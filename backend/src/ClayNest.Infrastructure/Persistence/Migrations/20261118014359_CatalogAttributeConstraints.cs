using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClayNest.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CatalogAttributeConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "CK_Variant_Attributes",
                schema: "commerce",
                table: "ProductVariants",
                sql: "(\"CapacityMl\" IS NULL OR \"CapacityMl\" BETWEEN 1 AND 100000) AND (\"WidthCm\" IS NULL OR \"WidthCm\" BETWEEN 0.01 AND 1000) AND (\"HeightCm\" IS NULL OR \"HeightCm\" BETWEEN 0.01 AND 1000) AND (\"WeightG\" IS NULL OR \"WeightG\" BETWEEN 1 AND 1000000)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Variant_Sku",
                schema: "commerce",
                table: "ProductVariants",
                sql: "\"Sku\" ~ '^[A-Z0-9][A-Z0-9_-]*$'");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Variant_VerifiedCare",
                schema: "commerce",
                table: "ProductVariants",
                sql: "NOT \"CareVerified\" OR (length(trim(\"CareNote\")) > 0 AND length(trim(\"CareSource\")) > 0)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Variant_Attributes",
                schema: "commerce",
                table: "ProductVariants");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Variant_Sku",
                schema: "commerce",
                table: "ProductVariants");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Variant_VerifiedCare",
                schema: "commerce",
                table: "ProductVariants");
        }
    }
}
