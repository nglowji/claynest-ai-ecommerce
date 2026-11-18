using ClayNest.Domain.Catalog;

namespace ClayNest.UnitTests;

public sealed class CatalogRuleTests
{
    [Theory]
    [InlineData(0, null)]
    [InlineData(100L, 100L)]
    [InlineData(100L, 99L)]
    public void Invalid_prices_are_rejected(long price, long? original)
    {
        var v = new ProductVariant(Guid.NewGuid());
        Assert.Throws<CatalogRuleException>(() => v.Update("SKU", "Cup", "", "", null, null, null, null, price, original, true, "", "", false));
    }
    [Fact]
    public void Safety_claims_require_evidence()
    {
        var v = new ProductVariant(Guid.NewGuid());
        Assert.Throws<CatalogRuleException>(() => v.Update("SKU", "Cup", "", "", null, null, null, null, 100, null, true, "Microwave-safe", "", true));
    }
    [Theory]
    [InlineData("https://external.example/x.jpg")]
    [InlineData("/images/../../secrets.jpg")]
    [InlineData("/images/executable.svg")]
    public void Image_paths_are_restricted(string path) => Assert.Throws<CatalogRuleException>(() => new ProductImage(Guid.NewGuid(), path, "Alt", 0));
    [Fact]
    public void Local_image_path_is_accepted() => Assert.Equal("/images/cup.jpg", new ProductImage(Guid.NewGuid(), "/images/cup.jpg", "Cup", 0).Url);
}
