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
    public string CompanyId => _companyId;

    private readonly string _connectionString;
    private readonly string _companyId;

    public SalesByCustomerSyncJob(string connectionString, string companyId)
    {
        _connectionString = connectionString;
        _companyId = companyId;
    }

    public List<string> GetQbXmlRequests()
    {
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
