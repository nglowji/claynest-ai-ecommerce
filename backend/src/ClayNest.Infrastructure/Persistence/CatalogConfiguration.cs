using ClayNest.Domain.Catalog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClayNest.Infrastructure.Persistence;

public sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.ToTable("Categories"); b.HasKey(x => x.Id); b.Property(x => x.Name).HasMaxLength(100);
        b.Property(x => x.Slug).HasMaxLength(140); b.HasIndex(x => x.Slug).IsUnique();
        b.Property(x => x.Revision).IsConcurrencyToken();
    }
}
public sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> b)
    {
        b.ToTable("Products"); b.HasKey(x => x.Id); b.Property(x => x.Name).HasMaxLength(180);
        b.Property(x => x.Slug).HasMaxLength(140); b.HasIndex(x => x.Slug).IsUnique();
        b.Property(x => x.Description).HasMaxLength(6000); b.Property(x => x.CraftStory).HasMaxLength(6000);
        b.Property(x => x.Material).HasMaxLength(160); b.Property(x => x.HandmadeNote).HasMaxLength(1000); b.Property(x => x.Label).HasMaxLength(32);
        b.Property(x => x.SourceUrl).HasMaxLength(500); b.Property(x => x.SourceName).HasMaxLength(120);
        b.Property(x => x.SourceDimensions).HasMaxLength(300); b.Property(x => x.SourceAvailability).HasMaxLength(160); b.Property(x => x.PriceUnit).HasMaxLength(60);
        b.Property(x => x.Revision).IsConcurrencyToken(); b.HasIndex(x => new { x.Published, x.Archived, x.CategoryId });
        b.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Variants).WithOne().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Images).WithOne().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}
public sealed class VariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> b)
    {
        b.ToTable("ProductVariants", t =>
        {
            t.HasCheckConstraint("CK_Variant_Price", "\"PriceVnd\" > 0 AND \"PriceVnd\" <= 1000000000");
            t.HasCheckConstraint("CK_Variant_ReferencePrice", "\"OriginalPriceVnd\" IS NULL OR (\"OriginalPriceVnd\" > \"PriceVnd\" AND \"OriginalPriceVnd\" <= 1000000000)");
            t.HasCheckConstraint("CK_Variant_Attributes", "(\"CapacityMl\" IS NULL OR \"CapacityMl\" BETWEEN 1 AND 100000) AND (\"WidthCm\" IS NULL OR \"WidthCm\" BETWEEN 0.01 AND 1000) AND (\"HeightCm\" IS NULL OR \"HeightCm\" BETWEEN 0.01 AND 1000) AND (\"WeightG\" IS NULL OR \"WeightG\" BETWEEN 1 AND 1000000)");
            t.HasCheckConstraint("CK_Variant_VerifiedCare", "NOT \"CareVerified\" OR (length(trim(\"CareNote\")) > 0 AND length(trim(\"CareSource\")) > 0)");
            t.HasCheckConstraint("CK_Variant_Sku", "\"Sku\" ~ '^[A-Z0-9][A-Z0-9_-]*$'");
            t.HasCheckConstraint("CK_Variant_Stock", "\"StockQty\" >= 0");
        });
        b.HasKey(x => x.Id); b.HasIndex(x => x.Sku).IsUnique(); b.Property(x => x.Sku).HasMaxLength(64);
        b.Property(x => x.Name).HasMaxLength(120); b.Property(x => x.Glaze).HasMaxLength(120); b.Property(x => x.IntendedUse).HasMaxLength(160);
        b.Property(x => x.WidthCm).HasPrecision(8, 2); b.Property(x => x.HeightCm).HasPrecision(8, 2);
        b.Property(x => x.CareNote).HasMaxLength(2000); b.Property(x => x.CareSource).HasMaxLength(1000);
        b.HasIndex(x => new { x.Active, x.PriceVnd });
        b.HasAlternateKey(x => new { x.ProductId, x.Id });
    }
}
public sealed class ImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> b)
    {
        b.ToTable("ProductImages"); b.HasKey(x => x.Id); b.Property(x => x.Url).HasMaxLength(500); b.Property(x => x.Alt).HasMaxLength(240);
        b.HasOne<ProductVariant>().WithMany().HasForeignKey(x => new { x.ProductId, x.VariantId })
            .HasPrincipalKey(x => new { x.ProductId, x.Id }).OnDelete(DeleteBehavior.Restrict);
    }
}
