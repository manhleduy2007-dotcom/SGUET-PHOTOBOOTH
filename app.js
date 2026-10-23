// ===== STATE & CONFIG =====
const STATE = {
    stream: null,
    photos: [null, null, null],
    beautyMode: true,
    countdownTime: 3,
    isCapturing: false,
    isFlipped: true,
    selectedFrame: null,
    finalImage: null,
    selectedDeviceId: null
};



let FRAME_POSITIONS = {
    "./Frames/Frame_1_final.png": {
        "photoSize": {
            "width": 780,
            "height": 575
        },
        "positions": [
            {
                "x": 48,
                "y": 668,
                "centerX": false
            },
            {
                "x": 48,
                "y": 1281,
                "centerX": false
            },
            {
                "x": 52,
                "y": 1900,
                "centerX": false
            }
        ]
    },
    "./Frames/Frame_2_final.png": {
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
    }
};

// ===== DOM ELEMENTS =====
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const countdown = document.getElementById('countdown');
const countdownNumber = document.getElementById('countdownNumber');

const startBtn = document.getElementById('startBtn');
const captureBtn = document.getElementById('captureBtn');
const singleCaptureBtn = document.getElementById('singleCaptureBtn');
const resetBtn = document.getElementById('resetBtn');
const selectFrameBtn = document.getElementById('selectFrameBtn');
const flipBtn = document.getElementById('flipBtn');

const photoCount = document.getElementById('photoCount');
const timerDisplay = document.getElementById('timerDisplay');

const frameModal = document.getElementById('frameModal');
const frameGrid = document.getElementById('frameGrid');

const swapModal = document.getElementById('swapModal');
const swapOptions = document.getElementById('swapOptions');
let swapFromIndex = null;

const qrModal = document.getElementById('qrModal');
const closeQrModal = document.getElementById('closeQrModal');
const downloadDirectBtn = document.getElementById('downloadDirectBtn');
const newPhotoBtn = document.getElementById('newPhotoBtn');

// ===== PWA SERVICE WORKER =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker đã được đăng ký:', registration.scope);
            })
            .catch(error => {
                console.log('Lỗi khi đăng ký Service Worker:', error);
            });
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    initTimerButtons();
    initBeautyToggle();
    initEventListeners();
    initPhotoSlotButtons();
    initUploadButtons();
    loadFramePositions();
    loadFrames();
    updatePhotoCount();
    initCameraSelector();
});

// ===== TIMER BUTTONS =====
function initTimerButtons() {
    const timerButtons = document.querySelectorAll('.timer-btn:not(.timer-btn-custom)');
    const customTimerBtn = document.getElementById('customTimerBtn');
    const customTimerInput = document.getElementById('customTimerInput');

    timerButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            timerButtons.forEach(b => b.classList.remove('active'));
            customTimerBtn.classList.remove('active');
            btn.classList.add('active');
            STATE.countdownTime = parseInt(btn.dataset.timer);
            timerDisplay.textContent = STATE.countdownTime === 0 ? 'Không' : `${STATE.countdownTime}s`;
            customTimerInput.classList.add('hidden');
        });
    });

    // Custom timer button toggle
    customTimerBtn.addEventListener('click', () => {
        customTimerInput.classList.toggle('hidden');
        if (!customTimerInput.classList.contains('hidden')) {
            document.getElementById('customTimer').focus();
        }
    });

    document.getElementById('applyCustomTimer').addEventListener('click', () => {
        const customValue = parseInt(document.getElementById('customTimer').value);
        if (customValue && customValue >= 0 && customValue <= 60) {
            STATE.countdownTime = customValue;
            timerDisplay.textContent = customValue === 0 ? 'Không' : `${customValue}s`;
            timerButtons.forEach(b => b.classList.remove('active'));
            customTimerBtn.classList.add('active');
            customTimerInput.classList.add('hidden');
        } else {
            alert('Vui lòng nhập số từ 0 đến 60!');
        }
    });
}

// ===== BEAUTY FILTER TOGGLE =====
function initBeautyToggle() {
    const beautyOnBtn = document.getElementById('beautyOnBtn');
    const beautyOffBtn = document.getElementById('beautyOffBtn');

    if (!beautyOnBtn || !beautyOffBtn) return;

    beautyOnBtn.addEventListener('click', () => {
        STATE.beautyMode = true;
        beautyOnBtn.classList.add('active');
        beautyOffBtn.classList.remove('active');
        applyVideoFilter(); // Apply filter to live video
    });

    beautyOffBtn.addEventListener('click', () => {
        STATE.beautyMode = false;
        beautyOffBtn.classList.add('active');
        beautyOnBtn.classList.remove('active');
        applyVideoFilter(); // Remove filter from live video
    });
}

