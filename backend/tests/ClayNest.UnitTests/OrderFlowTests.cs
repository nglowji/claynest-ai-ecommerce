using ClayNest.Domain.Orders;
namespace ClayNest.UnitTests;
public sealed class OrderFlowTests
{
    private static Order Create() => new("NG-TEST", null, new("Buyer", "0901234567", "", "Trà Vinh", "123 Ceramic Street", ""), 30000, Guid.NewGuid(), new string('A',64), new string('B',64), "protected", DateTimeOffset.UtcNow);
    [Fact]
    public void Fulfilment_requires_ordered_steps_and_explicit_cod_collection()
    {
        var order = Create(); var now = DateTimeOffset.UtcNow;
        Assert.Throws<OrderTransitionException>(() => order.TransitionTo("shipped",false,now));
        order.TransitionTo("confirmed",false,now); order.TransitionTo("packed",false,now);
        Assert.Throws<OrderTransitionException>(() => order.TransitionTo("cancelled",false,now));
        order.TransitionTo("shipped",false,now);
        Assert.Throws<OrderRuleException>(() => order.TransitionTo("completed",false,now));
        Assert.Null(order.CompletedAt); order.TransitionTo("completed",true,now);
        var completed = order.CompletedAt; Assert.NotNull(completed); Assert.Equal("paid",order.PaymentStatus); Assert.Equal(4,order.Revision);
        Assert.Throws<OrderTransitionException>(() => order.TransitionTo("completed",true,now.AddDays(1)));
        Assert.Equal(completed,order.CompletedAt); Assert.Empty(OrderFlow.Next(order.Status));
    }
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Cancellation_is_terminal_and_restock_is_marked_once(bool confirmed)
    {
        var order = Create(); var now = DateTimeOffset.UtcNow;
        if (confirmed) order.TransitionTo("confirmed",false,now);
        order.TransitionTo("cancelled",false,now); order.MarkRestocked();
        Assert.Equal(order.CancelledAt,order.RestockedAt); Assert.Null(order.CompletedAt); Assert.Equal("unpaid",order.PaymentStatus);
        Assert.Throws<OrderTransitionException>(() => order.MarkRestocked());
        Assert.Throws<OrderTransitionException>(() => order.TransitionTo("confirmed",false,now));
    }
}
