# Hướng dẫn biên tập — bài viết, trang kiến thức, liên kết và nguồn

Dành cho người biên tập nội dung trong `/admin/blog`. Áp dụng từ bản có trang
`/learn` (kho kiến thức) và tìm kiếm thống nhất.

## 1. Hai loại trang trong cùng một trình soạn

| Loại trang | Hiện ở | Dùng cho | Quy tắc khi đăng |
|---|---|---|---|
| **Bài blog** | `/blog/<mã>` | hướng dẫn, thử nghiệm, so sánh, lộ trình học | TL;DR đầu bài, 8–16 khối, kết bằng checklist hoặc ảnh |
| **Trang kiến thức** | `/learn/<mã>` | kiến thức tra cứu lâu dài (WB Shift, Color Depth…) | chọn nhóm, có ít nhất một tiêu đề mục, ít nhất một nguồn **có ngày kiểm tra** |

Chọn ở ô **Loại trang**. Khi trang đã đăng thì không đổi loại được (URL sẽ
đổi theo): gỡ đăng trước, đổi loại, rồi đăng lại.

Mã trang (phần cuối URL) được tạo từ tiêu đề ở lần lưu đầu và dùng chung cho
cả hai loại — một mã chỉ thuộc một trang.

## 2. Tạo và sửa

1. **Bài mới** → nhập tiêu đề → **Lưu nháp**. Ảnh chỉ tải lên được sau lần lưu
   đầu, vì ảnh phải thuộc về một trang.
2. Thêm khối nội dung như trước (đoạn văn, tiêu đề, menu, bảng, ảnh…).
3. Ô **Còn N quy tắc** luôn hiển thị những gì việc đăng sẽ từ chối — xử lý dần
   trong lúc viết.
4. Không có tự lưu. Đóng tab khi chưa lưu, trình duyệt sẽ hỏi lại.

## 3. Liên kết và nguồn

Nằm trong khung **Liên kết và nguồn**, dưới phần thông tin chung.

### Liên kết liên quan
Chọn loại (Công thức, Sản phẩm, Bài blog, Trang kiến thức) rồi gõ **mã** —
ô gợi ý liệt kê mã có thật:

- Công thức: mã dạng `SCL-PP-001` (không phải tên hay slug).
- Sản phẩm: mã trong danh mục, ví dụ `sony-ilce-7m4-bq-ap2`.
- Bài/trang: mã trong URL, ví dụ `iso-auto-min-ss`.

Khi lưu, máy chủ kiểm tra mọi mã. Mã không tồn tại được liệt kê dưới
**Không tìm thấy mã** và chặn việc đăng. Liên kết tới một bản nháp thì được
phép — nó tự hiện khi trang kia được đăng, và tự ẩn khi trang kia bị gỡ.

Bạn không cần sửa công thức hay sản phẩm để chúng "biết" về bài viết: trang
công thức và trang sản phẩm tự hiện các bài có liên kết tới chúng.

### Nên đọc trước
Mã các bài/trang người đọc nên đọc trước. Hiện ở cột bên phải bài, phía trên
mục lục.

### Giải thích khái niệm
Bấm chọn các thông số mà trang giải thích (ví dụ Picture Profile · Color
Depth). Trang công thức dùng thông tin này để đưa trang kiến thức phù hợp vào
mục **Tìm hiểu thêm**; trang thuật ngữ cũng dẫn sang.

### Nguồn
Mỗi nguồn gồm URL (bắt buộc `https://`), tiêu đề trang, nhà phát hành, mục,
phạm vi (máy, firmware) và **ngày kiểm tra**.

- Ngày kiểm tra là ngày **bạn đã mở và đọc lại trang đó**. Đừng điền ngày khi
  chưa đọc — đó chính là thứ trang công khai hiển thị là "kiểm tra …".
- Trang kiến thức không đăng được nếu có nguồn thiếu ngày.
- Với thông số máy ảnh, ưu tiên Help Guide của Sony **đúng mẫu máy** và ghi
  mẫu máy vào ô phạm vi.

### Tên tác giả và ngày rà soát
- **Tên tác giả hiển thị** là tên công khai. Không nhập email — hệ thống từ
  chối mọi giá trị có `@`.
- **Ngày rà soát** hiện là "Rà soát …" dưới bài. Nó không thay thế ngày đăng
  hay ngày sửa và không được dùng cho máy tìm kiếm.

## 4. Đăng và gỡ đăng

- **Đăng bài**: kiểm tra quy tắc theo loại trang, kiểm tra mã liên kết, chép
  ảnh sang kho công khai, rồi mới hiện trang. Nếu không kiểm tra được liên kết
  (lỗi tạm thời), việc đăng bị từ chối và **không có gì thay đổi**.
- **Gỡ đăng**: trang ẩn ngay ở mọi nơi — feed, `/learn`, tìm kiếm, sitemap,
  các mục liên quan — ở lần tải tiếp theo. Ảnh công khai được gỡ sau đó.
- **Xoá**: xoá ảnh khỏi cả hai kho trước, rồi xoá trang. Không hoàn tác được.

## 5. Ảnh

Không đổi so với trước: tải JPEG/PNG/WebP tối đa 8 MB, hệ thống tạo ba cỡ
WebP (320/640/1024) và bỏ siêu dữ liệu gốc. Không hỗ trợ ảnh động. Ảnh nháp
nằm trong kho riêng tư; chỉ bài đã đăng mới có ảnh công khai.

## 6. Bản nháp pilot

Chín bản nháp (sáu trang kiến thức, ba khung thử nghiệm) được tạo sẵn để duyệt
— xem `docs/plans/2026-10-05-pilot-content.md`:

- Trang kiến thức: mọi nguồn đã được đọc lại và ghi ngày kiểm tra
  2026-10-05; hai chỗ sai đã được sửa theo trang Sony. Đọc lại nội dung, điền
  **ngày rà soát** và tên tác giả hiển thị, rồi đăng những trang bạn muốn.
- Khung thử nghiệm: cần buổi chụp thật. Thay mọi chỗ `[CẦN BỔ SUNG: …]` bằng
  nội dung thật, tải cặp ảnh so sánh lên. Bài còn chỗ đánh dấu này sẽ không
  đăng được.

Không điền số đo, ảnh hay kết quả "đã thử" khi chưa thật sự chụp.
