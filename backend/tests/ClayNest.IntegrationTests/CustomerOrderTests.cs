using System.Net;
using System.Net.Http.Json;
using ClayNest.Application.Orders;
using Microsoft.AspNetCore.Mvc.Testing;
namespace ClayNest.IntegrationTests;
public sealed class CustomerOrderTests
{
    [DatabaseFact]
    public async Task History_only_exposes_owned_orders_and_filters_and_pages_are_validated()
    {
        await using var owner = await CheckoutTests.Fixture.Create(5);
        await owner.LoginCustomer();
        var quote = await owner.Quote(2);
        using var placed = await owner.Post("/api/v1/orders", owner.Command(quote), Guid.NewGuid());
        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        var receipt = (await placed.Content.ReadFromJsonAsync<OrderReceipt>())!;
        using var guest = owner.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new("https://localhost") });
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/v1/account/orders")).StatusCode);
        using var response = await owner.Client.GetAsync("/api/v1/account/orders");
        Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
        var history = (await response.Content.ReadFromJsonAsync<PurchaseHistory>())!;
        var order = Assert.Single(history.Orders.Items); Assert.Equal(receipt.Reference, order.Reference);
        var item = Assert.Single(order.Items); Assert.Equal(owner.VariantId, item.VariantId); Assert.Equal(2, item.Quantity); Assert.Equal(3, item.AvailableQty);
        var empty = (await owner.Client.GetFromJsonAsync<PurchaseHistory>("/api/v1/account/orders?status=completed"))!;
        Assert.Empty(empty.Orders.Items); Assert.Equal(1, Assert.Single(empty.Counts).Count);
        Assert.Single((await owner.Client.GetFromJsonAsync<PurchaseHistory>("/api/v1/account/orders?q=" + receipt.Reference))!.Orders.Items);
        await using var other = await CheckoutTests.Fixture.Create(1); await other.LoginCustomer();
        Assert.Empty((await other.Client.GetFromJsonAsync<PurchaseHistory>("/api/v1/account/orders?q=" + receipt.Reference))!.Orders.Items);
        Assert.Equal(HttpStatusCode.NotFound, (await other.Client.GetAsync($"/api/v1/orders/{receipt.Reference}/status")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.Client.GetAsync("/api/v1/account/orders?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.Client.GetAsync("/api/v1/account/orders?status=unknown")).StatusCode);
        Assert.Empty((await owner.Client.GetFromJsonAsync<PurchaseHistory>("/api/v1/account/orders?page=2"))!.Orders.Items);
    }
}
