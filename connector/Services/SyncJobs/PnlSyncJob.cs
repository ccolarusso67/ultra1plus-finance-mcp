using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs monthly Profit & Loss report from QuickBooks Desktop.
/// Uses GeneralSummaryReportQuery with ProfitAndLossStandard type.
///
/// First run: queries every month from StartYear (default 2020) to present,
/// giving full historical P&L for trend analysis.
/// Ongoing runs: queries the last 3 months (current + 2 prior) to keep
/// data fresh without hammering QuickBooks with years of reports every night.
/// </summary>
public class PnlSyncJob : ISyncJob
{
    public string Name => "pnl_sync";
    public string CompanyId => _companyId;

    private readonly string _connectionString;
    private readonly string _companyId;
    private readonly int _startYear;

    public PnlSyncJob(string connectionString, string companyId, int startYear = 2020)
    {
        _connectionString = connectionString;
        _companyId = companyId;
        _startYear = startYear;
    }

    public List<string> GetQbXmlRequests()
    {
        var requests = new List<string>();
        var now = DateTime.UtcNow;

        // Determine start date: check if we have any P&L data already
        // If not, do a full historical load from _startYear
        // If yes, only refresh the last 3 months (current + 2 prior)
        DateTime queryStart;
        try
        {
            using var conn = new NpgsqlConnection(_connectionString);
            conn.Open();
            using var cmd = new NpgsqlCommand(
                "SELECT COUNT(*) FROM monthly_pnl WHERE company_id = @cid", conn);
            cmd.Parameters.AddWithValue("cid", _companyId);
            var count = Convert.ToInt64(cmd.ExecuteScalar());

            if (count == 0)
            {
                // First run: full historical load
                queryStart = new DateTime(_startYear, 1, 1);
            }
            else
            {
                // Ongoing: refresh last 3 months (handles late adjustments)
                queryStart = new DateTime(now.Year, now.Month, 1).AddMonths(-2);
            }
        }
        catch
        {
            // If DB check fails, do full historical to be safe
            queryStart = new DateTime(_startYear, 1, 1);
        }

        for (var month = queryStart; month <= now; month = month.AddMonths(1))
        {
            var monthEnd = month.AddMonths(1).AddDays(-1);
            if (monthEnd > now) monthEnd = now;

            requests.Add($@"<?xml version=""1.0"" encoding=""utf-8""?>
            <?qbxml version=""16.0""?>
            <QBXML>
                <QBXMLMsgsRq onError=""continueOnError"">
                    <GeneralSummaryReportQueryRq>
                        <GeneralSummaryReportType>ProfitAndLossStandard</GeneralSummaryReportType>
                        <DisplayReport>false</DisplayReport>
                        <ReportPeriod>
                            <FromReportDate>{month:yyyy-MM-dd}</FromReportDate>
                            <ToReportDate>{monthEnd:yyyy-MM-dd}</ToReportDate>
                        </ReportPeriod>
                        <SummarizeColumnsBy>TotalOnly</SummarizeColumnsBy>
                        <ReportBasis>Accrual</ReportBasis>
                    </GeneralSummaryReportQueryRq>
                </QBXMLMsgsRq>
            </QBXML>");
        }

        return requests;
    }

    public async Task ProcessResponseAsync(string responseXml)
    {
        var doc = XDocument.Parse(responseXml);
        var reportRet = doc.Descendants("ReportRet").FirstOrDefault();
        if (reportRet == null) return;

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var reportPeriod = reportRet.Element("ReportPeriod");
        var fromDate = reportPeriod?.Element("FromReportDate")?.Value;
        if (fromDate == null) return;

        if (!DateTime.TryParse(fromDate, out var month)) return;
        var monthStart = new DateTime(month.Year, month.Month, 1);

        decimal income = 0, cogs = 0, grossProfit = 0;
        decimal operatingExpenses = 0, otherIncome = 0, otherExpenses = 0, netIncome = 0;

        var subtotalRows = reportRet.Descendants("SubtotalRow").ToList();
        var totalRows = reportRet.Descendants("TotalRow").ToList();

        foreach (var row in subtotalRows.Concat(totalRows))
        {
            var cols = row.Elements("ColData").ToList();
            if (cols.Count < 2) continue;

            var label = (cols[0].Attribute("value")?.Value ?? "").Trim().ToLower();
            var value = ParseDecimal(cols[1].Attribute("value")?.Value);

            if (label.Contains("total income") || label.Contains("total revenue"))
                income = value;
            else if (label.Contains("total cost of goods sold") || label.Contains("total cogs"))
                cogs = value;
            else if (label.Contains("gross profit"))
                grossProfit = value;
            else if (label.Contains("total expenses") || label.Contains("total operating expenses"))
                operatingExpenses = value;
            else if (label.Contains("total other income"))
                otherIncome = value;
            else if (label.Contains("total other expense"))
                otherExpenses = value;
            else if (label.Contains("net income") || label.Contains("net ordinary income"))
                netIncome = value;
        }

        if (grossProfit == 0 && income > 0)
            grossProfit = income - cogs;

        await using var cmd = new NpgsqlCommand(@"
            INSERT INTO monthly_pnl (company_id, month, report_basis, income, cogs, gross_profit,
                operating_expenses, other_income, other_expenses, net_income, snapshot_at)
            VALUES (@companyId, @month::date, 'accrual', @income, @cogs, @gross, @opex, @otherInc, @otherExp, @net, NOW())
            ON CONFLICT (company_id, month, report_basis) DO UPDATE SET
                income = EXCLUDED.income,
                cogs = EXCLUDED.cogs,
                gross_profit = EXCLUDED.gross_profit,
                operating_expenses = EXCLUDED.operating_expenses,
                other_income = EXCLUDED.other_income,
                other_expenses = EXCLUDED.other_expenses,
                net_income = EXCLUDED.net_income,
                snapshot_at = NOW()
        ", conn);

        cmd.Parameters.AddWithValue("companyId", _companyId);
        cmd.Parameters.AddWithValue("month", monthStart.ToString("yyyy-MM-dd"));
        cmd.Parameters.AddWithValue("income", income);
        cmd.Parameters.AddWithValue("cogs", cogs);
        cmd.Parameters.AddWithValue("gross", grossProfit);
        cmd.Parameters.AddWithValue("opex", operatingExpenses);
        cmd.Parameters.AddWithValue("otherInc", otherIncome);
        cmd.Parameters.AddWithValue("otherExp", otherExpenses);
        cmd.Parameters.AddWithValue("net", netIncome);

        await cmd.ExecuteNonQueryAsync();

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = 1, status = 'success', error_message = NULL
            WHERE company_id = @companyId AND job_name = 'pnl_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("companyId", _companyId);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
