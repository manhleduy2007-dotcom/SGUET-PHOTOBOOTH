// Vercel Serverless Function - upload ảnh lên hosting, thử lần lượt nhiều dịch vụ
// Node.js 18+: fetch, FormData, Blob có sẵn, không cần thư viện ngoài.
//
// File này phải nằm ở  api/upload.js  trong project Vercel.
//
// Thứ tự thử: ImgBB (nếu có biến môi trường IMGBB_KEY) -> Catbox -> Litterbox -> tmpfiles.org -> 0x0.st
// - Tổng thời gian có giới hạn (BUDGET_MS) để luôn trả lỗi chi tiết TRƯỚC khi Vercel cắt hàm (maxDuration 30s).
// - Nếu tất cả lỗi, response 502 ghi rõ từng dịch vụ lỗi vì sao, app.js hiện đúng thông báo đó lên màn hình QR.
//
// Chẩn đoán (mở trên trình duyệt):
//   GET /api/upload            -> kiểm tra hàm có chạy không và đã có IMGBB_KEY chưa
//   GET /api/upload?test=1     -> thử upload 1 ảnh nhỏ lên TỪNG host, cho biết host nào sống/chết từ Vercel
//                                (chỉ dùng để debug, xong nên xóa đoạn test)

const UA = 'Mozilla/5.0 (compatible; SGUET-Photobooth/1.0)';

// Ngân sách thời gian (ms). Có thể ghi đè bằng biến môi trường khi cần.
const BUDGET_MS = Number(process.env.UPLOAD_BUDGET_MS) || 26000; // < maxDuration 30s trong vercel.json
const HOST_MS = Number(process.env.UPLOAD_HOST_MS) || 9000;      // tối đa cho mỗi host
const MIN_SLICE_MS = 2000;                                       // còn ít hơn mức này thì không thử host tiếp nữa
const MAX_BYTES = 4 * 1024 * 1024;                               // Vercel giới hạn body ~4.5MB

// JPEG 8x8 dùng cho ?test=1
const TINY_JPEG_B64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDRooor1ThP/9k=';

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        const wantTest = new URL(req.url || '/', 'http://localhost').searchParams.has('test');
        if (wantTest) return runDiagnostics(res);
        return res.status(200).json({
            ok: true,
            imgbbKeySet: Boolean(process.env.IMGBB_KEY),
            hosts: getUploaders().map(([name]) => name)
        });
    }

    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    try {
        let body = req.body;
        if (typeof body === 'string') body = JSON.parse(body);
        let image = body && body.image;
        if (!image) return res.status(400).json({ success: false, error: 'No image data provided' });

        // Phòng trường hợp client gửi cả tiền tố data:image/...;base64,
        image = String(image).replace(/^data:[^;]+;base64,/, '');

        const buffer = Buffer.from(image, 'base64');
        console.log('Image buffer size:', buffer.length, 'bytes');
        if (buffer.length === 0) return res.status(400).json({ success: false, error: 'Empty image' });
        if (buffer.length > MAX_BYTES) return res.status(413).json({ success: false, error: 'Image too large' });

        const started = Date.now();
        const errors = [];

        for (const [name, upload] of getUploaders()) {
            const remaining = BUDGET_MS - (Date.now() - started);
            if (remaining < MIN_SLICE_MS) {
                errors.push(`${name}: bỏ qua (hết thời gian)`);
                continue;
            }
            try {
                const url = await upload(buffer, Math.min(HOST_MS, remaining));
                console.log(`Upload success via ${name}:`, url);
                return res.status(200).json({ success: true, url, host: name });
            } catch (e) {
                const reason = describeError(e);
                console.error(`${name} failed:`, reason);
                errors.push(`${name}: ${reason}`);
            }
        }

        return res.status(502).json({ success: false, error: errors.join(' | ') });
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ success: false, error: clean(`${error.name}: ${error.message}`) });
    }
};

