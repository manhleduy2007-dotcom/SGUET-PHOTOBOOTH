// Vercel Serverless Function - upload ảnh lên hosting, thử lần lượt nhiều dịch vụ
// Node.js 18+: fetch, FormData, Blob có sẵn, không cần thư viện ngoài.
//
// Thứ tự thử: ImgBB (nếu có biến môi trường IMGBB_KEY) -> Catbox -> 0x0.st
// Nếu tất cả lỗi, response 502 sẽ ghi rõ từng dịch vụ lỗi vì sao (HTTP status / nội dung trả về),
// và app.js sẽ hiện đúng thông báo đó lên màn hình QR.

const UA = 'Mozilla/5.0 (compatible; SGUET-Photobooth/1.0)';

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    try {
        let body = req.body;
        if (typeof body === 'string') body = JSON.parse(body);
        const image = body && body.image;
        if (!image) return res.status(400).json({ success: false, error: 'No image data provided' });

        const buffer = Buffer.from(image, 'base64');
        console.log('Image buffer size:', buffer.length, 'bytes');

        const uploaders = [];
        if (process.env.IMGBB_KEY) uploaders.push(['ImgBB', uploadImgbb]);
        uploaders.push(['Catbox', uploadCatbox], ['0x0.st', upload0x0]);

        const errors = [];
        for (const [name, upload] of uploaders) {
            try {
                const url = await upload(buffer);
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

// ===== helpers =====

// Bỏ ký tự HTML và cắt ngắn, vì chuỗi này được hiện lên giao diện
function clean(text, max = 120) {
    return String(text || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function describeError(e) {
    if (e && e.name === 'AbortError') return 'timeout (>15s)';
    const code = e && e.cause && (e.cause.code || e.cause.message);
    return clean(code ? `${e.message} (${code})` : (e && e.message));
}

async function fetchWithTimeout(url, options = {}, ms = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function uploadImgbb(buffer) {
    const form = new FormData();
    form.append('image', buffer.toString('base64'));

    const response = await fetchWithTimeout(
        `https://api.imgbb.com/1/upload?key=${encodeURIComponent(process.env.IMGBB_KEY)}`,
        { method: 'POST', body: form }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !data.data || !data.data.url) {
        const msg = data.error && data.error.message ? data.error.message : '';
        throw new Error(clean(`HTTP ${response.status} ${msg}`));
    }
    return data.data.url;
}

async function uploadCatbox(buffer) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');

    const response = await fetchWithTimeout('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: form,
        headers: { 'User-Agent': UA }
    });
    const text = (await response.text()).trim();
    if (!response.ok || !text.startsWith('https://')) {
        throw new Error(clean(`HTTP ${response.status} ${text}`));
    }
    return text;
}

async function upload0x0(buffer) {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');

    const response = await fetchWithTimeout('https://0x0.st', {
        method: 'POST',
        body: form,
        headers: { 'User-Agent': UA }
    });
    const text = (await response.text()).trim();
    if (!response.ok || !text.startsWith('http')) {
        throw new Error(clean(`HTTP ${response.status} ${text}`));
    }
    return text;
}