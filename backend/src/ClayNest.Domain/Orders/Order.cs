using System.Net.Mail;
using System.Text.RegularExpressions;

namespace ClayNest.Domain.Orders;

public sealed class OrderRuleException(string message) : Exception(message);

public sealed record ShippingContact(string Name, string Phone, string Email, string Province, string Address, string Note)
{
    public ShippingContact Normalize()
    {
        var name = Text(Name, 2, 100); var province = Text(Province, 2, 100);
        var address = Text(Address, 10, 500); var note = Text(Note, 0, 1000, allowNewline: true);
        var phone = Regex.Replace(Phone ?? "", @"[\s().-]", "");
        if (!Regex.IsMatch(phone, @"^\+?[0-9]{9,15}$")) throw new OrderRuleException("Số điện thoại cần 9–15 chữ số.");
        var email = Text(Email, 0, 254).ToLowerInvariant();
        if (email.Length > 0 && (!MailAddress.TryCreate(email, out var parsed) || parsed.Address != email))
            throw new OrderRuleException("Email không hợp lệ.");
        return new(name, phone, email, province, address, note);
    }
    private static string Text(string? value, int min, int max, bool allowNewline = false)
    {
        var text = (value ?? "").Trim();
        if (text.Length < min || text.Length > max || text.Any(c => char.IsControl(c) && !(allowNewline && c is '\r' or '\n')))
            throw new OrderRuleException("Thông tin giao hàng thiếu hoặc vượt độ dài cho phép.");
        return text;
    }
}

public sealed class Order
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Reference { get; private set; } = string.Empty;
    public Guid? CustomerId { get; private set; }
    public string CustomerName { get; private set; } = string.Empty;
    public string Phone { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string Province { get; private set; } = string.Empty;
    public string Address { get; private set; } = string.Empty;
    public string ShippingNote { get; private set; } = string.Empty;
    public string Status { get; private set; } = "pending";
    public string PaymentMethod { get; private set; } = "cod";
    public string PaymentStatus { get; private set; } = "unpaid";
    public long SubtotalVnd { get; private set; }
    public long ShippingFeeVnd { get; private set; }
    public long GrandTotalVnd { get; private set; }
    public Guid IdempotencyKey { get; private set; }
    public string PayloadHash { get; private set; } = string.Empty;
    public string AccessTokenHash { get; private set; } = string.Empty;
    public string AccessTokenProtected { get; private set; } = string.Empty;
    public DateTimeOffset AccessExpiresAt { get; private set; }
    public DateTimeOffset? AccessRevokedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public List<OrderItem> Items { get; private set; } = [];
    private Order() { }
    public Order(string reference, Guid? customerId, ShippingContact contact, long shippingFeeVnd,
        Guid idempotencyKey, string payloadHash, string accessHash, string accessProtected, DateTimeOffset now)
    {
        if (idempotencyKey == Guid.Empty || shippingFeeVnd < 0 || payloadHash.Length != 64 || accessHash.Length != 64)
            throw new OrderRuleException("Thông tin đơn hàng không hợp lệ.");
        contact = contact.Normalize(); Reference = reference; CustomerId = customerId;
        CustomerName = contact.Name; Phone = contact.Phone; Email = contact.Email; Province = contact.Province;
        Address = contact.Address; ShippingNote = contact.Note; ShippingFeeVnd = shippingFeeVnd;
        IdempotencyKey = idempotencyKey; PayloadHash = payloadHash; AccessTokenHash = accessHash;
        AccessTokenProtected = accessProtected; CreatedAt = now; AccessExpiresAt = now.AddDays(30);
    }
    public void AddItem(Guid variantId, string sku, string name, string variantName, string image, int quantity, long unitPrice)
    {
        if (Items.Count >= 30 || Items.Any(i => i.VariantId == variantId)) throw new OrderRuleException("Giỏ hàng tối đa 30 loại sản phẩm, không lặp biến thể.");
        var item = new OrderItem(Id, variantId, sku, name, variantName, image, quantity, unitPrice);
        Items.Add(item); SubtotalVnd = checked(SubtotalVnd + item.LineTotalVnd); GrandTotalVnd = checked(SubtotalVnd + ShippingFeeVnd);
    }
    public void RevokeAccess(DateTimeOffset now) => AccessRevokedAt ??= now;
}

public sealed class OrderItem
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid OrderId { get; private set; }
    public Guid VariantId { get; private set; }
    public string Sku { get; private set; } = string.Empty;
    public string ProductName { get; private set; } = string.Empty;
    public string VariantName { get; private set; } = string.Empty;
    public string Image { get; private set; } = string.Empty;
    public int Quantity { get; private set; }
    public long UnitPriceVnd { get; private set; }
    public long LineTotalVnd { get; private set; }
    private OrderItem() { }
    public OrderItem(Guid orderId, Guid variantId, string sku, string name, string variantName, string image, int quantity, long unitPrice)
    {
        if (quantity is < 1 or > 99 || unitPrice is <= 0 or > 1000000000 || variantId == Guid.Empty)
            throw new OrderRuleException("Số lượng hoặc giá sản phẩm không hợp lệ.");
        OrderId = orderId; VariantId = variantId; Sku = sku; ProductName = name; VariantName = variantName;
        Image = image; Quantity = quantity; UnitPriceVnd = unitPrice; LineTotalVnd = checked(unitPrice * quantity);
    }
}
