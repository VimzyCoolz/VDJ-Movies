import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();
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

apiRouter.get('/config', (req, res) => {
    res.json({
        VITE_ADMOB_APP_ID: process.env.VITE_ADMOB_APP_ID,
        VITE_ADMOB_INTERSTITIAL_UNIT_ID: process.env.VITE_ADMOB_INTERSTITIAL_UNIT_ID,
        VITE_ADMOB_BANNER_UNIT_ID: process.env.VITE_ADMOB_BANNER_UNIT_ID,
        VITE_GOOGLE_AD_CLIENT: process.env.VITE_GOOGLE_AD_CLIENT,
    });
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

// Get real search suggestions based on actual content
apiRouter.get('/suggestions', async (req, res) => {
    try {
        // Fetch top movie titles by views
        const titlesResult = await db.query('SELECT title FROM movies ORDER BY views DESC LIMIT 8');
        // Fetch unique DJ names
        const djsResult = await db.query('SELECT DISTINCT dj_name FROM movies LIMIT 5');
        // Fetch unique genres
        const genresResult = await db.query('SELECT DISTINCT genre FROM movies LIMIT 5');

        const suggestions = [
            ...titlesResult.rows.map(r => r.title),
            ...djsResult.rows.map(r => r.dj_name),
            ...genresResult.rows.map(r => r.genre)
        ];

        // Shuffle and take up to 15
        const shuffled = suggestions
            .filter((v, i, a) => a.indexOf(v) === i) // Unique
            .sort(() => Math.random() - 0.5)
            .slice(0, 15);

        res.json(shuffled);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] SUGGESTIONS_ERROR:`, error);
        res.status(500).json({ error: 'Failed to fetch suggestions' });
    }
});

// Delete a movie (only by owner)
apiRouter.delete('/movies/:id', async (req, res) => {
    const { publisher_name } = req.body;
    const movieId = req.params.id;

    if (!publisher_name) {
        return res.status(401).json({ error: 'Unauthorized: Publisher name required' });
    }

    try {
        // First, check if the movie belongs to the publisher
        const checkResult = await db.query('SELECT * FROM movies WHERE id = $1', [movieId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Movie not found' });
        }

        const movie = checkResult.rows[0];
        if (movie.publisher_name !== publisher_name) {
            return res.status(403).json({ error: 'Forbidden: You do not own this movie' });
        }

        // Delete from database
        await db.query('DELETE FROM movies WHERE id = $1', [movieId]);
        
        console.log(`[${new Date().toISOString()}] MOVIE_DELETED: ID ${movieId} by ${publisher_name}`);
        res.json({ success: true, message: 'Movie deleted successfully' });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] DELETE_ERROR:`, error);
        res.status(500).json({ error: 'Failed to delete movie', details: error.message });
    }
});

