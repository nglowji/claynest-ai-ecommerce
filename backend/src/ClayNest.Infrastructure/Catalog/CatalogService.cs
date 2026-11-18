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
                .OrderBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => new ImageDto(i.Id, i.Url, i.Alt, i.SortOrder, i.VariantId)).ToList());
    }

    public async Task SeedAsync(CancellationToken ct)
    {
        var categories = new[] { ("Cốc & tách", "coc-tach"), ("Bình hoa", "binh-hoa"), ("Bát & đĩa", "bat-dia"), ("Bộ sưu tập", "bo-suu-tap") };
        foreach (var (name, slug) in categories)
            if (!await db.Categories.AnyAsync(c => c.Slug == slug, ct)) db.Categories.Add(new Category(name, slug, true));
        await SaveAsync(ct);
        var data = new[] {
            ("Cốc Sương Mai", "coc-suong-mai", "coc-tach", "NG-CUP-001", 280000L, (long?)350000L, "cup", "Xanh sage", "Cốc uống nước", "HOT SALE"),
            ("Bình Nắng Nhẹ", "binh-nang-nhe", "binh-hoa", "NG-VASE-001", 420000L, (long?)560000L, "vase", "Đất nung", "Cắm hoa", "NÀNG CHỌN"),
            ("Bát Mây Ngà", "bat-may-nga", "bat-dia", "NG-BOWL-001", 240000L, (long?)null, "bowl", "Men ngà", "Trang trí bàn", "MỚI"),
            ("Bộ trà Thảnh Thơi", "bo-tra-thanh-thoi", "bo-suu-tap", "NG-TEA-001", 790000L, (long?)1000000L, "tea", "Men kem", "Quà tặng", "HOT SALE") };
        foreach (var (name, slug, categorySlug, sku, price, original, image, glaze, use, label) in data)
        {
            if (await db.Products.AnyAsync(p => p.Slug == slug, ct)) continue;
            var category = await db.Categories.SingleAsync(c => c.Slug == categorySlug, ct);
            var product = new Product(isDemo: true);
            product.Update(category.Id, name, slug, "Một món gốm mang sắc màu mộc mạc, dành cho góc nhà bình yên. Dữ liệu DEMO, ảnh AI minh họa.",
                "Câu chuyện minh họa về những điều giản dị trong nhà.", "Gốm thủ công (minh họa)", "Màu men và kích thước có thể khác giữa các sản phẩm thủ công.", label, true);
            var variant = new ProductVariant(product.Id);
            variant.Update(sku, "Tiêu chuẩn", glaze, use, null, null, null, null, price, original, true, "", "", false);
            product.Variants.Add(variant); product.Images.Add(new ProductImage(product.Id, $"/images/slow-living/{image}.jpg", name, 0));
            product.ValidatePublication(); db.Products.Add(product);
        }
        // A deliberately hidden, inactive example exercises publication boundaries.
        if (!await db.Products.AnyAsync(p => p.Slug == "ban-nhap-demo", ct))
        {
            var category = await db.Categories.SingleAsync(c => c.Slug == "coc-tach", ct);
            var hidden = new Product(isDemo: true);
            hidden.Update(category.Id, "Bản nháp DEMO", "ban-nhap-demo", "Mẫu chưa xuất bản.", "", "Gốm minh họa", "", "", false);
            var inactive = new ProductVariant(hidden.Id);
            inactive.Update("NG-DRAFT-DEMO", "Chưa hoạt động", "", "", null, null, null, null, 100000, null, false, "", "", false);
            hidden.Variants.Add(inactive); hidden.ValidatePublication(); db.Products.Add(hidden);
        }
        await SaveAsync(ct);
    }
}