// Apply beauty filter to live video preview
function applyVideoFilter() {
    if (!video) return;

    if (STATE.beautyMode) {
        // Apply CSS filters for real-time beauty effect (subtle glow)
        video.style.filter = 'brightness(1.08) contrast(0.97) saturate(1.08)';
    } else {
        video.style.filter = '';
    }
}

// ===== BEAUTY FILTER (SKIN DETECTION & SMOOTHING) =====
function applyBeautyFilter(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Create skin mask
    const skinMask = new Uint8Array(width * height);

    // Detect skin pixels
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const idx = i / 4;

        // Skin detection algorithm (improved)
        const isSkin = (
            r > 95 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 15 &&
            (r - g) > 15 &&
            (r - b) > 15 &&
            r < 250 // Avoid white
        );

        skinMask[idx] = isSkin ? 1 : 0;
    }

    // Apply gentle selective blur only to skin (radius 1 for subtle effect)
    const blurredData = selectiveBlur(imageData, skinMask, width, height, 1);

    // Blend and enhance
    for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;

        if (skinMask[idx]) {
            // Gentle blend (50% for subtle smoothing without losing detail)
            data[i] = data[i] * 0.5 + blurredData[i] * 0.5;
            data[i + 1] = data[i + 1] * 0.5 + blurredData[i + 1] * 0.5;
            data[i + 2] = data[i + 2] * 0.5 + blurredData[i + 2] * 0.5;

            // Brighten skin more for glowing effect
            data[i] = Math.min(255, data[i] * 1.10);
            data[i + 1] = Math.min(255, data[i + 1] * 1.08);
            data[i + 2] = Math.min(255, data[i + 2] * 1.06);

            // Add peachy tone for healthy glow
            data[i] = Math.min(255, data[i] + 5);
            data[i + 1] = Math.min(255, data[i + 1] + 3);
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

// Selective blur only on masked areas
function selectiveBlur(imageData, mask, width, height, radius) {
    const data = imageData.data;
    const output = new Uint8ClampedArray(data.length);
    output.set(data); // Copy original

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;

            // Only blur masked pixels (skin)
            if (mask[idx]) {
                let r = 0, g = 0, b = 0, count = 0;

                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nidx = (ny * width + nx) * 4;
                            r += data[nidx];
                            g += data[nidx + 1];
                            b += data[nidx + 2];
                            count++;
                        }
                    }
                }

                const pixelIdx = idx * 4;
                output[pixelIdx] = r / count;
                output[pixelIdx + 1] = g / count;
                output[pixelIdx + 2] = b / count;
            }
        }
    }

    return output;
}



// ===== EVENT LISTENERS =====
function initEventListeners() {
    startBtn.addEventListener('click', async () => {
        const selectedDeviceId = document.getElementById('cameraSelect')?.value;
        if (selectedDeviceId) {
            await startCamera(selectedDeviceId);
        } else {
            await startCamera();
        }
    });
    captureBtn.addEventListener('click', startAutoCapture);
    singleCaptureBtn.addEventListener('click', captureSinglePhoto);
    resetBtn.addEventListener('click', resetPhotos);
    selectFrameBtn.addEventListener('click', openFrameModal);

    // Frame modal buttons
    const closeFrameBtn = document.getElementById('closeFrameModal');
    const confirmFrameBtn = document.getElementById('confirmFrameBtn');
    if (closeFrameBtn) closeFrameBtn.addEventListener('click', closeFrameModal);
    if (confirmFrameBtn) confirmFrameBtn.addEventListener('click', selectFrame);

    // Swap modal buttons
    const closeSwapBtn = document.getElementById('closeSwapModal');
    if (closeSwapBtn) closeSwapBtn.addEventListener('click', closeSwapModal);

    // QR modal buttons
    closeQrModal.addEventListener('click', closeQRModal);
    downloadDirectBtn.addEventListener('click', downloadImage);

    // Other buttons
    flipBtn.addEventListener('click', toggleFlip);
    newPhotoBtn.addEventListener('click', () => {
        closeQRModal();
        resetPhotos();
    });
}

