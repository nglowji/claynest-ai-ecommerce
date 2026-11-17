using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace ClayNest.API.Errors;

public sealed partial class GlobalExceptionHandler(
    IProblemDetailsService problemDetails, ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        UnhandledFailure(logger, exception.GetType().Name, context.TraceIdentifier);
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await problemDetails.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Không thể xử lý yêu cầu lúc này.",
                Extensions = { ["correlation_id"] = context.TraceIdentifier }
            }
        });
        return true;
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled {ExceptionType}; correlation {CorrelationId}")]
    private static partial void UnhandledFailure(ILogger logger, string exceptionType, string correlationId);
}
