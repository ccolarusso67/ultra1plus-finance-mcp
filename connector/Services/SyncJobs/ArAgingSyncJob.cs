using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs AR Aging Summary report from QuickBooks Desktop.
/// Uses ReportQuery qbXML request — returns the standard AR Aging Summary report.
/// </summary>
public class ArAgingSyncJob : ISyncJob
{
    public string Name => "ar_aging_sync";

    private readonly string _connectionString;

    public ArAgingSyncJob(string connectionString)
    {
        _connectionString = connectionString;
    }

    public List<string> GetQbXmlRequests()
    {
        return new List<string>
        {
            @"<?xml version=""1.0"" encoding=""utf-8""?>
            <?qbxml version=""16.0""?>
            <QBXML>
                <QBXMLMsgsRq onError=""continueOnError"">
                    <AgingReportQueryRq>
                        <AgingReportType>ARAgingSummary</AgingReportType>
                        <ReportAgingAsOf>" + DateTime.UtcNow.ToString("yyyy-MM-dd") + @"</ReportAgingAsOf>
                    </AgingReportQueryRq>
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

        var recordCount = 0;

        // Parse report rows — structure varies by QB version but typically:
        // Each ReportData row has ColData elements matching the report columns.
        // Column order for AR Aging: Customer, Current, 1-30, 31-60, 61-90, 91+, Total
        var rows = reportRet.Descendants("DataRow");

        foreach (var row in rows)
        {
            var cols = row.Elements("ColData").ToList();
            if (cols.Count < 7) continue;

            var customerName = cols[0].Attribute("value")?.Value ?? "";
            if (string.IsNullOrWhiteSpace(customerName) || customerName == "TOTAL") continue;

            var current = ParseDecimal(cols[1].Attribute("value")?.Value);
            var days1_30 = ParseDecimal(cols[2].Attribute("value")?.Value);
            var days31_60 = ParseDecimal(cols[3].Attribute("value")?.Value);
            var days61_90 = ParseDecimal(cols[4].Attribute("value")?.Value);
            var days91Plus = ParseDecimal(cols[5].Attribute("value")?.Value);
            var total = ParseDecimal(cols[6].Attribute("value")?.Value);

            // Look up customer_id by name
            await using var lookupCmd = new NpgsqlCommand(
                "SELECT customer_id FROM customers WHERE full_name = @name LIMIT 1", conn);
            lookupCmd.Parameters.AddWithValue("name", customerName);
            var customerId = (string?)await lookupCmd.ExecuteScalarAsync();

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO ar_aging_summary
                    (customer_id, customer_name, current_bucket, days_1_30, days_31_60,
                     days_61_90, days_91_plus, total_open_balance, snapshot_at)
                VALUES (@custId, @name, @current, @d1, @d2, @d3, @d4, @total, NOW())
            ", conn);

            cmd.Parameters.AddWithValue("custId", (object?)customerId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("name", customerName);
            cmd.Parameters.AddWithValue("current", current);
            cmd.Parameters.AddWithValue("d1", days1_30);
            cmd.Parameters.AddWithValue("d2", days31_60);
            cmd.Parameters.AddWithValue("d3", days61_90);
            cmd.Parameters.AddWithValue("d4", days91Plus);
            cmd.Parameters.AddWithValue("total", total);

            await cmd.ExecuteNonQueryAsync();
            recordCount++;
        }

        // Update sync status
        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE job_name = 'ar_aging_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
