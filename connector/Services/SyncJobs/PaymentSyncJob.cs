using System.Xml.Linq;
using System.Text.Json;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs received payments from QuickBooks Desktop.
/// Uses ReceivePaymentQuery qbXML request.
/// </summary>
public class PaymentSyncJob : ISyncJob
{
    public string Name => "payment_sync";
    public string CompanyId => _companyId;

    private readonly string _connectionString;
    private readonly string _companyId;

    public PaymentSyncJob(string connectionString, string companyId)
    {
        _connectionString = connectionString;
        _companyId = companyId;
    }

    public List<string> GetQbXmlRequests()
    {
        return new List<string>
        {
            @"<?xml version=""1.0"" encoding=""utf-8""?>
            <?qbxml version=""16.0""?>
            <QBXML>
                <QBXMLMsgsRq onError=""continueOnError"">
                    <ReceivePaymentQueryRq>
                        <ModifiedDateRangeFilter>
                            <FromModifiedDate>" + new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc).ToString("yyyy-MM-ddTHH:mm:ss") // historical backfill + @"</FromModifiedDate>
                        </ModifiedDateRangeFilter>
                        <IncludeLineItems>true</IncludeLineItems>
                        <OwnerID>0</OwnerID>
                    </ReceivePaymentQueryRq>
                </QBXMLMsgsRq>
            </QBXML>"
        };
    }

    public async Task ProcessResponseAsync(string responseXml)
    {
        var doc = XDocument.Parse(responseXml);
        var paymentRets = doc.Descendants("ReceivePaymentRet");

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var recordCount = 0;

        foreach (var pmt in paymentRets)
        {
            var txnId = pmt.Element("TxnID")?.Value ?? "";
            var customerId = pmt.Element("CustomerRef")?.Element("ListID")?.Value;
            var paymentDate = pmt.Element("TxnDate")?.Value;
            var amount = ParseDecimal(pmt.Element("TotalAmount")?.Value);
            var refNumber = pmt.Element("RefNumber")?.Value;
            var paymentMethod = pmt.Element("PaymentMethodRef")?.Element("FullName")?.Value;
            var depositTo = pmt.Element("DepositToAccountRef")?.Element("FullName")?.Value;
            var memo = pmt.Element("Memo")?.Value;

            var appliedRefs = new List<object>();
            foreach (var applied in pmt.Elements("AppliedToTxnRet"))
            {
                appliedRefs.Add(new
                {
                    txn_id = applied.Element("TxnID")?.Value,
                    ref_number = applied.Element("RefNumber")?.Value,
                    amount_applied = ParseDecimal(applied.Element("Amount")?.Value)
                });
            }
            var appliedJson = JsonSerializer.Serialize(appliedRefs);

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO payments (company_id, txn_id, customer_id, payment_date, amount, ref_number,
                    payment_method, deposit_to, memo, applied_invoice_refs, last_synced_at)
                VALUES (@companyId, @txnId, @custId, @date::date, @amount, @ref, @method,
                    @deposit, @memo, @applied::jsonb, NOW())
                ON CONFLICT (company_id, txn_id) DO UPDATE SET
                    amount = EXCLUDED.amount,
                    ref_number = EXCLUDED.ref_number,
                    payment_method = EXCLUDED.payment_method,
                    applied_invoice_refs = EXCLUDED.applied_invoice_refs,
                    last_synced_at = NOW()
            ", conn);

            cmd.Parameters.AddWithValue("companyId", _companyId);
            cmd.Parameters.AddWithValue("txnId", txnId);
            cmd.Parameters.AddWithValue("custId", (object?)customerId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("date", (object?)paymentDate ?? DBNull.Value);
            cmd.Parameters.AddWithValue("amount", amount);
            cmd.Parameters.AddWithValue("ref", (object?)refNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("method", (object?)paymentMethod ?? DBNull.Value);
            cmd.Parameters.AddWithValue("deposit", (object?)depositTo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("memo", (object?)memo ?? DBNull.Value);
            cmd.Parameters.AddWithValue("applied", appliedJson);

            await cmd.ExecuteNonQueryAsync();
            recordCount++;
        }

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE company_id = @companyId AND job_name = 'payment_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        statusCmd.Parameters.AddWithValue("companyId", _companyId);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
