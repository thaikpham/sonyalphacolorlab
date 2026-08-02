# Cloud Share Operator Runbook

Runbook tối thiểu cho team vận hành browser capture + QR cloud share tại sự kiện.

## Mục tiêu

- xác minh backend sẵn sàng trước giờ chạy
- nhận biết nhanh lỗi đang nằm ở DB, R2, hay origin config
- có lệnh kiểm tra và cleanup thủ công

## 1. Kiểm tra nhanh khi nhận ca

1. Mở health endpoint:

```bash
curl -i https://your-domain/api/health/cloud-share
```

Kỳ vọng:

- status `200`
- body có `checks.env = ready`
- body có `checks.database = ready`
- body có `checks.r2Signer = ready`

2. Chụp thử một ảnh trên booth.
3. Quét QR bằng điện thoại thật.

## 2. Query DB hữu ích

20 capture mới nhất:

```sql
select
  capture_id,
  kind,
  status,
  download_token,
  storage_key,
  expires_at,
  uploaded_at,
  deleted_at
from capture_downloads
order by created_at desc
limit 20;
```

## 3. Lỗi thường gặp và cách đọc

### `database_unavailable`

Ý nghĩa:

- API không nói chuyện được với Postgres

Việc cần làm:

- kiểm tra `POSTGRES_URL` hoặc `DATABASE_URL`
- kiểm tra trạng thái provider Postgres
- gọi lại health endpoint sau khi sửa

### `missing_environment`

Ý nghĩa:

- thiếu env cloud share bắt buộc

Việc cần làm:

- so khớp env trên Vercel với `.env.example`
- redeploy nếu vừa thêm biến mới

### `origin_required` hoặc `origin_not_allowed`

Ý nghĩa:

- browser origin hiện tại không khớp `APP_BASE_URL`

Việc cần làm:

- production: kiểm tra domain thật đang dùng
- local `vercel dev`: đặt `APP_BASE_URL` về origin local thật, ví dụ `http://localhost:3000`

### `capture_upload_incomplete`

Ý nghĩa:

- object chưa xuất hiện trên R2 lúc gọi complete

Việc cần làm:

- kiểm tra CORS bucket
- kiểm tra quyền `PutObject`
- xem browser console có `403` từ R2 không

## 4. Cleanup thủ công

```bash
curl -i \
  -H "Authorization: Bearer <CRON_SECRET>" \
  https://your-domain/api/cron/cleanup-expired
```

Kỳ vọng:

- có `processed`
- có `deleted`
- nếu `failed > 0`, kiểm tra log function và thử lại sau khi xử lý R2/DB

## 5. Rotate secrets

Khi rotate `CRON_SECRET` hoặc R2 keys:

1. cập nhật env trên Vercel
2. redeploy
3. gọi lại health endpoint
4. chạy 1 smoke capture mới
5. test lại manual cleanup với secret mới
