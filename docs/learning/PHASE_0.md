# P0 v0.2 — .NET commerce và Python AI

## What

Dự án có ba thành phần chạy độc lập: React, ASP.NET Core và FastAPI. .NET sẽ sở hữu danh tính, sản phẩm, đơn, kho và số liệu. Python sở hữu tri thức/vector và điều phối AI. P0 chỉ tạo nền tảng, chưa có auth, CRUD, checkout hoặc LLM.

```text
backend/
  ClayNest.sln
  Directory.Build.props
  Directory.Packages.props
  src/ClayNest.Domain/
  src/ClayNest.Application/Abstractions/
  src/ClayNest.Infrastructure/Persistence/
  src/ClayNest.Infrastructure/Health/
  src/ClayNest.API/Configuration/
  src/ClayNest.API/Endpoints/
  src/ClayNest.API/Errors/
  src/ClayNest.API/Middleware/
  tests/ClayNest.UnitTests/
  tests/ClayNest.IntegrationTests/
ai-service/app/{api,core,db,llm,tools,rag,analytics}/
ai-service/tests/
infra/postgres/
scripts/
```

## Why

Clean Architecture giữ quy tắc nghiệp vụ ở trong và chi tiết triển khai ở ngoài. Interface `IReadinessProbe` thuộc Application; Infrastructure hiện thực bằng PostgreSQL; API chỉ hỏi interface. Composition root trong Program nối các thành phần qua DI. Domain chưa có entity vì chưa tới P1, thay vì thêm entity hoặc repository chưa có nhu cầu.

Tách DB user bảo vệ quyền sở hữu ngay tại PostgreSQL, kể cả khi code ứng dụng gọi nhầm schema. Kiểm thử ownership dùng DB thật và thử thao tác bị cấm, không chỉ kiểm tra tên folder.

## How — luồng HTTP và dữ liệu

Browser → Kestrel → correlation middleware → exception handler → CORS → endpoint → Application contract → Infrastructure → PostgreSQL commerce. Connection pool được DI quản lý vòng đời; DbContext scoped theo request, không singleton. Query readiness không mở transaction ghi dữ liệu.

API có `/health` và `/ready`. Liveness không cần DB. Readiness `SELECT 1` lỗi trả 503, không lộ connection string. `X-Correlation-ID` hợp lệ được giữ qua request; giá trị không hợp lệ được thay bằng UUID. `X-Request-ID` giữ tương thích P0. JSON logs chỉ ghi method/path/status/thời gian và correlation, không ghi body, token hoặc query string.

Python không được browser gọi trực tiếp. P0 chỉ có health/readiness và OpenAPI trong mạng nội bộ. Các endpoint chat/tool và xác thực liên dịch vụ sẽ được triển khai cùng phạm vi tương ứng; chưa có LLM call hoặc chức năng đặt đơn.

## C# so với Python

Kestrel và Uvicorn cùng nhận HTTP; ASP.NET middleware tương ứng FastAPI middleware. ASP.NET DI container quản lý singleton/scoped/disposable; FastAPI dùng dependency/lifespan. EF Core DbContext tương ứng SQLAlchemy session về đơn vị làm việc, nhưng chúng không chia sẻ entity hay migration. .NET build kiểm tra kiểu/assembly; Python dùng type hints, Pydantic và pytest để xác minh dữ liệu/hành vi.

## Chạy bằng Docker từ thư mục gốc

```powershell
python scripts/configure.py
docker compose --profile app up -d --build --wait
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/ready
```

OpenAPI .NET trong Development: http://127.0.0.1:8000/openapi/v1.json. Python health truy cập từ container:

```powershell
docker compose exec -T ai-service python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8001/health').read().decode())"
```

`configure.py` sinh credential còn thiếu, giữ giá trị đã có và không in mật khẩu. `.env` và `.env.example` không được Git theo dõi. Không dùng mật khẩu cố định trong source. `db-bootstrap` tạo/cập nhật role/schema trên volume hiện có. Không chạy `docker compose down -v` nếu muốn giữ dữ liệu.

## Build và test

