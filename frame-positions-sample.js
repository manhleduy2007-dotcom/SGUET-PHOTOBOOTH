// Sample Frame Positions Configuration
// Copy nội dung này vào app.js sau khi chạy detector.html

// Ví dụ cấu hình cho Frame_1.png và Frame2.png
const SAMPLE_FRAME_POSITIONS = {
    "Frame_1.png": {
        "photoSize": {
            "width": 789,
            "height": 584
        },
        "positions": [
            {
                "x": 46,
                "y": 667,
                "centerX": false
            },
            {
                "x": 46,
                "y": 1279,
                "centerX": false
            },
            {
                "x": 46,
                "y": 1892,
                "centerX": false
            }
        ]
    },
    "Frame2.png": {
        "photoSize": {
            "width": 780,
            "height": 562
        },
        "positions": [
            {
                "x": 48,
                "y": 681,
                "centerX": false
            },
            {
                "x": 48,
                "y": 1291,
                "centerX": false
            },
            {
                "x": 52,
                "y": 1900,
                "centerX": false
            }
        ]
    },
    "Frame3.png": {
        "photoSize": {
            "width": 789,
            "height": 489
        },
        "positions": [
            {
                "x": 46,
                "y": 715,
                "centerX": false
            },
            {
                "x": 47,
                "y": 1327,
                "centerX": false
            },
            {
                "x": 46,
                "y": 1940,
                "centerX": false
            }
        ]
    }
};

// Hướng dẫn:
// 1. Chạy detector.html để tự động phát hiện vị trí
// 2. Copy JSON được generate
// 3. Paste vào app.js thay thế FRAME_POSITIONS
// 4. Đảm bảo key của object khớp với path trong loadFrames()
//    Ví dụ: Nếu trong loadFrames() là 'Frames/Frame_1.png'
//            thì trong FRAME_POSITIONS phải là 'Frames/Frame_1.png'
