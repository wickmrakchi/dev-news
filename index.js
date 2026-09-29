const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ThumbnailBuilder,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
} = require("discord.js");
const config = require("./config");

const GUILDS_FILE = path.join(__dirname, "guilds.json");
const STATE_FILE = path.join(__dirname, "state.json");
const postedArticles = new Set();
const MAX_STORED_IDS = 100;
const DEFAULT_BANNER = "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800";
let cachedArticles = [];
let isPosting = false;
const BOT_COLOR = 0x6c63ff;

// ==================== TOPICS ====================
// Single source of truth for every article category: the /news filter menu,
// the emoji shown next to an article, the label used in embeds, the keyword
// matching and the description templates are all derived from this list.
const TOPICS = [
  { value: "javascript", label: "JavaScript", emoji: "🟨", description: "JavaScript & Node.js" },
  { value: "typescript", label: "TypeScript", emoji: "🔷", description: "Type safety and generics" },
  { value: "python", label: "Python", emoji: "🐍", description: "Python, Django, Flask" },
  { value: "react", label: "React", emoji: "⚛️", description: "React, Next.js" },
  { value: "vue", label: "Vue.js", emoji: "💚", description: "Vue, Nuxt" },
  { value: "angular", label: "Angular", emoji: "🔴", description: "Angular" },
  { value: "devops", label: "DevOps & Cloud", emoji: "⚙️", description: "Docker, K8s, AWS" },
  { value: "database", label: "Databases", emoji: "🗄️", description: "SQL, NoSQL, Redis" },
  { value: "security", label: "Security", emoji: "🔒", description: "Auth and security" },
  { value: "ai", label: "AI & ML", emoji: "🤖", description: "AI and machine learning" },
  { value: "mobile", label: "Mobile", emoji: "📱", description: "iOS, Android, Flutter" },
  { value: "rust", label: "Rust", emoji: "🦀", description: "Rust" },
  { value: "go", label: "Go", emoji: "🐹", description: "Golang" },
  { value: "webdev", label: "Web Dev", emoji: "🌐", description: "HTML, CSS, PWA" },
];

const DEFAULT_TOPIC = {
  value: "other",
  label: "General",
  emoji: "📰",
  description: "Anything else worth reading",
};

// Shown under the title on the card, one per topic.
const TOPIC_TEMPLATES = {
  javascript: "This article explores modern JavaScript concepts, from ES6+ to advanced patterns, helping you write cleaner and more efficient code.",
  typescript: "TypeScript brings type safety to JavaScript. Explore advanced types, generics, and patterns for production-grade code.",
  python: "Python continues to dominate with its versatility. This piece covers the latest developments, libraries, and best practices in the Python ecosystem.",
  react: "Dive into React development with patterns covering hooks, state management, performance optimization, and component architecture.",
  vue: "Vue.js keeps evolving with powerful features. This article explores the Composition API, reactivity, and scalable patterns.",
  angular: "Angular remains a robust framework for enterprise apps. This covers the latest features, DI patterns, and optimization strategies.",
  devops: "DevOps practices are essential for modern teams. This covers CI/CD, containerization, IaC, and cloud-native patterns.",
  database: "Database design is critical for performance. This covers SQL optimization, NoSQL patterns, and data modeling best practices.",
  security: "Security should never be an afterthought. This explores common vulnerabilities, auth patterns, and defense strategies.",
  ai: "AI is transforming development. This covers practical ML implementations, LLM integration, and modern AI tooling.",
  mobile: "Mobile development keeps evolving. This covers cross-platform frameworks, native patterns, and app architecture.",
  rust: "Rust offers memory safety without a GC. This explores ownership, concurrency, and systems programming patterns.",
  go: "Go excels at concurrent backend services. This covers goroutines, channels, and building scalable microservices.",
  webdev: "Web development evolves fast. This covers responsive design, performance, PWA patterns, and modern CSS/HTML techniques.",
  other: "A valuable resource for developers looking to level up their skills and stay current with industry trends.",
};

