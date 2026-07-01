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
const postedArticles = new Set();
const MAX_STORED_IDS = 100;
const DEFAULT_BANNER = "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800";
let cachedArticles = [];
const BOT_COLOR = 0x6c63ff;

const CATEGORIES = [
  { value: "all", label: "All", emoji: "📰", description: "All articles" },
  { value: "javascript", label: "JavaScript", emoji: "🟨", description: "JavaScript, Frontend" },
  { value: "python", label: "Python", emoji: "🐍", description: "Python, Django, Flask" },
  { value: "typescript", label: "TypeScript", emoji: "🔷", description: "TypeScript" },
  { value: "react", label: "React", emoji: "⚛️", description: "React, Next.js" },
  { value: "vue", label: "Vue.js", emoji: "💚", description: "Vue, Nuxt" },
  { value: "angular", label: "Angular", emoji: "🔴", description: "Angular" },
  { value: "devops", label: "DevOps & Cloud", emoji: "⚙️", description: "Docker, K8s, AWS" },
  { value: "database", label: "Databases", emoji: "🗄️", description: "SQL, NoSQL, Redis" },
  { value: "security", label: "Security", emoji: "🔒", description: "Auth, Security" },
  { value: "ai", label: "AI & ML", emoji: "🤖", description: "AI, Machine Learning" },
  { value: "mobile", label: "Mobile", emoji: "📱", description: "iOS, Android, Flutter" },
  { value: "rust", label: "Rust", emoji: "🦀", description: "Rust" },
  { value: "go", label: "Go", emoji: "🐹", description: "Golang" },
];

const CATEGORY_KEYWORDS = {
  javascript: ["javascript", "js", "node", "frontend"],
  python: ["python", "django", "flask", "fastapi"],
  typescript: ["typescript", "ts"],
  react: ["react", "jsx", "tsx", "nextjs", "remix"],
  vue: ["vue", "nuxt", "vuejs"],
  angular: ["angular", "ng"],
  devops: ["devops", "docker", "kubernetes", "ci/cd", "aws", "cloud", "deploy"],
  database: ["database", "sql", "postgres", "mongodb", "redis", "orm"],
  security: ["security", "auth", "oauth", "jwt", "encryption"],
  ai: ["ai", "machine learning", "ml", "deep learning", "neural", "gpt", "llm", "openai"],
  mobile: ["mobile", "ios", "android", "flutter", "react-native", "swift"],
  rust: ["rust"],
  go: ["go", "golang"],
};

