using ClayNest.Application.Identity;
using ClayNest.Domain.Identity;
using ClayNest.Infrastructure.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ClayNest.IntegrationTests;

public sealed class FirstAccountTests
{
    [DatabaseFact]
    public async Task Concurrent_first_registrations_assign_exactly_one_admin_and_later_accounts_stay_customers()
    {
        await using var factory = new AuthenticationTests.AuthFactory();
        using var client = factory.CreateClient();
        await using (var setup = factory.Services.CreateAsyncScope())
        {
            var db = setup.ServiceProvider.GetRequiredService<CommerceDbContext>();
            await db.Database.MigrateAsync();
            // Runs only against db-test/claynest_test; test execution is serial.
            TestDatabase.Connection("TEST_COMMERCE_CONNECTION");
            await db.Users.ExecuteDeleteAsync();
        }
        var emails = Enumerable.Range(0, 3).Select(_ => Guid.NewGuid().ToString("N") + "@example.test").ToArray();
        async Task Register(string email)
        {
            await using var scope = factory.Services.CreateAsyncScope();
            var result = await scope.ServiceProvider.GetRequiredService<IAdminAuthenticationService>().RegisterAsync(new("First account", email, "Strong-Password!12345"));
            Assert.True(result.Succeeded);
        }
        await Task.WhenAll(Register(emails[0]), Register(emails[1]));
        await Register(emails[2]);
        await using var verify = factory.Services.CreateAsyncScope();
        var users = verify.ServiceProvider.GetRequiredService<UserManager<AdminUser>>();
        var admins = await users.GetUsersInRoleAsync(CommerceRoles.Admin);
        Assert.Single(admins); Assert.Contains(admins[0].Email, emails.Take(2));
        Assert.False(await users.IsInRoleAsync((await users.FindByEmailAsync(emails[2]))!, CommerceRoles.Admin));
        foreach (var email in emails) Assert.True((await users.DeleteAsync((await users.FindByEmailAsync(email))!)).Succeeded);
    }
}
