# Internal Event Ops Go-Live Checklist

Checklist này dành riêng cho bối cảnh production nội bộ tại sự kiện, tập trung vào browser capture + cloud share + QR tải ảnh.

Nếu bạn đang chuẩn bị phát hành desktop installer cho người dùng tự cài, hãy dùng codebase `../kiosk-desktop` thay vì `kiosk-app`. Repo browser này không còn chứa desktop release workflow.

## 1. Cấu hình nền tảng

- [ ] Vercel project trỏ đúng `Root Directory = kiosk-app`
- [ ] `APP_BASE_URL` khớp origin thật đang phục vụ UI
- [ ] `POSTGRES_URL` hoặc `DATABASE_URL` đã nạp đúng môi trường
- [ ] `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` đã nạp đủ
- [ ] `CRON_SECRET` đã nạp và lưu vào password manager của team vận hành
- [ ] Bucket R2 vẫn private và đã có CORS cho browser `PUT`

## 2. Health check trước giờ mở booth

- [ ] `GET /api/health/cloud-share` trả `200`
- [ ] Không còn cảnh báo môi trường thiếu biến hoặc DB unavailable
- [ ] Browser booth mở được UI production và camera permission hoạt động

Ví dụ:

```bash
curl -i https://your-domain/api/health/cloud-share
```

## 3. Smoke test thực tế

- [ ] Chụp 1 ảnh ở browser mode
- [ ] Preview local hiện ngay trong modal
- [ ] QR xuất hiện sau khi upload xong
- [ ] Quét QR bằng điện thoại thật và tải được file
- [ ] DB có row mới với `status = 'ready'`

## 4. Cleanup và hết hạn

- [ ] Gọi manual cleanup bằng `CRON_SECRET` thành công
- [ ] Token hết hạn trả `410 Gone`
- [ ] Cleanup chuyển row sang `status = 'deleted'`

Ví dụ:

```bash
curl -i \
  -H "Authorization: Bearer <CRON_SECRET>" \
  https://your-domain/api/cron/cleanup-expired
```

## 5. Sẵn sàng vận hành

- [ ] Có ít nhất 1 người biết mở runbook và đọc health endpoint
- [ ] Có sẵn SQL query xem 20 capture mới nhất
- [ ] Có kế hoạch fallback khi DB hoặc R2 lỗi
- [ ] CI xanh ở commit đang deploy
