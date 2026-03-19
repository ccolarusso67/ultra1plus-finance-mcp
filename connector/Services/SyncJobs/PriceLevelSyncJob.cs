using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs price levels from QuickBooks Desktop.
/// Uses PriceLevelQuery to get customer-specific pricing and discounts.
/// </summary>
public class PriceLevelSyncJob : ISyncJob
{
    public string Name => "price_level_sync";
    public string CompanyId => _companyId;

    private readonly string _connectionString;
    private readonly string _companyId;

    public PriceLevelSyncJob(string connectionString, string companyId)
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
                    <PriceLevelQueryRq>
                        <OwnerID>0</OwnerID>
                    </PriceLevelQueryRq>
                </QBXMLMsgsRq>
            </QBXML>"
        };
    }

    public async Task ProcessResponseAsync(string responseXml)
    {
        var doc = XDocument.Parse(responseXml);
        var priceLevelRets = doc.Descendants("PriceLevelRet");

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var recordCount = 0;

        foreach (var pl in priceLevelRets)
        {
            var priceLevelName = pl.Element("Name")?.Value ?? "";
            var priceLevelType = pl.Element("PriceLevelType")?.Value;

            if (priceLevelType == "FixedPercentage")
            {
                var discountPct = ParseDecimal(pl.Element("PriceLevelFixedPercentage")?.Value);

                await using var cmd = new NpgsqlCommand(@"
                    INSERT INTO price_levels (company_id, price_level_name, customer_id, item_id, custom_price, discount_pct, updated_at)
                    VALUES (@companyId, @name, NULL, NULL, NULL, @discount, NOW())
                    ON CONFLICT (company_id, price_level_name, customer_id, item_id)
                    DO UPDATE SET discount_pct = EXCLUDED.discount_pct, updated_at = NOW()
                ", conn);

                cmd.Parameters.AddWithValue("companyId", _companyId);
                cmd.Parameters.AddWithValue("name", priceLevelName);
                cmd.Parameters.AddWithValue("discount", discountPct);

                await cmd.ExecuteNonQueryAsync();
                recordCount++;
            }
            else if (priceLevelType == "PerItem")
            {
                foreach (var itemEntry in pl.Elements("PriceLevelPerItemRet"))
                {
                    var itemId = itemEntry.Element("ItemRef")?.Element("ListID")?.Value;
                    var customPrice = ParseDecimal(itemEntry.Element("CustomPrice")?.Value);
                    var customPricePct = ParseDecimal(itemEntry.Element("CustomPricePercent")?.Value);

                    if (itemId == null) continue;

                    await using var cmd = new NpgsqlCommand(@"
                        INSERT INTO price_levels (company_id, price_level_name, customer_id, item_id, custom_price, discount_pct, updated_at)
                        VALUES (@companyId, @name, NULL, @itemId, @price, @discount, NOW())
                        ON CONFLICT (company_id, price_level_name, customer_id, item_id)
                        DO UPDATE SET
                            custom_price = EXCLUDED.custom_price,
                            discount_pct = EXCLUDED.discount_pct,
                            updated_at = NOW()
                    ", conn);

                    cmd.Parameters.AddWithValue("companyId", _companyId);
                    cmd.Parameters.AddWithValue("name", priceLevelName);
                    cmd.Parameters.AddWithValue("itemId", itemId);
                    cmd.Parameters.AddWithValue("price", customPrice > 0 ? customPrice : (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("discount", customPricePct > 0 ? customPricePct : (object)DBNull.Value);

                    await cmd.ExecuteNonQueryAsync();
                    recordCount++;
                }
            }
        }

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE company_id = @companyId AND job_name = 'price_level_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        statusCmd.Parameters.AddWithValue("companyId", _companyId);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