// dev.to tags are written in many shapes, so each one is normalized to a
// single canonical form before matching. "ai" and "ml" are machine learning
// tags, while "rails" and "digi" are not: matching on substrings is what used
// to misclassify a Rails article as AI.
const TAG_ALIASES = {
  "node.js": "node",
  "nodejs": "node",
  "node js": "node",
  "next.js": "nextjs",
  "nextjs": "nextjs",
  "vue.js": "vue",
  "vuejs": "vue",
  nuxt: "vue",
  "nuxt.js": "vue",
  "next.js/react": "react",
  "react.js": "react",
  "reactjs": "react",
  "react native": "mobile",
  "react-native": "mobile",
  "flutter/dart": "flutter",
  "dart": "flutter",
  "ci/cd": "devops",
  cicd: "devops",
  "github actions": "devops",
  "machine learning": "ai",
  "deep learning": "ai",
  "artificial intelligence": "ai",
  "generative ai": "ai",
  "chatgpt": "ai",
  "large language models": "ai",
  "llms": "ai",
  "web development": "webdev",
  web: "webdev",
  "front end": "webdev",
  "front-end": "webdev",
  frontend: "webdev",
  "back end": "webdev",
  "back-end": "webdev",
  backend: "webdev",
  fullstack: "webdev",
  pwa: "webdev",
  postgres: "database",
  postgresql: "database",
  mongodb: "database",
  nosql: "database",
  mysql: "database",
  sqlite: "database",
  redis: "database",
  "system design": "architecture",
  "cloud computing": "cloud",
  "aws": "cloud",
  "google cloud": "cloud",
  gcp: "cloud",
  azure: "cloud",
  k8s: "kubernetes",
  kubernetes: "kubernetes",
  golang: "go",
  "web security": "security",
  "appsec": "security",
  "social engineering": "security",
  "web3": "web3",
  blockchain: "web3",
  "prompt engineering": "ai",
};

const TAG_KEYWORDS = {
  javascript: ["javascript", "js", "es6", "ecmascript"],
  typescript: ["typescript", "ts"],
  python: ["python", "django", "flask", "fastapi"],
  react: ["react", "nextjs", "remix"],
  vue: ["vue", "nuxt"],
  angular: ["angular"],
  devops: ["devops", "docker", "kubernetes", "ci/cd", "cloud", "deploy"],
  database: ["database", "sql", "postgres", "mongodb", "redis", "orm"],
  security: ["security", "auth", "oauth", "jwt", "encryption"],
  ai: ["ai", "ml", "llm", "gpt", "openai"],
  mobile: ["mobile", "ios", "android", "flutter", "swift", "kotlin"],
  rust: ["rust"],
  go: ["go", "golang"],
  webdev: ["html", "css", "responsive", "http"],
};

function normalizeTag(tag) {
  const key = String(tag).toLowerCase().trim();
  return TAG_ALIASES[key] || key;
}

function normalizeTags(tags) {
  return Array.from(
    new Set((tags || []).map(normalizeTag).filter((tag) => tag.length > 0))
  );
}

// Returns the topic whose keywords best describe this article, based on how
// many of its tags match. Returns null when nothing matches.
function findTopic(article) {
  const tags = new Set(normalizeTags(article.tag_list));
  if (tags.size === 0) return null;

  let best = null;
  let bestScore = 0;

  for (const [value, keywords] of Object.entries(TAG_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (tags.has(keyword)) score += 1;
    }
    // An exact tag hit outranks a keyword that is only a substring of it.
    if (tags.has(value)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = value;
    }
  }

  if (!best) return null;

  const title = String(article.title || "").toLowerCase();
  if (bestScore === 1 && title.includes(best)) return null;

  return best;
}

function getTopic(value) {
  return TOPICS.find((topic) => topic.value === value) || DEFAULT_TOPIC;
}

function getEmojiForArticle(article) {
  const topic = findTopic(article);
  return topic ? getTopic(topic).emoji : DEFAULT_TOPIC.emoji;
}

function extractCategory(article) {
  const topic = findTopic(article);
  return topic ? getTopic(topic).label : DEFAULT_TOPIC.label;
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.substring(0, max).trim() + "..." : str;
}

// ==================== PERSISTENCE ====================
function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    }
  } catch (e) {
    console.error(`Error reading ${path.basename(file)}:`, e.message);
  }
  return fallback;
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`Error writing ${path.basename(file)}:`, e.message);
  }
}

