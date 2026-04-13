# Frontend Linh Kiện

Project đã được tổ chức lại theo cấu trúc tách biệt `HTML / CSS / JS`, loại bỏ toàn bộ fake JSON và luồng dữ liệu hardcode để chuyển sang gọi API thật bằng `fetch`.

## Thay backend

1. Mở `js/api.js`.
2. Sửa `BASE_URL` thành địa chỉ backend thật của bạn.
3. Nếu backend dùng route khác với placeholder hiện tại, chỉ cần cập nhật `API_PATHS` trong cùng file.

## Nguyên tắc dữ liệu

- Frontend giữ nguyên tên field theo CSDL: `san_pham`, `danh_muc`, `thuong_hieu`, `gio_hang`, `chi_tiet_gio_hang`, `don_hang`, `chi_tiet_don_hang`, `thanh_toan`, `tai_khoan`, `vai_tro`, `dia_chi_giao_hang`.
- Không còn `data.js`, fake DB localStorage hay mock JSON để render sản phẩm/đơn hàng/tài khoản.
- Các trang đều đi qua `api.js` để dùng chung `BASE_URL`, headers và token Authorization.

## File chính

- `js/api.js`: fetch wrapper, `BASE_URL`, CRUD helpers, API paths.
- `js/auth.js`: đăng nhập, đăng ký, logout, lưu token, đọc tài khoản hiện tại, kiểm tra vai trò.
- `js/helpers.js`: format tiền/ngày, query string, render status, debounce, layout chung, xử lý ảnh lỗi.
- `js/*.js` và `js/admin/*.js`: logic riêng cho từng trang user/admin.

## Lưu ý khi nối backend

- Một số route hiện đang để theo placeholder gần với tên bảng, ví dụ `/san-pham`, `/don-hang`, `/tai-khoan`.
- Nếu backend trả dữ liệu theo wrapper như `data`, `du_lieu`, `items` hoặc `danh_sach`, frontend hiện đã có normalize cơ bản để nhận nhiều kiểu phổ biến.
- Riêng các chỗ backend có thể cần contract riêng hơn CSDL thuần, phần tập trung để chỉnh là `API_PATHS` trong `js/api.js` và khối tạo payload trong từng page JS.
