using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs AR Aging Summary report from QuickBooks Desktop.
/// Uses ReportQuery qbXML request â returns the standard AR Aging Summary report.
/// </summary>
public class ArAgingSyncJob : ISyncJob
{
    public string Name => "ar_aging_sync";
    public string CompanyId => _companyId;

    private readonly string _connectionString;
    private readonly string _companyId;

    public ArAgingSyncJob(string connectionString, string companyId)
    {
        _connectionString = connectionString;
        _companyId = companyId;
    }

    public List<string> GetQbXmlRequests()
    {
        return new List<string>
        {
            @"<?xml version=""1.0"" encoding=""utf-8""?>
            <?qbxml version=""17.0""?>
            <QBXML>
                <QBXMLMsgsRq onError=""continueOnError"">
                    <AgingReportQueryRq>
                        <AgingReportType>ARAgingSummary</AgingReportType>
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

            // Look up customer_id by name (scoped to this company)
            await using var lookupCmd = new NpgsqlCommand(
                "SELECT customer_id FROM customers WHERE company_id = @companyId AND full_name = @name LIMIT 1", conn);
            lookupCmd.Parameters.AddWithValue("companyId", _companyId);
            lookupCmd.Parameters.AddWithValue("name", customerName);
            var customerId = (string?)await lookupCmd.ExecuteScalarAsync();

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO ar_aging_summary
                    (company_id, customer_id, customer_name, current_bucket, days_1_30, days_31_60,
                     days_61_90, days_91_plus, total_open_balance, snapshot_at)
                VALUES (@companyId, @custId, @name, @current, @d1, @d2, @d3, @d4, @total, NOW())
            ", conn);

            cmd.Parameters.AddWithValue("companyId", _companyId);
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

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE company_id = @companyId AND job_name = 'ar_aging_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        statusCmd.Parameters.AddWithValue("companyId", _companyId);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO ar_aging_summary
                    (company_id, customer_id, customer_name, current_bucket, days_1_30, days_31_60,
                     days_61_90, days_91_plus, total_open_balance, snapshot_at)
                VALUES (@companyId, @custId, @name, @current, @d1, @d2, @d3, @d4, @total, NOW())
            ", conn);

            cmd.Parameters.AddWithValue("companyId", _companyId);
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

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE company_id = @companyId AND job_name = 'ar_aging_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        statusCmd.Parameters.AddWithValue("companyId", _companyId);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
