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

    private readonly string _connectionString;

    public PriceLevelSyncJob(string connectionString)
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
                // Fixed percentage discount applied to all items
                var discountPct = ParseDecimal(pl.Element("PriceLevelFixedPercentage")?.Value);

                // Find customers assigned to this price level
                // QB doesn't directly return customer assignment in PriceLevelQuery,
                // but the price level name is referenced in CustomerRet.PriceLevelRef.
                // We store the price level with null customer_id and item_id
                // to represent the global discount.
                await using var cmd = new NpgsqlCommand(@"
                    INSERT INTO price_levels (price_level_name, customer_id, item_id, custom_price, discount_pct, updated_at)
                    VALUES (@name, NULL, NULL, NULL, @discount, NOW())
                    ON CONFLICT (price_level_name, customer_id, item_id)
                    DO UPDATE SET discount_pct = EXCLUDED.discount_pct, updated_at = NOW()
                ", conn);

                cmd.Parameters.AddWithValue("name", priceLevelName);
                cmd.Parameters.AddWithValue("discount", discountPct);

                await cmd.ExecuteNonQueryAsync();
                recordCount++;
            }
            else if (priceLevelType == "PerItem")
            {
                // Per-item custom pricing
                foreach (var itemEntry in pl.Elements("PriceLevelPerItemRet"))
                {
                    var itemId = itemEntry.Element("ItemRef")?.Element("ListID")?.Value;
                    var customPrice = ParseDecimal(itemEntry.Element("CustomPrice")?.Value);
                    var customPricePct = ParseDecimal(itemEntry.Element("CustomPricePercent")?.Value);

                    if (itemId == null) continue;

                    await using var cmd = new NpgsqlCommand(@"
                        INSERT INTO price_levels (price_level_name, customer_id, item_id, custom_price, discount_pct, updated_at)
                        VALUES (@name, NULL, @itemId, @price, @discount, NOW())
                        ON CONFLICT (price_level_name, customer_id, item_id)
                        DO UPDATE SET
                            custom_price = EXCLUDED.custom_price,
                            discount_pct = EXCLUDED.discount_pct,
                            updated_at = NOW()
                    ", conn);

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
            WHERE job_name = 'price_level_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
