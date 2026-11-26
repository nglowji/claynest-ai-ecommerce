using System.Net;
using System.Net.Http.Json;
using ClayNest.Application.Identity;
using ClayNest.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
namespace ClayNest.IntegrationTests;

public sealed class AccountTests
{
    [DatabaseFact]
    public async Task Profile_is_self_only_and_password_change_revokes_all_old_sessions()
    {
        await using var s = await Session.Create(); await s.Login();
        using var guest = s.Factory.CreateClient(new() {BaseAddress = new Uri("https://localhost")});
        using var forbidden = await guest.PutAsJsonAsync("/api/v1/auth/profile", new {displayName = "Intruder"});
        Assert.Equal(HttpStatusCode.Unauthorized, forbidden.StatusCode);
        using var csrf = await s.Client.PutAsJsonAsync("/api/v1/auth/profile", new {displayName = "No CSRF"});
        Assert.Equal(HttpStatusCode.BadRequest, csrf.StatusCode);
        using var changed = await s.Post("profile", new {displayName = "  New customer name  ", role = "Admin", email = "other@example.test"}, HttpMethod.Put);
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var profile = (await changed.Content.ReadFromJsonAsync<AdminProfile>())!;
        Assert.Equal("New customer name", profile.DisplayName); Assert.Equal(s.Email, profile.Email); Assert.Equal("Customer", profile.Role);
        using var second = s.Factory.CreateClient(new() {BaseAddress = new Uri("https://localhost")}); await s.Login(second);
        using var wrong = await s.Post("change-password", new {currentPassword = "Wrong!123456789", newPassword = Session.NewPassword});
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        using var password = await s.Post("change-password", new {currentPassword = Session.Password, newPassword = Session.NewPassword});
        Assert.Equal(HttpStatusCode.NoContent, password.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await second.GetAsync("/api/v1/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await s.Client.GetAsync("/api/v1/auth/me")).StatusCode);
        await s.Login(password: Session.NewPassword);
    }
    [DatabaseFact]
    public async Task Recovery_never_returns_tokens_and_reset_is_single_use_under_concurrency()
    {
        await using var s = await Session.Create(); await s.Login();
        using var signedIn = s.Factory.CreateClient(new() {BaseAddress = new Uri("https://localhost")}); await s.Login(signedIn);
        using var known = await s.Post("forgot-password", new {email = s.Email});
        using var unknown = await s.Post("forgot-password", new {email = "missing-" + Guid.NewGuid() + "@example.test"});
        Assert.Equal(HttpStatusCode.Accepted, known.StatusCode); Assert.Equal(known.StatusCode, unknown.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
        Assert.DoesNotContain("token", await known.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        using var duplicateMail = await s.Post("forgot-password", new {email = s.Email}); Assert.Single(s.Mail.Messages);
        var data = s.Credentials();
        using var tampered = await s.Post("reset-password", new {userId = s.UserId, token = "tampered", newPassword = Session.NewPassword});
        Assert.Equal(HttpStatusCode.BadRequest, tampered.StatusCode);
        using var another = await s.Post("reset-password", new {userId = Guid.NewGuid(), token = data.Token, newPassword = Session.NewPassword});
        Assert.Equal(HttpStatusCode.BadRequest, another.StatusCode);
        // Fetch CSRF before changing the stamp; two unauthenticated clients model concurrent link use.
        using var a = s.Factory.CreateClient(new() {BaseAddress = new Uri("https://localhost")});
        using var b = s.Factory.CreateClient(new() {BaseAddress = new Uri("https://localhost")});
        var results = await Task.WhenAll(s.Post("reset-password", new {userId = s.UserId, token = data.Token, newPassword = Session.NewPassword}, client: a),
            s.Post("reset-password", new {userId = s.UserId, token = data.Token, newPassword = "Another-Password!123"}, client: b));
        Assert.Single(results, r => r.StatusCode == HttpStatusCode.NoContent); Assert.Single(results, r => r.StatusCode == HttpStatusCode.BadRequest);
        foreach (var result in results) result.Dispose();
        Assert.Equal(HttpStatusCode.Unauthorized, (await signedIn.GetAsync("/api/v1/auth/me")).StatusCode);
        using var replay = await s.Post("reset-password", new {userId = s.UserId, token = data.Token, newPassword = Session.NewPassword}, client: a);
        Assert.Equal(HttpStatusCode.BadRequest, replay.StatusCode);
    }
    [DatabaseFact]
    public async Task Email_tokens_cannot_reset_password_and_verified_email_is_reflected_in_profile()
    {
        await using var s = await Session.Create(requireConfirmed: true);
        using var denied = await s.Post("login", new {email = s.Email, password = Session.Password}); Assert.Equal(HttpStatusCode.Unauthorized, denied.StatusCode);
        using var requested = await s.Post("request-verification", new {email = s.Email}); Assert.Equal(HttpStatusCode.Accepted, requested.StatusCode);
        var data = s.Credentials();
        using var invalidPurpose = await s.Post("reset-password", new {userId = s.UserId, token = data.Token, newPassword = Session.NewPassword});
        Assert.Equal(HttpStatusCode.BadRequest, invalidPurpose.StatusCode);
        using var verify = await s.Post("confirm-email", new {userId = s.UserId, token = data.Token}); Assert.Equal(HttpStatusCode.NoContent, verify.StatusCode);
        await s.Login(); var profile = await s.Client.GetFromJsonAsync<AdminProfile>("/api/v1/auth/me"); Assert.True(profile!.EmailConfirmed);
    }
    [DatabaseFact]
    public async Task Expired_tokens_cannot_change_credentials()
    {
        await using var s = await Session.Create(expired: true);
        using var requested = await s.Post("forgot-password", new {email = s.Email}); var data = s.Credentials();
        using var reset = await s.Post("reset-password", new {userId = s.UserId, token = data.Token, newPassword = Session.NewPassword});
        Assert.Equal(HttpStatusCode.BadRequest, reset.StatusCode); await s.Login();
    }
    internal sealed class Mailbox : IAccountEmailSender
    {
        public List<string> Messages = [];
        public Task SendAsync(string recipient, string subject, string body) { lock(Messages) Messages.Add(body); return Task.CompletedTask; }
    }
    internal sealed class Session : IAsyncDisposable
    {
        public const string Password = "Account-Password!123", NewPassword = "Updated-Password!456";
        public WebApplicationFactory<Program> Factory = null!; public HttpClient Client = null!;
        public CheckoutTests.Fixture Source = null!; public Mailbox Mail = new(); public Guid UserId;
        public string Email = "account-" + Guid.NewGuid().ToString("N") + "@example.test";
        public static async Task<Session> Create(bool expired = false, bool requireConfirmed = false)
        {
            var s = new Session {Source = await CheckoutTests.Fixture.Create(1)};
            s.Factory = s.Source.Factory.WithWebHostBuilder(b => b.ConfigureTestServices(services => {
                services.AddSingleton<IAccountEmailSender>(s.Mail);
                services.PostConfigure<AccountMailOptions>(o => o.RequireConfirmedEmail = requireConfirmed);
                if (expired) services.PostConfigure<DataProtectionTokenProviderOptions>(o => o.TokenLifespan = TimeSpan.FromSeconds(-1));
            }));
            s.Client = s.Factory.CreateClient(new() {BaseAddress = new Uri("https://localhost")});
            await using var scope = s.Factory.Services.CreateAsyncScope();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<AdminUser>>();
            var user = new AdminUser {Id = Guid.NewGuid(), Email = s.Email, UserName = s.Email, DisplayName = "Account customer"};
            Assert.True((await users.CreateAsync(user, Password)).Succeeded); s.UserId = user.Id; return s;
        }
        public (string UserId, string Token) Credentials()
        {
            var link = Mail.Messages.Last().Split('\n').Single(l => l.StartsWith("http", StringComparison.Ordinal));
            var parts = new Uri(link).Fragment.TrimStart('#').Split('&').Select(p => p.Split('=', 2)).ToDictionary(p => p[0], p => Uri.UnescapeDataString(p[1]));
            return (parts["user"], parts["token"]);
        }
        public async Task<HttpResponseMessage> Post(string path, object body, HttpMethod? method = null, HttpClient? client = null)
        {
            var target = client ?? Client;
            var csrf = (await target.GetFromJsonAsync<Dictionary<string,string>>("/api/v1/auth/csrf"))!["requestToken"];
            using var request = new HttpRequestMessage(method ?? HttpMethod.Post, "/api/v1/auth/" + path) {Content = JsonContent.Create(body)};
            request.Headers.Add("X-CSRF-TOKEN", csrf); return await target.SendAsync(request);
        }
        public async Task Login(HttpClient? client = null, string password = Password)
        {
            using var response = await Post("login", new {email = Email, password}, client: client); Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        public async ValueTask DisposeAsync() {Client.Dispose(); await Factory.DisposeAsync(); await Source.DisposeAsync();}
    }
}
