using System.Text.Json.Serialization;
using ClayNest.Application.Catalog;
namespace ClayNest.Application.Customers;

public sealed record CustomerRow(Guid Id, string Name, string Email, int OrderCount, int CompletedOrders,
    [property: JsonNumberHandling(JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.WriteAsString)] long CompletedSalesVnd,
    DateTimeOffset? LastOrderAt);
public interface ICustomerDirectory
{
    Task<PageResult<CustomerRow>> SearchAsync(string? query, int page, CancellationToken ct);
}
