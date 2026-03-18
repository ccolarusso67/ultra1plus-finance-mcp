using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs monthly Profit & Loss report from QuickBooks Desktop.
/// Uses GeneralSummaryReportQuery with ProfitAndLossStandard type.
/// Runs nightly — captures each month's P&L for the current fiscal year.
/// </summary>
public class PnlSyncJob : ISyncJob
{
    public string Name => "pnl_sync";

    private readonly string _connectionString;

    public PnlSyncJob(string connectionString)
    {
        _connectionString = connectionString;
    }

    public List<string> GetQbXmlRequests()
    {
        // Request P&L for each month of the current year
        var requests = new List<string>();
        var now = DateTime.UtcNow;
        var yearStart = new DateTime(now.Year, 1, 1);

        for (var month = yearStart; month <= now; month = month.AddMonths(1))
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

        // Extract the report period from the response
        var reportPeriod = reportRet.Element("ReportPeriod");
        var fromDate = reportPeriod?.Element("FromReportDate")?.Value;
        if (fromDate == null) return;

        // Parse the month from the period start
        var month = DateTime.Parse(fromDate);
        var monthStart = new DateTime(month.Year, month.Month, 1);

        // Parse report rows to extract key P&L figures
        decimal income = 0, cogs = 0, grossProfit = 0;
        decimal operatingExpenses = 0, otherIncome = 0, otherExpenses = 0, netIncome = 0;

        var rows = reportRet.Descendants("DataRow").ToList();
        var subtotalRows = reportRet.Descendants("SubtotalRow").ToList();
        var totalRows = reportRet.Descendants("TotalRow").ToList();

        // QB P&L report structure uses section labels to categorize rows.
        // We look for key summary rows by their RowData label.
        foreach (var row in subtotalRows.Concat(totalRows))
        {
            var rowData = row.Element("RowData") ?? row.Elements("ColData").FirstOrDefault()?.Parent;
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

        // If gross profit wasn't explicitly reported, calculate it
        if (grossProfit == 0 && income > 0)
            grossProfit = income - cogs;

        await using var cmd = new NpgsqlCommand(@"
            INSERT INTO monthly_pnl (month, report_basis, income, cogs, gross_profit,
                operating_expenses, other_income, other_expenses, net_income, snapshot_at)
            VALUES (@month, 'accrual', @income, @cogs, @gross, @opex, @otherInc, @otherExp, @net, NOW())
            ON CONFLICT (month, report_basis) DO UPDATE SET
                income = EXCLUDED.income,
                cogs = EXCLUDED.cogs,
                gross_profit = EXCLUDED.gross_profit,
                operating_expenses = EXCLUDED.operating_expenses,
                other_income = EXCLUDED.other_income,
                other_expenses = EXCLUDED.other_expenses,
                net_income = EXCLUDED.net_income,
                snapshot_at = NOW()
        ", conn);

        cmd.Parameters.AddWithValue("month", monthStart);
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
            WHERE job_name = 'pnl_sync'
        ", conn);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
