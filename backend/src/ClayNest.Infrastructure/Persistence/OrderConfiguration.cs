using ClayNest.Domain.Catalog;
using ClayNest.Domain.Orders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace ClayNest.Infrastructure.Persistence;

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.ToTable("Orders", t => t.HasCheckConstraint("CK_Order_Totals", "\"SubtotalVnd\" > 0 AND \"ShippingFeeVnd\" >= 0 AND \"GrandTotalVnd\" = \"SubtotalVnd\" + \"ShippingFeeVnd\""));
        b.ToTable("Orders", t =>
        {
            t.HasCheckConstraint("CK_Order_Status", "\"Status\" IN ('pending','confirmed','packed','shipped','completed','cancelled')");
            t.HasCheckConstraint("CK_Order_Completion", "(\"Status\" = 'completed' AND \"CompletedAt\" IS NOT NULL AND \"PaymentStatus\" = 'paid') OR (\"Status\" <> 'completed' AND \"CompletedAt\" IS NULL AND \"PaymentStatus\" = 'unpaid')");
            t.HasCheckConstraint("CK_Order_Cancellation", "(\"Status\" = 'cancelled' AND \"CancelledAt\" IS NOT NULL AND \"RestockedAt\" IS NOT NULL) OR (\"Status\" <> 'cancelled' AND \"CancelledAt\" IS NULL AND \"RestockedAt\" IS NULL)");
        });
        b.Property(x => x.Revision).IsConcurrencyToken();
        b.HasKey(x => x.Id); b.HasIndex(x => x.Reference).IsUnique(); b.HasIndex(x => x.IdempotencyKey).IsUnique();
        b.HasIndex(x => x.CompletedAt).HasFilter("\"Status\" = 'completed'"); b.HasIndex(x => new { x.CustomerId, x.CreatedAt }); b.HasIndex(x => new { x.Status, x.CreatedAt });
        b.Property(x => x.Reference).HasMaxLength(32); b.Property(x => x.CustomerName).HasMaxLength(100);
        b.Property(x => x.Phone).HasMaxLength(16); b.Property(x => x.Email).HasMaxLength(254);
        b.Property(x => x.Province).HasMaxLength(100); b.Property(x => x.Address).HasMaxLength(500);
        b.Property(x => x.ShippingNote).HasMaxLength(1000); b.Property(x => x.Status).HasMaxLength(20);
        b.Property(x => x.PaymentMethod).HasMaxLength(20); b.Property(x => x.PaymentStatus).HasMaxLength(20);
        b.Property(x => x.PayloadHash).HasMaxLength(64); b.Property(x => x.AccessTokenHash).HasMaxLength(64);
        b.Property(x => x.AccessTokenProtected).HasMaxLength(1024);
        b.HasMany(x => x.Items).WithOne().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
    }
}
public sealed class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> b)
    {
        b.ToTable("OrderItems", t => t.HasCheckConstraint("CK_OrderItem_Amounts", "\"Quantity\" BETWEEN 1 AND 99 AND \"UnitPriceVnd\" > 0 AND \"UnitPriceVnd\" <= 1000000000 AND \"LineTotalVnd\" = \"Quantity\"::bigint * \"UnitPriceVnd\""));
        b.HasKey(x => x.Id); b.HasIndex(x => new { x.OrderId, x.VariantId }).IsUnique();
        b.Property(x => x.Sku).HasMaxLength(64); b.Property(x => x.ProductName).HasMaxLength(180);
        b.Property(x => x.VariantName).HasMaxLength(120); b.Property(x => x.Image).HasMaxLength(500);
        b.HasOne<ProductVariant>().WithMany().HasForeignKey(x => x.VariantId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class OrderStatusChangeConfiguration : IEntityTypeConfiguration<OrderStatusChange>
{
    public void Configure(EntityTypeBuilder<OrderStatusChange> b)
    {
        b.ToTable("OrderStatusChanges", t => t.HasCheckConstraint("CK_OrderChange_Sequence", "\"Sequence\" >= 0"));
        b.HasKey(x => x.Id); b.HasIndex(x => new { x.OrderId, x.Sequence }).IsUnique();
        b.HasIndex(x => new { x.OrderId, x.RequestId }).IsUnique();
        b.Property(x => x.FromStatus).HasMaxLength(20); b.Property(x => x.ToStatus).HasMaxLength(20);
        b.Property(x => x.Reason).HasMaxLength(500); b.Property(x => x.ActorName).HasMaxLength(100);
        b.Property(x => x.PayloadHash).HasMaxLength(64);
        b.HasOne<Order>().WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
    }
}
