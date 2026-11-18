using Microsoft.EntityFrameworkCore;
using ClayNest.Domain.Catalog;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using ClayNest.Infrastructure.Identity;

namespace ClayNest.Infrastructure.Persistence;

public sealed class CommerceDbContext(DbContextOptions<CommerceDbContext> options) : IdentityDbContext<AdminUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ClayNest.Domain.Inventory.StockMovement> StockMovements => Set<ClayNest.Domain.Inventory.StockMovement>();
    public DbSet<ClayNest.Domain.Orders.Order> Orders => Set<ClayNest.Domain.Orders.Order>();
    public const string Schema = "commerce";

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.Entity<AdminUser>().Property(user => user.DisplayName).HasMaxLength(100);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CommerceDbContext).Assembly);
    }
}
