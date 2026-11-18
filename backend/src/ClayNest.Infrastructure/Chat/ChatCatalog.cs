using ClayNest.Application.Chat;
using ClayNest.Domain.Catalog;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace ClayNest.Infrastructure.Chat;

public sealed class ChatCatalog(CommerceDbContext db) : IChatCatalog
{
    public async Task<ChatContext> ContextAsync(CancellationToken ct)
    {
        var entries = await db.Products.AsNoTracking()
            .Where(p => p.Published && !p.Archived && p.Category.Active && p.Variants.Any(v => v.Active))
            .OrderBy(p => p.Slug).Select(p => new CatalogIndexEntry(p.Name, p.Slug, p.Category.Slug, p.Material))
            .Take(101).ToListAsync(ct);
        return new(StoreKnowledge.Articles.ToList(), entries.Take(100).ToList(), entries.Count > 100);
    }

    public static void Validate(ChatFilters f)
    {
        if (f.Q?.Length > 180 || f.Category?.Length > 100 || f.Glaze?.Length > 120 || f.Use?.Length > 160
            || f.MinPrice is < 0 or > 1000000000 || f.MaxPrice is < 0 or > 1000000000 || f.MinPrice > f.MaxPrice
            || f.MaxHeightCm is < 0.01m or > 1000 || f.MinCapacityMl is < 1 or > 100000)
            throw new ChatValidationException("Bộ lọc tư vấn không hợp lệ.");
    }
    private IQueryable<ChatFact> Facts(ChatFilters f)
    {
        Validate(f);
        var variants = db.Set<ProductVariant>().AsNoTracking().Where(v => v.Active);
        if (f.InStock) variants = variants.Where(v => v.StockQty > 0);
        if (f.MinPrice.HasValue) variants = variants.Where(v => v.PriceVnd >= f.MinPrice);
        if (f.MaxPrice.HasValue) variants = variants.Where(v => v.PriceVnd <= f.MaxPrice);
        if (f.MaxHeightCm.HasValue) variants = variants.Where(v => v.HeightCm != null && v.HeightCm <= f.MaxHeightCm);
        if (f.MinCapacityMl.HasValue) variants = variants.Where(v => v.CapacityMl != null && v.CapacityMl >= f.MinCapacityMl);
        if (!string.IsNullOrWhiteSpace(f.Glaze)) variants = variants.Where(v => v.Glaze.ToLower().Contains(f.Glaze.ToLower()));
        if (!string.IsNullOrWhiteSpace(f.Use)) variants = variants.Where(v => v.IntendedUse.ToLower().Contains(f.Use.ToLower()));
        var products = db.Products.Where(p => p.Published && !p.Archived && p.Category.Active);
        if (!string.IsNullOrWhiteSpace(f.Category)) products = products.Where(p => p.Category.Slug == f.Category || p.Category.Name == f.Category);
        if (!string.IsNullOrWhiteSpace(f.Q)) { var term = Product.NormalizeSearch(f.Q.Trim()); products = products.Where(p => p.SearchText.Contains(term)); }
        return from v in variants join p in products on v.ProductId equals p.Id
            select new ChatFact(default,default,"","","","","","","","",0,0,null,null,"") {
                VariantId=v.Id, ProductId=p.Id, Name=p.Name, Slug=p.Slug, Sku=v.Sku, VariantName=v.Name,
                Description=p.Description.Substring(0,Math.Min(350,p.Description.Length)), Material=p.Material,
                Glaze=v.Glaze, Use=v.IntendedUse, PriceVnd=v.PriceVnd, StockQty=v.StockQty, HeightCm=v.HeightCm, CapacityMl=v.CapacityMl,
                Image=p.Images.Where(i => i.VariantId == null || i.VariantId == v.Id).OrderByDescending(i => i.VariantId == v.Id).ThenBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault() ?? "" };
    }
    public async Task<List<ChatFact>> SearchAsync(ChatFilters filters,CancellationToken ct) => await Facts(filters).OrderBy(v => v.PriceVnd).ThenBy(v => v.Sku).Take(8).ToListAsync(ct);
    public async Task<List<ChatFact>> DetailAsync(string slug,CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(slug) || slug.Length > 140 || !System.Text.RegularExpressions.Regex.IsMatch(slug,"^[a-z0-9-]+$")) throw new ChatValidationException("Đường dẫn sản phẩm không hợp lệ.");
        return await Facts(new(InStock:false)).Where(v => v.Slug == slug).OrderBy(v => v.Sku).Take(8).ToListAsync(ct);
    }
    public async Task<List<ChatFact>> ResolveAsync(List<Guid> ids,ChatFilters filters,CancellationToken ct) => await Facts(filters with { Q = null }).Where(v => ids.Contains(v.VariantId)).ToListAsync(ct);
}
