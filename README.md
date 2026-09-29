# Dev News Bot

A Discord bot that pulls developer articles from [dev.to](https://dev.to) and delivers them straight into your server as clean, interactive cards.

<div align="center">

<img src="https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square&logo=node.js" alt="Node.js">
<img src="https://img.shields.io/badge/discord.js-14-5865F2?style=flat-square&logo=discord&logoColor=white" alt="discord.js">
<img src="https://img.shields.io/badge/API-dev.to-0A0A0A?style=flat-square&logo=dev.to&logoColor=white" alt="dev.to">
<img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License">

</div>

---

## 📖 Table of Contents

- [What it does](#what-it-does)
- [Features](#features)
- [Commands](#commands)
- [Requirements](#requirements)
- [Setup guide](#setup-guide)
- [Configuration](#configuration)
- [How classification works](#how-classification-works)
- [How the XP system works](#how-the-xp-system-works)
- [Project files](#project-files)
- [Adding a new topic](#adding-a-new-topic)
- [Troubleshooting](#troubleshooting)
- [Technical notes](#technical-notes)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

---

## 🎯 What it does

The bot polls the dev.to public API for the top weekly articles, scores them, filters out the low-effort ones, and posts each one to the channel you selected — as a Discord **Components V2** card with a cover image, a topic badge, a star rating, and action buttons.

You can also browse the whole feed from inside Discord with `/news`, filter it by technology, and page through the results without ever leaving the server.

---

## ✨ Features

- 📰 **Automatic posting** of top dev.to articles on a configurable interval
- 🗂️ **14 topic filters** (JavaScript, Python, React, AI, DevOps…) in a single select menu
- 📄 **Built-in browser** with pagination — no links needed, everything stays in Discord
- ⭐ **Article scoring** from 1 to 5 stars, based on reactions, comments and reading time
- 🎚️ **Quality gate** that skips low-engagement posts, tightening as the bot levels up
- 🏅 **XP and leveling** — every posted article earns experience, with four levels
- 🔁 **Per-server channels** — each server picks its own channel with `/setup`
- 🛡️ **Permission-gated commands** — `/setup` and `/forcefetch` are admin-only
- 💾 **Persistent state** — XP, level and posted articles survive restarts
- 🧩 **Single source of truth** for topics — one list drives filters, emojis, labels and descriptions

---

## 🎮 Commands

| Command | Permission | What it does |
|---|---|---|
| `/news` | Everyone | Browse articles with category filters and pagination |
| `/stats` | Everyone | Bot level, XP, article count and the active quality filter |
| `/setup` | Administrator | Choose the channel this server receives news in |
| `/forcefetch` | Administrator | Fetch and post immediately instead of waiting for the next cycle |

---

## 📋 Requirements

- **Node.js 18 or newer**
- A **Discord bot token** (free, takes two minutes to create)
- No database is needed — everything is stored in local JSON files

---

## 🚀 Setup guide

### Step 1 — Create the application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and give it a name.
3. Open the **Bot** tab and click **Add Bot**.
4. Click **Reset Token** and copy it somewhere safe — you will only see it once.

### Step 2 — Enable intents

Still in the **Bot** tab, under **Privileged Gateway Intents**, enable:

- ✅ **Message Content Intent**

The bot only subscribes to `Guilds` and `GuildMessages`, so no other intent is required to run it as shipped.

### Step 3 — Install and configure

```bash
npm install
cp config.example.js config.js      # Windows: copy config.example.js config.js
```

Open `config.js` and paste your token:

```js
module.exports = {
  botToken: 'PASTE_YOUR_TOKEN_HERE',
  // everything else can stay at its default
};
```

### Step 4 — Invite the bot to your server

Build an invite URL at the **OAuth2 → URL Generator** page:

| Field | Value |
|---|---|
| Scopes | `bot`, `applications.commands` |
| Bot permissions | `View Channels`, `Send Messages`, `Embed Links` |

### Step 5 — Run it

```bash
npm start        # normal run
npm run dev      # with nodemon, restarts on every file change
```

On startup the bot registers its slash commands, which can take up to an hour to appear in a brand new application. Once it shows up:

1. Run `/setup` in a channel and pick where the news should go.
2. Run `/forcefetch` to post the current feed immediately.

That's it — from now on it posts on its own schedule.

---

## ⚙️ Configuration

Everything lives in `config.js`. Only `botToken` is required.

| Setting | Default | Description |
|---|---|---|
| `botToken` | — | **Required.** Your bot token |
| `fetchInterval` | `600000` | Milliseconds between fetches (10 minutes) |
| `xpPerArticle` | `10` | Base XP awarded per published article |
| `xpMultiplier.reactions` | `0.5` | XP per like |
| `xpMultiplier.comments` | `2` | XP per comment |
| `levelThresholds.new` | `0` | Starting level, always zero |
| `levelThresholds.learning` | `100` | XP needed to reach the second level |
| `levelThresholds.experienced` | `500` | XP needed for the third level |
| `levelThresholds.expert` | `1000` | XP needed for the fourth level |
| `qualityThresholds` | per level | Minimum reactions, comments and reading minutes required to publish |
| `sourceName` | `"Dev.to"` | Shown in the **Source** field of every card |

> dev.to's public API does not expose a save count, so saves cannot be scored separately from likes. There is no `saves` multiplier on purpose.

---

## 🗂️ How classification works

Every article is classified from its dev.to tags. The tags are first **normalized** so that different spellings collapse into one canonical value:

| Written as | Normalized to |
|---|---|
| `node.js`, `nodejs`, `Node JS` | `node` |
| `machine learning`, `deep learning`, `LLMs` | `ai` |
| `react-native`, `React Native` | `mobile` |
| `next.js`, `NextJS` | `nextjs` |
| `postgresql`, `mongodb`, `redis` | `database` |
| `k8s`, `kubernetes` | `kubernetes` |

Matching then works on **whole tag equality**, not on substring search. That difference matters: a substring search classifies a Rails article as AI (because `rails` contains `ai`) and a Django article as Go (because `django` contains `go`).

Each topic is scored by how many of its keywords appear in the tags, plus a bonus for an exact tag match, so the strongest signal wins. If nothing matches, the article is labelled **General** and is skipped by the publishing filter.

---

## 🏅 How the XP system works

The bot earns experience for every article it publishes, and levels up as it goes:

| Level | Label | XP needed |
|---|---|---|
| 🌱 | Newcomer | 0 |
| 📚 | Learning | 100 |
| 💪 | Experienced | 500 |
| 🔥 | Expert | 1000 |

```
XP = xpPerArticle + (reactions × 0.5) + (comments × 2)
```

The level does more than change a label — it also **tightens the quality filter**. A Newcomer bot will publish almost anything; an Expert bot only publishes articles with 50+ reactions, 10+ comments and 8+ minutes of reading. This means the feed naturally gets cleaner as the bot proves itself.

An article counts once, no matter how many channels it is delivered to. The level and its counters are saved in `state.json` and restored on boot.

---

## 📁 Project files

| File | Role |
|---|---|
| `index.js` | Everything: configuration, classification, message building, commands |
| `config.js` | Your settings — **never commit this** |
| `config.example.js` | The same file with placeholder values |
| `guilds.json` | The selected channel for each server |
| `state.json` | Posted article ids, XP, level and counters |

`config.js`, `guilds.json` and `state.json` are all listed in `.gitignore`, so a normal `git add .` will never leak your token.

---

## 🧪 Adding a new topic

The bot has one topic list at the top of `index.js`. To add, say, **Svelte**, add an entry to `TOPICS`:

```js
const TOPICS = [
  // ...
  { value: "svelte", label: "Svelte", emoji: "🔥", description: "Svelte, SvelteKit" },
];
```

Then register its keywords so articles can match it:

```js
const TAG_KEYWORDS = {
  // ...
  svelte: ["svelte", "sveltekit"],
};
```

Finally, if the article deserves its own description, add a template:

```js
const TOPIC_TEMPLATES = {
  // ...
  svelte: "Svelte compiles to tiny, fast apps. This covers reactivity, stores, and SvelteKit patterns.",
};
```

That is the whole change. The select menu, the emoji, the label and the descriptions are all derived from these three lists — no duplicated tables to keep in sync.

---

## 🩺 Troubleshooting

**Slash commands do not appear**
Discord caches commands globally. For a brand new application it can take up to an hour. Restarting the bot re-registers them immediately for that guild only.

**`Cannot find module './config'`**
You skipped Step 3. Run `cp config.example.js config.js` and add your token.

**`An invalid token was provided`**
The token in `config.js` is wrong, was reset, or belongs to a different application. Copy it again from the Developer Portal.

**`No configured channels found`**
No server has picked a channel yet. Run `/setup` inside the server you want to configure.

**The bot posts nothing**
Check `/stats` — it shows the quality filter currently active. At the Newcomer level the filter is wide open, so an empty result usually means dev.to returned nothing or every article was already posted.

**`DiscordAPIError[50001]: Missing Access`**
The bot is not in that server, or it lacks permission to post in that channel.

---

## 🔧 Technical notes

**One source of truth for topics.** `TOPICS`, `TAG_ALIASES`, `TAG_KEYWORDS` and `TOPIC_TEMPLATES` at the top of the file drive the filter menu, the emojis, the labels and the descriptions. An earlier version kept four parallel keyword tables that slowly drifted apart.

**State is persisted.** `state.json` stores posted article ids and the XP counters, so a restart no longer reposts the entire feed or resets the level.

**A single timer.** The bot uses `client.once("ready")` instead of `client.on("ready")`. `ready` fires again after every reconnect, and an `on` handler would register another interval each time, doubling the posting rate.

**One post at a time.** An `isPosting` guard skips a cycle if the previous one is still running, which prevents double posting when a cycle takes longer than `fetchInterval`.

**Requests cannot hang.** The dev.to fetch uses `AbortSignal.timeout`, so a stalled API can no longer freeze the bot.

**Error messages respect Components V2.** A Components V2 message cannot be edited with plain `content`, so failures are reported with a proper container instead of an edit that would silently fail.

---

## 🤝 Contributing

Pull requests are welcome. If you add a topic, everything lives in the three lists at the top of `index.js`.

There are no tests yet and no enforced boundaries — patches go straight in.

---

## 📄 License

MIT. Use it, modify it, ship it inside your own project, no problem.

---

## 👨‍💻 Author

<p align="center">
  <img src="https://img.shields.io/badge/Mrakchi.dev-000000?style=for-the-badge" alt="Hamza Mrakchi">
</p>


<p align="center">
  <b>Hamza Mrakchi</b> — Full-Stack Developer & System Architect
</p>


<p align="center">
  <a href="https://github.com/wickmrakchi">
    <img src="https://img.shields.io/badge/GitHub-wickmrakchi-181717?style=for-the-badge&logo=github" alt="GitHub">
  </a>
  <a href="https://www.instagram.com/mrakchi_5/">
    <img src="https://img.shields.io/badge/Instagram-@mrakchi__5-E4405F?style=for-the-badge&logo=instagram" alt="Instagram">
  </a>
  <a href="mailto:hessamgrati@gmail.com">
    <img src="https://img.shields.io/badge/Email-hessamgrati@gmail.com-D14836?style=for-the-badge&logo=gmail" alt="Email">
  </a>
  <a href="https://www.paypal.com/paypalme/Essamgrati">
    <img src="https://img.shields.io/badge/PayPal-Support%20the%20Project-00457C?style=for-the-badge&logo=paypal&logoColor=white" alt="PayPal">
  </a>
  <a href="https://discord.gg/VyX7RTWxm4">
    <img src="https://img.shields.io/badge/Discord-wicks-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord">
  </a>
</p>


---


<p align="center">
  <img src="https://img.shields.io/badge/⭐_Star_this_repo_if_you_found_it_useful!-FFD700?style=for-the-badge" alt="Star">
</p>
