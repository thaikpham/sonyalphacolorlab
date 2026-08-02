# Vercel + R2 Cloud Share Checklist

Tài liệu này dùng để bật và test thật flow browser capture mới:

- chụp xong preview local hiện ngay trong review overlay
- file upload lên private Cloudflare R2 khi kết thúc session
- overlay hiện 1 QR duy nhất mở gallery của cả session
- token gallery được kiểm tra ở Vercel Functions
- signed media URL chỉ sống ngắn hạn
- cleanup xóa file theo `expires_at` trong DB

Flow code hiện tại nằm ở:

- Frontend capture: [src/hooks/useCaptureActions.ts](../src/hooks/useCaptureActions.ts)
- Browser session overlay: [src/components/capture/BrowserSessionOverlay.tsx](../src/components/capture/BrowserSessionOverlay.tsx)
- Vercel API: [api/](../api)
- Vercel routing + cron: [vercel.json](../vercel.json)
- Env template: [.env.example](../.env.example)
- Quickstart local test: [docs/vercel-dev-cloud-share-quickstart.md](./vercel-dev-cloud-share-quickstart.md)
- Internal go-live: [docs/internal-event-ops-go-live-checklist.md](./internal-event-ops-go-live-checklist.md)
- Operator runbook: [docs/cloud-share-operator-runbook.md](./cloud-share-operator-runbook.md)

## Quick Go / No-Go

- [ ] Vercel project đã trỏ đúng `Root Directory = kiosk-app`
- [ ] Có private bucket trên Cloudflare R2
- [ ] Có R2 access key / secret dùng cho S3-compatible API
- [ ] Đã cấu hình CORS cho browser upload bằng presigned URL
- [ ] Có Postgres connection string
- [ ] Đã set `APP_BASE_URL` đúng domain public
- [ ] Đã set `CRON_SECRET`
- [ ] `GET /api/health/cloud-share` trả `200`
- [ ] Đã test capture thật trên `vercel dev` hoặc deployment thật

## 1. Tạo Vercel Project Đúng Cấu Trúc

Repo này là monorepo nhẹ có app thật nằm trong thư mục `kiosk-app`.

Khi tạo project trên Vercel:

- Chọn đúng repository
- Đặt `Root Directory` là `kiosk-app`
- Framework preset có thể để Vite
- Đảm bảo file [vercel.json](../vercel.json) trong `kiosk-app` được dùng

Nếu root directory bị để ở repo root, các function trong `kiosk-app/api` sẽ không chạy đúng.

### CLI khuyến nghị

```bash
vercel login
vercel link
```

Chạy các lệnh trên trong thư mục `kiosk-app`.

## 2. Tạo Private Bucket Trên Cloudflare R2

Checklist:

