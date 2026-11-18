FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source
COPY Directory.Build.props Directory.Packages.props ClayNest.sln ./
COPY src/ClayNest.Domain/ClayNest.Domain.csproj src/ClayNest.Domain/
COPY src/ClayNest.Application/ClayNest.Application.csproj src/ClayNest.Application/
COPY src/ClayNest.Infrastructure/ClayNest.Infrastructure.csproj src/ClayNest.Infrastructure/
COPY src/ClayNest.API/ClayNest.API.csproj src/ClayNest.API/
COPY tests/ClayNest.UnitTests/ClayNest.UnitTests.csproj tests/ClayNest.UnitTests/
COPY tests/ClayNest.IntegrationTests/ClayNest.IntegrationTests.csproj tests/ClayNest.IntegrationTests/
COPY src/ClayNest.Domain/packages.lock.json src/ClayNest.Domain/
COPY src/ClayNest.Application/packages.lock.json src/ClayNest.Application/
COPY src/ClayNest.Infrastructure/packages.lock.json src/ClayNest.Infrastructure/
COPY src/ClayNest.API/packages.lock.json src/ClayNest.API/
COPY tests/ClayNest.UnitTests/packages.lock.json tests/ClayNest.UnitTests/
COPY tests/ClayNest.IntegrationTests/packages.lock.json tests/ClayNest.IntegrationTests/
RUN dotnet restore ClayNest.sln --locked-mode
COPY src ./src
COPY tests ./tests
RUN dotnet build ClayNest.sln -c Release --no-restore

FROM build AS tests
ENTRYPOINT ["dotnet", "test", "ClayNest.sln", "-c", "Release", "--no-build", "--no-restore", "--logger", "console;verbosity=normal"]

FROM build AS publish
RUN dotnet publish src/ClayNest.API/ClayNest.API.csproj -c Release --no-build --no-restore -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=publish /out ./
RUN mkdir -p /app/keys /app/media/catalog && chown -R $APP_UID:$APP_UID /app/keys /app/media
USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "ClayNest.API.dll"]
