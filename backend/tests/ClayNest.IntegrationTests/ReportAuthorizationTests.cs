using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using ClayNest.Application.Reports;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace ClayNest.IntegrationTests;
public sealed class ReportAuthorizationTests
{
    private sealed class TestAuth(IOptionsMonitor<AuthenticationSchemeOptions> options,Microsoft.Extensions.Logging.ILoggerFactory logger,UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options,logger,encoder)
    {
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var role=Request.Headers["X-Test-Role"].ToString(); if (string.IsNullOrEmpty(role)) return Task.FromResult(AuthenticateResult.NoResult());
            return Task.FromResult(AuthenticateResult.Success(new(new ClaimsPrincipal(new ClaimsIdentity([new(ClaimTypes.NameIdentifier,Guid.NewGuid().ToString()),new(ClaimTypes.Role,role)],Scheme.Name)),Scheme.Name)));
        }
    }
    private sealed class Service : IReportService
    {
        public int Calls;
        public Task<SalesReport> GetAsync(ReportQuery query,CancellationToken ct)
        {
            Calls++; var period=ReportPeriod.Create(query,DateTimeOffset.UtcNow);
            return Task.FromResult(new SalesReport(period,DateTimeOffset.UtcNow,"Asia/Ho_Chi_Minh",false,new(0,0,0,0,null,0,0),[],[],0,[]));
        }
    }
    [Fact]
    public async Task Report_and_csv_are_admin_only_no_store_and_validate_input()
    {
        var service=new Service(); await using var factory=new ApiFactory().WithWebHostBuilder(builder=>builder.ConfigureTestServices(services=>
        {
            services.AddAuthentication(o=>{ o.DefaultAuthenticateScheme="ReportsTest"; o.DefaultChallengeScheme="ReportsTest"; o.DefaultForbidScheme="ReportsTest"; }).AddScheme<AuthenticationSchemeOptions,TestAuth>("ReportsTest",_=>{});
            services.RemoveAll<IReportService>(); services.AddSingleton<IReportService>(service);
        }));
        using var client=factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress=new("https://localhost") });
        foreach(var role in new[]{"","Customer","Admin"})
        {
            client.DefaultRequestHeaders.Remove("X-Test-Role"); if (role!="") client.DefaultRequestHeaders.Add("X-Test-Role",role);
            foreach(var path in new[]{"/api/v1/admin/reports","/api/v1/admin/reports/export.csv"})
            {
                using var response=await client.GetAsync(path);
                Assert.Equal(role=="Admin" ? HttpStatusCode.OK : role=="" ? HttpStatusCode.Unauthorized : HttpStatusCode.Forbidden,response.StatusCode);
                if (role=="Admin") Assert.Contains("no-store",response.Headers.CacheControl!.ToString());
                if (role=="Admin" && path.EndsWith(".csv")) { Assert.Equal("text/csv",response.Content.Headers.ContentType!.MediaType); Assert.Contains("nang-gom-report",response.Content.Headers.ContentDisposition!.FileName); }
            }
            if (role!="Admin") Assert.Equal(0,service.Calls);
        }
        using var bad=await client.GetAsync("/api/v1/admin/reports?grain=sql-injection"); Assert.Equal(HttpStatusCode.BadRequest,bad.StatusCode);
        using var badDate=await client.GetAsync("/api/v1/admin/reports?from=invalid"); Assert.Equal(HttpStatusCode.BadRequest,badDate.StatusCode);
    }
}
