using ClayNest.Application.Catalog;
using ClayNest.Domain.Catalog;
using ClayNest.Infrastructure.Development;
using ClayNest.Infrastructure.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
namespace ClayNest.IntegrationTests;

public sealed class DevelopmentActivityTests
{
    private sealed class Environment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = "/tmp";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
    [DatabaseFact]
    public async Task Activity_is_opt_in_atomic_idempotent_and_reconciles_orders_and_stock()
    {
        await using var fixture = await CheckoutTests.Fixture.Create(30);
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CommerceDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        await scope.ServiceProvider.GetRequiredService<AdminProvisioner>().EnsureCreatedAsync(
            "activity-admin-" + Guid.NewGuid().ToString("N") + "@example.test", "Check-Only!12345", "Administrator");
        await scope.ServiceProvider.GetRequiredService<ICatalogService>().SeedAsync(default);
        var enabled = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["DevelopmentActivity:Enabled"] = "true" }).Build();
        var production = new DevelopmentActivitySeeder(db, users, roles, TimeProvider.System,
            new Environment { EnvironmentName = "Production" }, enabled);
        await Assert.ThrowsAsync<InvalidOperationException>(() => production.SeedAsync(default));
        var seeder = new DevelopmentActivitySeeder(db, users, roles, TimeProvider.System, new Environment(), enabled);
        await seeder.SeedAsync(default);
        var orders = await db.Orders.Where(o => o.PayloadHash == DevelopmentActivitySeeder.OriginHash).Include(o => o.Items).ToListAsync();
        Assert.Equal(180, orders.Count);
        Assert.Equal(48, orders.Select(o => o.CustomerId).Distinct().Count());
        Assert.All(orders, order => {
            Assert.Equal(order.Items.Sum(i => i.LineTotalVnd), order.SubtotalVnd);
            Assert.Equal(order.SubtotalVnd + order.ShippingFeeVnd, order.GrandTotalVnd);
            Assert.NotNull(order.AccessRevokedAt);
            Assert.DoesNotContain("DEMO", order.Reference);
            Assert.All(order.Items, item => Assert.True(item.UnitPriceVnd > 0));
        });
        Assert.All(orders.Where(o => o.Status == "completed"), o => { Assert.Equal("paid", o.PaymentStatus); Assert.NotNull(o.CompletedAt); });
        Assert.All(orders.Where(o => o.Status == "cancelled"), o => Assert.NotNull(o.RestockedAt));
        Assert.True(orders.Where(o => o.CompletedAt != null).Select(o => o.CompletedAt).Distinct().Count() > 30);
        var customerIds = orders.Select(o => o.CustomerId!.Value).Distinct().ToList();
        Assert.All(await db.Users.Where(u => customerIds.Contains(u.Id)).ToListAsync(), u => { Assert.Null(u.PasswordHash); Assert.EndsWith("@example.test", u.Email); });
        var variantIds = orders.SelectMany(o => o.Items).Select(i => i.VariantId).Distinct().ToArray();
        foreach (var variant in await db.Set<ProductVariant>().Where(v => variantIds.Contains(v.Id)).ToListAsync())
            Assert.Equal(variant.StockQty, await db.StockMovements.Where(m => m.VariantId == variant.Id).SumAsync(m => m.QuantityDelta));
        await seeder.SeedAsync(default);
        Assert.Equal(180, await db.Orders.CountAsync(o => o.PayloadHash == DevelopmentActivitySeeder.OriginHash));
        Assert.Equal(48, await db.Users.CountAsync(u => customerIds.Contains(u.Id)));
    }
}