// ==================== GUILD CONFIG ====================
let guildConfigs = readJson(GUILDS_FILE, {});

function saveGuildConfigs() {
  writeJson(GUILDS_FILE, guildConfigs);
}

function getChannelsForGuild(guildId) {
  const cfg = guildConfigs[guildId];
  return cfg && Array.isArray(cfg.channels) ? cfg.channels : [];
}

function setChannelsForGuild(guildId, channels) {
  if (!guildConfigs[guildId]) guildConfigs[guildId] = {};
  guildConfigs[guildId].channels = channels;
  saveGuildConfigs();
}

function removeGuildConfig(guildId) {
  if (guildConfigs[guildId]) {
    delete guildConfigs[guildId];
    saveGuildConfigs();
  }
}

// ==================== EXPERIENCE SYSTEM ====================
class ExperienceSystem {
  constructor() {
    this.xp = 0;
    this.level = "new";
    this.articlesPosted = 0;
    this.totalReactions = 0;
    this.totalComments = 0;
  }

  // Restores the counters from disk so leveling survives a restart.
  load(state) {
    if (!state) return;
    this.xp = Number(state.xp) || 0;
    this.articlesPosted = Number(state.articlesPosted) || 0;
    this.totalReactions = Number(state.totalReactions) || 0;
    this.totalComments = Number(state.totalComments) || 0;
    this.level = this.getLevel(this.xp);
  }

  toJSON() {
    return {
      xp: this.xp,
      articlesPosted: this.articlesPosted,
      totalReactions: this.totalReactions,
      totalComments: this.totalComments,
    };
  }

  getLevel(xp) {
    if (xp >= config.levelThresholds.expert) return "expert";
    if (xp >= config.levelThresholds.experienced) return "experienced";
    if (xp >= config.levelThresholds.learning) return "learning";
    return "new";
  }

  getLevelLabel(level) {
    const labels = {
      new: "Newcomer",
      learning: "Learning",
      experienced: "Experienced",
      expert: "Expert",
    };
    return labels[level] || "Newcomer";
  }

  getLevelColor(level) {
    const colors = { new: 0x808080, learning: 0x4caf50, experienced: 0x2196f3, expert: 0xff9800 };
    return colors[level] || 0x808080;
  }

  getLevelProgress() {
    const thresholds = [
      0,
      config.levelThresholds.learning,
      config.levelThresholds.experienced,
      config.levelThresholds.expert,
    ];
    const levelNames = ["new", "learning", "experienced", "expert"];
    const idx = levelNames.indexOf(this.level);
    const currentMin = thresholds[idx];
    const nextMin = thresholds[idx + 1];
    if (nextMin === undefined) return 100;
    const progress = Math.min(1, Math.max(0, (this.xp - currentMin) / (nextMin - currentMin)));
    return Math.floor(progress * 100);
  }

  getLevelEmoji(level) {
    const emojis = { new: "🌱", learning: "📚", experienced: "💪", expert: "🔥" };
    return emojis[level] || "🌱";
  }

  calculateXP(article) {
    const reactions = article.public_reactions_count || 0;
    const comments = article.comments_count || 0;
    // dev.to's public API does not expose a saves count, so saving a post
    // cannot be scored separately from reacting to it.
    const xpGained =
      config.xpPerArticle +
      reactions * config.xpMultiplier.reactions +
      comments * config.xpMultiplier.comments;
    return Math.floor(xpGained);
  }

  addXP(xpGained, article) {
    this.xp += xpGained;
    this.articlesPosted += 1;
    this.totalReactions += article.public_reactions_count || 0;
    this.totalComments += article.comments_count || 0;
    const newLevel = this.getLevel(this.xp);
    const levelChanged = newLevel !== this.level;
    this.level = newLevel;
    return { xpGained, newLevel, levelChanged };
  }

  getQualityThreshold() {
    return config.qualityThresholds[this.level];
  }

