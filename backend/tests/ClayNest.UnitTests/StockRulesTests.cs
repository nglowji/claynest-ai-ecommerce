using ClayNest.Domain.Catalog;
using ClayNest.Domain.Inventory;
namespace ClayNest.UnitTests;
public sealed class StockRulesTests
{
    [Fact]
    public void Balance_rejects_negative_and_overflow_without_mutation()
    {
        var variant = new ProductVariant(Guid.NewGuid(), 30);
        var revision = variant.StockRevision;
        Assert.Throws<StockRuleException>(() => variant.ChangeStock(-31));
        Assert.Throws<StockRuleException>(() => variant.ChangeStock(int.MaxValue));
        Assert.Equal(30, variant.StockQty); Assert.Equal(revision, variant.StockRevision);
        variant.ChangeStock(-5, 10); Assert.Equal(25, variant.StockQty); Assert.Equal(10, variant.LowStockThreshold); Assert.NotEqual(revision, variant.StockRevision);
    }
    [Theory]
    [InlineData("receipt", -1)]
    [InlineData("adjustment", 0)]
    [InlineData("threshold", 1)]
    [InlineData("unknown", 1)]
    public void Movement_rejects_invalid_kind_and_delta(string kind, int delta) =>
        Assert.Throws<StockRuleException>(() => new StockMovement(Guid.NewGuid(), kind, delta, 30, 5, "Reason", Guid.NewGuid(), "Admin"));
}
