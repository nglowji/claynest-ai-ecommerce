using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClayNest.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LowStockThreshold",
                schema: "commerce",
                table: "ProductVariants",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "StockRevision",
                schema: "commerce",
                table: "ProductVariants",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "StockMovements",
                schema: "commerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VariantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    QuantityDelta = table.Column<int>(type: "integer", nullable: false),
                    BalanceAfter = table.Column<int>(type: "integer", nullable: false),
                    ThresholdAfter = table.Column<int>(type: "integer", nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ActorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockMovements", x => x.Id);
                    table.CheckConstraint("CK_Movement_Balance", "\"BalanceAfter\" >= 0 AND \"ThresholdAfter\" BETWEEN 0 AND 1000000");
                    table.CheckConstraint("CK_Movement_Kind", "(\"Kind\" = 'receipt' AND \"QuantityDelta\" > 0) OR (\"Kind\" = 'adjustment' AND \"QuantityDelta\" <> 0) OR (\"Kind\" = 'threshold' AND \"QuantityDelta\" = 0) OR (\"Kind\" = 'opening' AND \"QuantityDelta\" >= 0)");
                    table.ForeignKey(
                        name: "FK_StockMovements_ProductVariants_VariantId",
                        column: x => x.VariantId,
                        principalSchema: "commerce",
                        principalTable: "ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Variant_Threshold",
                schema: "commerce",
                table: "ProductVariants",
                sql: "\"LowStockThreshold\" BETWEEN 0 AND 1000000");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_VariantId_CreatedAt_Id",
                schema: "commerce",
                table: "StockMovements",
                columns: new[] { "VariantId", "CreatedAt", "Id" });

            migrationBuilder.Sql("""
                UPDATE commerce."ProductVariants" SET "LowStockThreshold" = 5, "StockRevision" = gen_random_uuid();
                INSERT INTO commerce."StockMovements"
                    ("Id", "VariantId", "Kind", "QuantityDelta", "BalanceAfter", "ThresholdAfter", "Reason", "ActorId", "ActorName", "CreatedAt")
                SELECT gen_random_uuid(), "Id", 'opening', "StockQty", "StockQty", "LowStockThreshold",
                    'Ghi nhận số dư hiện có khi mở sổ kho', NULL, 'Hệ thống', CURRENT_TIMESTAMP
                FROM commerce."ProductVariants" WHERE "StockQty" > 0;

                CREATE FUNCTION commerce.prevent_stock_movement_edit() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'Stock history is append-only' USING ERRCODE = '23514';
                END;
                $$;
                CREATE TRIGGER stock_movements_append_only BEFORE UPDATE OR DELETE ON commerce."StockMovements"
                    FOR EACH ROW EXECUTE FUNCTION commerce.prevent_stock_movement_edit();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER stock_movements_append_only ON commerce.\"StockMovements\"; DROP FUNCTION commerce.prevent_stock_movement_edit();");
            migrationBuilder.DropTable(
                name: "StockMovements",
                schema: "commerce");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Variant_Threshold",
                schema: "commerce",
                table: "ProductVariants");

            migrationBuilder.DropColumn(
                name: "LowStockThreshold",
                schema: "commerce",
                table: "ProductVariants");

            migrationBuilder.DropColumn(
                name: "StockRevision",
                schema: "commerce",
                table: "ProductVariants");
        }
    }
}