  meetsQualityThreshold(article) {
    const threshold = this.getQualityThreshold();
    const reactions = article.public_reactions_count || 0;
    const comments = article.comments_count || 0;
    const readingTime = article.reading_time_minutes || 0;
    return (
      reactions >= threshold.minReactions &&
      comments >= threshold.minComments &&
      readingTime >= threshold.minReadingTime
    );
  }
}

const experienceSystem = new ExperienceSystem();

// The posted article ids and the XP counters are restored on boot, otherwise
// the bot forgets everything and reposts the whole feed after each restart.
const persistedState = readJson(STATE_FILE, null);
if (persistedState) {
  if (Array.isArray(persistedState.postedArticles)) {
    for (const id of persistedState.postedArticles) postedArticles.add(id);
  }
  experienceSystem.load(persistedState.experience);
}

function saveState() {
  writeJson(STATE_FILE, {
    postedArticles: Array.from(postedArticles),
    experience: experienceSystem.toJSON(),
  });
}

// ==================== DESCRIPTION GENERATOR ====================
class DescriptionGenerator {
  constructor() {
    this.techPrefixes = [
      "python", "javascript", "typescript", "react", "vue", "angular",
      "node", "rust", "go", "java", "c++", "php", "ruby",
    ];
  }

  findMatchingTopic(article) {
    const topic = findTopic(article);
    if (topic) return topic;

    const tags = new Set(normalizeTags(article.tag_list));
    if (tags.has("node")) return "node";

    return "other";
  }

  generateDescription(title, tags) {
    let description = TOPIC_TEMPLATES[this.findMatchingTopic({ title, tag_list: tags })];

    const titleLower = String(title || "").toLowerCase();
    for (const tech of this.techPrefixes) {
      if (titleLower.includes(tech)) {
        description = `${tech.charAt(0).toUpperCase() + tech.slice(1)} developers will find this particularly valuable. ${description}`;
        break;
      }
    }

    return truncate(description, 300);
  }
}

const descriptionGenerator = new DescriptionGenerator();

// ==================== CLIENT ====================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// ==================== UTILITY FUNCTIONS ====================
async function fetchDevNews() {
  try {
    const res = await fetch("https://dev.to/api/articles?per_page=60&top=7", {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": `${config.sourceName} Discord bot` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const articles = await res.json();
    cachedArticles = articles;
    return articles;
  } catch (e) {
    console.error("Fetch error:", e.message);
    return [];
  }
}

function formatRelativeTime(dateString) {
  if (!dateString) return "Unknown";
  const diff = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

function calcTechScore(article) {
  const score = ((article.public_reactions_count || 0) * 1.5) + ((article.comments_count || 0) * 2) + ((article.reading_time_minutes || 1) * 0.5);
  if (score >= 200) return 5;
  if (score >= 100) return 4;
  if (score >= 50) return 3;
  if (score >= 20) return 2;
  return 1;
}

function stars(r) {
  return "⭐".repeat(r) + "☆".repeat(5 - r);
}

function formatTags(tagList) {
  if (!tagList || tagList.length === 0) return "";
  return tagList.slice(0, 5).map((t) => `#${t}`).join(" ");
}

function matchesCategory(article, value) {
  if (value === "all") return true;
  return findTopic(article) === value;
}

function getAvatarForLevel(level) {
  const map = { new: 3, learning: 2, experienced: 1, expert: 1 };
  return `https://cdn.discordapp.com/embed/avatars/${map[level] || 3}.png`;
}

// ==================== COMPONENTS V2 BUILDERS ====================
function buildArticleMessage(article) {
  const emoji = getEmojiForArticle(article);
  const category = extractCategory(article);
  const score = calcTechScore(article);
  const relTime = formatRelativeTime(article.published_at);
  const desc = descriptionGenerator.generateDescription(article.title, article.tag_list);
  const levelLabel = experienceSystem.getLevelLabel(experienceSystem.level);
  const levelEmoji = experienceSystem.getLevelEmoji(experienceSystem.level);
  const levelColor = experienceSystem.getLevelColor(experienceSystem.level);
  const imageUrl = article.cover_image || DEFAULT_BANNER;
  const author = article.user?.name || "Unknown";
  const readTime = article.reading_time_minutes || 0;
  const tags = formatTags(article.tag_list);

  const container = new ContainerBuilder()
    .setAccentColor(levelColor)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(`# ${emoji} ${article.title}\n\n${desc}`)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(2).setDivider(true)
    )
    .addSectionComponents(
      new SectionBuilder()
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(getAvatarForLevel(experienceSystem.level)))
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(
              `${levelEmoji} **Level:** ${levelLabel}\n` +
              `📁 **Category:** ${category}\n` +
              `📊 **Source:** ${config.sourceName}\n` +
              `✍️ **Author:** ${author}`
            )
        )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(2).setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          `⏰ ${relTime}　·　📖 ${readTime} min read\n` +
          `${stars(score)} **${score}/5**　·　` +
          `❤️ ${article.public_reactions_count || 0}　💬 ${article.comments_count || 0}`
        )
    );

  if (tags) {
    container
      .addSeparatorComponents(new SeparatorBuilder().setSpacing(2).setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🏷️ ${tags}`));
  }

  container
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(2).setDivider(true))
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(imageUrl).setDescription(article.title)
      )
    );

  return container;
}

function buildArticleButtons(article) {
  const username = article.user?.username;
  const r1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("📖 Read Article").setStyle(ButtonStyle.Link).setURL(article.url),
    username
      ? new ButtonBuilder().setLabel("👤 View Profile").setStyle(ButtonStyle.Link).setURL(`https://dev.to/${username}`)
      : new ButtonBuilder().setLabel("👤 No Profile").setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setLabel("👍 Helpful").setStyle(ButtonStyle.Secondary).setCustomId(`act_helpful_${article.id}`),
  );
  const r2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("🔥 Trending").setStyle(ButtonStyle.Danger).setCustomId(`act_trending_${article.id}`),
    new ButtonBuilder().setLabel("💾 Save").setStyle(ButtonStyle.Success).setCustomId(`act_save_${article.id}`),
    new ButtonBuilder().setLabel("🤖 Bot Info").setStyle(ButtonStyle.Primary).setCustomId(`act_botinfo_${article.id}`),
  );
  return [r1, r2];
}

