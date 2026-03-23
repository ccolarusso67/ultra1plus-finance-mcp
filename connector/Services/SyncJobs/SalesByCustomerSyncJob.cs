using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs Sales by Customer Summary report from QuickBooks Desktop.
/// Uses GeneralSummaryReportQuery with SalesByCustomerSummary type.
///
/// First run: queries every quarter from StartYear (default 2020) to present,
/// giving full historical sales-by-customer data.
/// Ongoing runs: queries the current quarter + prior quarter to keep
/// data fresh and capture late entries.
/// </summary>
public class SalesByCustomerSyncJob : ISyncJob
{
    public string Name => "sales_by_customer_sync";
    public string CompanyId => _companyId;

    private readonly string _connectionString;
    private readonly string _companyId;
    private readonly int _startYear;

    public SalesByCustomerSyncJob(string connectionString, string companyId, int startYear = 2020)
    {
        _connectionString = connectionString;
        _companyId = companyId;
        _startYear = startYear;
    }

    public List<string> GetQbXmlRequests()
    {
        var requests = new List<string>();
        var now = DateTime.UtcNow;
        var currentQuarterStart = new DateTime(now.Year, ((now.Month - 1) / 3) * 3 + 1, 1);

        // Determine start: check if we have any data already
        DateTime queryStart;
        try
        {
            using var conn = new NpgsqlConnection(_connectionString);
            conn.Open();
            using var cmd = new NpgsqlCommand(
                "SELECT COUNT(*) FROM sales_by_customer WHERE company_id = @cid", conn);
            cmd.Parameters.AddWithValue("cid", _companyId);
            var count = Convert.ToInt64(cmd.ExecuteScalar());

            if (count == 0)
            {
                // First run: full historical load — every quarter from startYear
                queryStart = new DateTime(_startYear, 1, 1);
            }
            else
            {
                // Ongoing: refresh current quarter + prior quarter
                queryStart = currentQuarterStart.AddMonths(-3);
            }
        }
        catch
        {
            // If DB check fails, do full historical
            queryStart = new DateTime(_startYear, 1, 1);
        }

        // Generate one request per quarter from queryStart to current quarter
        for (var qStart = queryStart; qStart <= currentQuarterStart; qStart = qStart.AddMonths(3))
        {
            var qEnd = qStart.AddMonths(3).AddDays(-1);
            if (qEnd > now) qEnd = now;

            requests.Add($@"<?xml version=""1.0"" encoding=""utf-8""?>
            <?qbxml version=""16.0""?>
            <QBXML>
                <QBXMLMsgsRq onError=""continueOnError"">
                    <GeneralSummaryReportQueryRq>
                        <GeneralSummaryReportType>SalesByCustomerSummary</GeneralSummaryReportType>
                        <DisplayReport>false</DisplayReport>
                        <ReportPeriod>
                            <FromReportDate>{qStart:yyyy-MM-dd}</FromReportDate>
                            <ToReportDate>{qEnd:yyyy-MM-dd}</ToReportDate>
                        </ReportPeriod>
                        <SummarizeColumnsBy>TotalOnly</SummarizeColumnsBy>
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
        var periodStart = reportPeriod?.Element("FromReportDate")?.Value;
        var periodEnd = reportPeriod?.Element("ToReportDate")?.Value;
        if (string.IsNullOrWhiteSpace(periodStart) || string.IsNullOrWhiteSpace(periodEnd))
            return;

        var recordCount = 0;
        var rows = reportRet.Descendants("DataRow");

        foreach (var row in rows)
        {
            var cols = row.Elements("ColData").ToList();
            if (cols.Count < 2) continue;

            var customerName = cols[0].Attribute("value")?.Value ?? "";
            if (string.IsNullOrWhiteSpace(customerName) || customerName == "TOTAL") continue;

            var salesAmount = ParseDecimal(cols[1].Attribute("value")?.Value);

            // Look up customer_id (scoped to this company)
            await using var lookupCmd = new NpgsqlCommand(
                "SELECT customer_id FROM customers WHERE company_id = @companyId AND full_name = @name LIMIT 1", conn);
            lookupCmd.Parameters.AddWithValue("companyId", _companyId);
            lookupCmd.Parameters.AddWithValue("name", customerName);
            var customerId = (string?)await lookupCmd.ExecuteScalarAsync();

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO sales_by_customer
                    (company_id, customer_id, customer_name, period_start, period_end,
                     sales_amount, cogs_amount, gross_margin, order_count, snapshot_at)
                VALUES (@companyId, @custId, @name, @pStart::date, @pEnd::date,
                    @sales, 0, 0, 0, NOW())
                ON CONFLICT (company_id, customer_id, period_start, period_end) DO UPDATE SET
                    customer_name = EXCLUDED.customer_name,
                    sales_amount = EXCLUDED.sales_amount,
                    snapshot_at = NOW()
            ", conn);

            cmd.Parameters.AddWithValue("companyId", _companyId);
            cmd.Parameters.AddWithValue("custId", (object?)customerId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("name", customerName);
            cmd.Parameters.AddWithValue("pStart", periodStart);
            cmd.Parameters.AddWithValue("pEnd", periodEnd);
            cmd.Parameters.AddWithValue("sales", salesAmount);

            await cmd.ExecuteNonQueryAsync();
            recordCount++;
        }

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE company_id = @companyId AND job_name = 'sales_by_customer_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        statusCmd.Parameters.AddWithValue("companyId", _companyId);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
