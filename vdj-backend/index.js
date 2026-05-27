import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import db from './db.js';
import multer from 'multer';
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Polyfill for BigInt to support older GramJS versions or environments with BigInt mismatches
if (typeof BigInt !== 'undefined') {
    if (!BigInt.prototype.mod) {
        BigInt.prototype.mod = function (n) {
            const res = this % BigInt(n);
            // Return an object that mimics the expected BigInt extension if necessary
            return res;
        };
    }
    if (!BigInt.prototype.toJSNumber) {
        BigInt.prototype.toJSNumber = function () {
            return Number(this);
        };
    }
    // Add other missing methods that GramJS might expect on the result of mod()
    if (!BigInt.prototype.div) {
        BigInt.prototype.div = function (n) {
            return this / BigInt(n);
        };
    }
    if (!BigInt.prototype.mul) {
        BigInt.prototype.mul = function (n) {
            return this * BigInt(n);
        };
    }
    if (!BigInt.prototype.add) {
        BigInt.prototype.add = function (n) {
            return this + BigInt(n);
        };
    }
    if (!BigInt.prototype.sub) {
        BigInt.prototype.sub = function (n) {
            return this - BigInt(n);
        };
    }
    if (!BigInt.prototype.subtract) {
        BigInt.prototype.subtract = function (n) {
            return this - BigInt(n);
        };
    }
    if (!BigInt.prototype.minus) {
        BigInt.prototype.minus = function (n) {
            return this - BigInt(n);
        };
    }
    if (!BigInt.prototype.plus) {
        BigInt.prototype.plus = function (n) {
            return this + BigInt(n);
        };
    }
    if (!BigInt.prototype.multiply) {
        BigInt.prototype.multiply = function (n) {
            return this * BigInt(n);
        };
    }
    if (!BigInt.prototype.times) {
        BigInt.prototype.times = function (n) {
            return this * BigInt(n);
        };
    }
    if (!BigInt.prototype.remainder) {
        BigInt.prototype.remainder = function (n) {
            return this % BigInt(n);
        };
    }
    if (!BigInt.prototype.eq) {
        BigInt.prototype.eq = function (n) {
            return this === BigInt(n);
        };
    }
    if (!BigInt.prototype.equals) {
        BigInt.prototype.equals = function (n) {
            return this === BigInt(n);
        };
    }
    if (!BigInt.prototype.gt) {
        BigInt.prototype.gt = function (n) {
            return this > BigInt(n);
        };
    }
    if (!BigInt.prototype.lt) {
        BigInt.prototype.lt = function (n) {
            return this < BigInt(n);
        };
    }
    if (!BigInt.prototype.geq) {
        BigInt.prototype.geq = function (n) {
            return this >= BigInt(n);
        };
    }
    if (!BigInt.prototype.leq) {
        BigInt.prototype.leq = function (n) {
            return this <= BigInt(n);
        };
    }
    if (!BigInt.prototype.abs) {
        BigInt.prototype.abs = function () {
            return this < 0n ? -this : this;
        };
    }
    if (!BigInt.prototype.negate) {
        BigInt.prototype.negate = function () {
            return -this;
        };
    }
    if (!BigInt.prototype.isZero) {
        BigInt.prototype.isZero = function () {
            return this === 0n;
        };
    }
    if (!BigInt.prototype.isNegative) {
        BigInt.prototype.isNegative = function () {
            return this < 0n;
        };
    }
    if (!BigInt.prototype.isPositive) {
        BigInt.prototype.isPositive = function () {
            return this > 0n;
        };
    }
    if (!BigInt.prototype.neq) {
        BigInt.prototype.neq = function (n) {
            return this !== BigInt(n);
        };
    }
    if (!BigInt.prototype.lesser) {
        BigInt.prototype.lesser = function (n) {
            return this < BigInt(n);
        };
    }
    if (!BigInt.prototype.greater) {
        BigInt.prototype.greater = function (n) {
            return this > BigInt(n);
        };
    }
    if (!BigInt.prototype.divide) {
        BigInt.prototype.divide = function (n) {
            return this / BigInt(n);
        };
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Multer config for file uploads - Using diskStorage for better performance and lower memory usage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ 
    storage,
    limits: {
        fileSize: 1024 * 1024 * 2000, // 2GB limit (max supported by Telegram bots)
        fieldSize: 1024 * 1024 * 50 // 50MB limit for metadata fields
    }
});

