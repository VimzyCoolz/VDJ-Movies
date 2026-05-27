-- VDJ Movies Database Schema

-- If you are updating an existing database, run these individually in Supabase SQL Editor:
-- ALTER TABLE movies ADD COLUMN IF NOT EXISTS dj_name TEXT NOT NULL DEFAULT 'Unknown';
-- ALTER TABLE movies ADD COLUMN IF NOT EXISTS summary TEXT;
-- ALTER TABLE movies ADD COLUMN IF NOT EXISTS genre TEXT;
-- ALTER TABLE movies ADD COLUMN IF NOT EXISTS telegram_link TEXT;
-- ALTER TABLE movies ADD COLUMN IF NOT EXISTS telegram_message_id INTEGER;
-- ALTER TABLE movies ADD COLUMN IF NOT EXISTS publisher_name TEXT;

-- Movies table
CREATE TABLE IF NOT EXISTS movies (
    id SERIAL PRIMARY KEY,
    dj_name TEXT NOT NULL DEFAULT 'Unknown',
    title TEXT NOT NULL,
    summary TEXT,
    genre TEXT,
    telegram_link TEXT,
    telegram_message_id INTEGER,
    publisher_name TEXT,
    thumbnail_url TEXT,
    duration TEXT,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Movie Views table (Unique views tracking)
CREATE TABLE IF NOT EXISTS movie_views (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(movie_id, user_id)
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Downloads tracking (for future sync features)
CREATE TABLE IF NOT EXISTS downloads (
    id SERIAL PRIMARY KEY,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    user_id TEXT, -- For tracking individual user downloads
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
