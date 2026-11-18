using ClayNest.API.Configuration;
using ClayNest.API.Errors;
using ClayNest.Application.Catalog;
using ClayNest.Domain.Catalog;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http.Features;

namespace ClayNest.API.Endpoints;

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var publicApi = endpoints.MapGroup("/api/v1").WithTags("Catalog");
        publicApi.AddEndpointFilter(Errors);
        publicApi.MapGet("/categories", (ICatalogService service, CancellationToken ct) => service.CategoriesAsync(false, ct))
            .WithName("GetCategories").Produces<List<CategoryDto>>();
        publicApi.MapGet("/products", ([AsParameters] CatalogParameters q, ICatalogService service, CancellationToken ct) => service.SearchAsync(q.ToQuery(), false, ct))
            .WithName("SearchProducts").Produces<PageResult<ProductDto>>().ProducesProblem(400);
        publicApi.MapGet("/products/{slug}", async (string slug, ICatalogService service, HttpContext context, CancellationToken ct) =>
            await service.FindAsync(slug, false, ct) is { } product ? Results.Ok(product) : ApiErrors.Create(context, 404, "not_found", "Không tìm thấy sản phẩm."))
            .WithName("GetProduct").Produces<ProductDto>().ProducesProblem(404);

        var admin = endpoints.MapGroup("/api/v1/admin/catalog").WithTags("Admin catalog").RequireAuthorization(AdminAuthentication.Policy);
        admin.AddEndpointFilter(Errors);
        admin.AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext; http.Response.Headers.CacheControl = "no-store";
            if (http.Request.Method != "GET")
            {
                try { await http.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(http); }
                catch (AntiforgeryValidationException) { return ApiErrors.Create(http, 400, "invalid_csrf", "Phiên bảo mật không hợp lệ."); }
            }
            return await next(context);
        });
        admin.MapGet("/categories", (ICatalogService service, CancellationToken ct) => service.CategoriesAsync(true, ct)).Produces<List<CategoryDto>>();
        admin.MapPost("/categories", async (CategoryInput input, ICatalogService service, CancellationToken ct) => Results.Json(await service.SaveCategoryAsync(null, input, ct), statusCode: 201)).Produces<CategoryDto>(201).ProducesProblem(400).ProducesProblem(409);
        admin.MapPut("/categories/{id:guid}", (Guid id, CategoryInput input, ICatalogService service, CancellationToken ct) => service.SaveCategoryAsync(id, input, ct)).Produces<CategoryDto>().ProducesProblem(409);
        admin.MapGet("/products", ([AsParameters] CatalogParameters q, ICatalogService service, CancellationToken ct) => service.SearchAsync(q.ToQuery(), true, ct)).Produces<PageResult<ProductDto>>();
        admin.MapGet("/products/{id:guid}", async (Guid id, ICatalogService service, CancellationToken ct) =>
            await service.FindAsync(id.ToString(), true, ct) ?? throw new KeyNotFoundException()).Produces<ProductDto>();
        // Variants and image ordering are saved atomically with the product aggregate.
        admin.MapPost("/products", async (ProductInput input, ICatalogService service, CancellationToken ct) => Results.Json(await service.SaveProductAsync(null, input, ct), statusCode: 201)).Produces<ProductDto>(201).ProducesProblem(400).ProducesProblem(409);
        admin.MapPut("/products/{id:guid}", (Guid id, ProductInput input, ICatalogService service, CancellationToken ct) => service.SaveProductAsync(id, input, ct)).Produces<ProductDto>().ProducesProblem(400).ProducesProblem(409);
        admin.MapDelete("/products/{id:guid}", async (Guid id, Guid revision, ICatalogService service, CancellationToken ct) => { await service.ArchiveAsync(id, revision, ct); return Results.NoContent(); }).Produces(204).ProducesProblem(409);
        admin.MapPost("/images", async (HttpContext context, ICatalogImageStorage storage, CancellationToken ct) =>
        {
            var feature = context.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (feature is { IsReadOnly: false }) feature.MaxRequestBodySize = 6 * 1024 * 1024;
            if (!context.Request.HasFormContentType) return ApiErrors.Create(context, 400, "invalid_image", "Cần gửi ảnh dạng multipart.");
            var form = await context.Request.ReadFormAsync(ct);
            if (form.Files.Count != 1) return ApiErrors.Create(context, 400, "invalid_image", "Mỗi lần chỉ tải một ảnh.");
            var file = form.Files[0];
            await using var stream = file.OpenReadStream();
            return Results.Json(await storage.StoreAsync(stream, file.ContentType, file.Length, ct), statusCode: 201);
        }).Produces<StoredImage>(201).ProducesProblem(400);
        return endpoints;
    }

    private static async ValueTask<object?> Errors(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        try { return await next(context); }
        catch (CatalogRuleException ex) { return ApiErrors.Create(context.HttpContext, 400, "invalid_catalog", ex.Message); }
        catch (CatalogConflictException ex) { return ApiErrors.Create(context.HttpContext, 409, "catalog_conflict", ex.Message); }
        catch (KeyNotFoundException) { return ApiErrors.Create(context.HttpContext, 404, "not_found", "Không tìm thấy dữ liệu."); }
        catch (BadHttpRequestException ex) when (ex.StatusCode == 413) { return ApiErrors.Create(context.HttpContext, 413, "image_too_large", "Ảnh vượt giới hạn tải lên."); }
        catch (InvalidDataException) { return ApiErrors.Create(context.HttpContext, 400, "invalid_image", "Ảnh không hợp lệ hoặc quá lớn."); }
    }
    public sealed class CatalogParameters
    {
        public string? Q { get; set; }
        public string? Category { get; set; }
        public long? MinPrice { get; set; }
        public long? MaxPrice { get; set; }
        public string? Glaze { get; set; }
        public string? Use { get; set; }
        public bool? InStock { get; set; }
        public bool? Sale { get; set; }
        public string? Sort { get; set; }
        public int? Page { get; set; }
        public int? PageSize { get; set; }
        public CatalogQuery ToQuery() => new(Q, Category, MinPrice, MaxPrice, Glaze, Use, InStock ?? false, Sale ?? false, Sort ?? "default", Page ?? 1, PageSize ?? 12);
    }
}