```powershell
dotnet restore backend/ClayNest.sln --locked-mode
dotnet build backend/ClayNest.sln -c Release --no-restore
docker compose --profile test run --rm --build api-tests
docker compose --profile test run --rm --build ai-tests
```

Test profile bật cả kiểm thử DB thật; chạy xUnit không có hai biến TEST_*_CONNECTION sẽ báo skip rõ cho test DB. Script `scripts/Start-Api.ps1` nạp riêng cấu hình cần thiết và chạy .NET trực tiếp sau khi DB/bootstrap đã hoạt động; dừng API Docker trước để tránh trùng cổng.

## Trade-offs và failure cases

- Có hai runtime nên phải giữ DTO, correlation và timeout tại boundary ở các phase tích hợp.
- AI không ảnh hưởng readiness commerce. DB lỗi làm readiness 503, không làm liveness lỗi.
- P0 chưa có bảng, seed nghiệp vụ hoặc migration; không tự tạo schema bằng EF khi startup. Schema và role thuộc bootstrap hạ tầng; bảng commerce thuộc EF migrations ở P1.
- Windows Application Control trên máy hiện tại chặn nạp assembly khi chạy xUnit trực tiếp. Build .NET thành công; dùng Docker Linux cho kiểm thử, không tắt chính sách máy.
- Preview frontend vẫn dùng dữ liệu tĩnh; thay backend chưa có nghĩa storefront đã tích hợp catalog thật.

## BA checklist

- NFR-02: operational endpoints riêng, correlation trên cả hai service.
- NFR-05: không commit secret, template local bị ignore.
- NFR-07: response contract health/readiness typed.
- NFR-08/NFR-10: tests architecture/API/PostgreSQL và lockfile tái lập.
- NFR-11: JSON logs, exception response an toàn.
- FR-16/BR-16: nền tảng tách ownership; chưa tự nhận đã triển khai tool calling hoặc caller scope.
- UAT-25: thử ghi chéo schema bằng user AI phải bị PostgreSQL từ chối; đồng thời kiểm tra chiều ngược lại.
- UAT-10: kiểm tra dừng AI mà .NET vẫn health/ready; chưa áp dụng cho chat vì chat chưa triển khai.

## Kết quả thực thi — 17/11/2026

- `dotnet restore backend/ClayNest.sln`: thành công, tạo đủ lockfile cho 6 project.
- `dotnet build backend/ClayNest.sln -c Release --no-restore`: thành công, 0 warning và 0 error. Docker build cũng biên dịch thành công.
- `dotnet test ...` trên Windows: không chạy được vì Application Control chặn nạp assembly (0x800711C7); không coi lệnh này là test đạt.
- `docker compose --profile test run --rm --build api-tests`: 4 unit/architecture + 11 integration tests đạt, gồm kiểm tra DB thật, không skip.
- `docker compose --profile test run --rm --build ai-tests`: 8 pytest đạt. Ở lượt kiểm tra cuối trên image runtime với `AI_INTEGRATION_TESTS=1` và tắt cache provider: 8 đạt, còn 1 cảnh báo deprecation Starlette/TestClient dùng httpx.
- `docker compose --profile app up -d --build --quiet-build --wait`: API .NET, AI service và DB đều healthy.
- HTTP thật: .NET `/health` và `/ready` 200; OpenAPI `/openapi/v1.json` liệt kê đúng hai endpoint. Python health/readiness kiểm tra từ container đều 200.
- Dừng AI service: .NET health và readiness vẫn 200. Khôi phục AI thành công.
- Dừng PostgreSQL: .NET health 200, readiness 503; khôi phục DB: readiness 200.
- SQL xác nhận schema `commerce` do `commerce_app` sở hữu, `ai` do `ai_app` sở hữu; extension vector nằm ở `ai`.
- `git diff --check` và `docker compose config --quiet`: đạt. `.env`/`.env.example` bị ignore; không có trong tracked files. Frontend và README không thay đổi.

Các kết quả này xác minh P0. Chưa có auth, migration bảng nghiệp vụ, catalog, tool calling, RAG hoặc analytics để tự nhận đã hoàn thành các UAT tương ứng.
