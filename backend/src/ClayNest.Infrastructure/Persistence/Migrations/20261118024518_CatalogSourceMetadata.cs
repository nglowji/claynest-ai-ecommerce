using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClayNest.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CatalogSourceMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PriceUnit",
                schema: "commerce",
                table: "Products",
                type: "character varying(60)",
                maxLength: 60,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SourceAvailability",
                schema: "commerce",
                table: "Products",
                type: "character varying(160)",
                maxLength: 160,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SourceDimensions",
                schema: "commerce",
                table: "Products",
                type: "character varying(300)",
                maxLength: 300,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SourceName",
                schema: "commerce",
                table: "Products",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SourceUrl",
                schema: "commerce",
                table: "Products",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PriceUnit",
                schema: "commerce",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "SourceAvailability",
                schema: "commerce",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "SourceDimensions",
                schema: "commerce",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "SourceName",
                schema: "commerce",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "SourceUrl",
                schema: "commerce",
                table: "Products");
        }
    }
}
