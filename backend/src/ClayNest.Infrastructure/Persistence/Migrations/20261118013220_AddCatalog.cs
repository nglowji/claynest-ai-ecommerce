using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClayNest.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                schema: "commerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Slug = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    Revision = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Products",
                schema: "commerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    Slug = table.Column<string>(type: "character varying(140)", maxLength: 140, nullable: false),
                    Description = table.Column<string>(type: "character varying(6000)", maxLength: 6000, nullable: false),
                    CraftStory = table.Column<string>(type: "character varying(6000)", maxLength: 6000, nullable: false),
                    Material = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    HandmadeNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    SearchText = table.Column<string>(type: "text", nullable: false),
                    Label = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Published = table.Column<bool>(type: "boolean", nullable: false),
                    Archived = table.Column<bool>(type: "boolean", nullable: false),
                    IsDemo = table.Column<bool>(type: "boolean", nullable: false),
                    Revision = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Products_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalSchema: "commerce",
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductVariants",
                schema: "commerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sku = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Glaze = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    IntendedUse = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    CapacityMl = table.Column<int>(type: "integer", nullable: true),
                    WidthCm = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: true),
                    HeightCm = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: true),
                    WeightG = table.Column<int>(type: "integer", nullable: true),
                    PriceVnd = table.Column<long>(type: "bigint", nullable: false),
                    OriginalPriceVnd = table.Column<long>(type: "bigint", nullable: true),
                    StockQty = table.Column<int>(type: "integer", nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false),
                    CareNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CareSource = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CareVerified = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductVariants", x => x.Id);
                    table.UniqueConstraint("AK_ProductVariants_ProductId_Id", x => new { x.ProductId, x.Id });
                    table.CheckConstraint("CK_Variant_Price", "\"PriceVnd\" > 0 AND \"PriceVnd\" <= 1000000000");
                    table.CheckConstraint("CK_Variant_ReferencePrice", "\"OriginalPriceVnd\" IS NULL OR (\"OriginalPriceVnd\" > \"PriceVnd\" AND \"OriginalPriceVnd\" <= 1000000000)");
                    table.CheckConstraint("CK_Variant_Stock", "\"StockQty\" >= 0");
                    table.ForeignKey(
                        name: "FK_ProductVariants_Products_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "commerce",
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProductImages",
                schema: "commerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    VariantId = table.Column<Guid>(type: "uuid", nullable: true),
                    Url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Alt = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductImages_ProductVariants_ProductId_VariantId",
                        columns: x => new { x.ProductId, x.VariantId },
                        principalSchema: "commerce",
                        principalTable: "ProductVariants",
                        principalColumns: new[] { "ProductId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductImages_Products_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "commerce",
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Slug",
                schema: "commerce",
                table: "Categories",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductImages_ProductId_VariantId",
                schema: "commerce",
                table: "ProductImages",
                columns: new[] { "ProductId", "VariantId" });

            migrationBuilder.CreateIndex(
                name: "IX_Products_CategoryId",
                schema: "commerce",
                table: "Products",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Published_Archived_CategoryId",
                schema: "commerce",
                table: "Products",
                columns: new[] { "Published", "Archived", "CategoryId" });

            migrationBuilder.CreateIndex(
                name: "IX_Products_Slug",
                schema: "commerce",
                table: "Products",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_Active_PriceVnd",
                schema: "commerce",
                table: "ProductVariants",
                columns: new[] { "Active", "PriceVnd" });

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_Sku",
                schema: "commerce",
                table: "ProductVariants",
                column: "Sku",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductImages",
                schema: "commerce");

            migrationBuilder.DropTable(
                name: "ProductVariants",
                schema: "commerce");

            migrationBuilder.DropTable(
                name: "Products",
                schema: "commerce");

            migrationBuilder.DropTable(
                name: "Categories",
                schema: "commerce");
        }
    }
}
