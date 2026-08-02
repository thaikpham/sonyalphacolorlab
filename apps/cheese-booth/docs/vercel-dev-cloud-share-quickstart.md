# Vercel Dev Cloud Share Quickstart

Tài liệu này dành cho lúc bạn muốn test ngay flow browser capture + cloud upload + QR mà không cần đọc toàn bộ checklist dài.

Mục tiêu:

- chạy app bằng `vercel dev`
- chụp thử một ảnh trong browser mode
- thấy modal hiện preview local ngay
- chờ QR xuất hiện
- mở token link để tải file
- ép hết hạn token và gọi cleanup thủ công

Nếu cần checklist triển khai đầy đủ hơn, xem:

- [docs/vercel-r2-cloud-share-checklist.md](./vercel-r2-cloud-share-checklist.md)

## 0. Những gì cần có sẵn

Bạn đã có trên Vercel:

- project đã link đúng `Root Directory = kiosk-app`
- env vars đã nạp đủ
- R2 bucket private + CORS
- Postgres chạy được

Nếu chưa xong các phần đó, quay lại checklist đầy đủ trước.

## 1. First-Time Local Setup

Chạy lần lượt:

```bash
cd /home/thaikpham/Documents/Photobooth/kiosk-app
npx vercel login
```

Sau khi login xong:

```bash
cd /home/thaikpham/Documents/Photobooth/kiosk-app
npx vercel link
```

Khi được hỏi:

1. chọn đúng account/team
2. chọn đúng project của app này
3. xác nhận root là `kiosk-app`

## 2. Pull Env Về Máy

```bash
cd /home/thaikpham/Documents/Photobooth/kiosk-app
npx vercel env pull .env.local
```

Kiểm tra nhanh các biến quan trọng:

```bash
cd /home/thaikpham/Documents/Photobooth/kiosk-app
rg "^(APP_BASE_URL|POSTGRES_URL|R2_ACCOUNT_ID|R2_BUCKET_NAME|R2_ACCESS_KEY_ID|CRON_SECRET)=" .env.local
```

Nếu bạn muốn giữ API cùng origin local qua `vercel dev`, để `VITE_CLOUD_SHARE_API_BASE` trống hoặc xóa dòng đó khỏi `.env.local`.
Đồng thời đặt `APP_BASE_URL=http://localhost:3000` hoặc đúng origin local mà `vercel dev` đang dùng, vì API cloud-share hiện kiểm tra `Origin` theo `APP_BASE_URL`.

## 3. Chạy App Bằng Vercel Dev

```bash
cd /home/thaikpham/Documents/Photobooth/kiosk-app
npx vercel dev
```

Mở URL local mà Vercel in ra, thường là:

```text
http://localhost:3000
```

Không dùng `npm run dev` cho bài test này, vì route `/api/*` của cloud-share nằm ở Vercel Functions.

## 4. Browser Smoke Test

Thực hiện trên UI:

1. mở màn capture
2. cấp quyền camera
3. chụp một ảnh ở browser mode

Kỳ vọng:

- modal outcome mở ngay
- preview local xuất hiện ngay, không chờ upload
- block `Share / QR` hiện trạng thái `Đang tạo link tải…`
- vài giây sau QR xuất hiện
- `http://localhost:3000/api/health/cloud-share` trả `200`

## 5. Kiểm Tra Token Link

Khi QR đã xuất hiện, bạn có 2 cách test:

### Cách A: bấm link ngay trong modal

Kỳ vọng:

- request đi tới `/{download_token}`
- Vercel Function kiểm tra token
- app trả `302`
- file thật được tải xuống

### Cách B: copy token URL rồi dùng curl

Thay `<TOKEN_URL>` bằng link thật trong modal:

```bash
curl -i "<TOKEN_URL>"
```

Kỳ vọng:

- response có status `302`
- header `location:` trỏ tới signed R2 URL

## 6. Kiểm Tra DB Sau Khi Chụp

Mở Postgres console của bạn rồi chạy:

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
limit 5;
```

Kỳ vọng ở row mới nhất:

- `status = 'ready'`
- `download_token` có giá trị
- `uploaded_at` có giá trị
- `deleted_at` là `null`

## 7. Force Expire Token

Lấy `capture_id` mới nhất rồi thay vào đây:

```sql
update capture_downloads
set expires_at = now() - interval '1 minute'
where capture_id = '<CAPTURE_ID>';
```

Test lại token link:

```bash
curl -i "<TOKEN_URL>"
```

Kỳ vọng:

- response là `410 Gone`

## 8. Gọi Cleanup Thủ Công

Lấy `CRON_SECRET` trong `.env.local`, rồi gọi:

```bash
curl -i \
  -H "Authorization: Bearer <CRON_SECRET>" \
  http://127.0.0.1:3000/api/cron/cleanup-expired
```

Kỳ vọng:

- JSON response có `processed` và `deleted`
- row DB chuyển sang `status = 'deleted'`
- `deleted_at` có giá trị
- object tương ứng bị xóa khỏi R2

## 9. Query Xác Minh Sau Cleanup

```sql
select
  capture_id,
  status,
  deleted_at,
  storage_key
from capture_downloads
where capture_id = '<CAPTURE_ID>';
```

Kỳ vọng:

- `status = 'deleted'`
- `deleted_at` không còn `null`

## 10. Nếu Có Lỗi, Soi Theo Thứ Tự Này

### QR đứng ở loading

Kiểm tra theo thứ tự:

1. terminal `vercel dev` có lỗi function không
2. browser console có lỗi CORS không
3. `.env.local` có đủ `R2_*` và `POSTGRES_URL` không
4. bucket R2 có CORS `PUT` + `Content-Type` chưa

### Link token không tải file

Kiểm tra:

1. `APP_BASE_URL` có đúng domain public hoặc local test context không
2. row DB có `status = 'ready'` chưa
3. token đã quá hạn chưa

### Cleanup không xóa được

Kiểm tra:

1. `CRON_SECRET` trong request có khớp env không
2. row DB có đang quá hạn thật không
3. R2 credentials có đủ quyền `DeleteObject` không

## 11. Kết Thúc Phiên Test

Khi xong, dừng `vercel dev` bằng:

```bash
Ctrl + C
```

Nếu muốn test lại sạch hơn:

- chụp lượt mới
- hoặc xóa row test trong DB
- hoặc dùng bucket/path test riêng
