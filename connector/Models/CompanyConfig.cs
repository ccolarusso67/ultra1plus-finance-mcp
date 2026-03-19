namespace U1PFinanceSync.Models;

/// <summary>
/// Configuration for a single QuickBooks company file.
/// Loaded from the "Companies" array in appsettings.json.
/// </summary>
public class CompanyConfig
{
    public string CompanyId { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string ShortCode { get; set; } = "";
    public string CompanyFile { get; set; } = "";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public Dictionary<string, string> SyncSchedule { get; set; } = new();
}
