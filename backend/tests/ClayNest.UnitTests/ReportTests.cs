using System.Text;
using System.Text.Json;
using ClayNest.Application.Reports;
using ClayNest.Infrastructure.Reports;

namespace ClayNest.UnitTests;
public sealed class ReportTests
{
    [Fact]
    public void Vietnam_period_is_half_open_and_default_date_uses_vietnam_calendar()
    {
        var now=DateTimeOffset.Parse("2026-11-18T17:00:00Z");
        var period=ReportPeriod.Create(new(new(2026,11,19),new(2026,11,19)),now);
        Assert.Equal(DateTimeOffset.Parse("2026-11-18T17:00:00Z"),period.FromUtc);
        Assert.Equal(DateTimeOffset.Parse("2026-11-19T17:00:00Z"),period.ToExclusiveUtc);
        var defaults=ReportPeriod.Create(new(),now); Assert.Equal(new DateOnly(2026,11,19),defaults.To); Assert.Equal(29,defaults.To.DayNumber-defaults.From.DayNumber);
        var week=period with { Grain="week" }; Assert.Equal(new DateOnly(2026,11,16),week.Bucket(period.From));
        var month=period with { Grain="month" }; Assert.Equal(new DateOnly(2026,11,1),month.Bucket(period.From));
    }
    [Theory]
    [InlineData("day",367)] [InlineData("hour",1)] [InlineData("day",0)] [InlineData("drop table",1)]
    public void Invalid_windows_and_grain_are_rejected(string grain,int days)
    {
        var from=new DateOnly(2026,1,1); Assert.Throws<ReportValidationException>(()=>ReportPeriod.Create(new(from,from.AddDays(days-1),grain),DateTimeOffset.UtcNow));
    }
    [Theory]
    [InlineData("=SUM(A1)","\"'=SUM(A1)\"")]
    [InlineData("  @formula","\"'  @formula\"")]
    [InlineData("quote\",comma","\"quote\"\",comma\"")]
    public void Csv_strings_cannot_inject_formulas_or_break_quoting(string value,string expected) => Assert.Equal(expected,ReportCsv.Cell(value));

    [Fact]
    public void Money_contract_and_csv_preserve_values_above_javascript_safe_integer()
    {
        const long precise=9007199254740993;
        var period=ReportPeriod.Create(new(new(2026,1,1),new(2026,1,1)),DateTimeOffset.UtcNow);
        var report=new SalesReport(period,DateTimeOffset.UtcNow,"Asia/Ho_Chi_Minh",true,new(precise,precise,0,1,precise,0,0),[],[],0,[]);
        var json=JsonSerializer.Serialize(report,new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Contains("\"completedSalesVnd\":\"9007199254740993\"",json);
        Assert.Equal(precise,JsonSerializer.Deserialize<SalesReport>(json,new JsonSerializerOptions(JsonSerializerDefaults.Web))!.Metrics.CompletedSalesVnd);
        var csv=ReportCsv.Write(report); Assert.Equal(new byte[]{239,187,191},csv.Take(3));
        var text=Encoding.UTF8.GetString(csv); Assert.Contains("9007199254740993",text); Assert.Contains("DEMO DATA",text); Assert.Contains("\r\n",text);
    }
    [Fact]
    public async Task Demo_seeding_cannot_write_to_an_operating_database()
    {
        var options=new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<ClayNest.Infrastructure.Persistence.CommerceDbContext>();
        Microsoft.EntityFrameworkCore.NpgsqlDbContextOptionsBuilderExtensions.UseNpgsql(options,"Host=db;Database=claynest;Username=commerce_app");
        await using var db=new ClayNest.Infrastructure.Persistence.CommerceDbContext(options.Options);
        var seeder=new ReportDemoSeeder(db,TimeProvider.System,Microsoft.Extensions.Options.Options.Create(new ReportOptions { IsDemo=true }));
        await Assert.ThrowsAsync<InvalidOperationException>(()=>seeder.SeedAsync(CancellationToken.None));
    }

}
