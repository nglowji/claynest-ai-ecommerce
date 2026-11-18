namespace ClayNest.Application.Catalog;

public sealed record CategoryDto(Guid Id, string Name, string Slug, bool Active, Guid Revision);
public sealed record CategoryInput(string Name, string Slug, bool Active, Guid? Revision = null);
public sealed record VariantInput(Guid? Id, string Sku, string Name, string Glaze, string IntendedUse,
    int? CapacityMl, decimal? WidthCm, decimal? HeightCm, int? WeightG, long PriceVnd, long? OriginalPriceVnd,
    bool Active, string CareNote = "", string CareSource = "", bool CareVerified = false);
public sealed record ImageInput(string Url, string Alt, Guid? VariantId = null);
public sealed record ProductInput(Guid CategoryId, string Name, string Slug, string Description,
    string CraftStory, string Material, string HandmadeNote, string Label, bool Published,
    List<VariantInput> Variants, List<ImageInput> Images, Guid? Revision = null);
public sealed record VariantDto(Guid Id, string Sku, string Name, string Glaze, string IntendedUse,
    int? CapacityMl, decimal? WidthCm, decimal? HeightCm, int? WeightG, long PriceVnd, long? OriginalPriceVnd,
    int DiscountPercent, int StockQty, bool Active, string CareNote, string CareSource, bool CareVerified);
public sealed record ImageDto(Guid Id, string Url, string Alt, int SortOrder, Guid? VariantId);
public sealed record ProductDto(Guid Id, Guid CategoryId, string Category, string Name, string Slug,
    string Description, string CraftStory, string Material, string HandmadeNote, string Label,
    bool Published, bool Archived, bool IsDemo, Guid Revision, DateTimeOffset UpdatedAt,
    List<VariantDto> Variants, List<ImageDto> Images, string SourceUrl, string SourceName, string SourceDimensions, string SourceAvailability, string PriceUnit);
public sealed record PageResult<T>(List<T> Items, int Page, int PageSize, int TotalCount);
public sealed record CatalogQuery(string? Q = null, string? Category = null, long? MinPrice = null,
    long? MaxPrice = null, string? Glaze = null, string? Use = null, bool InStock = false,
    bool Sale = false, string Sort = "default", int Page = 1, int PageSize = 12);
public sealed class CatalogConflictException(string message) : Exception(message);
public interface ICatalogService
{
    Task<List<CategoryDto>> CategoriesAsync(bool admin, CancellationToken ct);
    Task<CategoryDto> SaveCategoryAsync(Guid? id, CategoryInput input, CancellationToken ct);
    Task<PageResult<ProductDto>> SearchAsync(CatalogQuery query, bool admin, CancellationToken ct);
    Task<ProductDto?> FindAsync(string slugOrId, bool admin, CancellationToken ct);
    Task<ProductDto> SaveProductAsync(Guid? id, ProductInput input, CancellationToken ct);
    Task ArchiveAsync(Guid id, Guid revision, CancellationToken ct);
    Task SeedAsync(CancellationToken ct);
    Task RefreshContentAsync(CancellationToken ct);
    Task RemoveSourceImagesAsync(CancellationToken ct);
}
public sealed record StoredImage(string Url);
public interface ICatalogImageStorage
{
    Task<StoredImage> StoreAsync(Stream stream, string contentType, long length, CancellationToken ct);
}