// Register a unique view
apiRouter.post('/movies/:id/view', async (req, res) => {
    const movieId = req.params.id;
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        // Use an UPSERT-like approach with INSERT IGNORE (or ON CONFLICT DO NOTHING in PG)
        // to handle idempotency and duplicate prevention at the DB level
        const viewResult = await db.query(
            'INSERT INTO movie_views (movie_id, user_id) VALUES ($1, $2) ON CONFLICT (movie_id, user_id) DO NOTHING RETURNING id',
            [movieId, userId]
        );

        // If a row was returned, it means this is a new unique view
        if (viewResult.rows.length > 0) {
            await db.query('UPDATE movies SET views = views + 1 WHERE id = $1', [movieId]);
            console.log(`[${new Date().toISOString()}] NEW_VIEW_REGISTERED: Movie ${movieId} by User ${userId}`);
            return res.json({ success: true, message: 'View registered' });
        } else {
            return res.json({ success: false, message: 'View already registered for this user' });
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] VIEW_REGISTRATION_ERROR:`, error);
        res.status(500).json({ error: 'Failed to register view', details: error.message });
    }
});

// Publish new movie with direct file upload and optional custom cover
apiRouter.post('/upload', upload.fields([
    { name: 'movie_file', maxCount: 1 },
    { name: 'cover_image', maxCount: 1 }
]), async (req, res) => {
    const startTime = Date.now();
    const { dj_name, title, summary, genre, publisher_name } = req.body;
    const movieFile = req.files['movie_file'] ? req.files['movie_file'][0] : null;
    const coverFile = req.files['cover_image'] ? req.files['cover_image'][0] : null;
    
    if (!movieFile || !dj_name || !title) {
        console.error(`[${new Date().toISOString()}] UPLOAD_FAILED: Missing fields. DJ: ${dj_name}, Title: ${title}, File: ${!!movieFile}`);
        return res.status(400).json({ error: 'Missing required fields or movie file' });
    }

    if (!channelId) {
        console.error(`[${new Date().toISOString()}] UPLOAD_FAILED: CLOUD_STORAGE_ID is not configured`);
        return res.status(500).json({ error: 'Server configuration error: Missing storage ID' });
    }

    console.log(`[${new Date().toISOString()}] UPLOAD_STARTED: ${title} (${(movieFile.size / (1024 * 1024)).toFixed(2)} MB) by ${dj_name} (Publisher: ${publisher_name || 'Anonymous'})`);

    try {
        // Ensure client is connected before sending
        const activeClient = await ensureConnected();
        const entity = await getChannelEntity(activeClient);
        
        let thumbnail_url = null;

        // 1. Process Cover Image if provided
        if (coverFile) {
            console.log(`[${new Date().toISOString()}] COVER_UPLOAD_INIT: ${coverFile.originalname}`);
            
            // Validate cover image (size < 5MB, common formats)
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(coverFile.mimetype)) {
                throw new Error('Invalid cover image format. Use JPG, PNG or WebP.');
            }
            if (coverFile.size > 5 * 1024 * 1024) {
                throw new Error('Cover image too large. Max 5MB allowed.');
            }

            const uploadedCover = await activeClient.sendFile(entity, {
                file: coverFile.path,
                caption: `**Cover for ${title}**`,
                forceDocument: false
            });
            
            thumbnail_url = `https://cloud-storage.vdj-movies.com/c/${channelId.replace('-100', '')}/${uploadedCover.id}`;
            console.log(`[${new Date().toISOString()}] COVER_UPLOAD_SUCCESS: ${thumbnail_url}`);
            
            // Clean up cover temp file
            fs.unlink(coverFile.path, () => {});
        }

        // 2. Process Movie File
        console.log(`[${new Date().toISOString()}] UPLOAD_TO_CLOUD_STARTED: ${title}`);
        
        // Check if file still exists before sending
        if (!fs.existsSync(movieFile.path)) {
            throw new Error(`Temporary file lost before cloud upload: ${movieFile.path}`);
        }

        const fileStats = fs.statSync(movieFile.path);
        console.log(`[${new Date().toISOString()}] FILE_VERIFIED: ${movieFile.path} (${(fileStats.size / (1024 * 1024)).toFixed(2)} MB)`);

        // Upload to storage with optimized parameters
        console.log(`[${new Date().toISOString()}] CLOUD_UPLOAD_INIT: ${title} - Using 4 workers, 512KB chunks`);
        
        const uploadedFile = await activeClient.sendFile(entity, {
            file: movieFile.path, // Read directly from disk
            caption: `**${title}**\nNarrated by: ${dj_name}\nPublished by: ${publisher_name || 'Anonymous'}\n\n${summary}\n\n#${genre}`,
            parseMode: 'markdown',
            workers: 4, 
            maxChunkSize: 512 * 1024, 
            forceDocument: false, 
            progressCallback: (progress) => {
                const percent = (progress * 100).toFixed(2);
                if (Math.floor(percent * 20) % 100 === 0 || percent === "100.00") { 
                    console.log(`[${new Date().toISOString()}] CLOUD_UPLOAD_PROGRESS: ${title} - ${percent}%`);
                }
            }
        });

        const upliftDuration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[${new Date().toISOString()}] UPLOAD_TO_CLOUD_SUCCESS: ${title} in ${upliftDuration}s`);

        // Construct internal tracking link
        const storage_link = `https://cloud-storage.vdj-movies.com/c/${channelId.replace('-100', '')}/${uploadedFile.id}`;
        
        // Calculate human readable size
        const sizeInBytes = movieFile.size;
        let sizeFormatted = '0 MB';
        if (sizeInBytes >= 1024 * 1024 * 1024) {
            sizeFormatted = `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        } else {
            sizeFormatted = `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB`;
        }

        const result = await db.query(
            'INSERT INTO movies (dj_name, title, summary, genre, telegram_link, telegram_message_id, publisher_name, size, thumbnail_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [dj_name, title, summary, genre, storage_link, uploadedFile.id, publisher_name || 'Anonymous', sizeFormatted, thumbnail_url]
        );
        
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[${new Date().toISOString()}] TRANSACTION_COMPLETE: ${title} published in ${totalDuration}s total.`);
        
        // Clean up: Delete movie temp file
        fs.unlink(movieFile.path, (err) => {
            if (err) console.error(`[${new Date().toISOString()}] CLEANUP_ERROR: Failed to delete temp file: ${movieFile.path}`, err);
        });

        res.json({ success: true, movie: result.rows[0] });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] UPLOAD_CRITICAL_ERROR:`, error);
        
        // Clean up: Delete temp files even on error
        [movieFile, coverFile].forEach(f => {
            if (f && f.path && fs.existsSync(f.path)) {
                try { fs.unlinkSync(f.path); } catch (e) {}
            }
        });
        
        const errorMessage = error.message || 'Unknown error during upload';
        res.status(500).json({ 
            error: 'Failed to process movie uplift', 
            details: errorMessage,
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
