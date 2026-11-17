using ClayNest.Application.Abstractions;
using ClayNest.Infrastructure.Health;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Npgsql;

namespace ClayNest.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<DatabaseOptions>()
            .Bind(configuration.GetSection(DatabaseOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton(provider =>
        {
            var options = provider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
            var connection = new NpgsqlConnectionStringBuilder(options.Commerce)
            {
                SearchPath = CommerceDbContext.Schema,
                Timeout = 3,
                CommandTimeout = 3,
                IncludeErrorDetail = false
            };
            return NpgsqlDataSource.Create(connection.ConnectionString);
        });

        services.AddDbContext<CommerceDbContext>((provider, options) =>
            options.UseNpgsql(provider.GetRequiredService<NpgsqlDataSource>(), postgres =>
                postgres.MigrationsHistoryTable("__EFMigrationsHistory", CommerceDbContext.Schema)));
        services.AddSingleton<IReadinessProbe, PostgresReadinessProbe>();
        return services;
    }
}
