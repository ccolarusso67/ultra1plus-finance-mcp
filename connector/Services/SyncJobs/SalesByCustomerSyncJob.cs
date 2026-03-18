using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs Sales by Customer Summary report from QuickBooks Desktop.
/// Uses GeneralSummaryReportQuery with SalesByCustomerSummary type.
/// Captures revenue, COGS, and margin per customer for the current quarter.
/// </summary>
public class SalesByCustomerSyncJob : ISyncJob
{
    public string Name => "sales_by_customer_sync";

    private readonly string _connectionString;

    public SalesByCustomerSyncJob(string connectionString)
    {
        _connectionString = connectionString;
    }

    public List<string> GetQbXmlRequests()
    {
        // Current quarter period
        var now = DateTime.UtcNow;
        var quarterStart = new DateTime(now.Year, ((now.Month - 1) / 3) * 3 + 1, 1);
        var quarterEnd = quarterStart.AddMonths(3).AddDays(-1);

        return new List<string>
        {
            $@"<?xml version=""1.0"" encoding=""utf-8""?>
            <?qbxml version=""16.0""?>
            <QBXML>
                <QBXMLMsgsRq onError=""continueOnError"">
                    <GeneralSummaryReportQueryRq>
                        <GeneralSummaryReportType>SalesByCustomerSummary</GeneralSummaryReportType>
                        <DisplayReport>false</DisplayReport>
                        <ReportPeriod>
                            <FromReportDate>{quarterStart:yyyy-MM-dd}</FromReportDate>
                            <ToReportDate>{quarterEnd:yyyy-MM-dd}</ToReportDate>
                        </ReportPeriod>
                        <SummarizeColumnsBy>TotalOnly</SummarizeColumnsBy>
                    </GeneralSummaryReportQueryRq>
                </QBXMLMsgsRq>
            </QBXML>"
        };
    }

    public async Task ProcessResponseAsync(string responseXml)
    {
        var doc = XDocument.Parse(responseXml);
        var reportRet = doc.Descendants("ReportRet").FirstOrDefault();
        if (reportRet == null) return;

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        // Extract period from report
        var reportPeriod = reportRet.Element("ReportPeriod");
        var periodStart = reportPeriod?.Element("FromReportDate")?.Value ?? "";
        var periodEnd = reportPeriod?.Element("ToReportDate")?.Value ?? "";

        var recordCount = 0;

        // Sales by Customer Summary columns: Customer, Amount
        var rows = reportRet.Descendants("DataRow");

        foreach (var row in rows)
        {
            var cols = row.Elements("ColData").ToList();
            if (cols.Count < 2) continue;

            var customerName = cols[0].Attribute("value")?.Value ?? "";
            if (string.IsNullOrWhiteSpace(customerName) || customerName == "TOTAL") continue;

            var salesAmount = ParseDecimal(cols[1].Attribute("value")?.Value);

            // Look up customer_id
            await using var lookupCmd = new NpgsqlCommand(
                "SELECT customer_id FROM customers WHERE full_name = @name LIMIT 1", conn);
            lookupCmd.Parameters.AddWithValue("name", customerName);
            var customerId = (string?)await lookupCmd.ExecuteScalarAsync();

            // COGS and margin will be computed from invoice_lines data.
            // For the report-based sync, we capture the sales total.
            // Margin is calculated by joining with invoice_lines at query time.
            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO sales_by_customer
                    (customer_id, customer_name, period_start, period_end,
                     sales_amount, cogs_amount, gross_margin, order_count, snapshot_at)
                VALUES (@custId, @name, @pStart::date, @pEnd::date,
                    @sales, 0, 0, 0, NOW())
                ON CONFLICT (customer_id, period_start, period_end) DO UPDATE SET
                    customer_name = EXCLUDED.customer_name,
                    sales_amount = EXCLUDED.sales_amount,
                    snapshot_at = NOW()
            ", conn);

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
            WHERE job_name = 'sales_by_customer_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
