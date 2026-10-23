// Vercel Serverless Function - Upload ảnh lên hosting
// Dùng Node.js 18+ native fetch, FormData, Blob - không cần thư viện ngoài

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'No image data provided' });

        const buffer = Buffer.from(image, 'base64');
        console.log('Image buffer size:', buffer.length, 'bytes');

        // Thử upload lên catbox.moe
        let url = await tryUploadCatbox(buffer);

        // Nếu catbox fail, thử 0x0.st
        if (!url) {
            console.log('Catbox failed, trying 0x0.st...');
            url = await tryUpload0x0(buffer);
        }

        if (!url) {
            throw new Error('Tất cả dịch vụ upload đều thất bại');
        }

        console.log('Upload success:', url);
        return res.status(200).json({ success: true, url });

    } catch (error) {
        console.error('Upload error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

async function tryUploadCatbox(buffer) {
    try {
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: form,
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
            console.error('Catbox status:', response.status);
            return null;
        }

        const text = (await response.text()).trim();
        if (text.startsWith('https://')) return text;
        console.error('Catbox bad response:', text);
        return null;
    } catch (e) {
        console.error('Catbox error:', e.message);
        return null;
    }
}

async function tryUpload0x0(buffer) {
    try {
        const form = new FormData();
        form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const response = await fetch('https://0x0.st', {
            method: 'POST',
            body: form,
            signal: controller.signal,
            headers: { 'User-Agent': 'SGUET-Photobooth/1.0' }
        });
        clearTimeout(timeout);

        if (!response.ok) {
            console.error('0x0.st status:', response.status);
            return null;
        }

        const text = (await response.text()).trim();
        if (text.startsWith('http')) return text;
        console.error('0x0.st bad response:', text);
        return null;
    } catch (e) {
        console.error('0x0.st error:', e.message);
        return null;
    }
}
