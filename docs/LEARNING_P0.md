# P0 — Nền tảng ClayNest AI

## What — Có gì?

Một modular monolith: một ứng dụng FastAPI với các package nghiệp vụ tách theo domain. React là ứng dụng trình duyệt riêng. PostgreSQL dùng Docker volume để giữ dữ liệu; pgvector là extension, chưa có embeddings hay bảng nghiệp vụ.

## Why — Vì sao?

Một backend giúp học luồng request và transaction trước khi phải xử lý giao tiếp giữa nhiều dịch vụ. Các package domain hiện rỗng để xác định chỗ đặt code sau này. PostgreSQL thật sẽ dùng cho kiểm tra transaction ở P2; SQLite có hành vi khóa khác.

Python dùng `.venv` để cô lập thư viện giữa các dự án. `pyproject.toml` khai báo package và dependency; `uv.lock` khóa phiên bản để tái lập. `uv sync --frozen --extra dev` tạo môi trường đúng lockfile, bao gồm pytest/httpx. Vai trò gần với khai báo dependency trong `.csproj` và khôi phục bằng NuGet, nhưng Python cần môi trường thực thi riêng.

## How — Luồng request và cấu hình

1. Vite phục vụ React tại cổng 5173.
2. React gọi `/health` trên FastAPI cổng 8000; browser áp dụng CORS.
3. Uvicorn nhận HTTP qua ASGI, chuyển tới middleware rồi endpoint FastAPI.
4. `/health` chỉ trả trạng thái tiến trình. `/ready` mở kết nối SQLAlchemy và chạy `SELECT 1`.
5. SQLAlchemy dùng driver psycopg giao tiếp PostgreSQL. Lifespan giải phóng connection pool khi ứng dụng dừng.

ASGI là giao diện giữa web server Python và ứng dụng, hỗ trợ bất đồng bộ. Uvicorn có vai trò gần với Kestrel; middleware FastAPI gần middleware ASP.NET Core. Endpoint `def` chạy trong thread pool, phù hợp driver SQL đồng bộ của P0. Tránh đặt SQL đồng bộ vào `async def` làm nghẽn event loop.

`Settings` đọc biến môi trường và `.env` ở gốc bằng đường dẫn cố định, không phụ thuộc thư mục chạy. Vai trò gần `IConfiguration`/Options. `create_app` tạo engine riêng cho từng ứng dụng. Khi có nghiệp vụ, session/transaction cần giới hạn theo request hoặc application service.

`X-Request-ID` được tạo mới cho mỗi phản hồi bình thường. P0 chưa có structured logging/tracing đầy đủ. OpenAPI được FastAPI sinh từ endpoint và model Pydantic, gần Swagger của ASP.NET Core.

## Trade-offs và lỗi cần hiểu

- Backend khởi động khi PostgreSQL tắt: `/health` 200, `/ready` 503, phân biệt tiến trình sống và khả năng nhận việc có database.
- Readiness kiểm tra database, chưa kiểm tra schema hoặc AI.
- UI có timeout 5 giây, hủy request khi component tháo và có nút thử lại. Health không xác nhận database đã sẵn sàng.
- Test mock xác minh hợp đồng API không cần Docker. Kiểm tra PostgreSQL thật chạy riêng.
- Mật khẩu demo và cổng loopback chỉ dành cho phát triển cục bộ.
- Chưa cần Alembic khi chưa có schema nghiệp vụ. P1 sẽ thêm migration và kiểm tra nâng cấp.

## Kiểm tra thủ công

Chạy theo README. Mở website xem trạng thái backend; tắt backend rồi bấm kiểm tra lại để xem lỗi. Tắt database bằng `docker compose stop db`: `/health` vẫn 200 và `/ready` phải 503. Chạy `docker compose up -d --wait`: `/ready` trở lại 200. Swagger tại `/docs`.

## Phạm vi và quyết định

P0 đáp ứng nền tảng kiến trúc và một phần NFR-02 (health/readiness, request ID), NFR-05 (cấu hình và kiểm thử nền tảng). Structured logging đầy đủ và migration nghiệp vụ chưa thuộc kết quả P0. Chưa triển khai FR catalog, checkout, AI hoặc analytics.

Giữ quy tắc bỏ qua Markdown cục bộ, chỉ thêm ngoại lệ cho tài liệu học P0. Dùng Vite/CSS thuần cho shell. Không dùng API trả phí.

Tham khảo: [FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/), [Vite](https://vite.dev/guide/).
