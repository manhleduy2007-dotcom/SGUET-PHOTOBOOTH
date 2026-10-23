// Vercel Serverless Function to proxy image upload to Catbox.moe
const FormData = require('form-data');
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        // Convert base64 to buffer
        const buffer = Buffer.from(image, 'base64');

        // Create FormData for Catbox
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', buffer, {
            filename: 'photo.jpg',
            contentType: 'image/jpeg',
            knownLength: buffer.length
        });

        // Upload to Catbox via server (bypass CORS)
        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: form,
            headers: {
                ...form.getHeaders(),
                'User-Agent': 'SGUET-Photobooth/1.0'
            },
            timeout: 25000
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Catbox error:', response.status, errorText);
            throw new Error(`Catbox returned ${response.status}: ${errorText}`);
        }

        const imageUrl = await response.text();

        if (!imageUrl || !imageUrl.trim().startsWith('https://')) {
            console.error('Invalid Catbox response:', imageUrl);
            throw new Error('Invalid response from Catbox: ' + imageUrl);
        }

        return res.status(200).json({
            success: true,
            url: imageUrl.trim()
        });

    } catch (error) {
        console.error('Upload error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message || 'Upload failed'
        });
    }
};
