using ClayNest.Application.Catalog;
using ClayNest.Domain.Catalog;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ClayNest.Infrastructure.Catalog;

public sealed class CatalogService(CommerceDbContext db) : ICatalogService
{
    public async Task<List<CategoryDto>> CategoriesAsync(bool admin, CancellationToken ct) => await db.Categories.AsNoTracking()
        .Where(x => admin || x.Active).OrderBy(x => x.Name).ThenBy(x => x.Id)
        .Select(x => new CategoryDto(x.Id, x.Name, x.Slug, x.Active, x.Revision)).ToListAsync(ct);

    public async Task<CategoryDto> SaveCategoryAsync(Guid? id, CategoryInput input, CancellationToken ct)
    {
        var category = id is null ? new Category(input.Name, input.Slug, input.Active)
            : await db.Categories.FindAsync([id.Value], ct) ?? throw new KeyNotFoundException();
        if (id is null) db.Categories.Add(category);
        else
        {
            if (category.Revision != input.Revision) throw new CatalogConflictException("Danh mục đã thay đổi. Hãy tải lại trước khi lưu.");
            category.Update(input.Name, input.Slug, input.Active);
        }
        await SaveAsync(ct);
        return new(category.Id, category.Name, category.Slug, category.Active, category.Revision);
    }

    private IQueryable<Product> Read(bool admin) => db.Products.Include(x => x.Category)
        .Include(x => x.Variants).Include(x => x.Images).AsSplitQuery().AsNoTracking()
        .Where(x => admin || x.Published && !x.Archived && x.Category.Active && x.Variants.Any(v => v.Active));

