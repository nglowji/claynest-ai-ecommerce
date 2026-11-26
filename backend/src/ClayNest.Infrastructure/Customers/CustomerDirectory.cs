using ClayNest.Application.Catalog;
using ClayNest.Application.Customers;
using ClayNest.Domain.Catalog;
using ClayNest.Domain.Identity;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace ClayNest.Infrastructure.Customers;

public sealed class CustomerDirectory(CommerceDbContext db) : ICustomerDirectory
{
    public async Task<PageResult<CustomerRow>> SearchAsync(string? query, int page, CancellationToken ct)
    {
        if (page is < 1 or > 10000 || query?.Length > 120) throw new CatalogRuleException("Từ khóa tối đa 120 ký tự và số trang hợp lệ.");
        var customerRoles = db.Roles.Where(r => r.Name == CommerceRoles.Customer).Select(r => r.Id);
        var adminRoles = db.Roles.Where(r => r.Name == CommerceRoles.Admin).Select(r => r.Id);
        var customers = db.Users.AsNoTracking().Where(u => db.UserRoles.Any(r => r.UserId == u.Id && customerRoles.Contains(r.RoleId))
            && !db.UserRoles.Any(r => r.UserId == u.Id && adminRoles.Contains(r.RoleId)));
        if (!string.IsNullOrWhiteSpace(query))
        {
            var term = query.Trim().ToLowerInvariant();
            customers = customers.Where(u => u.DisplayName.ToLower().Contains(term) || (u.Email != null && u.Email.ToLower().Contains(term)));
        }
        var count = await customers.CountAsync(ct);
        var rows = await customers.OrderBy(u => u.DisplayName).ThenBy(u => u.Id).Skip((page - 1) * 20).Take(20)
            .Select(u => new CustomerRow(u.Id, u.DisplayName, u.Email ?? "",
                db.Orders.Count(o => o.CustomerId == u.Id),
                db.Orders.Count(o => o.CustomerId == u.Id && o.Status == "completed"),
                db.Orders.Where(o => o.CustomerId == u.Id && o.Status == "completed").Sum(o => (long?)o.GrandTotalVnd) ?? 0,
                db.Orders.Where(o => o.CustomerId == u.Id).Max(o => (DateTimeOffset?)o.CreatedAt)))
            .ToListAsync(ct);
        return new(rows, page, 20, count);
    }
}
