using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs product catalog (inventory items) from QuickBooks Desktop.
/// Uses ItemQueryRq to get all inventory, non-inventory, and service items.
/// Also backfills invoice_lines.cost from product avg_cost.
/// </summary>
public class ProductSyncJob : ISyncJob
{
    public string Name => "product_sync";

    private readonly string _connectionString;

    public ProductSyncJob(string connectionString)
    {
        _connectionString = connectionString;
    }

    public List<string> GetQbXmlRequests()
    {
        // Query all item types: inventory, non-inventory, service
        return new List<string>
        {
            @"<?xml version=""1.0"" encoding=""utf-8""?>
            <?qbxml version=""16.0""?>
            <QBXML>
                <QBXMLMsgsRq onError=""continueOnError"">
                    <ItemQueryRq>
                        <ActiveStatus>All</ActiveStatus>
                        <OwnerID>0</OwnerID>
                    </ItemQueryRq>
                </QBXMLMsgsRq>
            </QBXML>"
        };
    }

    public async Task ProcessResponseAsync(string responseXml)
    {
        var doc = XDocument.Parse(responseXml);

        // QB returns different element names per item type
        var itemTypes = new[] {
            "ItemInventoryRet", "ItemNonInventoryRet", "ItemServiceRet",
            "ItemInventoryAssemblyRet", "ItemOtherChargeRet"
        };

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var recordCount = 0;

        foreach (var itemType in itemTypes)
        {
            foreach (var item in doc.Descendants(itemType))
            {
                var itemId = item.Element("ListID")?.Value ?? "";
                var name = item.Element("Name")?.Value ?? "";
                var fullName = item.Element("FullName")?.Value;
                var sku = item.Element("ManufacturerPartNumber")?.Value ?? name;
                var category = item.Element("ParentRef")?.Element("FullName")?.Value;
                var subcategory = item.Element("Sublevel")?.Value;
                var description = item.Element("SalesDesc")?.Value;
                var uom = item.Element("UnitOfMeasureSetRef")?.Element("FullName")?.Value;
                var listPrice = ParseDecimal(item.Element("SalesPrice")?.Value);
                var avgCost = ParseDecimal(item.Element("AverageCost")?.Value);
                var isActive = item.Element("IsActive")?.Value?.ToLower() != "false";

                await using var cmd = new NpgsqlCommand(@"
                    INSERT INTO product_catalog (item_id, sku, name, full_name, category, subcategory,
                        description, unit_of_measure, list_price, avg_cost, is_active, updated_at)
                    VALUES (@id, @sku, @name, @fullName, @category, @sub, @desc, @uom,
                        @price, @cost, @active, NOW())
                    ON CONFLICT (item_id) DO UPDATE SET
                        sku = EXCLUDED.sku,
                        name = EXCLUDED.name,
                        full_name = EXCLUDED.full_name,
                        category = EXCLUDED.category,
                        subcategory = EXCLUDED.subcategory,
                        description = EXCLUDED.description,
                        unit_of_measure = EXCLUDED.unit_of_measure,
                        list_price = EXCLUDED.list_price,
                        avg_cost = EXCLUDED.avg_cost,
                        is_active = EXCLUDED.is_active,
                        updated_at = NOW()
                ", conn);

                cmd.Parameters.AddWithValue("id", itemId);
                cmd.Parameters.AddWithValue("sku", sku);
                cmd.Parameters.AddWithValue("name", name);
                cmd.Parameters.AddWithValue("fullName", (object?)fullName ?? DBNull.Value);
                cmd.Parameters.AddWithValue("category", (object?)category ?? DBNull.Value);
                cmd.Parameters.AddWithValue("sub", (object?)subcategory ?? DBNull.Value);
                cmd.Parameters.AddWithValue("desc", (object?)description ?? DBNull.Value);
                cmd.Parameters.AddWithValue("uom", (object?)uom ?? DBNull.Value);
                cmd.Parameters.AddWithValue("price", listPrice);
                cmd.Parameters.AddWithValue("cost", avgCost);
                cmd.Parameters.AddWithValue("active", isActive);

                await cmd.ExecuteNonQueryAsync();
                recordCount++;
            }
        }

        // Backfill invoice_lines.cost from product_catalog.avg_cost
        // where cost is still 0 (not yet populated)
        await using var backfillCmd = new NpgsqlCommand(@"
            UPDATE invoice_lines il SET cost = pc.avg_cost
            FROM product_catalog pc
            WHERE il.item_id = pc.item_id
              AND il.cost = 0
              AND pc.avg_cost > 0
        ", conn);
        await backfillCmd.ExecuteNonQueryAsync();

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE job_name = 'product_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