// ===== CAMERA =====
async function startCamera(deviceId = null) {
    try {
        // Stop existing stream first
        stopCamera();

        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 960 },
                frameRate: { ideal: 30, max: 30 }
            }
        };

        // If deviceId is provided, use exact device
        if (deviceId) {
            constraints.video.deviceId = { exact: deviceId };
        } else {
            // Default to user-facing camera
            constraints.video.facingMode = 'user';
        }

        STATE.stream = await navigator.mediaDevices.getUserMedia(constraints);

        video.srcObject = STATE.stream;

        // Apply flip by default
        video.classList.add('flipped');

        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                video.play();
                resolve();
            };
        });

        // Apply beauty filter if enabled
        applyVideoFilter();

        startBtn.classList.add('hidden');
        captureBtn.classList.remove('hidden');
        flipBtn.classList.remove('hidden');

        return true;

    } catch (error) {
        console.error('Camera error:', error);
        let errorMsg = 'Không thể truy cập camera!\n\n';

        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMsg += '❌ Bạn đã từ chối quyền truy cập camera.\n\n';
            errorMsg += '✅ Giải pháp:\n';
            errorMsg += '1. Nhấn vào icon 🔒 (hoặc ⓘ) bên trái thanh địa chỉ\n';
            errorMsg += '2. Chọn "Cho phép" Camera\n';
            errorMsg += '3. Refresh lại trang (F5)';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMsg += '❌ Không tìm thấy camera.\n\n';
            errorMsg += '✅ Kiểm tra:\n';
            errorMsg += '1. Camera có được kết nối?\n';
            errorMsg += '2. Camera có đang được dùng bởi app khác không?';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMsg += '❌ Camera đang được sử dụng bởi ứng dụng khác.\n\n';
            errorMsg += '✅ Giải pháp:\n';
            errorMsg += '1. Đóng các ứng dụng khác đang dùng camera\n';
            errorMsg += '2. Thử lại';
        } else {
            errorMsg += '❌ Lỗi: ' + error.message;
        }

        alert(errorMsg);
        return false;
    }
}

function stopCamera() {
    if (STATE.stream) {
        STATE.stream.getTracks().forEach(track => track.stop());
        STATE.stream = null;
    }
}

function toggleFlip() {
    STATE.isFlipped = !STATE.isFlipped;
    video.classList.toggle('flipped', STATE.isFlipped);
}

// ===== AUTO CAPTURE =====
async function startAutoCapture() {
    if (STATE.isCapturing) return;

    STATE.isCapturing = true;
    captureBtn.disabled = true;

    // Chụp 3 ảnh tự động
    for (let i = 0; i < 3; i++) {
        // Countdown
        await doCountdown();

        // Capture
        await capturePhoto(i);

        // Wait before next photo (except last one)
        if (i < 2) {
            await sleep(1000);
        }
    }

    STATE.isCapturing = false;
    captureBtn.classList.add('hidden');
    resetBtn.classList.remove('hidden');
    selectFrameBtn.classList.remove('hidden');

    updatePhotoCount();
    updateButtons();

    // Tự động mở modal chọn frame
    setTimeout(() => openFrameModal(), 500);
}

async function doCountdown() {
    if (STATE.countdownTime === 0) return;

    countdown.classList.remove('hidden');

    for (let i = STATE.countdownTime; i > 0; i--) {
        countdownNumber.textContent = i;
        countdownNumber.style.animation = 'none';
        setTimeout(() => countdownNumber.style.animation = 'pulse 0.5s ease-in-out', 10);
        await sleep(1000);
    }

    countdown.classList.add('hidden');
}