// ==================== GUILD CONFIG ====================
function loadGuildConfigs() {
  try {
    if (fs.existsSync(GUILDS_FILE)) {
      return JSON.parse(fs.readFileSync(GUILDS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Error loading guild configs:", e.message);
  }
  return {};
}

function saveGuildConfigs(guilds) {
  try {
    fs.writeFileSync(GUILDS_FILE, JSON.stringify(guilds, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving guild configs:", e.message);
  }
}

let guildConfigs = loadGuildConfigs();

function getChannelsForGuild(guildId) {
  const cfg = guildConfigs[guildId];
  return cfg && Array.isArray(cfg.channels) ? cfg.channels : [];
}

function setChannelsForGuild(guildId, channels) {
  if (!guildConfigs[guildId]) guildConfigs[guildId] = {};
  guildConfigs[guildId].channels = channels;
  saveGuildConfigs(guildConfigs);
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

  getLevel(xp) {
    if (xp >= config.levelThresholds.expert) return "expert";
    if (xp >= config.levelThresholds.experienced) return "experienced";
    if (xp >= config.levelThresholds.learning) return "learning";
    return "new";
  }

  getLevelBadge(level) {
    const badges = {
      new: "<:none:>",
      learning: "<:none:>",
      experienced: "<:none:>",
      expert: "<:none:>",
    };
    return badges[level] || "";
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
    const thresholds = [0, config.levelThresholds.learning, config.levelThresholds.experienced, config.levelThresholds.expert];
    const levelNames = ["new", "learning", "experienced", "expert"];
    const idx = levelNames.indexOf(this.level);
    const currentMin = thresholds[idx];
    const nextMax = thresholds[idx + 1] || currentMin + 200;
    const progress = Math.min(1, (this.xp - currentMin) / (nextMax - currentMin));
    return Math.floor(progress * 100);
  }

  getLevelEmoji(level) {
    const emojis = { new: "🌱", learning: "📚", experienced: "💪", expert: "🔥" };
    return emojis[level] || "🌱";
  }

  calculateXP(article) {
    const reactions = article.public_reactions_count || 0;
    const comments = article.comments_count || 0;
    const saves = article.public_reactions_count || 0;
    const xpGained = config.xpPerArticle +
      (reactions * config.xpMultiplier.reactions) +
      (comments * config.xpMultiplier.comments) +
      (saves * config.xpMultiplier.saves);
    this.totalReactions += reactions;
    this.totalComments += comments;
    this.articlesPosted++;
    return Math.floor(xpGained);
  }

  addXP(xpGained) {
    this.xp += xpGained;
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
    return reactions >= threshold.minReactions &&
      comments >= threshold.minComments &&
      readingTime >= threshold.minReadingTime;
  }
}

const experienceSystem = new ExperienceSystem();

// ==================== DESCRIPTION GENERATOR ====================
class DescriptionGenerator {
  constructor() {
    this.topicTemplates = {
      javascript: "This article explores modern JavaScript concepts, from ES6+ to advanced patterns, helping you write cleaner and more efficient code.",
      python: "Python continues to dominate with its versatility. This piece covers the latest developments, libraries, and best practices in the Python ecosystem.",
      react: "Dive into React development with patterns covering hooks, state management, performance optimization, and component architecture.",
      vue: "Vue.js keeps evolving with powerful features. This article explores the Composition API, reactivity, and scalable patterns.",
      angular: "Angular remains a robust framework for enterprise apps. This covers the latest features, DI patterns, and optimization strategies.",
      node: "Node.js powers modern backends. This covers async patterns, performance tuning, API design, and the evolving ecosystem.",
      typescript: "TypeScript brings type safety to JavaScript. Explore advanced types, generics, and patterns for production-grade code.",
      devops: "DevOps practices are essential for modern teams. This covers CI/CD, containerization, IaC, and cloud-native patterns.",
      database: "Database design is critical for performance. This covers SQL optimization, NoSQL patterns, and data modeling best practices.",
      security: "Security should never be an afterthought. This explores common vulnerabilities, auth patterns, and defense strategies.",
      ai: "AI is transforming development. This covers practical ML implementations, LLM integration, and modern AI tooling.",
      webdev: "Web development evolves fast. This covers responsive design, performance, PWA patterns, and modern CSS/HTML techniques.",
      rust: "Rust offers memory safety without a GC. This explores ownership, concurrency, and systems programming patterns.",
      go: "Go excels at concurrent backend services. This covers goroutines, channels, and building scalable microservices.",
      mobile: "Mobile development keeps evolving. This covers cross-platform frameworks, native patterns, and app architecture.",
      default: "A valuable resource for developers looking to level up their skills and stay current with industry trends.",
    };

    this.keywordMap = {
      javascript: ["javascript", "js", "node", "frontend", "react", "vue", "angular"],
      python: ["python", "django", "flask", "fastapi"],
      react: ["react", "jsx", "tsx", "nextjs", "remix"],
      vue: ["vue", "nuxt", "vuejs"],
      angular: ["angular", "ng"],
      node: ["node", "express", "backend", "api", "rest"],
      typescript: ["typescript", "ts"],
      devops: ["devops", "docker", "kubernetes", "ci/cd", "aws", "cloud", "deploy"],
      database: ["database", "sql", "postgres", "mongodb", "redis", "orm"],
      security: ["security", "auth", "oauth", "jwt", "encryption"],
      ai: ["ai", "machine learning", "ml", "deep learning", "neural", "gpt", "llm", "openai"],
      webdev: ["web", "html", "css", "responsive", "pwa", "http"],
      rust: ["rust"],
      go: ["go", "golang"],
      mobile: ["mobile", "ios", "android", "flutter", "react-native", "swift"],
    };
  }

  findMatchingTopic(tags) {
    const tagString = (tags || []).join(" ").toLowerCase();
    for (const [topic, keywords] of Object.entries(this.keywordMap)) {
      for (const keyword of keywords) {
        if (tagString.includes(keyword)) return topic;
      }
    }
    return "default";
  }

  generateDescription(title, tags) {
    const topic = this.findMatchingTopic(tags);
    let description = this.topicTemplates[topic];
    const titleLower = title.toLowerCase();
    for (const tech of ["python", "javascript", "typescript", "react", "vue", "angular", "node", "rust", "go", "java", "c++", "php", "ruby"]) {
      if (titleLower.includes(tech)) {
        description = `${tech.charAt(0).toUpperCase() + tech.slice(1)} developers will find this particularly valuable. ${description}`;
        break;
      }
    }
    return description.substring(0, 300);
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
    const res = await fetch("https://dev.to/api/articles?per_page=60&top=7");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const articles = await res.json();
    cachedArticles = articles;
    return articles;
  } catch (e) {
    console.error("Fetch error:", e.message);
    return [];
  }
}

function getEmojiForTag(tags) {
  const map = {
    javascript: "🟨", python: "🐍", typescript: "🔷", react: "⚛️",
    vue: "💚", angular: "🔴", node: "🟢", rust: "🦀", go: "🐹",
    java: "☕", css: "🎨", html: "📄", webdev: "🌐", devops: "⚙️",
    database: "🗄️", security: "🔒", ai: "🤖", tutorial: "📚",
    news: "📰", discussion: "💭", beginner: "🌱", productivity: "⚡", mobile: "📱",
  };
  const s = (tags || []).join(" ").toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (s.includes(k)) return v;
  }
  return "📰";
}

function extractCategory(tags) {
  const map = [
    ["Python", ["python", "django", "flask"]],
    ["Web Dev", ["javascript", "typescript", "react", "vue", "angular", "html", "css", "webdev", "frontend", "backend"]],
    ["DevOps & Cloud", ["devops", "docker", "kubernetes", "aws", "cloud", "azure"]],
    ["Databases", ["database", "sql", "mongodb", "postgres", "redis"]],
    ["Security", ["security", "auth", "oauth", "jwt"]],
    ["AI & ML", ["ai", "machine-learning", "ml", "deep-learning", "gpt", "llm"]],
    ["Mobile", ["mobile", "ios", "android", "flutter", "react-native"]],
    ["General", ["programming", "code", "developer", "software"]],
  ];
  const s = (tags || []).join(" ").toLowerCase();
  for (const [label, kws] of map) {
    for (const kw of kws) {
      if (s.includes(kw)) return label;
    }
  }
  return "General";
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
  const kws = CATEGORY_KEYWORDS[value];
  if (!kws) return true;
  const s = (article.tag_list || []).join(" ").toLowerCase();
  const t = (article.title || "").toLowerCase();
  return kws.some((kw) => s.includes(kw) || t.includes(kw));
}

function getCategoryByValue(value) {
  return CATEGORIES.find((c) => c.value === value) || CATEGORIES[0];
}

function getAvatarForLevel(level) {
  const map = { expert: 0, experienced: 1, learning: 2, new: 3 };
  return `https://cdn.discordapp.com/embed/avatars/${map[level] || 3}.png`;
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.substring(0, max).trim() + "..." : str;
}

// ==================== COMPONENTS V2 BUILDERS ====================
function buildArticleMessage(article) {
  const emoji = getEmojiForTag(article.tag_list);
  const category = extractCategory(article.tag_list);
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

  const bgColor = levelColor === 0xff9800 ? 0x5865f2 : levelColor;

  const container = new ContainerBuilder()
    .setAccentColor(bgColor)
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
  const r1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("📖 Read Article").setStyle(ButtonStyle.Link).setURL(article.url),
    new ButtonBuilder().setLabel("👤 View Profile").setStyle(ButtonStyle.Link).setURL(`https://dev.to/${article.user?.username}`),
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
  const cat = getCategoryByValue(currentCategory);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`cat|${currentCategory}|${page}`)
    .setPlaceholder(`${cat.emoji} ${cat.label}`)
    .addOptions(
      CATEGORIES.map((c) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(c.label)
          .setValue(c.value)
          .setDescription(c.description)
          .setEmoji(c.emoji)
          .setDefault(c.value === currentCategory)
      )
    );
  return new ActionRowBuilder().addComponents(menu);
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
          `\`\`\`\nQuality Filter: Min ${es.getQualityThreshold().minReactions} reactions, ${es.getQualityThreshold().minComments} comments, ${es.getQualityThreshold().minReadingTime} min read\n\`\`\``
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
  try {
    const allChannels = new Set();
    for (const gid of Object.keys(guildConfigs)) {
      for (const cid of getChannelsForGuild(gid)) {
        let ch = client.channels.cache.get(cid);
        if (!ch) {
          try { ch = await client.channels.fetch(cid); } catch (_) { }
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
      if (!experienceSystem.meetsQualityThreshold(article)) { skipped++; continue; }

      for (const ch of allChannels) {
        try {
          await sendArticle(ch, article);
          if (!postedArticles.has(article.id)) {
            const xp = experienceSystem.calculateXP(article);
            const result = experienceSystem.addXP(xp);
            addPostedArticle(article.id);
            newPosts++;
            let log = `Posted: ${article.title.substring(0, 60)}`;
            log += result.levelChanged ? ` | LEVEL UP → ${result.newLevel} (${experienceSystem.xp} XP)` : ` | +${xp} XP`;
            console.log(log);
          }
        } catch (e) {
          console.error("Post error:", e.message);
        }
      }
    }
    console.log(`Done. New: ${newPosts}, Skipped: ${skipped}, Total tracked: ${postedArticles.size}`);
  } catch (e) {
    console.error("postNews error:", e.message);
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

  const totalPages = Math.ceil(filtered.length / 3);
  const p = Math.min(page, totalPages - 1);
  const start = p * 3;
  const pageItems = filtered.slice(start, start + 3);

  const cat = getCategoryByValue(category);
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
    const em = getEmojiForTag(a.tag_list);
    const cat_ = extractCategory(a.tag_list);
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

// ==================== PARSE CUSTOM ID ====================
function parseCustomId(id) {
  // cat|category|page
  // pg|prev|category|page
  // pg|next|category|page
  // act_helpful|1234 -> but these use _ as separator
  // pg|info
  const parts = id.split("|");
  return parts;
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
      const id = interaction.customId;
      const parts = parseCustomId(id);

      if (parts[0] === "cat") {
        // cat|category|page
        const categoryValue = interaction.values[0];
        await interaction.deferUpdate();
        await sendNewsBrowse(interaction, categoryValue, 0);
        return;
      }

      if (parts[0] === "setup" && parts[1] === "channel") {
        const selectedChannelId = interaction.values[0];
        const guildId = interaction.guildId;
        setChannelsForGuild(guildId, [selectedChannelId]);

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
      const parts = parseCustomId(id);

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

      // action buttons (act_helpful, act_trending, act_save, act_botinfo)
      if (id.startsWith("act_")) {
        const partsAct = id.split("_");
        const actionType = partsAct[1];
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
        await interaction.editReply({ content: `❌ Error: ${e.message}` });
      } else {
        await interaction.reply({ content: `❌ Error: ${e.message}`, ephemeral: true });
      }
    } catch (_) { }
  }
});

// ==================== BOT READY ====================
client.on("ready", async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
  console.log(`🌐 Serving ${client.guilds.cache.size} servers`);
  console.log(`📊 Level: ${experienceSystem.level} | XP: ${experienceSystem.xp}`);
  await registerSlashCommands();
  await fetchDevNews();
  await postNews();
  setInterval(postNews, config.fetchInterval);
  console.log(`⏰ Auto-fetch every ${config.fetchInterval / 60000} min`);
});

// ==================== GUILD JOIN ====================
client.on("guildCreate", async (guild) => {
  console.log(`➕ Added to server: ${guild.name} (${guild.id})`);
  if (!guildConfigs[guild.id]) {
    setChannelsForGuild(guild.id, []);
  }
});

process.on("uncaughtException", (e) => console.error("uncaughtException:", e.message));
process.on("unhandledRejection", (r) => console.error("unhandledRejection:", r));

client.login(config.botToken);
