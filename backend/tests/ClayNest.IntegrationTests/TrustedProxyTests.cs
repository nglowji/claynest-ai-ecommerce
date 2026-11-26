using System.Net;
using System.Net.Http.Json;
using ClayNest.API.Configuration;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
namespace ClayNest.IntegrationTests;

public sealed class TrustedProxyTests
{
    [Theory]
    [InlineData("172.30.92.2", "https", "203.0.113.7")]
    [InlineData("172.30.92.9", "http", "172.30.92.9")]
    [InlineData("::ffff:172.30.92.2", "https", "203.0.113.7")]
    public async Task Only_the_configured_proxy_can_forward_client_and_protocol(string peer, string scheme, string client)
    {
        using var host = await new HostBuilder().ConfigureWebHost(web => web.UseTestServer()
            .ConfigureServices(services => services.AddTrustedProxy(new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string,string?> { ["Proxy:Address"] = "172.30.92.2" }).Build()))
            .Configure(app => {
                app.Use((http, next) => {http.Connection.RemoteIpAddress = IPAddress.Parse(peer); return next();});
                app.UseForwardedHeaders();
                app.Run(http => http.Response.WriteAsJsonAsync(new {scheme = http.Request.Scheme,
                    client = http.Connection.RemoteIpAddress!.ToString(), host = http.Request.Host.Value}));
            })).StartAsync();
        using var request = new HttpRequestMessage(HttpMethod.Get, "http://localhost/");
        request.Headers.Add("X-Forwarded-Proto", "https"); request.Headers.Add("X-Forwarded-For", "203.0.113.7");
        request.Headers.Add("X-Forwarded-Host", "attacker.invalid");
        using var response = await host.GetTestClient().SendAsync(request);
        var values = (await response.Content.ReadFromJsonAsync<Dictionary<string,string>>())!;
        Assert.Equal(scheme, values["scheme"]); Assert.Equal(client, values["client"]); Assert.Equal("localhost", values["host"]);
    }
    [Fact]
    public void Invalid_proxy_address_is_rejected_at_configuration()
    {
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["Proxy:Address"] = "*" }).Build();
        Assert.Throws<InvalidOperationException>(() => new ServiceCollection().AddTrustedProxy(config));
    }
}
