using System.Net;
using Microsoft.AspNetCore.HttpOverrides;
namespace ClayNest.API.Configuration;

public static class TrustedProxy
{
    public static IServiceCollection AddTrustedProxy(this IServiceCollection services, IConfiguration config)
    {
        var address = config["Proxy:Address"];
        if (string.IsNullOrEmpty(address)) return services;
        if (!IPAddress.TryParse(address, out var proxy)) throw new InvalidOperationException("Proxy:Address must be one trusted IP address.");
        services.Configure<ForwardedHeadersOptions>(options => {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1;
            options.KnownProxies.Clear(); options.KnownIPNetworks.Clear();
            options.KnownProxies.Add(proxy);
        });
        return services;
    }
}
