using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ClayNest.API.Endpoints;

namespace ClayNest.IntegrationTests;

public sealed class OperationalTests
{
    [Theory]
    [InlineData("/health", "ok")]
    [InlineData("/ready", "ready")]
    public async Task Operational_endpoints_return_documented_contract(string path, string expected)
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        using var response = await client.GetAsync(path, CancellationToken.None);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expected, (await response.Content.ReadFromJsonAsync<OperationalEndpoints.HealthResponse>())?.Status);
        Assert.True(Guid.TryParse(response.Headers.GetValues("X-Correlation-ID").Single(), out _));
    }

    [Fact]
    public async Task Database_unavailable_does_not_break_liveness_or_expose_details()
    {
        await using var factory = new ApiFactory(ready: false);
        using var client = factory.CreateClient();
        using var ready = await client.GetAsync("/ready", CancellationToken.None);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, ready.StatusCode);
        Assert.Equal("unavailable", (await ready.Content.ReadFromJsonAsync<OperationalEndpoints.HealthResponse>())?.Status);
        using var health = await client.GetAsync("/health", CancellationToken.None);
        Assert.Equal(HttpStatusCode.OK, health.StatusCode);
    }

    [Fact]
    public async Task Unhandled_error_returns_sanitized_problem_details()
    {
        await using var factory = new ApiFactory(fail: true);
        using var client = factory.CreateClient();
        using var response = await client.GetAsync("/ready", CancellationToken.None);
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var content = await response.Content.ReadAsStringAsync(CancellationToken.None);
        Assert.DoesNotContain("private-password-sentinel", content);
        using var document = JsonDocument.Parse(content);
        Assert.Equal(response.Headers.GetValues("X-Correlation-ID").Single(), document.RootElement.GetProperty("correlationId").GetString());
    }

    [Theory]
    [InlineData("http://localhost:5173", true)]
    [InlineData("https://untrusted.example", false)]
    public async Task Cors_uses_explicit_origins(string origin, bool allowed)
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health");
        request.Headers.Add("Origin", origin);
        using var response = await client.SendAsync(request, CancellationToken.None);
        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task Correlation_id_is_propagated_if_valid_and_replaced_if_invalid()
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        var supplied = Guid.NewGuid();
        using var valid = new HttpRequestMessage(HttpMethod.Get, "/health");
        valid.Headers.Add("X-Correlation-ID", supplied.ToString());
        using var validResponse = await client.SendAsync(valid, CancellationToken.None);
        Assert.Equal(supplied.ToString("N"), validResponse.Headers.GetValues("X-Correlation-ID").Single());
        using var invalid = new HttpRequestMessage(HttpMethod.Get, "/health");
        invalid.Headers.Add("X-Correlation-ID", "untrusted-input");
        using var invalidResponse = await client.SendAsync(invalid, CancellationToken.None);
        Assert.True(Guid.TryParse(invalidResponse.Headers.GetValues("X-Correlation-ID").Single(), out _));
    }

    [Fact]
    public async Task Unimplemented_campaign_mutations_are_not_exposed()
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/v1/admin/campaigns", new { }, CancellationToken.None);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}

