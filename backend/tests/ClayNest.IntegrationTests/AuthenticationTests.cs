using System.Net;
using System.Net.Http.Json;
using ClayNest.Application.Identity;
using ClayNest.Domain.Identity;
using ClayNest.Infrastructure.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ClayNest.IntegrationTests;

public sealed class AuthenticationTests
{
    [DatabaseFact]
    public async Task Login_restores_profile_and_logout_revokes_replayed_cookie()
    {
        await using var session = await Session.CreateAsync();
        using var login = await session.LoginAsync();
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var cookie = login.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("nang_gom.admin=", StringComparison.Ordinal));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("expires=", cookie, StringComparison.OrdinalIgnoreCase);
        using var me = await session.Client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var profile = await me.Content.ReadFromJsonAsync<AdminProfile>();
        Assert.Equal(session.Email, profile?.Email);
        Assert.Equal(CommerceRoles.Admin, profile?.Role);
        using var adminSession = await session.Client.GetAsync("/api/v1/admin/session");
        Assert.Equal(HttpStatusCode.OK, adminSession.StatusCode);
        Assert.DoesNotContain("password", await me.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        using var logout = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/logout");
        logout.Headers.Add("X-CSRF-TOKEN", await session.CsrfAsync());
        using var loggedOut = await session.Client.SendAsync(logout);
        Assert.Equal(HttpStatusCode.NoContent, loggedOut.StatusCode);
        using var after = await session.Client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, after.StatusCode);
        using var replay = session.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), HandleCookies = false });
        replay.DefaultRequestHeaders.Add("Cookie", cookie.Split(';')[0]);
        using var replayResult = await replay.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, replayResult.StatusCode);
    }

    [DatabaseFact]
    public async Task Remember_me_issues_persistent_cookie()
    {
        await using var session = await Session.CreateAsync();
        using var response = await session.LoginAsync(remember: true);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(response.Headers.GetValues("Set-Cookie"), value => value.StartsWith("nang_gom.admin=", StringComparison.Ordinal) && value.Contains("expires=", StringComparison.OrdinalIgnoreCase));
    }

    [DatabaseFact]
    public async Task Login_requires_csrf_and_valid_input()
    {
        await using var session = await Session.CreateAsync();
        using var missing = await session.Client.PostAsJsonAsync("/api/v1/auth/login", new { email = session.Email, password = session.Password });
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        using var malformed = await session.LoginAsync(email: "invalid-email");
        Assert.Equal(HttpStatusCode.BadRequest, malformed.StatusCode);
        using var me = await session.Client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [DatabaseFact]
    public async Task Wrong_password_and_unknown_email_use_same_safe_error()
    {
        await using var session = await Session.CreateAsync();
        using var wrong = await session.LoginAsync(password: "InvalidPassword!123");
        using var unknown = await session.LoginAsync(email: "missing-" + session.Email);
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal(await wrong.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
    }

    [DatabaseFact]
    public async Task Customer_can_sign_in_but_cannot_access_admin_api()
    {
        await using var session = await Session.CreateAsync(admin: false);
        using var login = await session.LoginAsync();
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(CommerceRoles.Customer, (await login.Content.ReadFromJsonAsync<AdminProfile>())?.Role);
        using var me = await session.Client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        using var admin = await session.Client.GetAsync("/api/v1/admin/session");
        Assert.Equal(HttpStatusCode.Forbidden, admin.StatusCode);
    }

    [DatabaseFact]
    public async Task Registration_creates_only_customer_and_rejects_duplicate_or_weak_password()
    {
        await using var session = await Session.CreateAsync(admin: false);
        await using (var scope = session.Factory.Services.CreateAsyncScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>();
            var user = await users.FindByEmailAsync(session.Email);
            Assert.True((await users.DeleteAsync(user!)).Succeeded);
        }
        async Task<HttpResponseMessage> Register(string password, bool csrf = true)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/register")
            { Content = JsonContent.Create(new { displayName = "Customer test", email = session.Email, password, role = "Admin" }) };
            if (csrf) request.Headers.Add("X-CSRF-TOKEN", await session.CsrfAsync());
            return await session.Client.SendAsync(request);
        }
        using var missingCsrf = await Register(session.Password, false);
        Assert.Equal(HttpStatusCode.BadRequest, missingCsrf.StatusCode);
        using var weak = await Register("weak-password");
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        using var created = await Register(session.Password);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        await using (var scope = session.Factory.Services.CreateAsyncScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>();
            var user = await users.FindByEmailAsync(session.Email);
            session.userId = user!.Id.ToString();
            Assert.False(await users.IsInRoleAsync(user, CommerceRoles.Admin));
        }
        using var duplicate = await Register(session.Password);
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        using var login = await session.LoginAsync();
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(CommerceRoles.Customer, (await login.Content.ReadFromJsonAsync<AdminProfile>())?.Role);
        using var admin = await session.Client.GetAsync("/api/v1/admin/session");
        Assert.Equal(HttpStatusCode.Forbidden, admin.StatusCode);
    }

    [DatabaseFact]
    public async Task Five_failed_passwords_lock_account_even_with_correct_password()
    {
        await using var session = await Session.CreateAsync();
        for (var i = 0; i < 5; i++)
        {
            using var failure = await session.LoginAsync(password: "IncorrectPassword!123");
            Assert.Equal(HttpStatusCode.Unauthorized, failure.StatusCode);
        }
        using var correct = await session.LoginAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, correct.StatusCode);
    }

    [DatabaseFact]
    public async Task Logout_requires_current_user_csrf_token()
    {
        await using var session = await Session.CreateAsync();
        using var login = await session.LoginAsync();
        using var missing = await session.Client.PostAsync("/api/v1/auth/logout", null);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        using var me = await session.Client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    [DatabaseFact]
    public async Task Login_rate_limit_rejects_excess_attempts()
    {
        await using var session = await Session.CreateAsync();
        for (var i = 0; i < 10; i++)
        {
            using var response = await session.LoginAsync(email: "missing-" + session.Email);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
        using var rejected = await session.LoginAsync(email: "missing-" + session.Email);
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
    }

    private sealed class AuthFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Commerce"] = Environment.GetEnvironmentVariable("TEST_COMMERCE_CONNECTION"),
                ["Logging:LogLevel:Default"] = "None"
            }));
            builder.ConfigureTestServices(services => services.AddDataProtection().UseEphemeralDataProtectionProvider());
        }
    }

    private sealed class Session : IAsyncDisposable
    {
        public AuthFactory Factory { get; } = new();
        public HttpClient Client { get; private set; } = null!;
        public string Email { get; } = $"auth-test-{Guid.NewGuid():N}@example.test";
        public string Password { get; } = $"Test-{Guid.NewGuid():N}-Aa1!";
        public string userId = string.Empty;

        public static async Task<Session> CreateAsync(bool admin = true)
        {
            var session = new Session();
            session.Client = session.Factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });
            await using var scope = session.Factory.Services.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<CommerceDbContext>().Database.MigrateAsync();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>();
            var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
            if (!await roles.RoleExistsAsync(CommerceRoles.Admin)) Assert.True((await roles.CreateAsync(new IdentityRole<Guid>(CommerceRoles.Admin))).Succeeded);
            var user = new AdminUser { Id = Guid.NewGuid(), UserName = session.Email, Email = session.Email, DisplayName = "Test administrator", EmailConfirmed = true, LockoutEnabled = true };
            Assert.True((await users.CreateAsync(user, session.Password)).Succeeded);
            if (admin) Assert.True((await users.AddToRoleAsync(user, CommerceRoles.Admin)).Succeeded);
            session.userId = user.Id.ToString();
            return session;
        }

        public async Task<string> CsrfAsync()
        {
            using var response = await Client.GetAsync("/api/v1/auth/csrf");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<Dictionary<string, string>>())!["requestToken"];
        }

        public async Task<HttpResponseMessage> LoginAsync(string? email = null, string? password = null, bool remember = false)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/login");
            request.Headers.Add("X-CSRF-TOKEN", await CsrfAsync());
            request.Content = JsonContent.Create(new { email = email ?? Email, password = password ?? Password, rememberMe = remember });
            return await Client.SendAsync(request);
        }

        public async ValueTask DisposeAsync()
        {
            await using var scope = Factory.Services.CreateAsyncScope();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>();
            var user = await users.FindByIdAsync(userId);
            if (user is not null) Assert.True((await users.DeleteAsync(user)).Succeeded);
            Client.Dispose();
            await Factory.DisposeAsync();
        }
    }
}