function buildCategoryMenu(currentCategory = "all", page = 0) {
  const options = [
    new StringSelectMenuOptionBuilder()
      .setLabel("📰 All")
      .setValue("all")
      .setDescription("Every article")
      .setEmoji("📰")
      .setDefault(currentCategory === "all"),
    ...TOPICS.map((topic) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(topic.label)
        .setValue(topic.value)
        .setDescription(topic.description)
        .setEmoji(topic.emoji)
        .setDefault(topic.value === currentCategory)
    ),
  ];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`cat|${currentCategory}|${page}`)
      .setPlaceholder(currentCategory === "all" ? "📰 All articles" : `${getTopic(currentCategory).emoji} ${getTopic(currentCategory).label}`)
      .addOptions(options)
  );
}

function buildPagination(category, page, total) {
  const row = new ActionRowBuilder();
  if (page > 0) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel("◀ Previous")
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`pg|prev|${category}|${page}`)
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setLabel(`📄 Page ${page + 1} / ${total}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
      .setCustomId("pg|info")
  );
  if (page < total - 1) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel("Next ▶")
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`pg|next|${category}|${page}`)
    );
  }
  return row;
}

function buildStatsContainer() {
  const es = experienceSystem;
  const levelLabel = es.getLevelLabel(es.level);
  const emoji = es.getLevelEmoji(es.level);
  const progress = es.getLevelProgress();
  const threshold = es.getQualityThreshold();
  return new ContainerBuilder()
    .setAccentColor(BOT_COLOR)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          `# 🤖 Bot Statistics\n\n` +
          `${emoji} **Level:** ${levelLabel}\n` +
          `⚡ **XP:** ${es.xp}　|　**Progress:** ${progress}%\n` +
          `📝 **Articles:** ${es.articlesPosted}\n` +
          `❤️ **Reactions:** ${es.totalReactions}\n` +
          `💬 **Comments:** ${es.totalComments}\n` +
          `\`\`\`\nQuality Filter: Min ${threshold.minReactions} reactions, ${threshold.minComments} comments, ${threshold.minReadingTime} min read\n\`\`\``
        )
    );
}

