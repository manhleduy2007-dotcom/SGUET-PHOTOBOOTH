# SGUET Photobooth - Web Chụp Ảnh Kỷ Yếu

Web photobooth chụp tự động 3 ảnh và ghép vào khung ảnh, có mã QR để tải về điện thoại.

## ✨ Tính năng

- ✅ Chụp tự động 3 ảnh liên tiếp
- ⏱️ Tùy chỉnh thời gian đếm ngược (3s, 5s, 10s, 15s, hoặc tùy chỉnh)
- 🎨 Bộ lọc ảnh (Gốc, Đen trắng, Sepia, Ấm áp)
- 🖼️ Chọn khung ảnh từ folder Frames
- 📱 Mã QR để quét và tải ảnh về điện thoại
- 💾 Tải ảnh về máy tính
- 🔄 Chụp lại nếu không hài lòng
- 🌐 Chạy offline hoàn toàn

## 📁 Cấu trúc thư mục

```
Photobooth - SGUET/
├── index.html          # Trang web chính
├── style.css          # File CSS
├── app.js             # Logic chính
├── detector.html      # Tool phát hiện vị trí ảnh trong frame
├── README.md          # File hướng dẫn này
└── Frames/            # Thư mục chứa các khung ảnh
    ├── Frame_1.png
    ├── Frame2.png
    └── ...
```

## 🚀 Cách sử dụng

### 1. Chạy Web Photobooth

1. Mở file `index.html` bằng trình duyệt web (Chrome, Edge, Firefox, ...)
2. Nhấn **"Bật Camera"** để bật camera
3. Chọn thời gian đếm ngược mong muốn (mặc định 3s)
4. Chọn bộ lọc (nếu muốn)
5. Nhấn **"Bắt Đầu Chụp"**
6. Web sẽ tự động chụp 3 ảnh liên tiếp
7. Sau khi chụp xong, chọn khung ảnh
8. Quét mã QR để tải ảnh về điện thoại hoặc tải trực tiếp về máy tính

### 2. Chuẩn bị Frame mới

#### Yêu cầu frame:
- Frame phải có **vùng trong suốt (transparent)** để chèn ảnh
- Frame nên có **đúng 3 vùng trong suốt** cho 3 ảnh
- Các vùng ảnh nên có **kích thước giống nhau**
- Format: PNG với alpha channel
- Đặt tên dễ phân biệt (vd: `Frame_KyYeu_2024.png`)

#### Bước 1: Thêm frame vào folder
1. Đặt file frame (PNG) vào folder `Frames/`
2. Đặt tên rõ ràng, ví dụ: `Frame_KyYeu_2024.png`

#### Bước 2: Phát hiện vị trí ảnh trong frame
1. Mở file `detector.html` bằng trình duyệt
2. Nhấn **"Chọn tệp"** và chọn frame vừa thêm
3. Chọn chế độ:
   - **Normal Detection**: Nhanh, phù hợp với frame rõ ràng
   - **Precise Detection**: Chậm hơn nhưng chính xác hơn, mở rộng vùng ±10px
4. Nhấn **"Process Frames"**
5. Tool sẽ tự động:
   - Tìm 3 vùng trong suốt
   - Vẽ khung đỏ để xem trước
   - Hiển thị kích thước ảnh
   - Generate JSON config
6. Nhấn **"Copy JSON"** để copy cấu hình

#### Bước 3: Update cấu hình vào app.js
1. Mở file `app.js`
2. Tìm phần `FRAME_POSITIONS = {...}`
3. Paste JSON vừa copy vào, thay thế nội dung cũ
4. Thêm thông tin frame vào hàm `loadFrames()`:

```javascript
function loadFrames() {
    const frames = [
        { name: 'Frame 1', path: 'Frames/Frame_1.png' },
        { name: 'Frame 2', path: 'Frames/Frame2.png' },
        { name: 'Frame Kỷ Yếu 2024', path: 'Frames/Frame_KyYeu_2024.png' }, // Thêm dòng này
    ];
    // ... rest of the code
}
```

5. Lưu file và reload trang web

## 🎯 Ví dụ JSON Config

Sau khi chạy detector, bạn sẽ nhận được JSON như sau:

```json
{
  "Frame_KyYeu_2024.png": {
    "photoSize": {
      "width": 400,
      "height": 300
    },
    "positions": [
      {
        "x": 50,
        "y": 100,
        "centerX": false
      },
      {
        "x": 50,
        "y": 450,
        "centerX": false
      },
      {
        "x": 50,
        "y": 800,
        "centerX": false
      }
    ]
  }
}
```

**Giải thích:**
- `photoSize`: Kích thước mỗi ảnh (width x height)
- `positions`: Mảng 3 vị trí (từ trên xuống dưới)
  - `x`, `y`: Tọa độ góc trên bên trái
  - `centerX`: true = căn giữa theo chiều ngang, false = dùng x cố định

## 📱 Cách tải ảnh về điện thoại

1. Sau khi chọn frame, mã QR sẽ hiện lên
2. Mở camera điện thoại và quét mã QR
3. Trình duyệt sẽ mở trang hiển thị ảnh
4. Nhấn nút **"Tải về"** trên điện thoại

## 🔧 Troubleshooting

### Camera không bật được
- Kiểm tra quyền truy cập camera trong trình duyệt
- Đảm bảo không có ứng dụng nào khác đang dùng camera
- Thử trình duyệt khác (Chrome khuyến nghị)

### Frame không hiển thị đúng vị trí
- Chạy lại detector.html với chế độ **Precise Detection**
- Kiểm tra frame có đúng 3 vùng trong suốt
- Đảm bảo vùng trong suốt đủ lớn (>100x100 px)

### QR Code không hoạt động
- Đảm bảo điện thoại và máy tính cùng mạng WiFi (nếu chạy local server)
- Thử tải trực tiếp về máy tính trước

## 📝 Notes

- Web chạy hoàn toàn offline, không cần internet
- Ảnh được lưu trong sessionStorage (tạm thời)
- Khuyến nghị dùng trình duyệt Chrome để có trải nghiệm tốt nhất
- Frame nên có kích thước phù hợp (không quá lớn để tránh lag)

## 🎨 Tùy chỉnh thêm

### Thêm bộ lọc mới
Mở `app.js`, tìm phần `FILTERS` và thêm:

```javascript
const FILTERS = {
    none: '',
    grayscale: 'grayscale(100%)',
    sepia: 'sepia(100%)',
    warm: 'sepia(30%) saturate(1.4) brightness(1.1)',
    cool: 'hue-rotate(180deg) saturate(1.2)', // Thêm bộ lọc mới
};
```

Sau đó thêm nút trong HTML.

### Thay đổi số lượng ảnh
Hiện tại web được thiết kế cố định cho 3 ảnh. Để thay đổi, bạn cần:
1. Sửa HTML (thêm/bớt photo slots)
2. Sửa `STATE.photos` trong app.js
3. Sửa logic trong `startAutoCapture()`
4. Chuẩn bị frame phù hợp với số ảnh mới

---

**Chúc bạn có những bức ảnh kỷ yếu đẹp! 📸✨**
