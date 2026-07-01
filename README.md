# Dev News Bot 🤖📰

A Discord bot that fetches and posts curated developer news from [Dev.to](https://dev.to) using Discord's **Components V2** — the modern, flexible message layout system.

---

## ✨ Features

### 📰 Automated News Posting
- Fetches top articles from Dev.to every configured interval
- Filters articles by quality thresholds (reactions, comments, reading time)
- Creates a **thread** for each posted article for discussion
- Posts to per-server configured channels via `/setup`

### 🎨 Components V2 UI
Uses Discord's latest **Message Components V2** instead of traditional embeds:
- **Container** with accent colors
- **Text Display** for markdown-rich content
- **Section + Thumbnail** for metadata display
- **Media Gallery** for article cover images
- **Separators** for clean visual spacing
- **Action Rows** with interaction buttons

### 🧠 Experience & Leveling System
The bot levels up as it posts articles, unlocking stricter quality filters:

| Level | XP Required | Min Reactions | Min Comments | Min Reading |
|-------|-------------|---------------|--------------|-------------|
| 🌱 Newcomer | 0 | 0 | 0 | 0 min |
| 📚 Learning | 100 | 5 | 1 | 3 min |
| 💪 Experienced | 500 | 20 | 5 | 5 min |
| 🔥 Expert | 1000 | 50 | 10 | 8 min |

### 🗂️ Interactive News Browser (`/news`)
- Browse articles with category filtering (JavaScript, Python, React, Rust, Go, AI, etc.)
- Paginated view with Previous/Next buttons
- Real-time category switching via dropdown menu
- 14 categories to choose from

### 🌍 Multi-Server Support
- Per-server channel configuration via `/setup`
- Guild configs stored in `guilds.json`
- Bot auto-registers on new server join

---

## 📋 Commands

| Command | Description | Permission |
|---------|-------------|------------|
| `/news` | Browse and filter Dev.to news by category | Everyone |
| `/stats` | View bot statistics and experience level | Everyone |
| `/setup` | Set the news channel for this server | Admin only |
| `/forcefetch` | Force fetch and post latest news immediately | Admin only |

---

## 🏗️ Architecture

```
index.js          # Main bot logic
config.js         # Bot token, thresholds, intervals
guilds.json       # Per-server channel configurations (auto-created)
package.json      # Dependencies
```

### Tech Stack
- **Runtime:** Node.js
- **Library:** discord.js v14.26+ with Components V2 support
- **Builders:** @discordjs/builders (ContainerBuilder, TextDisplayBuilder, SectionBuilder, MediaGalleryBuilder, etc.)
- **API:** Dev.to API (`/api/articles?per_page=60&top=7`)
- **Storage:** JSON file for guild configs (no database required)

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- A Discord Application & Bot Token

### Installation

1. **Clone or download** the project
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure the bot:**
   Edit `config.js` with your bot token:
   ```js
   module.exports = {
     botToken: 'YOUR_BOT_TOKEN_HERE',
     fetchInterval: 600000, // 10 minutes
     // ... other settings
   };
   ```
4. **Start the bot:**
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

### Discord Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create an application and bot
3. Enable these **Privileged Gateway Intents**:
   - `MESSAGE CONTENT INTENT`
   - `SERVER MEMBERS INTENT` (if needed)
4. Use OAuth2 URL Generator with:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Send Messages`, `Create Public Threads`, `Embed Links`, `Read Message History`, `Use Slash Commands`
5. Invite the bot to your server
6. Run `/setup` in your server to configure the news channel
7. Run `/forcefetch` to immediately fetch and post articles

---

## ⚙️ Configuration (`config.js`)

| Option | Default | Description |
|--------|---------|-------------|
| `botToken` | — | Your Discord bot token |
| `fetchInterval` | 600000 | Auto-fetch interval in ms (10 min) |
| `xpPerArticle` | 10 | Base XP per posted article |
| `xpMultiplier.reactions` | 0.5 | Extra XP per reaction |
| `xpMultiplier.comments` | 2 | Extra XP per comment |
| `xpMultiplier.saves` | 3 | Extra XP per save |
| `levelThresholds.*` | — | XP thresholds for each level |
| `qualityThresholds.*` | — | Min requirements per level |
| `sourceName` | "Dev.to" | Source label shown in articles |

---

## 🧩 Components V2 Structure

Each article message is built as a **Components V2** message:

```
┌───────────────────────────────────────┐
│ Container (accent color by level)     │
│                                       │
│ TextDisplay: Title + Description      │
│ ── Separator ──────────────────────   │
│ Section: Level, Category, Source,     │
│          Author (with avatar icon)    │
│ ── Separator ──────────────────────   │
│ TextDisplay: Time, Read time, Stars,  │
│              Reactions, Comments      │
│ ── Separator ──────────────────────   │
│ TextDisplay: #tags (if any)           │
│ ── Separator ──────────────────────   │
│ MediaGallery: Article cover image     │
└───────────────────────────────────────┘
ActionRow: [Read Article] [Profile] [Helpful]
ActionRow: [Trending] [Save] [Bot Info]
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Échec de l'interaction" | Bot response took too long — check console for errors |
| No articles posted | Run `/setup` to configure a channel, then `/forcefetch` |
| Bot not responding | Ensure intents are enabled in Developer Portal |
| Components not rendering | Update discord.js to latest: `npm install discord.js@latest` |

---

## 📄 License

MIT