function buildBotInfoContainer() {
  const es = experienceSystem;
  return new ContainerBuilder()
    .setAccentColor(BOT_COLOR)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          `# 🤖 Dev News Bot\n\n` +
          `${es.getLevelEmoji(es.level)} **Level:** ${es.getLevelLabel(es.level)}\n` +
          `⚡ **XP:** ${es.xp}\n` +
          `📝 **Articles:** ${es.articlesPosted}\n` +
          `🎯 **Quality Threshold:** ${JSON.stringify(es.getQualityThreshold())}\n\n` +
          `*Level up by posting quality articles with high engagement!*`
        )
    );
}

// ==================== SEND ARTICLE ====================
async function sendArticle(channel, article) {
  const container = buildArticleMessage(article);
  const buttons = buildArticleButtons(article);
  const msg = await channel.send({
    flags: MessageFlags.IsComponentsV2,
    components: [container, ...buttons],
  });
  try {
    const name = `📰 ${truncate(article.title, 80)}`;
    await msg.startThread({ name, autoArchiveDuration: 1440 });
  } catch (_) {
    // Thread creation may fail silently
  }
}

// ==================== POST NEWS ====================
async function postNews() {
  // The interval can fire again while a previous run is still posting, which
  // would send the same article twice. Only one run at a time is allowed.
  if (isPosting) {
    console.log("Previous post still running, skipping this cycle.");
    return;
  }
  isPosting = true;

  try {
    const allChannels = new Set();
    for (const gid of Object.keys(guildConfigs)) {
      for (const cid of getChannelsForGuild(gid)) {
        let ch = client.channels.cache.get(cid);
        if (!ch) {
          try {
            ch = await client.channels.fetch(cid);
          } catch (e) {
            console.error(`Cannot access channel ${cid}:`, e.message);
            continue;
          }
        }
        if (ch) allChannels.add(ch);
      }
    }

    if (allChannels.size === 0) {
      console.log("No configured channels found. Use /setup to configure.");
      return;
    }

    const articles = await fetchDevNews();
    if (articles.length === 0) return;

    let newPosts = 0;
    let skipped = 0;

    for (const article of articles) {
      if (postedArticles.has(article.id)) continue;
      if (!experienceSystem.meetsQualityThreshold(article)) {
        skipped++;
        continue;
      }

      // An article counts once, no matter how many channels it goes to.
      addPostedArticle(article.id);
      saveState();

      const xp = experienceSystem.calculateXP(article);
      const result = experienceSystem.addXP(xp, article);
      saveState();
      newPosts++;

      for (const ch of allChannels) {
        try {
          await sendArticle(ch, article);
        } catch (e) {
          console.error("Post error:", e.message);
        }
      }

      const log = `Posted: ${article.title.substring(0, 60)}`;
      console.log(
        result.levelChanged
          ? `${log} | LEVEL UP → ${result.newLevel} (${experienceSystem.xp} XP)`
          : `${log} | +${xp} XP`
      );
    }

    console.log(`Done. New: ${newPosts}, Skipped: ${skipped}, Total tracked: ${postedArticles.size}`);
  } catch (e) {
    console.error("postNews error:", e.message);
  } finally {
    isPosting = false;
  }
}

function addPostedArticle(id) {
  postedArticles.add(id);
  if (postedArticles.size > MAX_STORED_IDS) {
    const it = postedArticles.values();
    postedArticles.delete(it.next().value);
  }
}

