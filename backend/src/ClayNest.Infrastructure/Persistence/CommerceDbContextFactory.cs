using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ClayNest.Infrastructure.Persistence;

public sealed class CommerceDbContextFactory : IDesignTimeDbContextFactory<CommerceDbContext>
{
    public CommerceDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__Commerce")
            ?? throw new InvalidOperationException("Set ConnectionStrings__Commerce before using EF tooling.");
        var options = new DbContextOptionsBuilder<CommerceDbContext>()
            .UseNpgsql(connection, postgres => postgres.MigrationsHistoryTable("__EFMigrationsHistory", CommerceDbContext.Schema)).Options;
        return new CommerceDbContext(options);
    }
}