async function capturePhoto(index) {
    // Draw video to canvas
    ctx.save();

    // Mirror image nếu FLIP (vì video đã flip rồi)
    // Nếu không flip thì vẽ bình thường
    if (STATE.isFlipped) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Apply beauty filter if enabled
    if (STATE.beautyMode) {
        applyBeautyFilter(ctx, canvas.width, canvas.height);
    }

    // Save photo
    STATE.photos[index] = canvas.toDataURL('image/png');

    // Update UI
    const slot = document.querySelector(`.photo-slot[data-index="${index}"]`);
    const img = document.createElement('img');
    img.src = STATE.photos[index];
    slot.innerHTML = '';
    slot.appendChild(img);
    slot.classList.add('filled');

    // Re-add upload, delete and swap buttons
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'upload-photo-btn';
    uploadBtn.dataset.index = index;
    uploadBtn.innerHTML = '<i class="fas fa-upload"></i>';
    uploadBtn.title = 'Tải ảnh lên';
    slot.appendChild(uploadBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-photo-btn';
    deleteBtn.dataset.index = index;
    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
    deleteBtn.addEventListener('click', () => deletePhoto(index));
    slot.appendChild(deleteBtn);

    const swapBtn = document.createElement('button');
    swapBtn.className = 'swap-photo-btn';
    swapBtn.dataset.index = index;
    swapBtn.innerHTML = '<i class="fas fa-arrows-rotate"></i>';
    swapBtn.addEventListener('click', () => openSwapModal(index));
    slot.appendChild(swapBtn);

    const uploadInput = document.createElement('input');
    uploadInput.type = 'file';
    uploadInput.className = 'photo-upload-input';
    uploadInput.dataset.index = index;
    uploadInput.accept = 'image/*';
    uploadInput.style.display = 'none';
    slot.appendChild(uploadInput);

    // Attach upload events
    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', (e) => handlePhotoUpload(e, index));

    updatePhotoCount();
    updateButtons();
}

// ===== RESET =====
function resetPhotos() {
    STATE.photos = [null, null, null, null];
    STATE.selectedFrame = null;
    STATE.finalImage = null;

    document.querySelectorAll('.photo-slot').forEach((slot, index) => {
        slot.classList.remove('filled');
        slot.innerHTML = `
            <i class="fas fa-image"></i>
            <span>Ảnh ${index + 1}</span>
            <button class="upload-photo-btn" data-index="${index}" title="Tải ảnh lên">
                <i class="fas fa-upload"></i>
            </button>
            <button class="delete-photo-btn hidden" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
            <button class="swap-photo-btn hidden" data-index="${index}">
                <i class="fas fa-arrows-rotate"></i>
            </button>
            <input type="file" class="photo-upload-input" data-index="${index}" accept="image/*" style="display: none;">
        `;
    });

    // Re-attach event listeners
    initPhotoSlotButtons();
    initUploadButtons();

    updatePhotoCount();
    updateButtons();

    captureBtn.classList.remove('hidden');
    captureBtn.disabled = false;
    singleCaptureBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
    selectFrameBtn.classList.add('hidden');
}

function updatePhotoCount() {
    const count = STATE.photos.filter(p => p !== null).length;
    photoCount.textContent = `${count}/3`;
}

// ===== FRAMES =====
function loadFramePositions() {
    console.log('Loaded frame positions:', Object.keys(FRAME_POSITIONS));
}

let currentPreviewFrame = null;

function loadFrames() {
    const frames = [
        { name: 'Frame 1', path: './Frames/Frame_1_final.png' },
        { name: 'Frame 2', path: './Frames/Frame_2_final.png' }
    ];

    frameGrid.innerHTML = '';

    frames.forEach(frame => {
        const item = document.createElement('div');
        item.className = 'frame-item';
        item.innerHTML = `
            <img src="${frame.path}" alt="${frame.name}">
            <p>${frame.name}</p>
        `;
        item.addEventListener('click', () => {
            // Update selection UI
            document.querySelectorAll('.frame-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            currentPreviewFrame = frame.path;

            // Generate preview
            generateFramePreview(frame.path);
        });
        frameGrid.appendChild(item);
    });
}

async function generateFramePreview(framePath) {
    const previewContainer = document.getElementById('framePreview');

    // Show loading
    previewContainer.innerHTML = '<p style="color: #666;">⏳ Đang tạo preview...</p>';

    try {
        const previewDataUrl = await createFramedImage(framePath);

        const img = document.createElement('img');
        img.src = previewDataUrl;
        previewContainer.innerHTML = '';
        previewContainer.appendChild(img);
    } catch (error) {
        console.error('Preview error:', error);
        previewContainer.innerHTML = '<p style="color: red;">❌ Lỗi: ' + error.message + '</p>';
    }
}

async function createFramedImage(framePath) {
    const config = FRAME_POSITIONS[framePath];
    if (!config) {
        throw new Error('Frame chưa có cấu hình vị trí! Path: ' + framePath);
    }

    const frameImg = await loadImageSafe(framePath);
    const photosToUse = STATE.photos.filter(p => p !== null).slice(0, 3);
    if (photosToUse.length === 0) {
        throw new Error('Không có ảnh nào!');
    }

    const photoImages = await Promise.all(
        photosToUse.map(photoData => loadImageSafe(photoData))
    );

    const canvas = document.createElement('canvas');
    const maxWidth = 1200;
    const scale = frameImg.width > maxWidth ? maxWidth / frameImg.width : 1;

    canvas.width = frameImg.width * scale;
    canvas.height = frameImg.height * scale;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    photoImages.forEach((photoImg, index) => {
        if (index >= config.positions.length) return;

        const pos = config.positions[index];
        const size = config.photoSize;

        let x = pos.x * scale;
        if (pos.centerX) {
            x = (canvas.width - size.width * scale) / 2;
        }

        const scaleX = (size.width * scale) / photoImg.width;
        const scaleY = (size.height * scale) / photoImg.height;
        const imgScale = Math.max(scaleX, scaleY);

        const scaledWidth = photoImg.width * imgScale;
        const scaledHeight = photoImg.height * imgScale;

        const offsetX = (scaledWidth - size.width * scale) / 2;
        const offsetY = (scaledHeight - size.height * scale) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, pos.y * scale, size.width * scale, size.height * scale);
        ctx.clip();
        ctx.drawImage(photoImg, x - offsetX, pos.y * scale - offsetY, scaledWidth, scaledHeight);
        ctx.restore();
    });

    ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.75);
}

