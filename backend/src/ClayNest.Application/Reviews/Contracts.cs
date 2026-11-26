using ClayNest.Application.Catalog;
namespace ClayNest.Application.Reviews;
public sealed record ReviewInput(int Rating, string Comment);
public sealed record ReviewRow(Guid Id, string AuthorName, int Rating, string Comment, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, bool VerifiedPurchase = true);
public sealed record RatingCount(int Rating, int Count);
public sealed record ProductReviews(int TotalCount, decimal? AverageRating, List<RatingCount> Distribution, PageResult<ReviewRow> Reviews);
public sealed record MyReview(bool Eligible, ReviewRow? Review);
public interface IProductReviews
{
    Task<ProductReviews> ListAsync(Guid productId, int page, int? rating, CancellationToken ct);
    Task<MyReview> MineAsync(Guid productId, Guid customerId, CancellationToken ct);
    Task<ReviewRow> SaveAsync(Guid productId, Guid customerId, ReviewInput input, CancellationToken ct);
}