    public async Task<PageResult<ProductDto>> SearchAsync(CatalogQuery q, bool admin, CancellationToken ct)
    {
        if (q.Page < 1 || q.Page > 10000 || q.PageSize < 1 || q.PageSize > 48 || q.MinPrice < 0 || q.MaxPrice < 0
            || q.MinPrice > q.MaxPrice || (q.Q?.Length ?? 0) > 180 || (q.Category?.Length ?? 0) > 140
            || (q.Glaze?.Length ?? 0) > 120 || (q.Use?.Length ?? 0) > 160
            || q.Sort is not ("default" or "price-asc" or "price-desc" or "newest"))
            throw new CatalogRuleException("Bộ lọc hoặc phân trang không hợp lệ.");
        var query = Read(admin);
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = Product.NormalizeSearch(q.Q.Trim());
            query = query.Where(p => p.SearchText.Contains(term));
        }
        if (!string.IsNullOrWhiteSpace(q.Category))
            query = query.Where(p => p.Category.Slug == q.Category || p.Category.Name == q.Category || p.CategoryId.ToString() == q.Category);
        // All variant-level filters apply to the SAME active variant.
        query = query.Where(p => p.Variants.Any(v => (admin || v.Active)
            && (q.MinPrice == null || v.PriceVnd >= q.MinPrice) && (q.MaxPrice == null || v.PriceVnd <= q.MaxPrice)
            && (!q.InStock || v.StockQty > 0) && (!q.Sale || v.OriginalPriceVnd > v.PriceVnd)
            && (q.Glaze == null || v.Glaze.ToLower().Contains(q.Glaze.ToLower()))
            && (q.Use == null || v.IntendedUse.ToLower().Contains(q.Use.ToLower()))));
        var count = await query.CountAsync(ct);
        query = q.Sort switch
        {
            "price-asc" => query.OrderBy(p => p.Variants.Where(v => (admin || v.Active)
                && (q.MinPrice == null || v.PriceVnd >= q.MinPrice) && (q.MaxPrice == null || v.PriceVnd <= q.MaxPrice)
                && (!q.InStock || v.StockQty > 0) && (!q.Sale || v.OriginalPriceVnd > v.PriceVnd)
                && (q.Glaze == null || v.Glaze.ToLower().Contains(q.Glaze.ToLower()))
                && (q.Use == null || v.IntendedUse.ToLower().Contains(q.Use.ToLower()))).Min(v => v.PriceVnd)).ThenBy(p => p.Id),
            "price-desc" => query.OrderByDescending(p => p.Variants.Where(v => (admin || v.Active)
                && (q.MinPrice == null || v.PriceVnd >= q.MinPrice) && (q.MaxPrice == null || v.PriceVnd <= q.MaxPrice)
                && (!q.InStock || v.StockQty > 0) && (!q.Sale || v.OriginalPriceVnd > v.PriceVnd)
                && (q.Glaze == null || v.Glaze.ToLower().Contains(q.Glaze.ToLower()))
                && (q.Use == null || v.IntendedUse.ToLower().Contains(q.Use.ToLower()))).Min(v => v.PriceVnd)).ThenBy(p => p.Id),
            "newest" => query.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id),
            _ => query.OrderBy(p => p.Name).ThenBy(p => p.Id)
        };
        var items = await query.Skip((q.Page - 1) * q.PageSize).Take(q.PageSize).ToListAsync(ct);
        return new(items.Select(p => Map(p, admin, admin ? null : q)).ToList(), q.Page, q.PageSize, count);
    }

    public async Task<ProductDto?> FindAsync(string slugOrId, bool admin, CancellationToken ct)
    {
        var parsed = Guid.TryParse(slugOrId, out var id) && admin;
        var product = await Read(admin).SingleOrDefaultAsync(x => parsed ? x.Id == id : x.Slug == slugOrId, ct);
        return product is null ? null : Map(product, admin);
    }

    public async Task<ProductDto> SaveProductAsync(Guid? id, ProductInput input, CancellationToken ct)
    {
        if (input.Variants is null || input.Images is null || input.Variants.Count is < 1 or > 30 || input.Images.Count > 12 || input.Variants.Any(v => v is null) || input.Images.Any(i => i is null))
            throw new CatalogRuleException("Cần 1–30 biến thể và tối đa 12 ảnh.");
        var category = await db.Categories.FindAsync([input.CategoryId], ct)
            ?? throw new CatalogRuleException("Danh mục không tồn tại.");
        if (input.Published && !category.Active) throw new CatalogRuleException("Không xuất bản vào danh mục đã ẩn.");
        var product = id is null ? new Product() : await db.Products.Include(x => x.Variants).Include(x => x.Images)
            .SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new KeyNotFoundException();
        if (id is not null && product.Revision != input.Revision) throw new CatalogConflictException("Sản phẩm đã thay đổi. Hãy tải lại trước khi lưu.");
        if (product.Archived) throw new CatalogRuleException("Sản phẩm đã lưu trữ, không thể sửa.");
        if (product.Variants.Any(v => !input.Variants.Any(i => i.Id == v.Id)))
            throw new CatalogRuleException("Không xóa biến thể đã lưu; hãy tắt hoạt động để giữ lịch sử SKU.");
        product.Update(input.CategoryId, input.Name, input.Slug, input.Description, input.CraftStory,
            input.Material, input.HandmadeNote, input.Label, input.Published);
        var seen = new HashSet<Guid>();
        foreach (var v in input.Variants)
        {
            var variant = v.Id is null ? new ProductVariant(product.Id) : product.Variants.SingleOrDefault(x => x.Id == v.Id)
                ?? throw new CatalogRuleException("Biến thể không thuộc sản phẩm.");
            if (!seen.Add(variant.Id)) throw new CatalogRuleException("Biến thể bị lặp.");
            variant.Update(v.Sku, v.Name, v.Glaze, v.IntendedUse, v.CapacityMl, v.WidthCm, v.HeightCm,
                v.WeightG, v.PriceVnd, v.OriginalPriceVnd, v.Active, v.CareNote, v.CareSource, v.CareVerified);
            if (v.Id is null) { product.Variants.Add(variant); if (id is not null) db.Add(variant); }
        }
        if (product.Variants.Select(v => v.Sku).Distinct().Count() != product.Variants.Count)
            throw new CatalogRuleException("SKU của các biến thể không được trùng nhau.");
        product.Images.Clear();
        for (var i = 0; i < input.Images.Count; i++)
        {
            var image = input.Images[i];
            if (image.VariantId is not null && product.Variants.All(v => v.Id != image.VariantId)) throw new CatalogRuleException("Ảnh không thuộc biến thể của sản phẩm.");
            var entity = new ProductImage(product.Id, image.Url, image.Alt, i, image.VariantId);
            product.Images.Add(entity); if (id is not null) db.Add(entity);
        }
        product.ValidatePublication();
        if (id is null) db.Products.Add(product);
        await SaveAsync(ct);
        // Read back without the tracking graph to include the current category navigation.
        return (await FindAsync(product.Id.ToString(), true, ct))!;
    }

    public async Task ArchiveAsync(Guid id, Guid revision, CancellationToken ct)
    {
        var product = await db.Products.FindAsync([id], ct) ?? throw new KeyNotFoundException();
        if (product.Revision != revision) throw new CatalogConflictException("Sản phẩm đã thay đổi. Hãy tải lại.");
        product.Archive(); await SaveAsync(ct);
    }

    private async Task SaveAsync(CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { throw new CatalogConflictException("Dữ liệu đã được sửa ở nơi khác. Hãy tải lại."); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { throw new CatalogConflictException("SKU hoặc slug đã tồn tại. Hãy dùng giá trị khác."); }
    }

    private static ProductDto Map(Product p, bool admin, CatalogQuery? q = null)
    {
        var variants = p.Variants.Where(v => admin || v.Active).Where(v => q is null
            || (q.MinPrice is null || v.PriceVnd >= q.MinPrice) && (q.MaxPrice is null || v.PriceVnd <= q.MaxPrice)
            && (!q.InStock || v.StockQty > 0) && (!q.Sale || v.OriginalPriceVnd > v.PriceVnd)
            && (q.Glaze is null || v.Glaze.Contains(q.Glaze, StringComparison.OrdinalIgnoreCase))
            && (q.Use is null || v.IntendedUse.Contains(q.Use, StringComparison.OrdinalIgnoreCase))).OrderBy(v => v.Sku).Select(v => new VariantDto(
            v.Id, v.Sku, v.Name, v.Glaze, v.IntendedUse, v.CapacityMl, v.WidthCm, v.HeightCm, v.WeightG,
            v.PriceVnd, v.OriginalPriceVnd, v.OriginalPriceVnd is > 0 ? (int)Math.Round((1m - (decimal)v.PriceVnd / v.OriginalPriceVnd.Value) * 100, 0, MidpointRounding.AwayFromZero) : 0,
            v.StockQty, v.Active, admin || v.CareVerified ? v.CareNote : "", admin || v.CareVerified ? v.CareSource : "", v.CareVerified)).ToList();
        return new(p.Id, p.CategoryId, p.Category.Name, p.Name, p.Slug, p.Description, p.CraftStory, p.Material,
            p.HandmadeNote, p.Label, p.Published, p.Archived, p.IsDemo, p.Revision, p.UpdatedAt, variants,
            p.Images.Where(i => admin || i.VariantId is null || variants.Any(v => v.Id == i.VariantId))
                .OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => new ImageDto(i.Id, i.Url, i.Alt, i.SortOrder, i.VariantId)).ToList(), p.SourceUrl, p.SourceName, p.SourceDimensions, p.SourceAvailability, p.PriceUnit);
    }

    public async Task SeedAsync(CancellationToken ct)
    {
        var entries = CatalogContent.Load();
        foreach (var entry in entries.DistinctBy(e => e.CategorySlug))
            if (!await db.Categories.AnyAsync(c => c.Slug == entry.CategorySlug, ct)) db.Categories.Add(new Category(entry.CategoryName, entry.CategorySlug, true));
        await SaveAsync(ct);
        foreach (var entry in entries)
        {
            if (await db.Products.AnyAsync(p => p.Slug == entry.Slug, ct)) continue;
            var category = await db.Categories.SingleAsync(c => c.Slug == entry.CategorySlug, ct);
            var product = new Product(isDemo: entry.IsAuthored);
            product.Update(category.Id, entry.Name, entry.Slug, entry.Description, entry.CraftStory,
                entry.Material, entry.HandmadeNote, entry.Label, entry.Images.Count > 0);
            if (!string.IsNullOrEmpty(entry.SourceUrl))
                product.RecordSource(entry.SourceUrl, entry.SourceName, entry.SourceDimensions, entry.SourceAvailability, entry.PriceUnit);
            var variant = new ProductVariant(product.Id, initialStockQty: entry.IsAuthored ? 30 : 0);
            variant.Update(entry.Sku, entry.VariantName, entry.Glaze, entry.IntendedUse,
                entry.CapacityMl, entry.WidthCm, entry.HeightCm, entry.WeightG, entry.PriceVnd, entry.OriginalPriceVnd, true, "", "", false);
            product.Variants.Add(variant);
            if (variant.StockQty > 0)
                db.StockMovements.Add(new ClayNest.Domain.Inventory.StockMovement(variant.Id, "opening", variant.StockQty,
                    variant.StockQty, variant.LowStockThreshold, "Khởi tạo tồn kho bộ sưu tập Nàng Gốm", null, "Hệ thống"));
            for (var i = 0; i < entry.Images.Count; i++)
                product.Images.Add(new ProductImage(product.Id, entry.Images[i].Path, entry.Name, i));
            product.ValidatePublication(); db.Products.Add(product);
        }
        await SaveAsync(ct);
    }

    public async Task RemoveSourceImagesAsync(CancellationToken ct)
    {
        var products = await db.Products.Include(p => p.Images).Include(p => p.Variants)
            .Where(p => p.SourceUrl.StartsWith("https://www.bienhoaceramic.com/")
                || p.SourceUrl.StartsWith("https://bienhoaceramic.com/")
                || p.Images.Any(i => i.Url.StartsWith("/images/catalog/"))).ToListAsync(ct);
        foreach (var product in products)
        {
            var removed = product.Images.RemoveAll(i => i.Url.StartsWith("/images/catalog/"));
            if (product.Published && product.Images.Count == 0)
                product.Update(product.CategoryId, product.Name, product.Slug, product.Description, product.CraftStory,
                    product.Material, product.HandmadeNote, product.Label, false);
            else if (removed > 0) product.Touch();
            product.ValidatePublication();
        }
        await SaveAsync(ct);
    }

    public async Task RefreshContentAsync(CancellationToken ct)
    {
        var retiredCategories = new[] { "do-gia-dung", "den-gom", "tuong-gom", "don-gom", "don-voi" };
        var categories = await db.Categories.Where(c => retiredCategories.Contains(c.Slug) && c.Active).ToListAsync(ct);
        foreach (var category in categories)
            if (!await db.Products.AnyAsync(p => p.CategoryId == category.Id && p.Published && !p.Archived, ct))
                category.Update(category.Name, category.Slug, false);
        var legacy = CatalogContent.Legacy().ToDictionary(e => e.Slug);
        var products = await db.Products.Include(p => p.Variants).Include(p => p.Images)
            .Where(p => p.IsDemo).ToListAsync(ct);
        foreach (var product in products)
        {
            var starter = product.Description == "Một món gốm mang sắc màu mộc mạc, dành cho góc nhà bình yên. Dữ liệu DEMO, ảnh AI minh họa.";
            var authored = legacy.TryGetValue(product.Slug, out var entry) && product.Description == entry.Description;
            if (starter || authored)
            {
                // Retire only our exact starter copy; no deletion, no price/stock changes or merchant text overwrite.
                product.Update(product.CategoryId, product.Name, product.Slug, "Thiết kế đang ngừng trưng bày.", "", "Gốm", product.HandmadeNote, "", false);
                product.Archive(); product.ValidatePublication();
            }
            if (product.Slug == "ban-nhap-demo" && product.Name == "Bản nháp DEMO")
            {
                product.Update(product.CategoryId, "Bộ sưu tập sắp ra mắt", "bo-suu-tap-sap-ra-mat", "Những thiết kế đang được hoàn thiện.", "", "Gốm", "", "", false);
                foreach (var variant in product.Variants)
                    variant.Update(variant.Sku == "NG-DRAFT-DEMO" ? "NG-PREVIEW-001" : variant.Sku, "Đang hoàn thiện", variant.Glaze, variant.IntendedUse,
                        variant.CapacityMl, variant.WidthCm, variant.HeightCm, variant.WeightG, variant.PriceVnd, variant.OriginalPriceVnd,
                        variant.Active, variant.CareNote, variant.CareSource, variant.CareVerified);
                product.ValidatePublication();
            }
        }
        await SaveAsync(ct);
    }
}