function openFrameModal() {
    frameModal.classList.add('active');

    // Auto-select first frame
    setTimeout(() => {
        const firstFrame = document.querySelector('.frame-item');
        if (firstFrame) {
            firstFrame.click();
        }
    }, 100);
}

function closeFrameModal() {
    frameModal.classList.remove('active');
    currentPreviewFrame = null;
}

async function selectFrame(framePath) {
    // This is now the confirm button handler
    if (!currentPreviewFrame) {
        alert('Vui lòng chọn một khung ảnh!');
        return;
    }

    // Save frame path before closing modal
    const selectedFramePath = currentPreviewFrame;
    STATE.selectedFrame = selectedFramePath;
    closeFrameModal();

    // Show loading
    const loading = document.createElement('div');
    loading.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px 40px; border-radius: 10px; z-index: 9999; font-size: 18px;';
    loading.textContent = '⏳ Đang xử lý...';
    document.body.appendChild(loading);

    try {
        // Create final image with saved path
        const finalImageData = await createFramedImage(selectedFramePath);
        STATE.finalImage = finalImageData;

        document.body.removeChild(loading);

        // Show QR modal
        showQRCode();
    } catch (error) {
        if (document.body.contains(loading)) {
            document.body.removeChild(loading);
        }
        console.error('Frame selection error:', error);
        alert('Lỗi khi xử lý ảnh: ' + error.message);
    }
}

// Helper function to load image safely
function loadImageSafe(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Không thể tải: ' + src));
        img.src = src;
    });
}

// ===== QR CODE =====
async function uploadWithTimeout(url, options, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Upload quá lâu (>10s)');
        }
        throw error;
    }
}

async function showQRCode() {
    if (!STATE.finalImage) {
        alert('Không có ảnh để hiển thị!');
        return;
    }

    qrModal.classList.add('active');

    const previewImg = document.getElementById('finalImagePreview');
    if (previewImg) {
        previewImg.src = STATE.finalImage;
    }

    const qrcodeContainer = document.getElementById('qrcode');
    qrcodeContainer.innerHTML = '<p style="color: #667eea; font-weight: 600;"><i class="fas fa-spinner fa-spin"></i> Đang upload ảnh...</p>';

    try {
        const base64Data = STATE.finalImage.split(',')[1];

        const response = await uploadWithTimeout('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Data })
        }, 10000);

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server đang bảo trì hoặc không có kết nối');
        }

        if (!response.ok) {
            throw new Error(`Server lỗi (${response.status})`);
        }

        const data = await response.json();

        if (data.success && data.url) {
            const imageUrl = data.url;
            const previewUrl = `${window.location.origin}/preview.html?img=${encodeURIComponent(imageUrl)}`;

            qrcodeContainer.innerHTML = '';
            setTimeout(() => {
                new QRCode(qrcodeContainer, {
                    text: previewUrl,
                    width: 200,
                    height: 200,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });

                const successMsg = document.createElement('div');
                successMsg.innerHTML = `
                    <p style="color: #4caf50; font-size: 0.9rem; margin-top: 15px; font-weight: 600;">
                        ✅ Quét QR để xem và tải ảnh
                    </p>
                    <p style="color: #2196F3; font-size: 1rem; margin-top: 12px; font-weight: 600;">
                        SGUET cảm ơn bạn đã ghé thăm 💙
                    </p>
                    <p style="color: #666; font-size: 0.8rem; margin-top: 8px;">
                        📱 Theo dõi: facebook.com/SupportGroupUET
                    </p>
                `;
                qrcodeContainer.appendChild(successMsg);
            }, 50);
        } else {
            throw new Error(data.error || 'Upload thất bại');
        }

    } catch (error) {
        console.error('Upload error:', error);

        qrcodeContainer.innerHTML = `
            <div style="text-align: center;">
                <p style="color: #ff9800; font-weight: 600; margin-bottom: 10px;">
                    ⚠️ ${error.message || 'Không thể upload'}
                </p>
                <p style="color: #666; font-size: 0.85rem; margin-bottom: 15px;">
                    Mạng có vẻ chậm. Tải về máy tính nhé!
                </p>
                <button onclick="document.getElementById('downloadDirectBtn').click()" style="padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 1rem;">
                    <i class="fas fa-download"></i> Tải về máy tính
                </button>
                <p style="color: #2196F3; font-size: 1rem; margin-top: 15px; font-weight: 600;">
                    SGUET cảm ơn bạn 💙
                </p>
            </div>
        `;
    }
}

