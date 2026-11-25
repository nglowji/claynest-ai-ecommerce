using System.Security.Cryptography;
using System.Text;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Identity;
using ClayNest.Domain.Inventory;
using ClayNest.Domain.Orders;
using ClayNest.Infrastructure.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Npgsql;
namespace ClayNest.Infrastructure.Development;

// Synthetic local activity, never imported business transactions. No customer passwords or deliverable email.
// PayloadHash and deterministic identity keys retain provenance without presentation labels.
public sealed class DevelopmentActivitySeeder(CommerceDbContext db, UserManager<AdminUser> users,
    RoleManager<IdentityRole<Guid>> roles, TimeProvider clock, IHostEnvironment environment, IConfiguration configuration)
{
    public const string Origin = "nang-gom-development-activity-v1";
    public static string OriginHash => Hash(Origin);
    private static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static Guid Key(string value) => new(SHA256.HashData(Encoding.UTF8.GetBytes(Origin + "/" + value)).AsSpan(0, 16));
    public async Task SeedAsync(CancellationToken ct)
    {
        if (!environment.IsDevelopment() || !configuration.GetValue<bool>("DevelopmentActivity:Enabled"))
            throw new InvalidOperationException("Activity seeding requires Development and explicit DevelopmentActivity:Enabled.");
        var connection = new NpgsqlConnectionStringBuilder(db.Database.GetDbConnection().ConnectionString);
        if (connection.Host is not ("db" or "db-test") || connection.Database is not ("claynest" or "claynest_test"))
            throw new InvalidOperationException("Activity seeding is restricted to the local workspace databases.");
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(742019025)", ct);
        if (await db.Orders.AnyAsync(o => o.PayloadHash == OriginHash, ct)) { await transaction.CommitAsync(ct); return; }
        var adminRole = await roles.FindByNameAsync(CommerceRoles.Admin) ?? throw new InvalidOperationException("Create the administrator first.");
        if (!await db.UserRoles.AnyAsync(r => r.RoleId == adminRole.Id, ct)) throw new InvalidOperationException("An administrator is required.");
        var products = await db.Products.Include(p => p.Variants).Include(p => p.Images)
            .Where(p => p.Published && !p.Archived && p.Category.Active).OrderBy(p => p.Slug).ToListAsync(ct);
        var catalog = products.SelectMany(p => p.Variants.Where(v => v.Active).Select(v => (Product: p, Variant: v))).ToList();
        if (catalog.Count < 5) throw new InvalidOperationException("At least five active catalog variants are required.");
        if (!await roles.RoleExistsAsync(CommerceRoles.Customer)) Ensure(await roles.CreateAsync(new(CommerceRoles.Customer)));
        var names = new[] { "Nguyễn Minh Anh", "Trần Thảo Vy", "Lê Hoàng Nam", "Phạm Ngọc Linh", "Võ Thanh Trúc", "Đặng Hải Yến", "Bùi Tuấn Kiệt", "Huỳnh Mai Chi", "Đỗ Quốc Huy", "Phan Bảo Ngọc", "Ngô Khánh An", "Dương Gia Hân", "Nguyễn Hoài Phương", "Trần Nhật Minh", "Lê Bảo Trân", "Phạm Anh Thư", "Võ Đức Anh", "Đặng Phương Linh", "Bùi Ngọc Hân", "Huỳnh Quốc Bảo", "Đỗ Mỹ Duyên", "Phan Thanh Tâm", "Ngô Minh Châu", "Dương Tú Anh", "Nguyễn Hà My", "Trần Ngọc Diệp", "Lê Minh Khang", "Phạm Hồng Nhung", "Võ Kim Ngân", "Đặng Trung Kiên", "Bùi Thu Hà", "Huỳnh Phương Anh", "Đỗ Khánh Linh", "Phan Minh Đức", "Ngô Quỳnh Anh", "Dương Bảo Anh", "Nguyễn Thanh Hà", "Trần Gia Bảo", "Lê Thùy Dương", "Phạm Quang Huy", "Võ Ngọc Mai", "Đặng Hải Đăng", "Bùi Thanh Vân", "Huỳnh Ngọc Ánh", "Đỗ Phương Thảo", "Phan Đức Minh", "Ngô Bảo Châu", "Dương Minh Tâm" };
        var customers = new List<AdminUser>();
        for (var i = 0; i < 48; i++)
        {
            var email = "khachhang" + (i + 1).ToString("D3") + "@example.test";
            var user = new AdminUser { Id = Key("customer/" + i), UserName = email, Email = email,
                DisplayName = names[i % names.Length], EmailConfirmed = false, LockoutEnabled = true };
            Ensure(await users.CreateAsync(user)); // No password: these records cannot be used to sign in.
            Ensure(await users.AddToRoleAsync(user, CommerceRoles.Customer)); customers.Add(user);
        }
        var areas = new[] { "Trà Vinh", "Vĩnh Long", "Cần Thơ", "Bến Tre", "TP. Hồ Chí Minh", "Đồng Tháp", "Tiền Giang", "Sóc Trăng" };
        var roads = new[] { "Nguyễn Đáng", "Võ Nguyên Giáp", "Lê Lợi", "Nguyễn Thị Minh Khai", "Trần Phú", "Hùng Vương" };
        var random = new Random(20261125);
        var now = clock.GetUtcNow();
        for (var index = 0; index < 180; index++)
        {
            var customer = customers[index < customers.Count ? index : random.Next(customers.Count)];
            var age = index < 12 ? index % 4 : random.Next(0, index % 3 == 0 ? 21 : 90);
            var created = now.AddDays(-age).AddMinutes(-random.Next(15, 600));
            var buyer = customers.IndexOf(customer);
            var contact = new ShippingContact(customer.DisplayName, "000" + (1000000 + buyer), customer.Email!,
                areas[buyer % areas.Length], (12 + buyer) + " đường " + roads[buyer % roads.Length] + ", khu vực trung tâm", "Gọi trước khi giao hàng.");
            var chosen = new List<(Product Product, ProductVariant Variant, int Quantity)>();
            var seen = new HashSet<Guid>();
            var lineCount = random.Next(1, 4);
            while (chosen.Count < lineCount)
            {
                var candidate = catalog[random.Next(catalog.Count)];
                if (seen.Add(candidate.Variant.Id)) chosen.Add((candidate.Product, candidate.Variant, random.Next(1, 3)));
            }
            var subtotal = chosen.Sum(line => line.Variant.PriceVnd * line.Quantity);
            var reference = "NG-" + created.ToOffset(TimeSpan.FromHours(7)).ToString("yyMMdd") + "-" + Hash(Origin + index)[..10].ToUpperInvariant();
            var order = new Order(reference, customer.Id, contact, subtotal >= 800000 ? 0 : 30000,
                Key("order/" + index), OriginHash, Hash(Guid.NewGuid().ToString()), "", created);
            db.Orders.Add(order);
            db.OrderStatusChanges.Add(new(order.Id, 0, "", "pending", "Đã tiếp nhận đơn hàng", null, "Cửa hàng", created));
            foreach (var line in chosen)
            {
                var variant = line.Variant;
                if (variant.StockQty < line.Quantity)
                {
                    variant.ChangeStock(30);
                    db.StockMovements.Add(new(variant.Id, "receipt", 30, variant.StockQty, variant.LowStockThreshold,
                        "Bổ sung hàng vào kho", null, "Cửa hàng"));
                }
                order.AddItem(variant.Id, variant.Sku, line.Product.Name, variant.Name,
                    line.Product.Images.OrderBy(i => i.SortOrder).FirstOrDefault()?.Url ?? "", line.Quantity, variant.PriceVnd);
                variant.ChangeStock(-line.Quantity);
                db.StockMovements.Add(new(variant.Id, "sale", -line.Quantity, variant.StockQty, variant.LowStockThreshold,
                    "Xuất hàng theo đơn " + reference, null, "Cửa hàng", order.Id));
            }
            var target = index < 12 ? new[] { "pending", "confirmed", "packed", "shipped" }[index % 4]
                : random.Next(100) < 9 ? "cancelled" : age >= 5 ? "completed" : age >= 2 ? "shipped" : "confirmed";
            var states = target == "cancelled" ? new[] { "cancelled" } : new[] { "confirmed", "packed", "shipped", "completed" }.Take(Array.IndexOf(new[] { "pending", "confirmed", "packed", "shipped", "completed" }, target));
            var step = 0;
            foreach (var state in states)
            {
                step++;
                var at = age >= 5 ? created.AddHours(step * 12 + random.Next(0, 4))
                    : created + TimeSpan.FromTicks((now - created).Ticks * step / 5);
                var previous = order.Status; order.TransitionTo(state, state == "completed", at);
                db.OrderStatusChanges.Add(new(order.Id, order.Revision, previous, state, Reason(state), Key("actor"), "Cửa hàng", at, Key("event/" + index + "/" + state), OriginHash));
            }
            if (target == "cancelled")
            {
                order.MarkRestocked();
                foreach (var line in chosen)
                {
                    line.Variant.ChangeStock(line.Quantity);
                    db.StockMovements.Add(new(line.Variant.Id, "restock", line.Quantity, line.Variant.StockQty, line.Variant.LowStockThreshold,
                        "Hoàn kho đơn " + reference, null, "Cửa hàng", order.Id));
                }
            }
            order.RevokeAccess(now); // Initial history never creates a usable guest lookup secret.
        }
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
    }
    private static string Reason(string state) => state switch {
        "confirmed" => "Đã kiểm tra và xác nhận đơn", "packed" => "Đã đóng gói chống vỡ",
        "shipped" => "Đã bàn giao đơn vị vận chuyển", "completed" => "Đã giao hàng và thu đủ tiền COD",
        _ => "Khách thay đổi nhu cầu, đã hủy và hoàn kho"
    };
    private static void Ensure(IdentityResult result)
    {
        if (!result.Succeeded) throw new InvalidOperationException("Unable to create development customer: " + string.Join(",", result.Errors.Select(e => e.Code)));
    }
}
