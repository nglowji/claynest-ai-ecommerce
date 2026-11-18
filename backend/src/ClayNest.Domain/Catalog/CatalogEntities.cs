namespace ClayNest.Domain.Catalog;

public sealed class CatalogRuleException(string message) : Exception(message);

public static class CatalogRules
{
    public static string Text(string? value, int max, string field, bool required = false)
    {
        var text = value?.Trim() ?? string.Empty;
        if ((required && text.Length == 0) || text.Length > max)
            throw new CatalogRuleException($"{field}: thông tin thiếu hoặc vượt quá {max} ký tự.");
        return text;
    }
    public static string Slug(string? value)
    {
        var slug = Text(value, 140, "Slug", true);
        if (!System.Text.RegularExpressions.Regex.IsMatch(slug, "^[a-z0-9]+(?:-[a-z0-9]+)*$"))
            throw new CatalogRuleException("Slug chỉ gồm chữ thường không dấu, số và dấu gạch nối.");
        return slug;
    }
}

public sealed class Category
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public bool Active { get; private set; }
    public Guid Revision { get; private set; } = Guid.NewGuid();
    private Category() { }
    public Category(string name, string slug, bool active) => Update(name, slug, active);
    public void Update(string name, string slug, bool active)
    {
        Name = CatalogRules.Text(name, 100, "Tên danh mục", true);
        Slug = CatalogRules.Slug(slug); Active = active; Revision = Guid.NewGuid();
    }
}

public sealed class Product
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid CategoryId { get; private set; }
    public Category Category { get; private set; } = null!;
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string CraftStory { get; private set; } = string.Empty;
    public string Material { get; private set; } = string.Empty;
    public string HandmadeNote { get; private set; } = string.Empty;
    public string SearchText { get; private set; } = string.Empty;
    public string Label { get; private set; } = string.Empty;
    public bool Published { get; private set; }
    public bool Archived { get; private set; }
    public string SourceUrl { get; private set; } = string.Empty;
    public string SourceName { get; private set; } = string.Empty;
    public string SourceDimensions { get; private set; } = string.Empty;
    public string SourceAvailability { get; private set; } = string.Empty;
    public string PriceUnit { get; private set; } = string.Empty;
    public bool IsDemo { get; private set; }
    public Guid Revision { get; private set; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; private set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; private set; } = DateTimeOffset.UtcNow;
    public List<ProductVariant> Variants { get; private set; } = [];
    public List<ProductImage> Images { get; private set; } = [];
    private Product() { }
    public Product(bool isDemo = false) => IsDemo = isDemo;
    public void Update(Guid categoryId, string name, string slug, string description, string story,
        string material, string handmadeNote, string label, bool published)
    {
        if (categoryId == Guid.Empty) throw new CatalogRuleException("Cần chọn danh mục.");
        CategoryId = categoryId; Name = CatalogRules.Text(name, 180, "Tên sản phẩm", true);
        Slug = CatalogRules.Slug(slug); Description = CatalogRules.Text(description, 6000, "Mô tả", true);
        CraftStory = CatalogRules.Text(story, 6000, "Câu chuyện"); Material = CatalogRules.Text(material, 160, "Chất liệu", true);
        HandmadeNote = CatalogRules.Text(handmadeNote, 1000, "Lưu ý thủ công"); Label = CatalogRules.Text(label, 32, "Nhãn");
        Published = published; Touch();
    }
    public static string NormalizeSearch(string value) => new string(value.Normalize(System.Text.NormalizationForm.FormD)
        .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
        .ToArray()).ToLowerInvariant().Replace('đ', 'd');
    public void RecordSource(string url, string name, string dimensions, string availability, string priceUnit)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed) || parsed.Scheme != "https")
            throw new CatalogRuleException("Đường dẫn nguồn sản phẩm không hợp lệ.");
        SourceUrl = CatalogRules.Text(url, 500, "Nguồn sản phẩm", true);
        SourceName = CatalogRules.Text(name, 120, "Tên nguồn", true);
        SourceDimensions = CatalogRules.Text(dimensions, 300, "Kích thước từ nguồn");
        SourceAvailability = CatalogRules.Text(availability, 160, "Tình trạng từ nguồn");
        PriceUnit = CatalogRules.Text(priceUnit, 60, "Đơn vị giá"); Touch();
    }
    public void Touch() { Revision = Guid.NewGuid(); UpdatedAt = DateTimeOffset.UtcNow; }
    public void Archive() { Archived = true; Published = false; Touch(); }
    public void ValidatePublication()
    {
        SearchText = NormalizeSearch(string.Join(" ", Name, Description, Material,
            string.Join(" ", Variants.Select(v => $"{v.Sku} {v.Glaze} {v.IntendedUse}"))));
        if (Variants.Count == 0 || Variants.Count > 30 || Images.Count > 12)
            throw new CatalogRuleException("Cần 1–30 biến thể và tối đa 12 ảnh.");
        if (Published && (!Variants.Any(v => v.Active) || !Images.Any(i => i.VariantId is null || Variants.Any(v => v.Active && v.Id == i.VariantId)) || Archived))
            throw new CatalogRuleException("Chỉ xuất bản sản phẩm có biến thể hoạt động và ảnh.");
    }
}

