using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClayNest.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderCheckout : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Movement_Kind",
                schema: "commerce",
                table: "StockMovements");

            migrationBuilder.AddColumn<Guid>(
                name: "OrderId",
                schema: "commerce",
                table: "StockMovements",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Orders",
                schema: "commerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Reference = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: true),
                    CustomerName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    Province = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ShippingNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PaymentMethod = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PaymentStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SubtotalVnd = table.Column<long>(type: "bigint", nullable: false),
                    ShippingFeeVnd = table.Column<long>(type: "bigint", nullable: false),
                    GrandTotalVnd = table.Column<long>(type: "bigint", nullable: false),
                    IdempotencyKey = table.Column<Guid>(type: "uuid", nullable: false),
                    PayloadHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AccessTokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AccessTokenProtected = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    AccessExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AccessRevokedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Orders", x => x.Id);
                    table.CheckConstraint("CK_Order_Totals", "\"SubtotalVnd\" > 0 AND \"ShippingFeeVnd\" >= 0 AND \"GrandTotalVnd\" = \"SubtotalVnd\" + \"ShippingFeeVnd\"");
                });

            migrationBuilder.CreateTable(
                name: "OrderItems",
                schema: "commerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    VariantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sku = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ProductName = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    VariantName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Image = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPriceVnd = table.Column<long>(type: "bigint", nullable: false),
                    LineTotalVnd = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderItems", x => x.Id);
                    table.CheckConstraint("CK_OrderItem_Amounts", "\"Quantity\" BETWEEN 1 AND 99 AND \"UnitPriceVnd\" > 0 AND \"UnitPriceVnd\" <= 1000000000 AND \"LineTotalVnd\" = \"Quantity\"::bigint * \"UnitPriceVnd\"");
                    table.ForeignKey(
                        name: "FK_OrderItems_Orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "commerce",
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrderItems_ProductVariants_VariantId",
                        column: x => x.VariantId,
                        principalSchema: "commerce",
                        principalTable: "ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_OrderId",
                schema: "commerce",
                table: "StockMovements",
                column: "OrderId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Movement_Kind",
                schema: "commerce",
                table: "StockMovements",
                sql: "(\"Kind\" = 'receipt' AND \"QuantityDelta\" > 0) OR (\"Kind\" = 'adjustment' AND \"QuantityDelta\" <> 0) OR (\"Kind\" = 'threshold' AND \"QuantityDelta\" = 0) OR (\"Kind\" = 'opening' AND \"QuantityDelta\" >= 0) OR (\"Kind\" = 'sale' AND \"QuantityDelta\" < 0 AND \"OrderId\" IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_OrderId_VariantId",
                schema: "commerce",
                table: "OrderItems",
                columns: new[] { "OrderId", "VariantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderItems_VariantId",
                schema: "commerce",
                table: "OrderItems",
                column: "VariantId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CustomerId_CreatedAt",
                schema: "commerce",
                table: "Orders",
                columns: new[] { "CustomerId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_IdempotencyKey",
                schema: "commerce",
                table: "Orders",
                column: "IdempotencyKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_Reference",
                schema: "commerce",
                table: "Orders",
                column: "Reference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_Status_CreatedAt",
                schema: "commerce",
                table: "Orders",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_StockMovements_Orders_OrderId",
                schema: "commerce",
                table: "StockMovements",
                column: "OrderId",
                principalSchema: "commerce",
                principalTable: "Orders",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StockMovements_Orders_OrderId",
                schema: "commerce",
                table: "StockMovements");

            migrationBuilder.DropTable(
                name: "OrderItems",
                schema: "commerce");

            migrationBuilder.DropTable(
                name: "Orders",
                schema: "commerce");

            migrationBuilder.DropIndex(
                name: "IX_StockMovements_OrderId",
                schema: "commerce",
                table: "StockMovements");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Movement_Kind",
                schema: "commerce",
                table: "StockMovements");

            migrationBuilder.DropColumn(
                name: "OrderId",
                schema: "commerce",
                table: "StockMovements");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Movement_Kind",
                schema: "commerce",
                table: "StockMovements",
                sql: "(\"Kind\" = 'receipt' AND \"QuantityDelta\" > 0) OR (\"Kind\" = 'adjustment' AND \"QuantityDelta\" <> 0) OR (\"Kind\" = 'threshold' AND \"QuantityDelta\" = 0) OR (\"Kind\" = 'opening' AND \"QuantityDelta\" >= 0)");
        }
    }
}
