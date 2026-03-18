using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs bills (AP transactions) from QuickBooks Desktop.
/// Uses BillQuery qbXML request.
/// </summary>
public class BillSyncJob : ISyncJob
{
    public string Name => "bill_sync";

    private readonly string _connectionString;

    public BillSyncJob(string connectionString)
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
                    <BillQueryRq>
                        <ModifiedDateRangeFilter>
                            <FromModifiedDate>" + DateTime.UtcNow.AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ss") + @"</FromModifiedDate>
                        </ModifiedDateRangeFilter>
                        <OwnerID>0</OwnerID>
                    </BillQueryRq>
                </QBXMLMsgsRq>
            </QBXML>"
        };
    }

    public async Task ProcessResponseAsync(string responseXml)
    {
        var doc = XDocument.Parse(responseXml);
        var billRets = doc.Descendants("BillRet");

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var recordCount = 0;

        foreach (var bill in billRets)
        {
            var txnId = bill.Element("TxnID")?.Value ?? "";
            var vendorId = bill.Element("VendorRef")?.Element("ListID")?.Value;
            var vendorName = bill.Element("VendorRef")?.Element("FullName")?.Value ?? "";
            var refNumber = bill.Element("RefNumber")?.Value;
            var txnDate = bill.Element("TxnDate")?.Value;
            var dueDate = bill.Element("DueDate")?.Value;
            var amount = ParseDecimal(bill.Element("AmountDue")?.Value);
            var balanceRemaining = ParseDecimal(bill.Element("OpenAmount")?.Value);
            var isPaid = balanceRemaining == 0 && amount > 0;
            var memo = bill.Element("Memo")?.Value;

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO bills (txn_id, vendor_id, vendor_name, ref_number, txn_date,
                    due_date, amount, balance_remaining, is_paid, memo, last_synced_at)
                VALUES (@txnId, @vendorId, @vendorName, @ref, @txnDate::date,
                    @dueDate::date, @amount, @balance, @isPaid, @memo, NOW())
                ON CONFLICT (txn_id) DO UPDATE SET
                    vendor_name = EXCLUDED.vendor_name,
                    balance_remaining = EXCLUDED.balance_remaining,
                    is_paid = EXCLUDED.is_paid,
                    last_synced_at = NOW()
            ", conn);

            cmd.Parameters.AddWithValue("txnId", txnId);
            cmd.Parameters.AddWithValue("vendorId", (object?)vendorId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("vendorName", vendorName);
            cmd.Parameters.AddWithValue("ref", (object?)refNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("txnDate", (object?)txnDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("dueDate", (object?)dueDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("amount", amount);
            cmd.Parameters.AddWithValue("balance", balanceRemaining);
            cmd.Parameters.AddWithValue("isPaid", isPaid);
            cmd.Parameters.AddWithValue("memo", (object?)memo ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();
            recordCount++;
        }

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE job_name = 'bill_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
