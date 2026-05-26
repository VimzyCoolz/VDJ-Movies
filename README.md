# VDJ Movies - Re-initialized & Redesigned✔

A professional Netflix-style movie streaming platform for DJ Afro and DJ Smith fans.

## 🚀 Features

- **📱 Mobile-First Design**: Permanent bottom navigation bar with gold icons.
- **🎞️ Netflix-Style Home**: Horizontal genre rails (Action, Kihindi, Comedy, etc.).
- **🔍 Smart Search**: Prominent top search bar for DJs and titles.
- **📚 Offline Vault**: Dedicated library for tracking downloads and watching offline.
- **📤 Creator Portal**: Simple form for DJs to publish content directly.
- **👤 CoolzTech Auth**: Integrated shared UI for secure profile management.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons.
- **Backend**: Node.js, Express, PostgreSQL.
- **Streaming**: GramJS (via TgStreamBot).
- **Deployment**: Vercel.

## 📁 Directory Structure

- `/vdj-frontend`: React application (Vite).
- `/vdj-backend`: Express API and Database logic.
- `/TgStreamBot`: Telegram file streaming bot.
- `/images`: Branding assets (Logo, Background, etc.).

## 🔑 Environment Variables (.env)

Ensure these are set in your root `.env` file:
- `DATABASE_URL`: PostgreSQL connection string.
- `CT_PUB`: CoolzTech Shared UI Public Key.
- `TELEGRAM_BOT_TOKEN`: Your streaming bot token.
- `BASE_URL`: Deployment URL.

## 📦 Setup

1. **Database**: Run `init.sql` in your PostgreSQL instance.
2. **Backend**: `cd vdj-backend && npm install && npm start`.
3. **Frontend**: `cd vdj-frontend && npm install && npm run dev`.
