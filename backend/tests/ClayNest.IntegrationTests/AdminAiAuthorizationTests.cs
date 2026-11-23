using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using ClayNest.Application.AdminAi;
using ClayNest.Application.Chat;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
namespace ClayNest.IntegrationTests;

public sealed class AdminAiAuthorizationTests
{
    private sealed class Auth(IOptionsMonitor<AuthenticationSchemeOptions> options,
        Microsoft.Extensions.Logging.ILoggerFactory logger, UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var role = Request.Headers["X-Test-Role"].ToString();
            if (string.IsNullOrEmpty(role)) return Task.FromResult(AuthenticateResult.NoResult());
            var principal = new ClaimsPrincipal(new ClaimsIdentity([
                new(ClaimTypes.NameIdentifier, "00000000-0000-0000-0000-000000000001"),
                new(ClaimTypes.Role, role)], Scheme.Name));
            return Task.FromResult(AuthenticateResult.Success(new(principal, Scheme.Name)));
        }
    }
    private sealed class Service : IAdminAiService
    {
        public int Calls;
        public bool Fail;
        public Task<AdminAiResponse> AskAsync(AdminAiRequest request, CancellationToken ct)
        {
            Calls++;
            if (Fail) throw new ChatUnavailableException();
            return Task.FromResult(new AdminAiResponse("Grounded response", new(2026, 11, 1),
                new(2026, 11, 30), DateTimeOffset.UtcNow, false, [], []));
        }
    }
    [Fact]
    public async Task Assistant_requires_admin_and_csrf_and_redacts_provider_failures()
    {
        var service = new Service();
        await using var factory = new ApiFactory().WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication(o => { o.DefaultAuthenticateScheme = "AdminAiTest"; o.DefaultChallengeScheme = "AdminAiTest"; o.DefaultForbidScheme = "AdminAiTest"; })
                .AddScheme<AuthenticationSchemeOptions, Auth>("AdminAiTest", _ => { });
            services.RemoveAll<IAdminAiService>(); services.AddSingleton<IAdminAiService>(service);
        }));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new("https://localhost") });
        async Task<HttpResponseMessage> Ask(bool csrf = false)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/admin/assistant") { Content = JsonContent.Create(new AdminAiRequest("hello")) };
            if (csrf) request.Headers.Add("X-CSRF-TOKEN", (await client.GetFromJsonAsync<Dictionary<string, string>>("/api/v1/auth/csrf"))!["requestToken"]);
            return await client.SendAsync(request);
        }
        using var guest = await Ask(); Assert.Equal(HttpStatusCode.Unauthorized, guest.StatusCode);
        client.DefaultRequestHeaders.Add("X-Test-Role", "Customer");
        using var customer = await Ask(); Assert.Equal(HttpStatusCode.Forbidden, customer.StatusCode);
        Assert.Equal(0, service.Calls);
        client.DefaultRequestHeaders.Remove("X-Test-Role"); client.DefaultRequestHeaders.Add("X-Test-Role", "Admin");
        using var missing = await Ask(); Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Equal(0, service.Calls);
        using var success = await Ask(true); Assert.Equal(HttpStatusCode.OK, success.StatusCode);
        Assert.Contains("no-store", success.Headers.CacheControl!.ToString());
        service.Fail = true;
        using var unavailable = await Ask(true); Assert.Equal(HttpStatusCode.ServiceUnavailable, unavailable.StatusCode);
        Assert.DoesNotContain("Exception", await unavailable.Content.ReadAsStringAsync());
    }
}