// ===== danh sách host =====

function getUploaders() {
    const list = [];
    if (process.env.IMGBB_KEY) list.push(['ImgBB', uploadImgbb]);
    list.push(
        ['Catbox', uploadCatbox],
        ['Litterbox', uploadLitterbox],
        ['0x0.st', upload0x0]
    );
    return list;
}

async function runDiagnostics(res) {
    const buffer = Buffer.from(TINY_JPEG_B64, 'base64');
    const results = await Promise.all(getUploaders().map(async ([name, upload]) => {
        const t = Date.now();
        try {
            const url = await upload(buffer, 8000);
            return { host: name, ok: true, ms: Date.now() - t, url };
        } catch (e) {
            return { host: name, ok: false, ms: Date.now() - t, error: describeError(e) };
        }
    }));
    return res.status(200).json({ imgbbKeySet: Boolean(process.env.IMGBB_KEY), results });
}

// ===== helpers =====

// Bỏ ký tự HTML và cắt ngắn, vì chuỗi này được hiện lên giao diện
function clean(text, max = 120) {
    return String(text || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function describeError(e) {
    if (e && e.name === 'AbortError') return 'timeout';
    const code = e && e.cause && (e.cause.code || e.cause.message);
    return clean(code ? `${e.message} (${code})` : (e && e.message));
}

async function fetchWithTimeout(url, options = {}, ms = HOST_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ===== từng host =====

async function uploadImgbb(buffer, ms) {
    const form = new FormData();
    form.append('image', buffer.toString('base64'));

    const response = await fetchWithTimeout(
        `https://api.imgbb.com/1/upload?key=${encodeURIComponent(process.env.IMGBB_KEY)}`,
        { method: 'POST', body: form },
        ms
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.data || !data.data.url) {
        const msg = data.error && data.error.message ? data.error.message : '';
        throw new Error(clean(`HTTP ${response.status} ${msg}`));
    }
    return data.data.url;
}

async function uploadCatbox(buffer, ms) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');

    const response = await fetchWithTimeout('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: form,
        headers: { 'User-Agent': UA }
    }, ms);
    const text = (await response.text()).trim();
    if (!response.ok || !text.startsWith('https://')) {
        throw new Error(clean(`HTTP ${response.status} ${text}`));
    }
    return text;
}

// Litterbox = Catbox bản file tạm (giữ 72 giờ), cùng chủ nhưng khác endpoint
async function uploadLitterbox(buffer, ms) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '72h');
    form.append('fileToUpload', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');

    const response = await fetchWithTimeout('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        body: form,
        headers: { 'User-Agent': UA }
    }, ms);
    const text = (await response.text()).trim();
    if (!response.ok || !text.startsWith('https://')) {
        throw new Error(clean(`HTTP ${response.status} ${text}`));
    }
    return text;
}

// tmpfiles.org: file bị xóa sau khoảng 1 giờ, chỉ dùng làm phương án cuối
async function uploadTmpfiles(buffer, ms) {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');

    const response = await fetchWithTimeout('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: form,
        headers: { 'User-Agent': UA }
    }, ms);
    const data = await response.json().catch(() => ({}));
    const pageUrl = data && data.data && data.data.url;
    if (!response.ok || !pageUrl) {
        throw new Error(clean(`HTTP ${response.status} ${data && data.status ? data.status : ''}`));
    }
    // Link trả về là trang xem; link tải trực tiếp có thêm /dl/
    return String(pageUrl).replace('http://', 'https://').replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}

async function upload0x0(buffer, ms) {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');

    const response = await fetchWithTimeout('https://0x0.st', {
        method: 'POST',
        body: form,
        headers: { 'User-Agent': UA }
    }, ms);
    const text = (await response.text()).trim();
    if (!response.ok || !text.startsWith('http')) {
        throw new Error(clean(`HTTP ${response.status} ${text}`));
    }
    return text;
}