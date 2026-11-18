namespace ClayNest.API.Errors;

public static class ApiErrors
{
    public static IResult Create(HttpContext context, int status, string code, string detail,
        Dictionary<string, string[]>? errors = null) => Results.Problem(
        statusCode: status, title: detail,
        extensions: new Dictionary<string, object?>
        {
            ["code"] = code, ["correlationId"] = context.TraceIdentifier,
            ["errors"] = errors
        });

    public static Task WriteAsync(HttpContext context, int status, string code, string detail) =>
        Create(context, status, code, detail).ExecuteAsync(context);
}
