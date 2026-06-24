-- If you are updating an existing database, run these individually in  SQL Editor:eg
-- ALTER TABLE movies ADD COLUMN IF NOT EXISTS dj_name TEXT NOT NULL DEFAULT 'Unknown';
-- ALTER TABLE movies ADD COLUMN IF NOT EXISTS summary TEXT;
CREATE TABLE IF NOT EXISTS heartbeats (
  id SERIAL PRIMARY KEY,
  ping_time timestamp with time zone DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS movies (
  id SERIAL PRIMARY KEY,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  telegram_message_id integer NULL,
  duration text,
  views integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT NOW(),
  dj_name text NOT NULL DEFAULT 'Unknown'::text,
  telegram_link text NULL,
  summary text,
  genre text,
  publisher_name text,
  size text
);
CREATE TABLE IF NOT EXISTS thumbnails (
  id SERIAL PRIMARY KEY,
  movie_id INTEGER NOT NULL,
  telegram_file_id INTEGER NOT NULL,
  created_at timestamp with time zone DEFAULT NOW(),
  CONSTRAINT fk_movie
    FOREIGN KEY(movie_id)
    REFERENCES movies(id)
    ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  password_hash text,
  avatar_url text,
  phone_number text,
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW(),
  is_dj_manager boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS djs (
  id SERIAL PRIMARY KEY,
  name text NOT NULL UNIQUE,
  manager_user_id UUID,
  status text DEFAULT 'open'::text, -- 'open', 'moderated', 'restricted'
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW(),
  CONSTRAINT djs_manager_user_id_fkey FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dj_verifications (
  id SERIAL PRIMARY KEY,
  dj_id integer NOT NULL,
  manager_user_id UUID NOT NULL,
  passport_photo_telegram_file_id integer,
  license_telegram_file_id integer,
  national_id_telegram_file_id integer,
  verification_status text DEFAULT 'pending'::text, -- 'pending', 'approved', 'rejected'
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW(),
  CONSTRAINT dj_verifications_dj_id_fkey FOREIGN KEY (dj_id) REFERENCES djs(id) ON DELETE CASCADE,
  CONSTRAINT dj_verifications_manager_user_id_fkey FOREIGN KEY (manager_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  movie_id integer,
  reason text NOT NULL,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT NOW(),
  CONSTRAINT reports_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS downloads (
  id SERIAL PRIMARY KEY,
  movie_id integer,
  user_id UUID,
  status text DEFAULT 'completed'::text,
  created_at timestamp with time zone DEFAULT NOW(),
  CONSTRAINT downloads_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS movie_views (
  id SERIAL PRIMARY KEY,
  movie_id integer,
  user_id UUID NOT NULL,
  viewed_at timestamp with time zone DEFAULT NOW(),
  CONSTRAINT movie_views_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  UNIQUE(movie_id, user_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  type text NOT NULL,
  message text NOT NULL,
  related_entity_id integer,
  related_entity_type text,
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT NOW(),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS series (
  id SERIAL PRIMARY KEY,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  user_id UUID,
  dj_id integer,
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW(),
  CONSTRAINT series_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT series_dj_id_fkey FOREIGN KEY (dj_id) REFERENCES djs(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS followers (
  follower_user_id UUID NOT NULL,
  followed_dj_id integer NOT NULL,
  created_at timestamp with time zone DEFAULT NOW(),
  CONSTRAINT followers_follower_user_id_fkey FOREIGN KEY (follower_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT followers_followed_dj_id_fkey FOREIGN KEY (followed_dj_id) REFERENCES djs(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS dj_approvals (
  id SERIAL PRIMARY KEY,
  dj_id integer,
  movie_id integer,
  uploader_user_id UUID,
  status text DEFAULT 'pending'::text,
  reviewed_by_user_id UUID,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT NOW(),
  CONSTRAINT dj_approvals_dj_id_fkey FOREIGN KEY (dj_id) REFERENCES djs(id) ON DELETE CASCADE,
  CONSTRAINT dj_approvals_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  CONSTRAINT dj_approvals_uploader_user_id_fkey FOREIGN KEY (uploader_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT dj_approvals_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS series_movies (
  series_id integer NOT NULL,
  movie_id integer NOT NULL,
  order_in_series integer NOT NULL,
  CONSTRAINT series_movies_pkey PRIMARY KEY (series_id, movie_id),
  CONSTRAINT series_movies_series_id_fkey FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
  CONSTRAINT series_movies_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);
