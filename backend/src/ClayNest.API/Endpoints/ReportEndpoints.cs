using ClayNest.API.Configuration;
using ClayNest.API.Errors;
using ClayNest.Application.Reports;
using ClayNest.Infrastructure.Reports;
namespace ClayNest.API.Endpoints;
public static class ReportEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group=endpoints.MapGroup("/api/v1/admin/reports").RequireAuthorization(AdminAuthentication.Policy).WithTags("Sales reports").RequireRateLimiting("reports");
        group.AddEndpointFilter(async (context,next)=>
        {
            context.HttpContext.Response.Headers.CacheControl="no-store";
            context.HttpContext.Response.Headers["X-Content-Type-Options"]="nosniff";
            try { return await next(context); }
            catch (ReportValidationException ex) { return ApiErrors.Create(context.HttpContext,400,"invalid_report",ex.Message); }
        });
        group.MapGet("",(DateOnly? from,DateOnly? to,string? grain,IReportService service,CancellationToken ct)=>service.GetAsync(new(from,to,grain ?? "day"),ct)).Produces<SalesReport>();
        group.MapGet("/export.csv",async (DateOnly? from,DateOnly? to,string? grain,IReportService service,CancellationToken ct)=>
        {
            var report=await service.GetAsync(new(from,to,grain ?? "day"),ct);
            return Results.File(ReportCsv.Write(report),"text/csv; charset=utf-8",$"nang-gom-report-{report.Period.From:yyyyMMdd}-{report.Period.To:yyyyMMdd}-{report.Period.Grain}.csv");
        });
        return endpoints;
    }
}
