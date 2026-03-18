using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs AP Aging Summary report from QuickBooks Desktop.
/// Uses AgingReportQuery with APAgingSummary type.
/// </summary>
public class ApAgingSyncJob : ISyncJob
{
    public string Name => "ap_aging_sync";

    private readonly string _connectionString;

    public ApAgingSyncJob(string connectionString)
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
                        <AgingReportType>APAgingSummary</AgingReportType>
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

        // Column order for AP Aging: Vendor, Current, 1-30, 31-60, 61-90, 91+, Total
        var rows = reportRet.Descendants("DataRow");

        foreach (var row in rows)
        {
            var cols = row.Elements("ColData").ToList();
            if (cols.Count < 7) continue;

            var vendorName = cols[0].Attribute("value")?.Value ?? "";
            if (string.IsNullOrWhiteSpace(vendorName) || vendorName == "TOTAL") continue;

            var current = ParseDecimal(cols[1].Attribute("value")?.Value);
            var days1_30 = ParseDecimal(cols[2].Attribute("value")?.Value);
            var days31_60 = ParseDecimal(cols[3].Attribute("value")?.Value);
            var days61_90 = ParseDecimal(cols[4].Attribute("value")?.Value);
            var days91Plus = ParseDecimal(cols[5].Attribute("value")?.Value);
            var total = ParseDecimal(cols[6].Attribute("value")?.Value);

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO ap_aging_summary
                    (vendor_name, current_bucket, days_1_30, days_31_60,
                     days_61_90, days_91_plus, total_open_balance, snapshot_at)
                VALUES (@name, @current, @d1, @d2, @d3, @d4, @total, NOW())
            ", conn);

            cmd.Parameters.AddWithValue("name", vendorName);
            cmd.Parameters.AddWithValue("current", current);
            cmd.Parameters.AddWithValue("d1", days1_30);
            cmd.Parameters.AddWithValue("d2", days31_60);
            cmd.Parameters.AddWithValue("d3", days61_90);
            cmd.Parameters.AddWithValue("d4", days91Plus);
            cmd.Parameters.AddWithValue("total", total);

            await cmd.ExecuteNonQueryAsync();
            recordCount++;
        }

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE job_name = 'ap_aging_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
