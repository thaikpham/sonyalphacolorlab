## Thay đổi

<!-- Một hai câu: thay đổi gì, vì sao. Ảnh 390 và 1440 nếu đổi giao diện. -->

## Kiểm tra

- [ ] `npm run verify` (lint, typecheck, test, build)
- [ ] `npm run test:screens` (layout 390/768/1440, axe, vùng chạm 44px, CLS/JS/LCP, màn đầu)

## Thiết kế

<!-- Bắt buộc khi PR đổi src/, messages/, public/fonts/ hoặc packages/colorlab-tokens/ (design-checklist.yml). Đánh dấu mục đầu nếu không đổi giao diện. Chi tiết: docs/DESIGN_GOVERNANCE.md. -->

- [ ] Không đổi giao diện
- [ ] Một `.btn-accent` mỗi màn hình; màu theo token, không hex, không palette Tailwind (`floor.test.ts` xanh)
- [ ] Vừa 390 / 768 / 1440, không cuộn ngang ngoài `.scroll-silent` / `.filter-scroll` / `.scroll-area` / `.scroll-table`
- [ ] Không dòng giải thích; mọi chuỗi trong `messages/*.json` ở cả hai ngôn ngữ
- [ ] Không stroke, chữ luôn sáng hơn nền, elevation dùng nguyên khối
- [ ] Ba trạng thái: đang tải đúng kích thước, rỗng có việc để làm, lỗi có thử lại
- [ ] Trợ năng: tên đọc được bắt đầu bằng chữ hiển thị, vùng chạm 44px, `:focus-visible` thấy được, sheet trả focus
- [ ] Màn mới có trong `e2e/setup.ts`
- [ ] Màn đầu không tăng số chỗ bấm; không tên nội bộ ở màn đầu
- [ ] Ảnh so sánh: không đổi, hoặc đã xem `visual-diff` và gắn `visual-ok`
