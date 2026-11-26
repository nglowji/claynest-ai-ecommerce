using ClayNest.Domain.Catalog;
using ClayNest.Domain.Reviews;
using ClayNest.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace ClayNest.Infrastructure.Persistence;
public sealed class ReviewConfiguration : IEntityTypeConfiguration<ProductReview>
{
    public void Configure(EntityTypeBuilder<ProductReview> b)
    {
        b.ToTable("ProductReviews", table => {
            table.HasCheckConstraint("CK_Review_Rating", "\"Rating\" BETWEEN 1 AND 5");
            table.HasCheckConstraint("CK_Review_Comment", "char_length(\"Comment\") BETWEEN 10 AND 2000");
        });
        b.HasKey(r => r.Id);
        b.Property(r => r.AuthorName).HasMaxLength(100);
        b.Property(r => r.Comment).HasMaxLength(2000);
        b.HasIndex(r => new { r.ProductId, r.CustomerId }).IsUnique();
        b.HasIndex(r => new { r.ProductId, r.CreatedAt, r.Id });
        b.HasOne<Product>().WithMany().HasForeignKey(r => r.ProductId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<AdminUser>().WithMany().HasForeignKey(r => r.CustomerId).OnDelete(DeleteBehavior.Cascade);
    }
}