// Cloud Client Initialization
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const dcId = parseInt(process.env.TELEGRAM_DC_ID) || 4; // Default to 4, but allow override to 2
let channelId = process.env.TELEGRAM_CHANNEL_ID;
let cachedChannelEntity = null;

// Normalize Channel ID
if (channelId && !channelId.startsWith('-100') && !channelId.startsWith('@')) {
    if (/^\d+$/.test(channelId)) {
        channelId = `-100${channelId}`;
    }
}

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
    useWSS: false,
    dcId: dcId, // Explicitly set the Data Center ID
});

// Helper to ensure cloud client is connected
let isClientStarted = false;
let clientPromise = null;

async function ensureConnected() {
    if (isClientStarted && client.connected) return client;

    if (clientPromise) return clientPromise;

    clientPromise = (async () => {
        try {
            if (!apiId || !apiHash || !botToken) {
                throw new Error("Missing cloud configuration (API_ID, API_HASH, or BOT_TOKEN)");
            }
            
            console.log(`[${new Date().toISOString()}] CLOUD_CONNECT_STARTING...`);
            await client.start({
                botAuthToken: botToken,
            });
            
            isClientStarted = true;
            console.log(`[${new Date().toISOString()}] CLOUD_CONNECT_SUCCESS`);
            return client;
        } catch (err) {
            console.error(`[${new Date().toISOString()}] CLOUD_CONNECT_ERROR:`, err);
            clientPromise = null; // Reset so next request can retry
            throw err;
        }
    })();

    return clientPromise;
}

// Initial attempt to start (optional, but good for warm instances)
ensureConnected().catch(err => console.error("Initial cloud connection failed:", err));

