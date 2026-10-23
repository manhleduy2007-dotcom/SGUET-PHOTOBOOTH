// Vercel Serverless Function to proxy image upload to Catbox.moe
import FormData from 'form-data';
import fetch from 'node-fetch';

export default async function handler(req, res) {
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
            filename: 'photo.png',
            contentType: 'image/png',
            knownLength: buffer.length
        });

        // Upload to Catbox via server (bypass CORS)
        const response = await fetch('https://catbox.moe/user/api.php', {
            method: 'POST',
            body: form,
            headers: {
                ...form.getHeaders(),
                'User-Agent': 'SGUET-Photobooth/1.0'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Catbox error:', response.status, errorText);
            throw new Error(`Catbox returned ${response.status}`);
        }

        const imageUrl = await response.text();

        if (!imageUrl || !imageUrl.trim().startsWith('https://')) {
            console.error('Invalid Catbox response:', imageUrl);
            throw new Error('Invalid response from Catbox');
        }

        return res.status(200).json({
            success: true,
            url: imageUrl.trim()
        });

    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Upload failed'
        });
    }
}