function closeQRModal() {
    qrModal.classList.remove('active');

    // Clear QR code to prevent duplicates on next open
    const qrcodeContainer = document.getElementById('qrcode');
    if (qrcodeContainer) {
        qrcodeContainer.innerHTML = '';
    }
}

function downloadImage() {
    if (!STATE.finalImage) return;

    const link = document.createElement('a');
    link.download = `SGUET-Photobooth-${Date.now()}.png`;
    link.href = STATE.finalImage;
    link.click();
}

// ===== UTILITIES =====
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== CAMERA SELECTOR =====
async function initCameraSelector() {
    const select = document.getElementById('cameraSelect');
    const refreshBtn = document.getElementById('refreshCameraBtn');

    if (!select || !refreshBtn) return;

    // Populate camera list
    await populateCameraList();

    // Event listeners
    select.addEventListener('change', onCameraChange);
    refreshBtn.addEventListener('click', refreshCameraList);
}

async function getCameraDevices() {
    try {
        console.log('🔍 Requesting camera permission...');

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 960 } }
        });

        console.log('✅ Camera permission granted');
        stream.getTracks().forEach(track => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        console.log(`📷 Found ${videoDevices.length} camera(s):`, videoDevices.map(d => d.label));
        return videoDevices;
    } catch (err) {
        console.error('❌ Error getting cameras:', err);
        alert(`Không thể truy cập camera!\n\nLỗi: ${err.message}\n\nVui lòng:\n1. Cho phép truy cập camera\n2. Đóng các app khác đang dùng camera\n3. Reload trang (F5)`);
        return [];
    }
}

const CAMERA_TYPES = {
    phone: ['phone', 'mobile', 'android', 'iphone', 'samsung', 'remote', 'link', 'wireless'],
    virtual: ['vmix', 'obs', 'virtual', 'snap', 'manycam', 'xsplit', 'streamlabs', 'droidcam', 'iriun', 'epoccam', 'ndi', 'software'],
    integrated: ['integrated', 'built-in', 'facetime', 'webcam', 'hd webcam', 'laptop', 'internal']
};

function detectCameraType(label) {
    const lower = label.toLowerCase();
    for (const [type, keywords] of Object.entries(CAMERA_TYPES)) {
        if (keywords.some(keyword => lower.includes(keyword))) return type;
    }
    return 'physical';
}

function getCameraDisplay(camera, index) {
    const name = camera.label || `Camera ${index + 1}`;
    const type = detectCameraType(name);

    const icons = { phone: '📱', virtual: '🎥', integrated: '📹', physical: '📹' };
    const suffix = type === 'virtual' ? ' (Virtual)' : '';

    return {
        text: `${icons[type]} ${name}${suffix}`,
        type,
        isPhone: type === 'phone'
    };
}

async function populateCameraList(autoStart = true) {
    const select = document.getElementById('cameraSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Đang tải...</option>';

    const cameras = await getCameraDevices();
    select.innerHTML = '<option value="">📷 Chọn camera...</option>';

    if (cameras.length === 0) {
        select.innerHTML = '<option value="" disabled>Không tìm thấy camera</option>';
        return;
    }

    // Add camera options
    cameras.forEach((camera, index) => {
        const option = document.createElement('option');
        option.value = camera.deviceId;
        const display = getCameraDisplay(camera, index);
        option.textContent = display.text;
        select.appendChild(option);
    });

    // Auto-select and auto-start default camera
    if (!STATE.selectedDeviceId && cameras.length > 0) {
        const priority = ['integrated', 'physical', 'virtual', 'phone'];
        let defaultCamera = null;

        for (const type of priority) {
            defaultCamera = cameras.find(c => {
                const display = getCameraDisplay(c, 0);
                return display.type === type;
            });
            if (defaultCamera) break;
        }

        defaultCamera = defaultCamera || cameras[0];
        select.value = defaultCamera.deviceId;
        STATE.selectedDeviceId = defaultCamera.deviceId;

        // Auto-start camera by default
        if (autoStart) {
            await startCamera(defaultCamera.deviceId);
        }
    } else if (STATE.selectedDeviceId) {
        select.value = STATE.selectedDeviceId;
    }
}

async function onCameraChange(event) {
    const deviceId = event.target.value;

    if (!deviceId) {
        stopCamera();
        startBtn.classList.remove('hidden');
        captureBtn.classList.add('hidden');
        flipBtn.classList.add('hidden');
        return;
    }

    stopCamera();
    const success = await startCamera(deviceId);
    if (success) STATE.selectedDeviceId = deviceId;
}

async function refreshCameraList() {
    await populateCameraList();
}

// ===== PHOTO MANAGEMENT =====
function initPhotoSlotButtons() {
    // Delete buttons
    document.querySelectorAll('.delete-photo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            deletePhoto(index);
        });
    });

    // Swap buttons
    document.querySelectorAll('.swap-photo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            openSwapModal(index);
        });
    });
}

