using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs sales orders from QuickBooks Desktop.
/// Uses SalesOrderQuery qbXML request â returns open/modified sales orders.
///
/// Supports two modes:
///   - Incremental (default): queries last 7 days by ModifiedDateRangeFilter
///   - Full backfill: generates one request per year using TxnDateRangeFilter.
///     Set Backfill:Enabled = true in appsettings.json to activate.
/// </summary>
public class SalesOrderSyncJob : ISyncJob
{
    public string Name => "sales_order_sync";

    private readonly string _connectionString;
    private readonly bool _fullBackfill;
    private readonly int _backfillStartYear;
    private int _totalRecordsSynced;

    public SalesOrderSyncJob(string connectionString, bool fullBackfill = false, int backfillStartYear = 2020)
    {
        _connectionString = connectionString;
        _fullBackfill = fullBackfill;
        _backfillStartYear = backfillStartYear;
    }

    public List<string> GetQbXmlRequests()
    {
        if (_fullBackfill)
        {
            var requests = new List<string>();
            var currentYear = DateTime.UtcNow.Year;

            for (var year = _backfillStartYear; year <= currentYear; year++)
            {
                requests.Add($@"<?xml version=""1.0"" encoding=""utf-8""?>
            <?qbxml version=""16.0""?>
            <QBXML>
                <QBXMLMsgsRq onError=""continueOnError"">
                    <SalesOrderQueryRq>
                        <TxnDateRangeFilter>
                            <FromTxnDate>{year}-01-01</FromTxnDate>
                            <ToTxnDate>{year}-12-31</ToTxnDate>
                        </TxnDateRangeFilter>
                        <OwnerID>0</OwnerID>
                    </SalesOrderQueryRq>
                </QBXMLMsgsRq>
            </QBXML>");
            }

            return requests;
        }

        return new List<string>
        {
            @"<?xml version=""1.0"" encoding=""utf-8""?>
            <?qbxml version=""16.0""?>
            <QBXML>
                <QBXMLMsgsRq onError=""continueOnError"">
                    <SalesOrderQueryRq>
                        <ModifiedDateRangeFilter>
                            <FromModifiedDate>" + DateTime.UtcNow.AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ss") + @"</FromModifiedDate>
                        </ModifiedDateRangeFilter>
                        <OwnerID>0</OwnerID>
                    </SalesOrderQueryRq>
                </QBXMLMsgsRq>
            </QBXML>"
        };
    }

    public async Task ProcessResponseAsync(string responseXml)
    {
        var doc = XDocument.Parse(responseXml);
        var soRets = doc.Descendants("SalesOrderRet");

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var recordCount = 0;

        foreach (var so in soRets)
        {
            var txnId = so.Element("TxnID")?.Value ?? "";
            var refNumber = so.Element("RefNumber")?.Value;
            var customerId = so.Element("CustomerRef")?.Element("ListID")?.Value;
            var txnDate = so.Element("TxnDate")?.Value;
            var shipDate = so.Element("ShipDate")?.Value;
            var amount = ParseDecimal(so.Element("Subtotal")?.Value);
            var isManuallyClosed = so.Element("IsManuallyClosed")?.Value?.ToLower() == "true";
            var isFullyInvoiced = so.Element("IsFullyInvoiced")?.Value?.ToLower() == "true";
            var memo = so.Element("Memo")?.Value;

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO sales_orders (txn_id, ref_number, customer_id, txn_date, ship_date,
                    amount, is_fulfilled, is_closed, memo, last_synced_at)
                VALUES (@txnId, @ref, @custId, @txnDate::date, @shipDate::date,
                    @amount, @fulfilled, @closed, @memo, NOW())
                ON CONFLICT (txn_id) DO UPDATE SET
                    ref_number = EXCLUDED.ref_number,
                    ship_date = EXCLUDED.ship_date,
                    amount = EXCLUDED.amount,
                    is_fulfilled = EXCLUDED.is_fulfilled,
                    is_closed = EXCLUDED.is_closed,
                    last_synced_at = NOW()
            ", conn);

            cmd.Parameters.AddWithValue("txnId", txnId);
            cmd.Parameters.AddWithValue("ref", (object?)refNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("custId", (object?)customerId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("txnDate", (object?)txnDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("shipDate", (object?)shipDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("amount", amount);
            cmd.Parameters.AddWithValue("fulfilled", isFullyInvoiced);
            cmd.Parameters.AddWithValue("closed", isManuallyClosed || isFullyInvoiced);
            cmd.Parameters.AddWithValue("memo", (object?)memo ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();
            recordCount++;
        }

        _totalRecordsSynced += recordCount;

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE job_name = 'sales_order_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", _totalRecordsSynced);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