- [ ] Tạo bucket mới, để private
- [ ] Không public bucket
- [ ] Tạo access key có quyền đọc/ghi bucket này
- [ ] Ghi lại:
  - `R2_ACCOUNT_ID`
  - `R2_BUCKET_NAME`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`

### CORS bắt buộc cho presigned upload

Flow hiện tại upload file từ browser trực tiếp lên presigned `PUT` URL, nên bucket vẫn cần CORS.

JSON mẫu:

```json
[
  {
    "AllowedOrigins": [
      "https://cheesebooth.vercel.app",
      "http://127.0.0.1:3000",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Điều chỉnh `AllowedOrigins` theo domain thật của bạn.

### Lifecycle rule

Lifecycle trên R2 chỉ nên là lớp backup dọn rác, không phải nguồn chân lý.

Khuyến nghị:

- Lifecycle backup: `Delete objects after 72h`
- Nguồn chân lý thật: `expires_at` trong DB + cleanup cron của app

## 3. Tạo Database

App hiện hỗ trợ:

- `POSTGRES_URL`
- hoặc `DATABASE_URL`

Có thể dùng:

- Vercel Marketplace Postgres / Neon
- hoặc bất kỳ Postgres nào bạn kiểm soát

Không cần chạy migration tay cho v1 này. API sẽ tự tạo bảng `capture_downloads` khi có request đầu tiên.

### Query kiểm tra nhanh

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

## 4. Nạp Environment Variables

Dùng file mẫu [.env.example](../.env.example).

### Biến bắt buộc

- `APP_BASE_URL`
  - domain public thật, ví dụ `https://cheesebooth.vercel.app`
  - khi test local bằng `vercel dev`, đổi sang origin local thật, ví dụ `http://localhost:3000`
  - không thêm dấu `/` cuối
- `POSTGRES_URL`
  - connection string của DB
- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `CRON_SECRET`
  - chuỗi ngẫu nhiên dài, dùng để gọi manual cleanup an toàn

### Biến frontend

- `VITE_CLOUD_SHARE_API_BASE`
  - trên production Vercel: để trống
  - khi chạy `npm run dev` thuần Vite: set về domain có API thật, ví dụ deployment preview hoặc local `vercel dev`

### Khuyến nghị nơi nạp biến

Nạp cùng bộ biến cho:

- Production
- Preview
- Development

trong Vercel Project Settings.

## 5. Cách Test Thật Ngay Ở Local

Để test full flow browser + API + QR, ưu tiên `vercel dev`.

```bash
cd kiosk-app
cp .env.example .env.local
vercel dev
```

Checklist test:

- [ ] Mở URL local do `vercel dev` in ra
- [ ] Cấp quyền camera
- [ ] Chụp 1 ảnh ở browser mode
- [ ] Modal mở ngay với preview local
- [ ] Block share chuyển từ `Đang tạo link tải…` sang QR
- [ ] Mở link token hoặc quét QR từ điện thoại
- [ ] Link phải `302` sang file thật và tải được

### Quan trọng

Nếu bạn chỉ chạy:

```bash
npm run dev
```

thì frontend Vite sẽ không tự có `/api/*`.

Lúc đó cloud share chỉ chạy được nếu `VITE_CLOUD_SHARE_API_BASE` trỏ tới một origin đang có Vercel Functions thật.

## 6. Deploy Preview / Production

Sau khi env đã đúng:

- deploy preview bằng push branch
- hoặc deploy production bằng `vercel --prod`

Checklist sau deploy:

- [ ] Capture trong browser không còn auto-download local
- [ ] Modal hiện preview local ngay
- [ ] QR xuất hiện sau khi upload xong
- [ ] Link token có dạng `https://your-domain/{download_token}`
- [ ] Token mở được file thật
- [ ] Bucket vẫn private
- [ ] `https://your-domain/api/health/cloud-share` trả `200`

## 7. Force Test Hết Hạn + Cleanup

Đây là bài test quan trọng để xác nhận token 24h và cleanup hoạt động đúng.

### 7.1 Ép token hết hạn

Chọn 1 row mới nhất rồi update:

```sql
update capture_downloads
set expires_at = now() - interval '1 minute'
where capture_id = '<capture_id>';
```

Kỳ vọng:

- mở lại `https://your-domain/{download_token}` sẽ trả `410 Gone`

### 7.2 Gọi cleanup thủ công

Production:

```bash
curl -i \
  -H "Authorization: Bearer <CRON_SECRET>" \
  https://your-domain/api/cron/cleanup-expired
```

Local `vercel dev`:

```bash
curl -i \
  -H "Authorization: Bearer <CRON_SECRET>" \
  http://127.0.0.1:3000/api/cron/cleanup-expired
```

Kỳ vọng:

- row chuyển sang `status = 'deleted'`
- `deleted_at` có giá trị
- object bị xóa khỏi R2

## 8. Launch Checklist

- [ ] Vercel project root đúng là `kiosk-app`
- [ ] `vercel.json` đã được pick up
- [ ] Env vars đầy đủ
- [ ] R2 bucket private
- [ ] R2 CORS đã bật cho `PUT`
- [ ] DB kết nối thành công
- [ ] Chụp ảnh browser mode tạo được row trong `capture_downloads`
- [ ] QR hiện ra trong modal
- [ ] Token URL tải được file
- [ ] Token quá hạn trả `410`
- [ ] Cleanup API xóa object được
- [ ] Lifecycle 72h chỉ đóng vai trò backup

## 9. Các Lỗi Hay Gặp

### Capture xong nhưng QR đứng ở trạng thái loading

Thường là một trong các lỗi sau:

- thiếu CORS trên R2
- sai `R2_*` credentials
- `POSTGRES_URL` chưa đúng
- `APP_BASE_URL` sai domain
- bạn đang chạy `npm run dev` thuần Vite nhưng không set `VITE_CLOUD_SHARE_API_BASE`

### QR mở ra nhưng link chết

Thường là:

- token đã hết hạn
- row chưa `status = ready`
- `APP_BASE_URL` trỏ sai domain

### Upload được nhưng cleanup không chạy

Kiểm tra:

- `CRON_SECRET`
- route `/api/cron/cleanup-expired`
- cron trong [vercel.json](../vercel.json)

## 10. Official References

- Vercel CLI overview: https://vercel.com/docs/cli
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Cloudflare R2 presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Cloudflare R2 CORS: https://developers.cloudflare.com/r2/buckets/cors/
