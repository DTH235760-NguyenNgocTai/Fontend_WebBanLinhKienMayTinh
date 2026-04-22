# Frontend TKGear

README nay mo ta cach frontend dang hoat dong, cac API dang goi, va nhung diem backend can biet de lam viec cung frontend hien tai.

## Muc tieu

- Frontend da bo fake data va mock JSON, chi con goi API that.
- Ten field duoc giu gan voi CSDL hien tai: `san_pham`, `danh_muc`, `thuong_hieu`, `gio_hang`, `chi_tiet_gio_hang`, `don_hang`, `chi_tiet_don_hang`, `thanh_toan`, `tai_khoan`, `vai_tro`, `dia_chi_giao_hang`.
- Cac trang user va admin deu di qua `js/api.js` de dung chung `BASE_URL`, token va normalize response.

## Cau truc chinh

- `index.html`, `login.html`, `register.html`: entry pages.
- `pages/`: cac trang user.
- `pages/admin/`: cac trang admin.
- `js/api.js`: wrapper cho tat ca API.
- `js/auth.js`: dang nhap, dang ky, logout, luu token, doc tai khoan hien tai.
- `js/helpers.js`: format, layout, render status, image fallback, utility dung chung.
- `js/product-preview.js`: popup xem nhanh san pham.
- `js/ckeditor.js`: khoi tao CKEditor cho mo ta san pham.
- `js/rich-text.js`: sanitize HTML rich text truoc khi render/gui len backend.

## Cau hinh backend

Frontend doc API URL tu:

- `js/api.js`
- bien `BASE_URL`

Neu backend doi host, port hoac prefix route thi chi can sua:

- `BASE_URL`
- `API_PATHS`

## Kieu response frontend chap nhan

Frontend da normalize mot so wrapper response pho bien:

- `du_lieu`
- `data`
- `items`
- `danh_sach`
- mang thuong

Neu backend tra 1 trong cac kieu tren thi frontend van doc duoc. Doi voi record don le, frontend uu tien:

- `ban_ghi`
- `item`
- object thuong

## Cac luong user

### 1. Trang chu

- Lay danh sach san pham bang `sanPhamApi.listAll({ sort: "moi_nhat" })`.
- Click 1 lan vao card san pham mo popup xem nhanh.
- Double click vao card hoac bam `Xem chi tiet` moi vao trang chi tiet.

### 2. Danh sach san pham

- Frontend gui cac filter chinh:
  - `keyword`
  - `danh_muc_id`
  - `thuong_hieu_id`
  - `sort`
- Frontend tu filter them `trang_thai` local neu backend chua ho tro.
- Frontend dang dung `listAll()` roi phan trang local tren giao dien.

### 3. Chi tiet san pham

- Frontend uu tien goi:
  - `GET /san-pham/:id`
- Sau do doi chieu lai voi danh sach `listAll()` de tranh hien sai chi tiet.
- `mo_ta_ngan` va `mo_ta_chi_tiet` duoc render dang HTML da sanitize.

### 4. Gio hang

- Frontend tu tim gio hang hien tai theo `tai_khoan_id` neu endpoint gio hang tra ca danh sach.
- Chi tiet gio hang duoc lay tu `chi_tiet_gio_hang` va loc local theo `gio_hang_id` neu can.

### 5. Thanh toan

- Frontend dang dung:
  - `donHangApi.checkout(payload)`
- Nghia la frontend khong tu tao:
  - `don_hang`
  - `chi_tiet_don_hang`
  - `thanh_toan`
  - xoa gio hang
- Toan bo xu ly checkout duoc day sang backend.

Payload checkout frontend hien gui:

```json
{
  "tai_khoan_id": 1,
  "nguoi_nhan": "Nguyen Van A",
  "so_dien_thoai": "0900000000",
  "dia_chi": "Dia chi nhan hang",
  "phuong_thuc_thanh_toan": "cod",
  "ghi_chu": "..."
}
```

### 6. Don hang va tai khoan

- Don hang cua user duoc doc qua `donHangApi.listByCustomer(tai_khoan_id)`.
- Chi tiet don hang duoc doc qua `chiTietDonHangApi.listByOrder(don_hang_id)`.
- Thanh toan cua don hang duoc doc qua `thanhToanApi.listByOrder(don_hang_id)`.
- Dia chi giao hang cua user duoc doc qua `diaChiGiaoHangApi.listByCustomer(tai_khoan_id)`.

## Cac luong admin

### 1. Dashboard

- Tong hop san pham, don hang, danh muc, thuong hieu, tai khoan.
- Danh sach san pham dang dung `sanPhamApi.listAll()`.

### 2. Don hang

- Admin doc chi tiet don hang qua `listByOrder()`.
- Admin doc thanh toan theo don hang qua `listByOrder()`.

### 3. Tai khoan

