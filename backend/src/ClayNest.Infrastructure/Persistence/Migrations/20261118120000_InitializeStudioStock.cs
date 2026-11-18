using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ClayNest.Infrastructure.Persistence.Migrations;

[DbContext(typeof(CommerceDbContext))]
[Migration("20261118120000_InitializeStudioStock")]
public sealed class InitializeStudioStock : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // One-time initialization for the thirty Nàng Gốm studio items; never reset stock on startup.
        migrationBuilder.Sql("""
            UPDATE commerce."ProductVariants" AS v
            SET "StockQty" = 30
            FROM commerce."Products" AS p
            WHERE v."ProductId" = p."Id"
              AND v."Sku" ~ '^NG-STUDIO-(00[1-9]|0[12][0-9]|030)$'
              AND p."Slug" LIKE 'nang-%'
              AND p."Published" AND NOT p."Archived"
              AND v."StockQty" = 0;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Preserve inventory values: subsequent stock adjustments cannot safely be reversed.
    }
}
