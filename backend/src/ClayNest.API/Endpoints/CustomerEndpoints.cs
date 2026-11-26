using ClayNest.API.Configuration;
using ClayNest.API.Errors;
using ClayNest.Application.Catalog;
using ClayNest.Application.Customers;
using ClayNest.Domain.Catalog;
namespace ClayNest.API.Endpoints;

public static class CustomerEndpoints
{
    public static IEndpointRouteBuilder MapCustomerEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/admin/customers", async (string? q, int? page, HttpContext http, ICustomerDirectory directory, CancellationToken ct) =>
        {
            http.Response.Headers.CacheControl = "no-store";
            try { return Results.Ok(await directory.SearchAsync(q, page ?? 1, ct)); }
            catch (CatalogRuleException ex) { return ApiErrors.Create(http, 400, "invalid_customer_query", ex.Message); }
        }).RequireAuthorization(AdminAuthentication.Policy).RequireRateLimiting("reports")
          .WithTags("Customer directory").Produces<PageResult<CustomerRow>>().ProducesProblem(400).ProducesProblem(401).ProducesProblem(403);
        return endpoints;
    }
}
