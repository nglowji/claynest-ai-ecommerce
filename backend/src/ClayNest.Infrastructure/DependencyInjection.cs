using ClayNest.Application.Abstractions;
using ClayNest.Application.Identity;
using ClayNest.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
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
        services.AddIdentityCore<AdminUser>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.Password.RequiredLength = 12;
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireNonAlphanumeric = true;
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
            options.Lockout.AllowedForNewUsers = true;
        }).AddRoles<IdentityRole<Guid>>().AddEntityFrameworkStores<CommerceDbContext>().AddSignInManager();
        services.AddScoped<ClayNest.Application.Catalog.ICatalogService, ClayNest.Infrastructure.Catalog.CatalogService>();
        services.AddScoped<ClayNest.Application.Catalog.ICatalogImageStorage, ClayNest.Infrastructure.Catalog.LocalCatalogImageStorage>();
        services.AddScoped<IAdminAuthenticationService, AdminAuthenticationService>();
        services.AddScoped<AdminProvisioner>();
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<ClayNest.Application.Orders.IAdminOrderService, ClayNest.Infrastructure.Orders.AdminOrderService>();
        services.AddScoped<ClayNest.Application.Orders.IOrderService, ClayNest.Infrastructure.Orders.OrderService>();
        services.AddScoped<ClayNest.Application.Inventory.IInventoryService, ClayNest.Infrastructure.Inventory.InventoryService>();
        return services;
    }
}