app.use(cors());
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Increase payload limits for large movie metadata and uploads
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Request logger for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Body keys: ${Object.keys(req.body)}`);
    next();
});

// API Router
const apiRouter = express.Router();
app.use('/api', apiRouter);

// --- Streaming Engine ---

async function getChannelEntity(activeClient) {
    if (cachedChannelEntity) return cachedChannelEntity;
    
    if (!channelId) {
        throw new Error("TELEGRAM_CHANNEL_ID is not configured in environment variables");
    }

    try {
        console.log(`[${new Date().toISOString()}] RESOLVING_CHANNEL: ${channelId}`);
        cachedChannelEntity = await activeClient.getEntity(channelId);
        return cachedChannelEntity;
    } catch (err) {
        console.error(`[${new Date().toISOString()}] CHANNEL_RESOLUTION_ERROR:`, err);
        throw new Error(`Could not access Telegram channel ${channelId}. Make sure the bot is an admin and the ID is correct.`);
    }
}

apiRouter.get('/stream/:id', async (req, res) => {
    const fileId = parseInt(req.params.id);
    const range = req.headers.range;

    if (isNaN(fileId)) {
        return res.status(400).json({ error: 'Invalid movie ID' });
    }

    try {
        console.log(`[${new Date().toISOString()}] STREAM_REQUEST: ID ${fileId}, Range: ${range || 'None'}`);
        
        const activeClient = await ensureConnected();
        const entity = await getChannelEntity(activeClient);

        // In a real production scenario, we'd fetch the message entity to get the file
        // For now, we'll use the fileId directly if it's a message ID
        let message;
        try {
            message = await activeClient.getMessages(entity, { ids: [fileId] });
        } catch (msgErr) {
            console.error(`[${new Date().toISOString()}] STREAM_FETCH_ERROR:`, msgErr);
            throw new Error(`Failed to fetch message ${fileId} from channel: ${msgErr.message}`);
        }
        
        if (!message || !message[0] || !message[0].media) {
            console.warn(`[${new Date().toISOString()}] STREAM_NOT_FOUND: ID ${fileId}`);
            return res.status(404).json({ error: 'Video not found in cloud storage' });
        }

        const media = message[0].media;
        const document = media.document || media.photo;
        
        if (!document) {
            return res.status(404).json({ error: 'No media found in message' });
        }

        const fileSize = BigInt(document.size);
        const fileName = media.document?.attributes?.find(a => a.constructor.name === 'DocumentAttributeFilename')?.fileName || 'video.mp4';
        const mimeType = media.document?.mimeType || 'video/mp4';

        console.log(`[${new Date().toISOString()}] STREAM_STARTING: ${fileName} (${fileSize} bytes)`);

        if (!range) {
            res.status(200).set({
                'Content-Length': fileSize.toString(),
                'Content-Type': mimeType,
                'Accept-Ranges': 'bytes',
                'Content-Disposition': `inline; filename="${fileName}"`
            });
            
            const stream = activeClient.iterDownload({
                file: media,
                offset: BigInt(0), // Explicitly pass 0n to avoid internal default to Number 0
                requestSize: 1024 * 1024,
            });

            for await (const chunk of stream) {
                res.write(chunk);
            }
            res.end();
        } else {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = BigInt(parts[0]);
            const end = parts[1] ? BigInt(parts[1]) : fileSize - 1n;
            
            if (start >= fileSize) {
                return res.status(416).json({ error: 'Requested range not satisfiable' });
            }

            const chunksize = (end - start) + 1n;

            res.status(206).set({
                'Content-Range': `bytes ${start.toString()}-${end.toString()}/${fileSize.toString()}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize.toString(),
                'Content-Type': mimeType,
            });

            const stream = activeClient.iterDownload({
                file: media,
                offset: start, // MUST be BigInt for .mod() polyfill
                limit: Number(chunksize), // MUST be Number for Math.max() internal calls
                requestSize: 1024 * 1024,
            });

            for await (const chunk of stream) {
                res.write(chunk);
            }
            res.end();
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] STREAM_CRITICAL_ERROR:`, error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Streaming failed', 
                details: error.message,
                suggestion: "Check if TELEGRAM_CHANNEL_ID is correct and bot is an admin."
            });
        } else {
            res.end();
        }
    }
});

// Health check
apiRouter.get('/', (req, res) => {
    res.json({ status: 'running', service: 'VDJ Movies API' });
});

// Alias for health check at /health
apiRouter.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'running', database: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', database: 'disconnected', details: err.message });
    }
});

// Friendly GET handler for /upload to prevent 404s
apiRouter.get('/upload', (req, res) => {
    res.json({ 
        status: 'active', 
        message: 'This endpoint is for movie uploads. Please use the Creator Content Portal in the app to publish movies.',
        method_required: 'POST'
    });
});

// Get all movies grouped by genre
apiRouter.get('/movies', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM movies ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] DB_ERROR:`, error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// Get movies by publisher name
apiRouter.get('/movies/publisher/:name', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM movies WHERE publisher_name = $1 ORDER BY created_at DESC', [req.params.name]);
        res.json(result.rows);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] DB_ERROR:`, error);
        res.status(500).json({ error: 'Database error', details: error.message });
    }
});

// Publish new movie with direct file upload
apiRouter.post('/upload', upload.single('movie_file'), async (req, res) => {
    const startTime = Date.now();
    const { dj_name, title, summary, genre, publisher_name } = req.body;
    const file = req.file;
    
    if (!file || !dj_name || !title) {
        console.error(`[${new Date().toISOString()}] UPLOAD_FAILED: Missing fields. DJ: ${dj_name}, Title: ${title}, File: ${!!file}`);
        return res.status(400).json({ error: 'Missing required fields or file' });
    }

    if (!channelId) {
        console.error(`[${new Date().toISOString()}] UPLOAD_FAILED: CLOUD_STORAGE_ID is not configured`);
        return res.status(500).json({ error: 'Server configuration error: Missing storage ID' });
    }

    console.log(`[${new Date().toISOString()}] UPLOAD_STARTED: ${title} (${(file.size / (1024 * 1024)).toFixed(2)} MB) by ${dj_name} (Publisher: ${publisher_name || 'Anonymous'})`);

    try {
        console.log(`[${new Date().toISOString()}] UPLOAD_TO_CLOUD_STARTED: ${title}`);
        
        // Ensure client is connected before sending
        const activeClient = await ensureConnected();
        
        // Resolve channel entity
        const entity = await getChannelEntity(activeClient);
        
        // Check if file still exists before sending
        if (!fs.existsSync(file.path)) {
            throw new Error(`Temporary file lost before cloud upload: ${file.path}`);
        }

        const fileStats = fs.statSync(file.path);
        console.log(`[${new Date().toISOString()}] FILE_VERIFIED: ${file.path} (${(fileStats.size / (1024 * 1024)).toFixed(2)} MB)`);

        // Upload to storage with optimized parameters
        console.log(`[${new Date().toISOString()}] CLOUD_UPLOAD_INIT: ${title} - Using 4 workers, 512KB chunks`);
        
        const uploadedFile = await activeClient.sendFile(entity, {
            file: file.path, // Read directly from disk
            caption: `🎬 **${title}**\n🎙️ Narrated by: ${dj_name}\n👤 Published by: ${publisher_name || 'Anonymous'}\n\n${summary}\n\n#${genre}`,
            parseMode: 'markdown',
            workers: 4, // Reduced from 8 for better stability on smaller instances
            maxChunkSize: 512 * 1024, // Reduced from 1MB to 512KB for better reliability
            forceDocument: false, // Allow Telegram to treat it as a video if possible
            progressCallback: (progress) => {
                const percent = (progress * 100).toFixed(2);
                // Log every 5% for better visibility without flooding
                if (Math.floor(percent * 20) % 100 === 0 || percent === "100.00") { 
                    console.log(`[${new Date().toISOString()}] CLOUD_UPLOAD_PROGRESS: ${title} - ${percent}%`);
                }
            }
        });

        const upliftDuration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[${new Date().toISOString()}] UPLOAD_TO_CLOUD_SUCCESS: ${title} in ${upliftDuration}s`);

        // Construct internal tracking link
        const storage_link = `https://cloud-storage.vdj-movies.com/c/${channelId.replace('-100', '')}/${uploadedFile.id}`;

        const result = await db.query(
            'INSERT INTO movies (dj_name, title, summary, genre, telegram_link, telegram_message_id, publisher_name) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [dj_name, title, summary, genre, storage_link, uploadedFile.id, publisher_name || 'Anonymous']
        );
        
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[${new Date().toISOString()}] TRANSACTION_COMPLETE: ${title} published in ${totalDuration}s total.`);
        
        // Clean up: Delete temp file
        fs.unlink(file.path, (err) => {
            if (err) console.error(`[${new Date().toISOString()}] CLEANUP_ERROR: Failed to delete temp file: ${file.path}`, err);
        });

        res.json({ success: true, movie: result.rows[0] });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] UPLOAD_CRITICAL_ERROR:`, error);
        
        // Clean up: Delete temp file even on error
        if (file && file.path) {
            try {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            } catch (unlinkErr) {
                console.error(`[${new Date().toISOString()}] CLEANUP_ERROR:`, unlinkErr);
            }
        }
        
        const errorMessage = error.message || 'Unknown error during upload';
        res.status(500).json({ 
            error: 'Failed to process movie uplift', 
            details: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
});

// Reports
apiRouter.post('/report', async (req, res) => {
    const { movieId, reason } = req.body;
    try {
        await db.query('INSERT INTO reports (movie_id, reason) VALUES ($1, $2)', [movieId, reason]);
        res.json({ success: true, message: 'Report submitted' });
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
