using System.Text.Json;

namespace ClayNest.Infrastructure.Catalog;

internal sealed record CatalogImage(string Path, string SourceUrl, string Sha256);
internal sealed record CatalogEntry(string Name, string Slug, string CategoryName, string CategorySlug, string Sku,
    long PriceVnd, long? OriginalPriceVnd, string Image, List<CatalogImage> Images, string Glaze, string IntendedUse,
    string Description, string CraftStory, string Label, string Material, string HandmadeNote,
    string SourceUrl, string SourceName, string SourceDimensions, string SourceAvailability, string PriceUnit, decimal? HeightCm,
    bool IsAuthored = false, int? CapacityMl = null, decimal? WidthCm = null, int? WeightG = null, string VariantName = "Tiêu chuẩn");
internal sealed record LegacyCatalogEntry(string Slug, string Description);

internal static class CatalogContent
{
    private static readonly Lazy<IReadOnlyList<CatalogEntry>> Entries = new(() =>
    {
        using var stream = typeof(CatalogContent).Assembly.GetManifestResourceStream("ClayNest.Infrastructure.Catalog.catalog.json")
            ?? throw new InvalidOperationException("Catalog content is missing from the deployment.");
        return JsonSerializer.Deserialize<List<CatalogEntry>>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? throw new InvalidOperationException("Catalog content is invalid.");
    });
    public static IReadOnlyList<LegacyCatalogEntry> Legacy()
    {
        using var stream = typeof(CatalogContent).Assembly.GetManifestResourceStream("ClayNest.Infrastructure.Catalog.legacy-content.json")!;
        return JsonSerializer.Deserialize<List<LegacyCatalogEntry>>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
    }
    public static IReadOnlyList<CatalogEntry> Load() => Entries.Value;
}
