using U1PFinanceSync.Models;

namespace U1PFinanceSync.Services;

/// <summary>
/// Registry of all configured QuickBooks company files.
/// Provides lookup by QBWC username (used during authenticate) and by company ID.
/// </summary>
public class CompanyRegistry
{
    private readonly Dictionary<string, CompanyConfig> _byUsername = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, CompanyConfig> _byCompanyId = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<CompanyConfig> _all = new();

    public CompanyRegistry(IConfiguration config, ILogger<CompanyRegistry> logger)
    {
        var companies = config.GetSection("Companies").Get<List<CompanyConfig>>()
            ?? throw new InvalidOperationException("No Companies configured in appsettings.json");

        foreach (var company in companies)
        {
            if (string.IsNullOrWhiteSpace(company.CompanyId))
                throw new InvalidOperationException("CompanyId is required for each company config");
            if (string.IsNullOrWhiteSpace(company.Username))
                throw new InvalidOperationException($"Username is required for company {company.CompanyId}");

            _byUsername[company.Username] = company;
            _byCompanyId[company.CompanyId] = company;
            _all.Add(company);

            logger.LogInformation("Registered company: {CompanyId} ({DisplayName}), user: {Username}",
                company.CompanyId, company.DisplayName, company.Username);
        }

        logger.LogInformation("CompanyRegistry loaded {Count} companies", _all.Count);
    }

    public CompanyConfig? GetByUsername(string username)
        => _byUsername.GetValueOrDefault(username);

    public CompanyConfig? GetByCompanyId(string companyId)
        => _byCompanyId.GetValueOrDefault(companyId);

    public IReadOnlyList<CompanyConfig> GetAll() => _all;
}