- Man hinh admin tai khoan hien chi cho cap nhat `trang_thai`.
- Frontend khong con gia update `vai_tro_id` vi backend hien tai khong ho tro luu role tu man nay.

### 4. Thuong hieu

- Frontend dang bat buoc `logo` o man hinh admin thuong hieu vi backend hien tai yeu cau field nay.
- Admin co the:
  - nhap truc tiep URL/logo string vao field `logo`
  - hoac chon file logo, frontend se doc file thanh chuoi `data:image/...` roi gui van qua field `logo`

### 5. San pham

Day la man hinh co nhieu thay doi nhat.

#### a. Upload anh san pham

- Frontend gui file that len backend bang `multipart/form-data`.
- Endpoint dang dung:
  - `POST /hinh-anh-san-pham`
  - `POST /hinh-anh-san-pham/:id` kem `_method=PUT` khi cap nhat anh chinh
- Ten field file frontend dang gui:
  - `image`

Neu backend doi ten field file thi sua:

- `PRODUCT_IMAGE_FILE_FIELD` trong `js/admin/san-pham.js`

FormData frontend dang gui gom:

```text
san_pham_id
la_anh_chinh=1
thu_tu=1
image=<file>
duong_dan_cu=<optional, khi da co anh cu>
_method=PUT <optional, khi update anh cu>
```

#### b. Gia nhap

- Frontend da them `gia_nhap` vao form admin san pham.
- Khi sua san pham, neu backend chua tra `gia_nhap`, frontend tam fallback bang `gia_ban`.

#### c. Mo ta ngan + mo ta chi tiet

- Hai field nay duoc luu duoi dang HTML.
- Frontend admin dung `CKEditor 5` trong popup modal de nhap noi dung cho de nhin.
- O form admin, frontend chi hien preview ngan. Khi bam vao preview se mo popup CKEditor.
- O trang user, frontend render HTML da sanitize.
- O trang chu, frontend chi lay text thuan tu `mo_ta_ngan` de tranh lo tag HTML trong hero.

Backend can hieu:

- `mo_ta_ngan`: HTML duoc phep
- `mo_ta_chi_tiet`: HTML duoc phep

Frontend se sanitize truoc khi:

- gui len backend
- render ra giao dien

## Cac wrapper API dang bo sung logic local

Do backend hien tai co mot so endpoint tra ca danh sach ma chua filter dung theo query, frontend dang bo sung cac wrapper sau:

- `sanPhamApi.listAll(params)`
- `diaChiGiaoHangApi.listByCustomer(tai_khoan_id)`
- `donHangApi.listByCustomer(tai_khoan_id)`
- `chiTietDonHangApi.listByOrder(don_hang_id)`
- `thanhToanApi.listByOrder(don_hang_id)`
- `gioHangApi.ensureCurrent(payload)`
- `gioHangApi.getDetails(params)`

Neu backend ve sau da filter va paginate dung theo query, cac wrapper nay co the don gian hoa.

## Contract backend nen co de frontend chay dep hon

Frontend hien da co workaround, nhung ve lau dai backend nen ho tro:

- `GET /san-pham`
  - nhan `keyword`, `danh_muc_id`, `thuong_hieu_id`, `sort`, `limit`
- `GET /gio-hang`
  - co the filter theo `tai_khoan_id`
- `GET /chi-tiet-gio-hang`
  - co the filter theo `gio_hang_id`
- `GET /dia-chi-giao-hang`
  - co the filter theo `tai_khoan_id`
- `GET /don-hang`
  - co the filter theo `tai_khoan_id`
- `GET /chi-tiet-don-hang`
  - co the filter theo `don_hang_id`
- `GET /thanh-toan`
  - co the filter theo `don_hang_id`
- `POST /don-hang/checkout`
  - backend xu ly tao don, chi tiet don, thanh toan, va dong bo gio hang neu can

## File backend can xem de noi contract voi frontend

- `js/api.js`
- `js/thanh-toan.js`
- `js/admin/san-pham.js`
- `js/chi-tiet-san-pham.js`
- `js/product-preview.js`
- `js/ckeditor.js`
- `js/rich-text.js`

## Luu y khi deploy

- `js/ckeditor.js` dang dung development license key cua CKEditor, phu hop local/dev.
- Khi dua len production, can doi sang production key.
- Neu backend khong cho upload file voi field `image` thi frontend se luu duoc san pham nhung upload anh se bao warning.

## Tom tat cho backend

Neu backend chi can doc nhanh mot vai dong:

1. Frontend da goi API that, khong con fake data.
2. Frontend dang bo sung mot so filter local do backend chua filter dung o mot vai endpoint.
3. Checkout da day sang backend qua `POST /don-hang/checkout`.
4. Admin san pham gui anh that len API bang `multipart/form-data`, field file la `image`.
5. `mo_ta_ngan` va `mo_ta_chi_tiet` duoc frontend luu va hien thi dang HTML da sanitize.