function deletePhoto(index) {
    if (!STATE.photos[index]) return;

    STATE.photos[index] = null;

    // Update UI
    const slot = document.querySelector(`.photo-slot[data-index="${index}"]`);
    slot.classList.remove('filled');
    slot.innerHTML = `
        <i class="fas fa-image"></i>
        <span>Ảnh ${index + 1}</span>
        <button class="upload-photo-btn" data-index="${index}" title="Tải ảnh lên">
            <i class="fas fa-upload"></i>
        </button>
        <button class="delete-photo-btn hidden" data-index="${index}">
            <i class="fas fa-times"></i>
        </button>
        <button class="swap-photo-btn hidden" data-index="${index}">
            <i class="fas fa-arrows-rotate"></i>
        </button>
        <input type="file" class="photo-upload-input" data-index="${index}" accept="image/*" style="display: none;">
    `;

    // Re-attach event listeners for this slot
    const deleteBtn = slot.querySelector('.delete-photo-btn');
    const swapBtn = slot.querySelector('.swap-photo-btn');
    const uploadBtn = slot.querySelector('.upload-photo-btn');
    const uploadInput = slot.querySelector('.photo-upload-input');

    deleteBtn.addEventListener('click', () => deletePhoto(index));
    swapBtn.addEventListener('click', () => openSwapModal(index));
    uploadBtn.addEventListener('click', () => uploadInput.click());
    uploadInput.addEventListener('change', (e) => handlePhotoUpload(e, index));

    updatePhotoCount();
    updateButtons();
}

function openSwapModal(fromIndex) {
    if (!STATE.photos[fromIndex]) return;

    swapFromIndex = fromIndex;
    swapOptions.innerHTML = '';

    for (let i = 0; i < 3; i++) {
        const btn = document.createElement('button');
        btn.className = 'swap-option-btn';
        btn.textContent = `Ảnh ${i + 1}`;

        if (i === fromIndex) {
            btn.classList.add('disabled');
            btn.textContent += ' (Hiện tại)';
        } else if (!STATE.photos[i]) {
            btn.classList.add('disabled');
            btn.textContent += ' (Trống)';
        } else {
            btn.onclick = () => swapPhotos(fromIndex, i);
        }

        swapOptions.appendChild(btn);
    }

    swapModal.classList.add('active');
}

function closeSwapModal() {
    swapModal.classList.remove('active');
    swapFromIndex = null;
}

function swapPhotos(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;

    const temp = STATE.photos[fromIndex];
    STATE.photos[fromIndex] = STATE.photos[toIndex];
    STATE.photos[toIndex] = temp;

    // Update both slots
    [fromIndex, toIndex].forEach(index => {
        const slot = document.querySelector(`.photo-slot[data-index="${index}"]`);
        if (STATE.photos[index]) {
            const img = document.createElement('img');
            img.src = STATE.photos[index];
            slot.innerHTML = '';
            slot.appendChild(img);
            slot.classList.add('filled');

            // Re-add buttons
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-photo-btn';
            deleteBtn.dataset.index = index;
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.addEventListener('click', () => deletePhoto(index));
            slot.appendChild(deleteBtn);

            const swapBtn = document.createElement('button');
            swapBtn.className = 'swap-photo-btn';
            swapBtn.dataset.index = index;
            swapBtn.innerHTML = '<i class="fas fa-arrows-rotate"></i>';
            swapBtn.addEventListener('click', () => openSwapModal(index));
            slot.appendChild(swapBtn);
        }
    });

    closeSwapModal();
}

