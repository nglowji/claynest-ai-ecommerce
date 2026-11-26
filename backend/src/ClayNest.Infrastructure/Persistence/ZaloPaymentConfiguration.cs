using ClayNest.Domain.Orders;
using ClayNest.Domain.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace ClayNest.Infrastructure.Persistence;
public sealed class ZaloPaymentConfiguration : IEntityTypeConfiguration<ZaloPayment>
{
    public void Configure(EntityTypeBuilder<ZaloPayment> b)
    {
        b.ToTable("ZaloPayments", t => {
            t.HasCheckConstraint("CK_Zalo_Amount", "\"Amount\" > 0");
            t.HasCheckConstraint("CK_Zalo_State", "\"State\" IN ('created','pending','paid','expired')");
        });
        b.HasKey(p => p.Id); b.HasIndex(p => p.OrderId).IsUnique(); b.HasIndex(p => p.AppTransId).IsUnique();
        b.HasIndex(p => p.ProviderTransactionId).IsUnique().HasFilter("\"ProviderTransactionId\" IS NOT NULL");
        b.Property(p => p.AppTransId).HasMaxLength(40); b.Property(p => p.State).HasMaxLength(20);
        b.Property(p => p.QrPayload).HasMaxLength(8192); b.Property(p => p.OrderUrl).HasMaxLength(2048);
        b.HasOne<Order>().WithMany().HasForeignKey(p => p.OrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(p => new {p.State, p.ExpiresAt});
    }
}
