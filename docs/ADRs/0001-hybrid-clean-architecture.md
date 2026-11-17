# ADR-0001 — .NET commerce, Python AI và Clean Architecture

Trạng thái: triển khai nền tảng P0 theo đặc tả v0.2 và yêu cầu chuyển backend.

## Bối cảnh

Backend trước đây là khung FastAPI, chưa có bảng hay nghiệp vụ. Frontend Nàng Gốm hiện dùng dữ liệu minh họa. Đặc tả v0.2 chuyển quyền sở hữu commerce/identity/KPI sang .NET, giữ Python cho AI/RAG.

## Quyết định

- Dùng .NET 10 LTS, ASP.NET Core Web API và EF Core/Npgsql cùng major 10. Package quản lý tập trung bằng `backend/Directory.Packages.props`, lockfile tại mỗi project.
- `Domain` không tham chiếu framework/DB/HTTP. Chưa tạo entity giả ở P0.
- `Application` tham chiếu Domain, khai báo hợp đồng do use case cần. Hiện có `IReadinessProbe`.
- `Infrastructure` tham chiếu Application và hiện thực EF Core, connection pool, PostgreSQL readiness. Không tham chiếu API.
- `API` là composition root: DI, middleware, CORS, OpenAPI và endpoints. Không đặt nghiệp vụ ở endpoint.
- Giữ modular monolith cho commerce; chưa cần MediatR, generic repository, event bus hoặc dịch vụ tách theo nghiệp vụ.
- FastAPI chuyển từ `backend/` sang `ai-service/`. Xóa các placeholder commerce rỗng trong Python; giữ package AI/RAG/tool theo v0.2.
- Một PostgreSQL instance với `commerce_app`/schema `commerce` và `ai_app`/schema `ai`. Không service nào dùng superuser. Vector nằm trong `ai`; role commerce không có USAGE vào schema này và ngược lại.
- `db-bootstrap` chạy idempotent để nâng volume P0 cũ mà không xóa volume. File init cũng dùng được khi dựng DB mới.
- Chỉ API .NET mở cổng host 8000; Python chỉ có cổng 8001 trong mạng Compose. Không có internal chat/tool endpoint chưa được xác thực ở P0 vì chưa tạo các endpoint đó.
- Health là tiến trình sống; readiness của .NET chỉ phụ thuộc commerce DB, không phụ thuộc AI. Khi AI dừng, commerce vẫn có thể sẵn sàng.
- Không tự chạy `EnsureCreated` hoặc migration khi khởi động. Migration bảng nghiệp vụ thuộc P1. Readiness hiện kiểm tra kết nối, chưa kiểm tra phiên bản schema.
- Giữ nguyên frontend. Không cập nhật README theo yêu cầu; `.env.example` vẫn bị Git bỏ qua.

## Phương án không chọn

Giữ FastAPI làm chủ commerce mâu thuẫn v0.2. Tách mỗi domain thành microservice làm tăng chi phí tích hợp ngoài phạm vi MVP. Dựng entity/repository/CQRS rỗng để đủ lớp tạo code chưa có yêu cầu kiểm chứng.

## Hệ quả và phạm vi tiếp theo

P0 bổ sung một deployment boundary và hai runtime. P1 sẽ thêm Identity hoặc auth flow đã rà soát, migration, catalog và các quy tắc nghiệp vụ. P4 bổ sung service credential và caller scope ở các API AI/read-tool; không coi mạng nội bộ là cơ chế phân quyền. Tách migration principal và runtime principal chặt hơn khi hardening production.
