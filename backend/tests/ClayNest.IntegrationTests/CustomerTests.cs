using System.Net;
using System.Net.Http.Json;
using ClayNest.Application.Catalog;
using ClayNest.Application.Customers;
using ClayNest.Domain.Identity;
using ClayNest.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
namespace ClayNest.IntegrationTests;

public sealed class CustomerTests
{
    private sealed class Directory : ICustomerDirectory
    {
        public int Calls;
        public Task<PageResult<CustomerRow>> SearchAsync(string? query, int page, CancellationToken ct)
        {
            Calls++; return Task.FromResult(new PageResult<CustomerRow>([], page, 20, 0));
        }
    }
    [Fact]
    public async Task Directory_is_admin_only_and_never_cached()
    {
        var directory = new Directory();
        await using var factory = new ApiFactory().WithWebHostBuilder(builder => builder.ConfigureTestServices(services => {
            services.AddAuthentication(o => { o.DefaultAuthenticateScheme = "CustomersTest"; o.DefaultChallengeScheme = "CustomersTest"; o.DefaultForbidScheme = "CustomersTest"; })
                .AddScheme<AuthenticationSchemeOptions, ReportAuthorizationTests.TestAuth>("CustomersTest", _ => { });
            services.RemoveAll<ICustomerDirectory>(); services.AddSingleton<ICustomerDirectory>(directory);
        }));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new("https://localhost") });
        foreach (var role in new[] { "", "Customer", "Admin" }) {
            client.DefaultRequestHeaders.Remove("X-Test-Role"); if (role != "") client.DefaultRequestHeaders.Add("X-Test-Role", role);
            using var response = await client.GetAsync("/api/v1/admin/customers");
            Assert.Equal(role == "Admin" ? HttpStatusCode.OK : role == "" ? HttpStatusCode.Unauthorized : HttpStatusCode.Forbidden, response.StatusCode);
            if (role != "Admin") Assert.Equal(0, directory.Calls);
            else Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
        }
    }
    [DatabaseFact]
    public async Task Directory_searches_accounts_and_counts_only_completed_purchase_value()
    {
        await using var fixture = await CheckoutTests.Fixture.Create(10);
        var customerId = await fixture.LoginCustomer();
        await using var scope = fixture.Factory.Services.CreateAsyncScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>();
        if (!await roles.RoleExistsAsync(CommerceRoles.Customer)) await roles.CreateAsync(new(CommerceRoles.Customer));
        var customer = (await users.FindByIdAsync(customerId.ToString()))!;
        Assert.True((await users.AddToRoleAsync(customer, CommerceRoles.Customer)).Succeeded);
        var quote = await fixture.Quote(1);
        using var created = await fixture.Post("/api/v1/orders", fixture.Command(quote), Guid.NewGuid());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var directory = scope.ServiceProvider.GetRequiredService<ICustomerDirectory>();
        var before = Assert.Single((await directory.SearchAsync(fixture.Key, 1, default)).Items);
        Assert.Equal(1, before.OrderCount); Assert.Equal(0, before.CompletedSalesVnd);
        await fixture.WithDb(async db => {
            var order = db.Orders.Single(o => o.CustomerId == customerId);
            foreach (var status in new[] { "confirmed", "packed", "shipped", "completed" }) order.TransitionTo(status, true, DateTimeOffset.UtcNow);
            await db.SaveChangesAsync();
        });
        var after = Assert.Single((await directory.SearchAsync(fixture.Key.ToUpperInvariant(), 1, default)).Items);
        Assert.Equal(customerId, after.Id); Assert.Equal(130000, after.CompletedSalesVnd); Assert.Equal(1, after.CompletedOrders);
        await Assert.ThrowsAsync<ClayNest.Domain.Catalog.CatalogRuleException>(() => directory.SearchAsync("", 0, default));
    }
}
