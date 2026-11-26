using System.Text;
using ClayNest.Application.Catalog;
using ClayNest.Application.Reviews;
using ClayNest.Domain.Reviews;
using ClayNest.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
namespace ClayNest.Infrastructure.Reviews;
public sealed class ProductReviewService(CommerceDbContext db, TimeProvider clock) : IProductReviews
{
    private async Task Visible(Guid productId, CancellationToken ct)
    {
        if (!await db.Products.AnyAsync(p => p.Id == productId && p.Published && !p.Archived && p.Category.Active && p.Variants.Any(v => v.Active), ct))
            throw new KeyNotFoundException();
    }
    private Task<bool> Purchased(Guid productId, Guid customerId, CancellationToken ct) => db.Orders.AnyAsync(o => o.CustomerId == customerId && o.Status == "completed" && o.Items.Any(i => db.Set<ClayNest.Domain.Catalog.ProductVariant>().Any(v => v.Id == i.VariantId && v.ProductId == productId)), ct);
    private static ReviewRow Row(ProductReview r) => new(r.Id, r.AuthorName, r.Rating, r.Comment, r.CreatedAt, r.UpdatedAt);
    public async Task<ProductReviews> ListAsync(Guid productId, int page, int? rating, CancellationToken ct)
    {
        if (page is < 1 or > 100000 || rating is < 1 or > 5) throw new ReviewRuleException("Bộ lọc đánh giá không hợp lệ.");
        await Visible(productId, ct);
        var query = db.Set<ProductReview>().AsNoTracking().Where(r => r.ProductId == productId);
        var counts = await query.GroupBy(r => r.Rating).Select(g => new RatingCount(g.Key, g.Count())).ToListAsync(ct);
        var total = counts.Sum(c => c.Count);
        var average = total == 0 ? (decimal?)null : decimal.Round(counts.Sum(c => c.Rating * (decimal)c.Count) / total, 1);
        if (rating.HasValue) query = query.Where(r => r.Rating == rating);
        var filtered = rating.HasValue ? counts.SingleOrDefault(c => c.Rating == rating)?.Count ?? 0 : total;
        var rows = await query.OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id).Skip((page - 1) * 5).Take(5)
            .Select(r => new ReviewRow(r.Id, r.AuthorName, r.Rating, r.Comment, r.CreatedAt, r.UpdatedAt, true)).ToListAsync(ct);
        return new(total, average, Enumerable.Range(1, 5).Reverse().Select(n => new RatingCount(n, counts.SingleOrDefault(c => c.Rating == n)?.Count ?? 0)).ToList(), new(rows, page, 5, filtered));
    }
    public async Task<MyReview> MineAsync(Guid productId, Guid customerId, CancellationToken ct)
    {
        await Visible(productId, ct);
        var existing = await db.Set<ProductReview>().AsNoTracking().SingleOrDefaultAsync(r => r.ProductId == productId && r.CustomerId == customerId, ct);
        return new(await Purchased(productId, customerId, ct), existing is null ? null : Row(existing));
    }
    public async Task<ReviewRow> SaveAsync(Guid productId, Guid customerId, ReviewInput input, CancellationToken ct)
    {
        await Visible(productId, ct);
        if (!await Purchased(productId, customerId, ct)) throw new UnauthorizedAccessException();
        var review = await db.Set<ProductReview>().SingleOrDefaultAsync(r => r.ProductId == productId && r.CustomerId == customerId, ct);
        if (review is null) {
            var name = await db.Users.Where(u => u.Id == customerId).Select(u => u.DisplayName).SingleAsync(ct);
            var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var publicName = parts.Length > 1 ? parts[0] + " " + parts[^1].EnumerateRunes().First().ToString() + "." : "Khách hàng";
            review = new(productId, customerId, publicName, input.Rating, input.Comment, clock.GetUtcNow());
            db.Add(review);
        } else review.Update(input.Rating, input.Comment, clock.GetUtcNow());
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation }) {
            throw new ReviewRuleException("Đánh giá đã được lưu từ một yêu cầu khác. Vui lòng tải lại trước khi sửa.");
        }
        return Row(review);
    }
}
