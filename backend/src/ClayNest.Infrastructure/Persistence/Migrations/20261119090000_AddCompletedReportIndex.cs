using Microsoft.EntityFrameworkCore.Migrations;
namespace ClayNest.Infrastructure.Persistence.Migrations;
public partial class AddCompletedReportIndex : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.CreateIndex(
        name:"IX_Orders_CompletedAt",schema:"commerce",table:"Orders",column:"CompletedAt",filter:"\"Status\" = 'completed'");
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropIndex(name:"IX_Orders_CompletedAt",schema:"commerce",table:"Orders");
}
