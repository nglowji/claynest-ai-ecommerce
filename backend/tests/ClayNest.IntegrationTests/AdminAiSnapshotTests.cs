using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ClayNest.Application.AdminAi;
using ClayNest.Application.Orders;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
namespace ClayNest.IntegrationTests;

public sealed class AdminAiSnapshotTests
{
    [DatabaseFact]
    public async Task Snapshot_reads_aggregates_without_customer_contact_or_order_secrets()
    {
        await using var fixture = await CheckoutTests.Fixture.Create(2);
        var quote = await fixture.Quote(1);
        using var placed = await fixture.Post("/api/v1/orders", fixture.Command(quote), Guid.NewGuid());
        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        var receipt = (await placed.Content.ReadFromJsonAsync<OrderReceipt>())!;
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var snapshot = scope.ServiceProvider.GetRequiredService<IAdminAiSnapshot>();
        var context = await snapshot.GetAsync(new("buyer@example.test 0901234567 " + new string('K', 43), 7), default);
        Assert.Equal(6, context.To.DayNumber - context.From.DayNumber);
        Assert.Contains(context.Facts, fact => fact.Id == "pending");
        foreach (var id in new[] { "sales-change", "cancellation-rate", "stalled-orders", "out-of-stock", "unsold-stock", "draft-products" })
            Assert.Contains(context.Facts, fact => fact.Id == id);
        Assert.Contains(context.Guides, guide => guide.Key == "inventory");
        var json = JsonSerializer.Serialize(context);
        foreach (var secret in new[] { CheckoutTests.Fixture.Contact.Name, CheckoutTests.Fixture.Contact.Email,
            CheckoutTests.Fixture.Contact.Phone, CheckoutTests.Fixture.Contact.Address, receipt.AccessToken,
            receipt.Reference, new string('K', 43) }) Assert.DoesNotContain(secret, json);
        Assert.Empty(scope.ServiceProvider.GetRequiredService<CommerceDbContext>().ChangeTracker.Entries());
        await fixture.WithDb(async db =>
        {
            Assert.Equal(1, await db.Set<ClayNest.Domain.Catalog.ProductVariant>()
                .Where(v => v.Id == fixture.VariantId).Select(v => v.StockQty).SingleAsync());
        });
    }
}
