namespace ClayNest.Domain.Reviews;

public sealed class ReviewRuleException(string message) : Exception(message);
public sealed class ProductReview
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ProductId { get; private set; }
    public Guid CustomerId { get; private set; }
    public string AuthorName { get; private set; } = "";
    public int Rating { get; private set; }
    public string Comment { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    private ProductReview() { }
    public ProductReview(Guid productId, Guid customerId, string authorName, int rating, string comment, DateTimeOffset now)
    {
        ProductId = productId; CustomerId = customerId; AuthorName = authorName; CreatedAt = now;
        Update(rating, comment, now);
    }
    public void Update(int rating, string? comment, DateTimeOffset now)
    {
        var text = (comment ?? "").Trim();
        if (rating is < 1 or > 5 || text.Length is < 10 or > 2000 || text.Any(c => char.IsControl(c) && c is not ('\r' or '\n' or '\t')))
            throw new ReviewRuleException("Chọn từ 1 đến 5 sao và viết đánh giá từ 10 đến 2.000 ký tự.");
        Rating = rating; Comment = text; UpdatedAt = now;
    }
}
