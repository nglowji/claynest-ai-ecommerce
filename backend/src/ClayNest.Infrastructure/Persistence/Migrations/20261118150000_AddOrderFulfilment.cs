using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClayNest.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderFulfilment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_StockMovements_OrderId",
                schema: "commerce",
                table: "StockMovements");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Movement_Kind",
                schema: "commerce",
                table: "StockMovements");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CancelledAt",
                schema: "commerce",
                table: "Orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CompletedAt",
                schema: "commerce",
                table: "Orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "RestockedAt",
                schema: "commerce",
                table: "Orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Revision",
                schema: "commerce",
                table: "Orders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                schema: "commerce",
                table: "Orders",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.CreateTable(
                name: "OrderStatusChanges",
                schema: "commerce",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sequence = table.Column<int>(type: "integer", nullable: false),
                    FromStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ToStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ActorId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActorName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: true),
                    PayloadHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderStatusChanges", x => x.Id);
                    table.CheckConstraint("CK_OrderChange_Sequence", "\"Sequence\" >= 0");
                    table.ForeignKey(
                        name: "FK_OrderStatusChanges_Orders_OrderId",
                        column: x => x.OrderId,
                        principalSchema: "commerce",
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_OrderId_VariantId_Kind",
                schema: "commerce",
                table: "StockMovements",
                columns: new[] { "OrderId", "VariantId", "Kind" },
                unique: true,
                filter: "\"OrderId\" IS NOT NULL AND \"Kind\" IN ('sale','restock')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Movement_Kind",
                schema: "commerce",
                table: "StockMovements",
                sql: "(\"Kind\" = 'receipt' AND \"QuantityDelta\" > 0) OR (\"Kind\" = 'adjustment' AND \"QuantityDelta\" <> 0) OR (\"Kind\" = 'threshold' AND \"QuantityDelta\" = 0) OR (\"Kind\" = 'opening' AND \"QuantityDelta\" >= 0) OR (\"Kind\" = 'sale' AND \"QuantityDelta\" < 0 AND \"OrderId\" IS NOT NULL) OR (\"Kind\" = 'restock' AND \"QuantityDelta\" > 0 AND \"OrderId\" IS NOT NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Order_Cancellation",
                schema: "commerce",
                table: "Orders",
                sql: "(\"Status\" = 'cancelled' AND \"CancelledAt\" IS NOT NULL AND \"RestockedAt\" IS NOT NULL) OR (\"Status\" <> 'cancelled' AND \"CancelledAt\" IS NULL AND \"RestockedAt\" IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Order_Completion",
                schema: "commerce",
                table: "Orders",
                sql: "(\"Status\" = 'completed' AND \"CompletedAt\" IS NOT NULL AND \"PaymentStatus\" = 'paid') OR (\"Status\" <> 'completed' AND \"CompletedAt\" IS NULL AND \"PaymentStatus\" = 'unpaid')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Order_Status",
                schema: "commerce",
                table: "Orders",
                sql: "\"Status\" IN ('pending','confirmed','packed','shipped','completed','cancelled')");

            migrationBuilder.CreateIndex(
                name: "IX_OrderStatusChanges_OrderId_RequestId",
                schema: "commerce",
                table: "OrderStatusChanges",
                columns: new[] { "OrderId", "RequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderStatusChanges_OrderId_Sequence",
                schema: "commerce",
                table: "OrderStatusChanges",
                columns: new[] { "OrderId", "Sequence" },
                unique: true);

            migrationBuilder.Sql("""
                UPDATE commerce."Orders" SET "UpdatedAt" = "CreatedAt";
                INSERT INTO commerce."OrderStatusChanges"
                    ("Id","OrderId","Sequence","FromStatus","ToStatus","Reason","ActorId","ActorName","CreatedAt","RequestId","PayloadHash")
                SELECT gen_random_uuid(), "Id", 0, '', "Status", 'Khởi tạo lịch sử cho đơn hiện có', NULL, 'Hệ thống', "CreatedAt", NULL, ''
                FROM commerce."Orders";
                CREATE FUNCTION commerce.prevent_order_change_edit() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'Order history is append-only' USING ERRCODE = '23514';
                END;
                $$;
                CREATE TRIGGER order_changes_append_only BEFORE UPDATE OR DELETE ON commerce."OrderStatusChanges"
                    FOR EACH ROW EXECUTE FUNCTION commerce.prevent_order_change_edit();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM commerce."OrderStatusChanges" WHERE "Sequence" > 0) THEN
                        RAISE EXCEPTION 'Cannot remove fulfilment audit history; use a forward migration';
                    END IF;
                END $$;
                DROP TRIGGER order_changes_append_only ON commerce."OrderStatusChanges";
                DROP FUNCTION commerce.prevent_order_change_edit();
                """);
            migrationBuilder.DropTable(
                name: "OrderStatusChanges",
                schema: "commerce");

            migrationBuilder.DropIndex(
                name: "IX_StockMovements_OrderId_VariantId_Kind",
                schema: "commerce",
                table: "StockMovements");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Movement_Kind",
                schema: "commerce",
                table: "StockMovements");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Order_Cancellation",
                schema: "commerce",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Order_Completion",
                schema: "commerce",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Order_Status",
                schema: "commerce",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                schema: "commerce",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                schema: "commerce",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "RestockedAt",
                schema: "commerce",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Revision",
                schema: "commerce",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                schema: "commerce",
                table: "Orders");

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
        }
    }
}
