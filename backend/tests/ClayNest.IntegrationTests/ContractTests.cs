using System.Net;
using System.Text;
using System.Text.Json;

namespace ClayNest.IntegrationTests;

public sealed class ContractTests
{
    [Fact]
    public async Task Openapi_exposes_auth_success_and_failure_contracts()
    {
        await using var factory = new ApiFactory(environment: "Development");
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var paths = document.RootElement.GetProperty("paths");
        var login = paths.GetProperty("/api/v1/auth/login").GetProperty("post");
        Assert.Equal("Login", login.GetProperty("operationId").GetString());
        foreach (var code in new[] { "200", "400", "401", "429" })
            Assert.True(login.GetProperty("responses").TryGetProperty(code, out _));
        Assert.True(paths.GetProperty("/api/v1/auth/register").GetProperty("post").GetProperty("responses").TryGetProperty("201", out _));
        Assert.True(paths.GetProperty("/api/v1/admin/session").GetProperty("get").GetProperty("responses").TryGetProperty("403", out _));
        var schemas = document.RootElement.GetProperty("components").GetProperty("schemas");
        var profile = schemas.EnumerateObject().Single(value => value.Name.EndsWith("AdminProfile", StringComparison.Ordinal)).Value;
        foreach (var name in new[] { "id", "email", "displayName", "role" })
            Assert.True(profile.GetProperty("properties").TryGetProperty(name, out _));
    }

    [Fact]
    public async Task Unauthorized_response_is_problem_json_and_has_request_correlation()
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/api/v1/admin/session");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("unauthenticated", body.RootElement.GetProperty("code").GetString());
        Assert.Equal(response.Headers.GetValues("X-Correlation-ID").Single(), body.RootElement.GetProperty("correlationId").GetString());
    }

    [Fact]
    public async Task Malformed_json_has_a_safe_standard_error()
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        using var response = await client.PostAsync("/api/v1/auth/login", new StringContent("{broken", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("invalid_input", body.RootElement.GetProperty("code").GetString());
    }
}