// ==================== BROWSE NEWS ====================
async function sendNewsBrowse(interaction, category = "all", page = 0) {
  const articles = cachedArticles.length > 0 ? cachedArticles : await fetchDevNews();
  const filtered = articles.filter((a) => matchesCategory(a, category));

  if (filtered.length === 0) {
    const empty = new ContainerBuilder()
      .setAccentColor(BOT_COLOR)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent("# 😅 No articles found\n\nNo articles match this category. Try another one!")
      );
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [empty, buildCategoryMenu(category, 0)],
    });
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / 3));
  const p = Math.min(Math.max(0, page), totalPages - 1);
  const start = p * 3;
  const pageItems = filtered.slice(start, start + 3);

  const cat = category === "all" ? { emoji: "📰", label: "All" } : getTopic(category);
  const header = new ContainerBuilder()
    .setAccentColor(BOT_COLOR)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          `# 📰 Dev News Browser\n` +
          `${cat.emoji} **${cat.label}**　·　${filtered.length} articles　·　Page ${p + 1}/${totalPages}\n\n` +
          `*Select a category to filter articles*`
        )
    );

  const items = pageItems.map((a, i) => {
    const em = getEmojiForArticle(a);
    const cat_ = extractCategory(a);
    const time = formatRelativeTime(a.published_at);
    const sc = calcTechScore(a);
    const n = start + i + 1;
    const au = a.user?.name || "Unknown";
    return new ContainerBuilder()
      .setAccentColor(BOT_COLOR)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            `**${n}. ${em} [${truncate(a.title, 80)}](${a.url})**\n` +
            `👤 ${au}　·　${time}　·　📖 ${a.reading_time_minutes || 0} min\n` +
            `${stars(sc)}　📁 ${cat_}`
          )
      );
  });

  const components = [header, buildCategoryMenu(category, p), ...items];
  if (totalPages > 1) components.push(buildPagination(category, p, totalPages));

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    components,
  });
}

// ==================== SLASH COMMANDS ====================
const slashCommands = [
  { name: "news", description: "Browse and filter Dev.to news by category" },
  { name: "stats", description: "View bot statistics and experience level" },
  { name: "setup", description: "Set the news channel for this server (Admin only)" },
  { name: "forcefetch", description: "Force fetch and post the latest news (Admin only)" },
];

async function registerSlashCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(config.botToken);
    await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
    console.log("Slash commands registered!");
  } catch (e) {
    console.error("Register commands error:", e.message);
  }
}

