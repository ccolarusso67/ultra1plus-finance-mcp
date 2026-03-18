using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs invoices and invoice line items from QuickBooks Desktop.
/// Uses InvoiceQuery qbXML request — returns full invoice objects with line items.
/// </summary>
public class InvoiceSyncJob : ISyncJob
{
    public string Name => "invoice_sync";

    private readonly string _connectionString;

    public InvoiceSyncJob(string connectionString)
    {
        _connectionString = connectionString;
    }

    public List<string> GetQbXmlRequests()
    {
        // Query invoices modified in the last 7 days for incremental sync.
        // On first run or full sync, remove the ModifiedDateRangeFilter.
        return new List<string>
        {
            @"<?xml version=""1.0"" encoding=""utf-8""?>
            <?qbxml version=""16.0""?>
            <QBXML>
                <QBXMLMsgsRq onError=""continueOnError"">
                    <InvoiceQueryRq>
                        <ModifiedDateRangeFilter>
                            <FromModifiedDate>" + DateTime.UtcNow.AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ss") + @"</FromModifiedDate>
                        </ModifiedDateRangeFilter>
                        <IncludeLineItems>true</IncludeLineItems>
                        <OwnerID>0</OwnerID>
                    </InvoiceQueryRq>
                </QBXMLMsgsRq>
            </QBXML>"
        };
    }

    public async Task ProcessResponseAsync(string responseXml)
    {
        var doc = XDocument.Parse(responseXml);
        var invoiceRets = doc.Descendants("InvoiceRet");

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        foreach (var inv in invoiceRets)
        {
            var txnId = inv.Element("TxnID")?.Value ?? "";
            var refNumber = inv.Element("RefNumber")?.Value;
            var customerId = inv.Element("CustomerRef")?.Element("ListID")?.Value;
            var txnDate = inv.Element("TxnDate")?.Value;
            var dueDate = inv.Element("DueDate")?.Value;
            var shipDate = inv.Element("ShipDate")?.Value;
            var amount = decimal.Parse(inv.Element("Subtotal")?.Value ?? "0");
            var balanceRemaining = decimal.Parse(inv.Element("BalanceRemaining")?.Value ?? "0");
            var isPaid = balanceRemaining == 0;
            var terms = inv.Element("TermsRef")?.Element("FullName")?.Value;
            var poNumber = inv.Element("PONumber")?.Value;
            var memo = inv.Element("Memo")?.Value;

            // Upsert invoice
            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO invoices (txn_id, ref_number, customer_id, txn_date, due_date,
                    ship_date, amount, balance_remaining, is_paid, terms, po_number, memo, last_synced_at)
                VALUES (@txnId, @refNumber, @customerId, @txnDate::date, @dueDate::date,
                    @shipDate::date, @amount, @balance, @isPaid, @terms, @po, @memo, NOW())
                ON CONFLICT (txn_id) DO UPDATE SET
                    ref_number = EXCLUDED.ref_number,
                    balance_remaining = EXCLUDED.balance_remaining,
                    is_paid = EXCLUDED.is_paid,
                    last_synced_at = NOW()
            ", conn);

            cmd.Parameters.AddWithValue("txnId", txnId);
            cmd.Parameters.AddWithValue("refNumber", (object?)refNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("customerId", (object?)customerId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("txnDate", (object?)txnDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("dueDate", (object?)dueDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("shipDate", (object?)shipDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("amount", amount);
            cmd.Parameters.AddWithValue("balance", balanceRemaining);
            cmd.Parameters.AddWithValue("isPaid", isPaid);
            cmd.Parameters.AddWithValue("terms", (object?)terms ?? DBNull.Value);
            cmd.Parameters.AddWithValue("po", (object?)poNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("memo", (object?)memo ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();

            // Delete existing line items for this invoice, then re-insert
            await using var delCmd = new NpgsqlCommand(
                "DELETE FROM invoice_lines WHERE invoice_txn_id = @txnId", conn);
            delCmd.Parameters.AddWithValue("txnId", txnId);
            await delCmd.ExecuteNonQueryAsync();

            // Process line items
            var lineNumber = 0;
            foreach (var line in inv.Elements("InvoiceLineRet"))
            {
                lineNumber++;
                var itemId = line.Element("ItemRef")?.Element("ListID")?.Value;
                var sku = line.Element("ItemRef")?.Element("FullName")?.Value;
                var description = line.Element("Desc")?.Value;
                var quantity = decimal.Parse(line.Element("Quantity")?.Value ?? "0");
                var unitPrice = decimal.Parse(line.Element("Rate")?.Value ?? "0");
                var lineTotal = decimal.Parse(line.Element("Amount")?.Value ?? "0");
                var className = line.Element("ClassRef")?.Element("FullName")?.Value;

                // Cost comes from the item, not the invoice line.
                // We'll join with product_catalog.avg_cost at query time,
                // or populate during product sync.
                var cost = 0m;

                await using var lineCmd = new NpgsqlCommand(@"
                    INSERT INTO invoice_lines (invoice_txn_id, line_number, item_id, sku,
                        description, quantity, unit_price, cost, line_total, class_name)
                    VALUES (@txnId, @lineNum, @itemId, @sku, @desc, @qty, @price, @cost, @total, @class)
                ", conn);

                lineCmd.Parameters.AddWithValue("txnId", txnId);
                lineCmd.Parameters.AddWithValue("lineNum", lineNumber);
                lineCmd.Parameters.AddWithValue("itemId", (object?)itemId ?? DBNull.Value);
                lineCmd.Parameters.AddWithValue("sku", (object?)sku ?? DBNull.Value);
                lineCmd.Parameters.AddWithValue("desc", (object?)description ?? DBNull.Value);
                lineCmd.Parameters.AddWithValue("qty", quantity);
                lineCmd.Parameters.AddWithValue("price", unitPrice);
                lineCmd.Parameters.AddWithValue("cost", cost);
                lineCmd.Parameters.AddWithValue("total", lineTotal);
                lineCmd.Parameters.AddWithValue("class", (object?)className ?? DBNull.Value);

                await lineCmd.ExecuteNonQueryAsync();
            }
        }

        // Update sync status
        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE job_name = 'invoice_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", invoiceRets.Count());
        await statusCmd.ExecuteNonQueryAsync();
    }
}
