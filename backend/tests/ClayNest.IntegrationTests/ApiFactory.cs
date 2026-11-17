using ClayNest.Application.Abstractions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ClayNest.IntegrationTests;

public sealed class ApiFactory(bool ready = true, bool fail = false) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(
            new Dictionary<string, string?> { ["ConnectionStrings:Commerce"] = "Host=localhost;Database=unused;Username=unused" }));
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IReadinessProbe>();
            services.AddSingleton<IReadinessProbe>(new StubProbe(ready, fail));
        });
    }

    private sealed class StubProbe(bool ready, bool fail) : IReadinessProbe
    {
        public Task<bool> IsReadyAsync(CancellationToken cancellationToken) => fail
            ? throw new InvalidOperationException("private-password-sentinel") : Task.FromResult(ready);
    }
}