// ==================== INTERACTION HANDLER ====================
client.on("interactionCreate", async (interaction) => {
  try {
    // ===== COMMANDS =====
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "news") {
        await interaction.deferReply();
        await sendNewsBrowse(interaction, "all", 0);
        return;
      }

      if (interaction.commandName === "stats") {
        await interaction.reply({
          flags: MessageFlags.IsComponentsV2,
          components: [buildStatsContainer()],
        });
        return;
      }

      if (interaction.commandName === "forcefetch") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: "❌ Admin only.", ephemeral: true });
          return;
        }
        await interaction.reply("🔄 Fetching latest news...");
        await postNews();
        await interaction.editReply("✅ Done! News posted to all configured channels.");
        return;
      }

      if (interaction.commandName === "setup") {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          await interaction.reply({ content: "❌ Admin only.", ephemeral: true });
          return;
        }

        const guildId = interaction.guildId;
        const channels = getChannelsForGuild(guildId);

        const setupContainer = new ContainerBuilder()
          .setAccentColor(BOT_COLOR)
          .addTextDisplayComponents(
            new TextDisplayBuilder()
              .setContent(
                `# ⚙️ News Channel Setup\n\n` +
                `**Current channel:** ${channels.length > 0 ? `<#${channels[0]}>` : "None"}\n\n` +
                `Select a channel below to receive Dev.to news updates.`
              )
          );

        const channelOptions = interaction.guild.channels.cache
          .filter((ch) => ch.type === 0 && ch.viewable)
          .map((ch) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`#${ch.name}`)
              .setValue(ch.id)
              .setDescription(`Post news to #${ch.name}`)
          )
          .slice(0, 25);

        if (channelOptions.length === 0) {
          await interaction.reply({ content: "❌ No text channels available.", ephemeral: true });
          return;
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId("setup|channel")
          .setPlaceholder("Choose a text channel...")
          .addOptions(channelOptions);

        await interaction.reply({
          flags: MessageFlags.IsComponentsV2,
          components: [setupContainer, new ActionRowBuilder().addComponents(menu)],
          ephemeral: true,
        });
        return;
      }
    }

    // ===== SELECT MENUS =====
    if (interaction.isStringSelectMenu()) {
      const parts = interaction.customId.split("|");

      if (parts[0] === "cat") {
        await interaction.deferUpdate();
        await sendNewsBrowse(interaction, interaction.values[0], 0);
        return;
      }

      if (parts[0] === "setup" && parts[1] === "channel") {
        const selectedChannelId = interaction.values[0];
        setChannelsForGuild(interaction.guildId, [selectedChannelId]);

        const confirm = new ContainerBuilder()
          .setAccentColor(0x4caf50)
          .addTextDisplayComponents(
            new TextDisplayBuilder()
              .setContent(
                `# ✅ Setup Complete!\n\n` +
                `News will be posted to <#${selectedChannelId}>.\n` +
                `Use \`/setup\` anytime to change channels.`
              )
          );
        await interaction.update({
          flags: MessageFlags.IsComponentsV2,
          components: [confirm],
        });
        return;
      }
    }

    // ===== BUTTONS =====
    if (interaction.isButton()) {
      const id = interaction.customId;
      const parts = id.split("|");

      if (parts[0] === "pg") {
        // pg|prev|category|page  or  pg|next|category|page
        if (parts[1] === "prev" || parts[1] === "next") {
          const category = parts[2];
          const currPage = parseInt(parts[3], 10);
          const newPage = parts[1] === "next" ? currPage + 1 : currPage - 1;
          await interaction.deferUpdate();
          await sendNewsBrowse(interaction, category, newPage);
          return;
        }
        if (parts[1] === "info") return; // disabled button
      }

      // action buttons use "_" as separator: act_<action>_<articleId>
      if (id.startsWith("act_")) {
        const actionType = id.split("_")[1];
        if (actionType === "helpful") {
          await interaction.reply({ content: "👍 Thanks for your feedback!", ephemeral: true });
        } else if (actionType === "trending") {
          await interaction.reply({ content: "🔥 Marked as trending!", ephemeral: true });
        } else if (actionType === "save") {
          await interaction.reply({ content: "💾 Article saved to your collection!", ephemeral: true });
        } else if (actionType === "botinfo") {
          await interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [buildBotInfoContainer()],
            ephemeral: true,
          });
        }
        return;
      }
    }
  } catch (e) {
    console.error("Interaction error:", e.message, e.stack?.substring(0, 200));
    try {
      if (interaction.deferred || interaction.replied) {
        // The original message may be a Components V2 one, and those cannot
        // be edited with plain content.
        await interaction.editReply({
          flags: MessageFlags.IsComponentsV2,
          components: [
            new ContainerBuilder()
              .setAccentColor(0xe74c3c)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent("# ❌ Something went wrong\nThe command could not be completed. Please try again.")
              ),
          ],
        });
      } else {
        await interaction.reply({ content: "❌ Something went wrong.", ephemeral: true });
      }
    } catch (replyError) {
      console.error("Could not deliver the error message:", replyError.message);
    }
  }
});

// ==================== BOT READY ====================
// "ready" fires again after every reconnect, so a plain on() handler would
// register a second interval each time and post news twice as often.
client.once("ready", async () => {
  console.log(`✅ Bot online as ${client.user.username}`);
  console.log(`🌐 Serving ${client.guilds.cache.size} servers`);
  console.log(`📊 Level: ${experienceSystem.level} | XP: ${experienceSystem.xp} | Tracked: ${postedArticles.size}`);
  await registerSlashCommands();
  await fetchDevNews();
  await postNews();
  setInterval(postNews, config.fetchInterval);
  console.log(`⏰ Auto-fetch every ${config.fetchInterval / 60000} min`);
});

// ==================== GUILD EVENTS ====================
client.on("guildCreate", async (guild) => {
  console.log(`➕ Added to server: ${guild.name} (${guild.id})`);
  if (!guildConfigs[guild.id]) {
    setChannelsForGuild(guild.id, []);
  }
});

// Without this, the bot keeps the settings of servers it was removed from and
// keeps trying to reach channels it can no longer access.
client.on("guildDelete", async (guild) => {
  console.log(`➖ Removed from server: ${guild.name} (${guild.id})`);
  removeGuildConfig(guild.id);
});

process.on("uncaughtException", (e) => console.error("uncaughtException:", e.message));
process.on("unhandledRejection", (r) => console.error("unhandledRejection:", r));

client.login(config.botToken);