public sealed class ProductVariant
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ProductId { get; private set; }
    public string Sku { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string Glaze { get; private set; } = string.Empty;
    public string IntendedUse { get; private set; } = string.Empty;
    public int? CapacityMl { get; private set; }
    public decimal? WidthCm { get; private set; }
    public decimal? HeightCm { get; private set; }
    public int? WeightG { get; private set; }
    public long PriceVnd { get; private set; }
    public long? OriginalPriceVnd { get; private set; }
    public int StockQty { get; private set; }
    public int LowStockThreshold { get; private set; } = 5;
    public Guid StockRevision { get; private set; } = Guid.NewGuid();
    public void ChangeStock(int delta, int? threshold = null)
    {
        var next = (long)StockQty + delta;
        if (next < 0 || next > 1000000 || threshold is < 0 or > 1000000)
            throw new ClayNest.Domain.Inventory.StockRuleException("Tồn kho phải từ 0–1.000.000; không thể trừ quá số lượng hiện có.");
        StockQty = (int)next;
        if (threshold.HasValue) LowStockThreshold = threshold.Value;
        StockRevision = Guid.NewGuid();
    }
    public bool Active { get; private set; }
    public string CareNote { get; private set; } = string.Empty;
    public string CareSource { get; private set; } = string.Empty;
    public bool CareVerified { get; private set; }
    private ProductVariant() { }
    public ProductVariant(Guid productId, int initialStockQty = 0)
    {
        if (initialStockQty < 0) throw new CatalogRuleException("Số lượng tồn kho không được âm.");
        ProductId = productId;
        StockQty = initialStockQty;
    }
    public void Update(string sku, string name, string glaze, string intendedUse, int? capacityMl,
        decimal? widthCm, decimal? heightCm, int? weightG, long priceVnd, long? originalPriceVnd,
        bool active, string careNote, string careSource, bool careVerified)
    {
        Sku = CatalogRules.Text(sku, 64, "SKU", true).ToUpperInvariant();
        if (!System.Text.RegularExpressions.Regex.IsMatch(Sku, "^[A-Z0-9][A-Z0-9_-]*$")) throw new CatalogRuleException("SKU không hợp lệ.");
        Name = CatalogRules.Text(name, 120, "Tên biến thể", true); Glaze = CatalogRules.Text(glaze, 120, "Màu men");
        IntendedUse = CatalogRules.Text(intendedUse, 160, "Công dụng");
        if (priceVnd <= 0 || priceVnd > 1_000_000_000 || originalPriceVnd is not null && (originalPriceVnd <= priceVnd || originalPriceVnd > 1_000_000_000))
            throw new CatalogRuleException("Giá bán phải dương; giá niêm yết phải cao hơn giá bán, tối đa 1 tỷ VND.");
        if (capacityMl is <= 0 or > 100000 || widthCm is < 0.01m or > 1000 || heightCm is < 0.01m or > 1000 || weightG is <= 0 or > 1000000)
            throw new CatalogRuleException("Thông số phải dương và trong giới hạn cho phép.");
        if (widthCm.HasValue && decimal.Round(widthCm.Value, 2) != widthCm.Value || heightCm.HasValue && decimal.Round(heightCm.Value, 2) != heightCm.Value)
            throw new CatalogRuleException("Kích thước hỗ trợ tối đa 2 chữ số thập phân.");
        CapacityMl = capacityMl; WidthCm = widthCm; HeightCm = heightCm; WeightG = weightG;
        PriceVnd = priceVnd; OriginalPriceVnd = originalPriceVnd; Active = active;
        CareNote = CatalogRules.Text(careNote, 2000, "Hướng dẫn chăm sóc"); CareSource = CatalogRules.Text(careSource, 1000, "Nguồn xác minh");
        if (careVerified && (CareNote.Length == 0 || CareSource.Length == 0)) throw new CatalogRuleException("Hướng dẫn xác minh cần nội dung và nguồn chứng cứ.");
        CareVerified = careVerified;
    }
}

public sealed class ProductImage
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ProductId { get; private set; }
    public Guid? VariantId { get; private set; }
    public string Url { get; private set; } = string.Empty;
    public string Alt { get; private set; } = string.Empty;
    public int SortOrder { get; private set; }
    private ProductImage() { }
    public ProductImage(Guid productId, string url, string alt, int sortOrder, Guid? variantId = null)
    {
        ProductId = productId; Url = CatalogRules.Text(url, 500, "Ảnh", true);
        if (!System.Text.RegularExpressions.Regex.IsMatch(Url, @"^/(?:images|media/catalog)/[a-zA-Z0-9_./-]+\.(?:jpg|jpeg|png|webp)$") || Url.Contains(".."))
            throw new CatalogRuleException("Chỉ dùng ảnh local đã được kiểm soát.");
        Alt = CatalogRules.Text(alt, 240, "Mô tả ảnh", true); SortOrder = sortOrder; VariantId = variantId;
    }
}
