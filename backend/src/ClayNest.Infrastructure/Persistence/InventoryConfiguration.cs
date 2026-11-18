using ClayNest.Domain.Catalog;
using ClayNest.Domain.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace ClayNest.Infrastructure.Persistence;

public sealed class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> b)
    {
        b.ToTable("StockMovements", t =>
        {
            t.HasCheckConstraint("CK_Movement_Balance", "\"BalanceAfter\" >= 0 AND \"ThresholdAfter\" BETWEEN 0 AND 1000000");
            t.HasCheckConstraint("CK_Movement_Kind", "(\"Kind\" = 'receipt' AND \"QuantityDelta\" > 0) OR (\"Kind\" = 'adjustment' AND \"QuantityDelta\" <> 0) OR (\"Kind\" = 'threshold' AND \"QuantityDelta\" = 0) OR (\"Kind\" = 'opening' AND \"QuantityDelta\" >= 0)");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasMaxLength(20); b.Property(x => x.Reason).HasMaxLength(500);
        b.Property(x => x.ActorName).HasMaxLength(100);
        b.HasOne<ProductVariant>().WithMany().HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.VariantId, x.CreatedAt, x.Id });
    }
}