async function captureSinglePhoto() {
    const emptyIndex = STATE.photos.findIndex(p => p === null);
    if (emptyIndex === -1) {
        alert('Đã chụp đủ 3 ảnh!');
        return;
    }

    singleCaptureBtn.disabled = true;

    if (STATE.countdownTime > 0) {
        await showCountdown();
    }

    await capturePhoto(emptyIndex);

    singleCaptureBtn.disabled = false;
    updateButtons();
}

function updateButtons() {
    const photosFilled = STATE.photos.filter(p => p !== null).length;
    const hasEmptySlots = photosFilled < 3;

    // Show/hide single capture button if there are empty slots after initial capture
    if (hasEmptySlots && photosFilled > 0) {
        singleCaptureBtn.classList.remove('hidden');
    } else {
        singleCaptureBtn.classList.add('hidden');
    }

    // Show select frame button when all 3 photos are taken
    if (photosFilled === 3) {
        selectFrameBtn.classList.remove('hidden');
        captureBtn.classList.add('hidden');
        singleCaptureBtn.classList.add('hidden');
    } else {
        selectFrameBtn.classList.add('hidden');
    }

    // Show/hide reset button
    if (photosFilled > 0) {
        resetBtn.classList.remove('hidden');
    } else {
        resetBtn.classList.add('hidden');
    }
}

// ===== UPLOAD PHOTO =====
function initUploadButtons() {
    document.querySelectorAll('.upload-photo-btn').forEach(btn => {
        const index = parseInt(btn.dataset.index);
        const input = document.querySelector(`.photo-upload-input[data-index="${index}"]`);

        btn.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => handlePhotoUpload(e, index));
    });
}

async function handlePhotoUpload(event, index) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Vui lòng chọn file ảnh!');
        return;
    }

    try {
        // Read file as data URL
        const reader = new FileReader();

        reader.onload = async (e) => {
            const imageData = e.target.result;

            // Load image to get dimensions
            const img = await loadImageSafe(imageData);

            // Get frame config to determine target size
            const config = STATE.selectedFrame ? FRAME_POSITIONS[STATE.selectedFrame] : null;
            const targetSize = config ? config.photoSize : { width: 789, height: 584 };

            // Create canvas to crop/resize image
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = targetSize.width;
            cropCanvas.height = targetSize.height;
            const cropCtx = cropCanvas.getContext('2d');

            // Calculate scaling to cover (like object-fit: cover)
            const scaleX = targetSize.width / img.width;
            const scaleY = targetSize.height / img.height;
            const scale = Math.max(scaleX, scaleY);

            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;

            // Center crop
            const offsetX = (scaledWidth - targetSize.width) / 2;
            const offsetY = (scaledHeight - targetSize.height) / 2;

            cropCtx.drawImage(img, -offsetX, -offsetY, scaledWidth, scaledHeight);

            // Save cropped image
            const croppedData = cropCanvas.toDataURL('image/png');
            STATE.photos[index] = croppedData;

            // Update UI
            const slot = document.querySelector(`.photo-slot[data-index="${index}"]`);
            const imgElement = document.createElement('img');
            imgElement.src = croppedData;
            slot.innerHTML = '';
            slot.appendChild(imgElement);
            slot.classList.add('filled');

            // Re-add buttons
            const uploadBtn = document.createElement('button');
            uploadBtn.className = 'upload-photo-btn';
            uploadBtn.dataset.index = index;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i>';
            uploadBtn.title = 'Tải ảnh lên';
            slot.appendChild(uploadBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-photo-btn';
            deleteBtn.dataset.index = index;
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            slot.appendChild(deleteBtn);

            const swapBtn = document.createElement('button');
            swapBtn.className = 'swap-photo-btn';
            swapBtn.dataset.index = index;
            swapBtn.innerHTML = '<i class="fas fa-arrows-rotate"></i>';
            slot.appendChild(swapBtn);

            const uploadInput = document.createElement('input');
            uploadInput.type = 'file';
            uploadInput.className = 'photo-upload-input';
            uploadInput.dataset.index = index;
            uploadInput.accept = 'image/*';
            uploadInput.style.display = 'none';
            slot.appendChild(uploadInput);

            // Re-attach event listeners
            uploadBtn.addEventListener('click', () => uploadInput.click());
            uploadInput.addEventListener('change', (e) => handlePhotoUpload(e, index));
            deleteBtn.addEventListener('click', () => deletePhoto(index));
            swapBtn.addEventListener('click', () => openSwapModal(index));

            updatePhotoCount();
            updateButtons();
        };

        reader.readAsDataURL(file);

    } catch (error) {
        console.error('Upload error:', error);
        alert('Lỗi khi tải ảnh: ' + error.message);
    }

    // Reset input
    event.target.value = '';
}
