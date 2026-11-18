using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ClayNest.Application.Orders;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Inventory;
using ClayNest.Domain.Orders;
using ClayNest.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace ClayNest.Infrastructure.Orders;

public sealed class OrderService(CommerceDbContext db, IDataProtectionProvider protection, TimeProvider clock) : IOrderService
{
    private readonly IDataProtector quotes = protection.CreateProtector("NangGom.Checkout.Quote.v1");
    private readonly IDataProtector secrets = protection.CreateProtector("NangGom.Order.Access.v1");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private const string ShippingPolicy = "Phí giao hàng 30.000 đ toàn quốc. Miễn phí cho giá trị sản phẩm từ 800.000 đ.";
    private const string PackingNote = "Mỗi món gốm được bọc chống sốc, chèn cố định và đóng hộp phù hợp đồ dễ vỡ. Thời gian giao được xác nhận khi cửa hàng xử lý đơn.";
    private static long Shipping(long subtotal) => subtotal >= 800000 ? 0 : 30000;
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    public async Task<CartQuote> QuoteAsync(QuoteRequest request, CancellationToken ct)
    {
        if (request.Items is null || request.Items.Count is < 1 or > 30 || request.Items.Any(l => l is null || l.VariantId == Guid.Empty || l.Quantity is < 1 or > 99)
            || request.Items.Select(l => l.VariantId).Distinct().Count() != request.Items.Count)
            throw new OrderRuleException("Giỏ hàng cần 1–30 biến thể khác nhau, mỗi loại từ 1–99 sản phẩm.");
        var ids = request.Items.Select(l => l.VariantId).ToArray();
        var rows = await Live(db.Set<ProductVariant>().AsNoTracking().Where(v => ids.Contains(v.Id))).ToListAsync(ct);
        var lines = new List<QuoteLine>();
        foreach (var line in request.Items.OrderBy(l => l.VariantId))
        {
            var row = rows.SingleOrDefault(r => r.Variant.Id == line.VariantId);
            if (row is null || !row.Sellable)
                lines.Add(new(line.VariantId, line.Quantity, "Sản phẩm không còn được bán", "", "", "", "", 0, null, 0, 0, "Sản phẩm không còn khả dụng. Vui lòng xóa khỏi giỏ."));
            else
            {
                var v = row.Variant;
                lines.Add(new(v.Id, line.Quantity, row.Name, v.Name, v.Sku, row.Slug, row.Image, v.PriceVnd,
                    v.OriginalPriceVnd, checked(v.PriceVnd * line.Quantity), v.StockQty,
                    v.StockQty < line.Quantity ? $"Chỉ còn {v.StockQty} sản phẩm. Vui lòng giảm số lượng." : null));
            }
        }
        var subtotal = lines.Sum(l => l.LineTotalVnd); var shipping = Shipping(subtotal);
        var expires = clock.GetUtcNow().AddMinutes(5); var canCheckout = lines.All(l => l.Issue is null);
        var snapshot = new QuoteSnapshot(lines.Select(l => new AcceptedLine(l.VariantId, l.Quantity, l.UnitPriceVnd)).ToList(), shipping, expires, 1);
        return new(lines, subtotal, shipping, checked(subtotal + shipping), canCheckout,
            canCheckout ? quotes.Protect(JsonSerializer.Serialize(snapshot, Json)) : null, expires, ShippingPolicy, PackingNote);
    }

