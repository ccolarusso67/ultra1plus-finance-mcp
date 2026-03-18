using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs customer records from QuickBooks Desktop.
/// Uses CustomerQuery qbXML request — returns full customer objects.
/// </summary>
public class CustomerSyncJob : ISyncJob
{
    public string Name => "customer_sync";

    private readonly string _connectionString;

    public CustomerSyncJob(string connectionString)
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
                    <CustomerQueryRq>
                        <ActiveStatus>All</ActiveStatus>
                        <OwnerID>0</OwnerID>
                    </CustomerQueryRq>
                </QBXMLMsgsRq>
            </QBXML>"
        };
    }

    public async Task ProcessResponseAsync(string responseXml)
    {
        var doc = XDocument.Parse(responseXml);
        var customerRets = doc.Descendants("CustomerRet");

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var recordCount = 0;

        foreach (var cust in customerRets)
        {
            var listId = cust.Element("ListID")?.Value ?? "";
            var fullName = cust.Element("FullName")?.Value ?? "";
            var companyName = cust.Element("CompanyName")?.Value;
            var terms = cust.Element("TermsRef")?.Element("FullName")?.Value;
            var creditLimit = ParseDecimal(cust.Element("CreditLimit")?.Value);
            var balance = ParseDecimal(cust.Element("Balance")?.Value);
            var isActive = cust.Element("IsActive")?.Value?.ToLower() == "true";
            var email = cust.Element("Email")?.Value;
            var phone = cust.Element("Phone")?.Value;

            var billAddr = cust.Element("BillAddress");
            var billingAddress = billAddr != null
                ? string.Join(", ",
                    new[] { billAddr.Element("Addr1")?.Value, billAddr.Element("Addr2")?.Value,
                            billAddr.Element("City")?.Value, billAddr.Element("State")?.Value,
                            billAddr.Element("PostalCode")?.Value }
                    .Where(s => !string.IsNullOrWhiteSpace(s)))
                : null;

            var shipAddr = cust.Element("ShipAddress");
            var shippingAddress = shipAddr != null
                ? string.Join(", ",
                    new[] { shipAddr.Element("Addr1")?.Value, shipAddr.Element("Addr2")?.Value,
                            shipAddr.Element("City")?.Value, shipAddr.Element("State")?.Value,
                            shipAddr.Element("PostalCode")?.Value }
                    .Where(s => !string.IsNullOrWhiteSpace(s)))
                : null;

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO customers (customer_id, full_name, company_name, terms, credit_limit,
                    balance, is_active, email, phone, billing_address, shipping_address, updated_at)
                VALUES (@id, @name, @company, @terms, @creditLimit, @balance, @active,
                    @email, @phone, @billAddr, @shipAddr, NOW())
                ON CONFLICT (customer_id) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    company_name = EXCLUDED.company_name,
                    terms = EXCLUDED.terms,
                    credit_limit = EXCLUDED.credit_limit,
                    balance = EXCLUDED.balance,
                    is_active = EXCLUDED.is_active,
                    email = EXCLUDED.email,
                    phone = EXCLUDED.phone,
                    billing_address = EXCLUDED.billing_address,
                    shipping_address = EXCLUDED.shipping_address,
                    updated_at = NOW()
            ", conn);

            cmd.Parameters.AddWithValue("id", listId);
            cmd.Parameters.AddWithValue("name", fullName);
            cmd.Parameters.AddWithValue("company", (object?)companyName ?? DBNull.Value);
            cmd.Parameters.AddWithValue("terms", (object?)terms ?? DBNull.Value);
            cmd.Parameters.AddWithValue("creditLimit", creditLimit);
            cmd.Parameters.AddWithValue("balance", balance);
            cmd.Parameters.AddWithValue("active", isActive);
            cmd.Parameters.AddWithValue("email", (object?)email ?? DBNull.Value);
            cmd.Parameters.AddWithValue("phone", (object?)phone ?? DBNull.Value);
            cmd.Parameters.AddWithValue("billAddr", (object?)billingAddress ?? DBNull.Value);
            cmd.Parameters.AddWithValue("shipAddr", (object?)shippingAddress ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();
            recordCount++;
        }

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE job_name = 'customer_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
