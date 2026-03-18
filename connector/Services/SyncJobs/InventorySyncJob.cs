using System.Xml.Linq;
using Npgsql;

namespace U1PFinanceSync.Services.SyncJobs;

/// <summary>
/// Syncs inventory stock status from QuickBooks Desktop.
/// Uses ItemInventoryQuery to get current stock levels.
/// </summary>
public class InventorySyncJob : ISyncJob
{
    public string Name => "inventory_sync";

    private readonly string _connectionString;

    public InventorySyncJob(string connectionString)
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
                    <ItemInventoryQueryRq>
                        <ActiveStatus>ActiveOnly</ActiveStatus>
                        <OwnerID>0</OwnerID>
                    </ItemInventoryQueryRq>
                </QBXMLMsgsRq>
            </QBXML>"
        };
    }

    public async Task ProcessResponseAsync(string responseXml)
    {
        var doc = XDocument.Parse(responseXml);
        var itemRets = doc.Descendants("ItemInventoryRet");

        await using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var recordCount = 0;

        foreach (var item in itemRets)
        {
            var itemId = item.Element("ListID")?.Value ?? "";
            var sku = item.Element("Name")?.Value;
            var name = item.Element("FullName")?.Value ?? "";
            var category = item.Element("ParentRef")?.Element("FullName")?.Value;
            var qoh = ParseDecimal(item.Element("QuantityOnHand")?.Value);
            var qos = ParseDecimal(item.Element("QuantityOnSalesOrder")?.Value);
            var available = qoh - qos;
            var reorderPoint = ParseDecimal(item.Element("ReorderPoint")?.Value);
            var avgCost = ParseDecimal(item.Element("AverageCost")?.Value);
            var assetValue = qoh * avgCost;

            await using var cmd = new NpgsqlCommand(@"
                INSERT INTO inventory_summary
                    (item_id, sku, name, category, quantity_on_hand, quantity_on_sales_order,
                     quantity_available, reorder_point, avg_cost, last_cost, asset_value, snapshot_at)
                VALUES (@itemId, @sku, @name, @category, @qoh, @qos, @available,
                    @reorder, @avgCost, @avgCost, @assetValue, NOW())
            ", conn);

            cmd.Parameters.AddWithValue("itemId", itemId);
            cmd.Parameters.AddWithValue("sku", (object?)sku ?? DBNull.Value);
            cmd.Parameters.AddWithValue("name", name);
            cmd.Parameters.AddWithValue("category", (object?)category ?? DBNull.Value);
            cmd.Parameters.AddWithValue("qoh", qoh);
            cmd.Parameters.AddWithValue("qos", qos);
            cmd.Parameters.AddWithValue("available", available);
            cmd.Parameters.AddWithValue("reorder", reorderPoint);
            cmd.Parameters.AddWithValue("avgCost", avgCost);
            cmd.Parameters.AddWithValue("assetValue", assetValue);

            await cmd.ExecuteNonQueryAsync();
            recordCount++;
        }

        await using var statusCmd = new NpgsqlCommand(@"
            UPDATE sync_status SET
                last_run_at = NOW(), last_success_at = NOW(),
                records_synced = @count, status = 'success', error_message = NULL
            WHERE job_name = 'inventory_sync'
        ", conn);
        statusCmd.Parameters.AddWithValue("count", recordCount);
        await statusCmd.ExecuteNonQueryAsync();
    }

    private static decimal ParseDecimal(string? value) =>
        decimal.TryParse(value, out var result) ? result : 0m;
}
