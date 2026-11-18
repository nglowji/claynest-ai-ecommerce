using ClayNest.Domain.Orders;
namespace ClayNest.UnitTests;
public sealed class OrderRulesTests
{
    [Fact]
    public void Contact_normalizes_phone_and_rejects_incomplete_address()
    {
        var contact = new ShippingContact(" Buyer ", "090 123 4567", "BUYER@EXAMPLE.TEST", "Trà Vinh", "123 Ceramic Street", "");
        var normalized = contact.Normalize(); Assert.Equal("0901234567", normalized.Phone); Assert.Equal("buyer@example.test", normalized.Email);
        Assert.Throws<OrderRuleException>(() => (contact with { Address = "" }).Normalize());
        Assert.Throws<OrderRuleException>(() => (contact with { Phone = "abc" }).Normalize());
    }
    [Fact]
    public void Order_snapshots_integer_prices_and_rejects_duplicate_variants()
    {
        var order = new Order("NG-TEST", null, new("Buyer", "0901234567", "", "Trà Vinh", "123 Ceramic Street", ""), 30000, Guid.NewGuid(), new string('A',64), new string('B',64), "protected", DateTimeOffset.UtcNow);
        var variant = Guid.NewGuid(); order.AddItem(variant, "SKU", "Cup", "Green", "", 3, 260000);
        Assert.Equal(810000, order.GrandTotalVnd); Assert.Equal(780000, order.Items.Single().LineTotalVnd);
        Assert.Throws<OrderRuleException>(() => order.AddItem(variant, "SKU", "Cup", "Green", "", 1, 260000));
    }
}