    private sealed record LiveVariant(ProductVariant Variant, string Name, string Slug, string Image, bool Sellable);
    private IQueryable<LiveVariant> Live(IQueryable<ProductVariant> variants) =>
        from v in variants join p in db.Products.AsNoTracking() on v.ProductId equals p.Id
        select new LiveVariant(v, p.Name, p.Slug,
            p.Images.Where(i => i.VariantId == null || i.VariantId == v.Id).OrderByDescending(i => i.VariantId == v.Id)
                .ThenBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.Url).FirstOrDefault() ?? "",
            p.Published && !p.Archived && p.Category.Active && v.Active);

    public async Task<OrderReceipt> PlaceAsync(Guid idempotencyKey, CheckoutRequest request, Guid? customerId, CancellationToken ct)
    {
        if (idempotencyKey == Guid.Empty || !request.AcceptTerms || request.Contact is null || string.IsNullOrWhiteSpace(request.QuoteToken) || request.QuoteToken.Length > 20000)
            throw new OrderRuleException("Cần báo giá hợp lệ, thông tin giao hàng và xác nhận điều kiện đặt hàng.");
        var contact = request.Contact.Normalize();
        var payloadHash = Hash(JsonSerializer.Serialize(new { customerId, request.QuoteToken, contact, request.AcceptTerms }, Json));
        var lockId = BinaryPrimitives.ReadInt64LittleEndian(SHA256.HashData(idempotencyKey.ToByteArray()));
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({lockId})", ct);
        var previous = await db.Orders.AsNoTracking().SingleOrDefaultAsync(o => o.IdempotencyKey == idempotencyKey, ct);
        if (previous is not null)
        {
            if (previous.PayloadHash != payloadHash) throw new CheckoutConflictException("idempotency_conflict", "Mã yêu cầu đã dùng cho nội dung khác. Không gửi lại thành đơn mới.");
            return Receipt(previous);
        }
        QuoteSnapshot snapshot;
        try { snapshot = JsonSerializer.Deserialize<QuoteSnapshot>(quotes.Unprotect(request.QuoteToken), Json) ?? throw new CryptographicException(); }
        catch (Exception ex) when (ex is CryptographicException or JsonException or FormatException)
        { throw new CheckoutConflictException("quote_invalid", "Báo giá không hợp lệ. Vui lòng lấy báo giá mới."); }
        if (snapshot.PolicyVersion != 1 || snapshot.ExpiresAt <= clock.GetUtcNow())
            throw new CheckoutConflictException("quote_expired", "Báo giá đã hết hạn. Vui lòng xem và xác nhận báo giá mới.");
        if (snapshot.Items.Count is < 1 or > 30) throw new OrderRuleException("Giỏ hàng không hợp lệ.");
        var live = new List<LiveVariant>();
        // Consistent lock order prevents multi-item checkouts from deadlocking each other.
        foreach (var line in snapshot.Items.OrderBy(l => l.VariantId))
        {
            var variant = await db.Set<ProductVariant>().FromSqlInterpolated($"SELECT * FROM commerce.\"ProductVariants\" WHERE \"Id\" = {line.VariantId} FOR UPDATE").SingleOrDefaultAsync(ct);
            if (variant is null) throw new CheckoutConflictException("stock_changed", "Một món gốm không còn khả dụng. Vui lòng kiểm tra lại giỏ hàng.");
            var row = await Live(db.Set<ProductVariant>().Where(v => v.Id == variant.Id)).SingleAsync(ct);
            if (!row.Sellable || variant.StockQty < line.Quantity)
                throw new CheckoutConflictException("stock_changed", "Số lượng khả dụng đã thay đổi. Vui lòng kiểm tra lại giỏ hàng.");
            if (variant.PriceVnd != line.UnitPriceVnd)
                throw new CheckoutConflictException("price_changed", "Giá sản phẩm đã thay đổi. Vui lòng xem và xác nhận báo giá mới.");
            live.Add(row);
        }
        var subtotal = snapshot.Items.Sum(l => checked(l.UnitPriceVnd * l.Quantity));
        if (snapshot.ShippingFeeVnd != Shipping(subtotal))
            throw new CheckoutConflictException("price_changed", "Phí giao hàng đã thay đổi. Vui lòng xác nhận báo giá mới.");
        var now = clock.GetUtcNow();
        var access = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var reference = $"NG-{now:yyMMdd}-{Guid.NewGuid().ToString("N")[..12].ToUpperInvariant()}";
        var order = new Order(reference, customerId, contact, snapshot.ShippingFeeVnd, idempotencyKey, payloadHash, Hash(access), secrets.Protect(access), now);
        foreach (var line in snapshot.Items.OrderBy(l => l.VariantId))
        {
            var row = live.Single(r => r.Variant.Id == line.VariantId); var variant = row.Variant;
            order.AddItem(variant.Id, variant.Sku, row.Name, variant.Name, row.Image, line.Quantity, variant.PriceVnd);
            variant.ChangeStock(-line.Quantity);
            db.StockMovements.Add(new StockMovement(variant.Id, "sale", -line.Quantity, variant.StockQty, variant.LowStockThreshold,
                "Giữ hàng cho đơn " + reference, customerId, customerId is null ? "Khách vãng lai" : "Khách hàng", order.Id));
        }
        db.Orders.Add(order); await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Receipt(order);
    }
    private OrderReceipt Receipt(Order order) => new(order.Reference, secrets.Unprotect(order.AccessTokenProtected), order.AccessExpiresAt, order.GrandTotalVnd, order.Status);

    private async Task<Order?> Accessible(string reference, string? token, Guid? customerId, CancellationToken ct)
    {
        if (reference.Length > 32) return null;
        var order = await db.Orders.Include(o => o.Items).SingleOrDefaultAsync(o => o.Reference == reference, ct);
        if (order is null) return null;
        if (customerId.HasValue && customerId == order.CustomerId) return order;
        if (token is null || token.Length > 128 || order.AccessRevokedAt.HasValue || order.AccessExpiresAt <= clock.GetUtcNow()) return null;
        return CryptographicOperations.FixedTimeEquals(Convert.FromHexString(Hash(token)), Convert.FromHexString(order.AccessTokenHash)) ? order : null;
    }
    public async Task<OrderStatusDto?> StatusAsync(string reference, string? accessToken, Guid? customerId, CancellationToken ct)
    {
        var o = await Accessible(reference, accessToken, customerId, ct);
        return o is null ? null : new(o.Reference, o.Status, o.PaymentMethod, o.PaymentStatus, o.SubtotalVnd, o.ShippingFeeVnd, o.GrandTotalVnd, o.CreatedAt,
            new(o.CustomerName, o.Phone, o.Email, o.Province, o.Address, o.ShippingNote),
            o.Items.OrderBy(i => i.Sku).Select(i => new OrderLineDto(i.Sku, i.ProductName, i.VariantName, i.Image, i.Quantity, i.UnitPriceVnd, i.LineTotalVnd)).ToList());
    }
    public async Task<bool> RevokeAccessAsync(string reference, string? accessToken, Guid? customerId, CancellationToken ct)
    {
        var order = await Accessible(reference, accessToken, customerId, ct);
        if (order is null) return false;
        order.RevokeAccess(clock.GetUtcNow()); await db.SaveChangesAsync(ct); return true;
    }
}
