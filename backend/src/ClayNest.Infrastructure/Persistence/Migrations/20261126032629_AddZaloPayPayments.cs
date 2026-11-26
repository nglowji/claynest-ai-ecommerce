using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClayNest.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddZaloPayPayments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Order_Completion",
                schema: "commerce",
                table: "Orders");

            migrationBuilder.CreateTable(
                name: "ZaloPayments",
                schema: "commerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppId = table.Column<int>(type: "integer", nullable: false),
                    AppTransId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Amount = table.Column<long>(type: "bigint", nullable: false),
                    AppTime = table.Column<long>(type: "bigint", nullable: false),
                    State = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    QrPayload = table.Column<string>(type: "character varying(8192)", maxLength: 8192, nullable: false),
                    OrderUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastCheckedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ProviderTransactionId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ZaloPayments", x => x.Id);
                    table.CheckConstraint("CK_Zalo_Amount", "\"Amount\" > 0");
                    table.CheckConstraint("CK_Zalo_State", "\"State\" IN ('created','pending','paid','expired')");
                    table.ForeignKey(
                        name: "FK_ZaloPayments_Orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "commerce",
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Order_Completion",
                schema: "commerce",
                table: "Orders",
                sql: "(\"Status\" = 'completed' AND \"CompletedAt\" IS NOT NULL AND \"PaymentStatus\" = 'paid') OR (\"Status\" <> 'completed' AND \"CompletedAt\" IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Order_Payment",
                schema: "commerce",
                table: "Orders",
                sql: "\"PaymentMethod\" IN ('cod','zalopay') AND \"PaymentStatus\" IN ('unpaid','paid','refund_required') AND (\"PaymentMethod\" <> 'cod' OR \"Status\" = 'completed' OR \"PaymentStatus\" = 'unpaid') AND (\"PaymentStatus\" <> 'refund_required' OR (\"PaymentMethod\" = 'zalopay' AND \"Status\" = 'cancelled'))");

            migrationBuilder.CreateIndex(
                name: "IX_ZaloPayments_AppTransId",
                schema: "commerce",
                table: "ZaloPayments",
                column: "AppTransId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ZaloPayments_OrderId",
                schema: "commerce",
                table: "ZaloPayments",
                column: "OrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ZaloPayments_ProviderTransactionId",
                schema: "commerce",
                table: "ZaloPayments",
                column: "ProviderTransactionId",
                unique: true,
                filter: "\"ProviderTransactionId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ZaloPayments_State_ExpiresAt",
                schema: "commerce",
                table: "ZaloPayments",
                columns: new[] { "State", "ExpiresAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ZaloPayments",
                schema: "commerce");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Order_Completion",
                schema: "commerce",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Order_Payment",
                schema: "commerce",
                table: "Orders");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Order_Completion",
                schema: "commerce",
                table: "Orders",
                sql: "(\"Status\" = 'completed' AND \"CompletedAt\" IS NOT NULL AND \"PaymentStatus\" = 'paid') OR (\"Status\" <> 'completed' AND \"CompletedAt\" IS NULL AND \"PaymentStatus\" = 'unpaid')");
        }
    }
}
