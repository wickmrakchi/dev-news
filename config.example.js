module.exports = {
  botToken: 'YOUR_BOT_TOKEN_HERE',
  fetchInterval: 600000,
  xpPerArticle: 10,
  xpMultiplier: {
    reactions: 0.5,
    comments: 2,
    saves: 3,
  },
  levelThresholds: {
    new: 0,
    learning: 100,
    experienced: 500,
    expert: 1000,
  },
  qualityThresholds: {
    new: { minReactions: 0, minComments: 0, minReadingTime: 0 },
    learning: { minReactions: 5, minComments: 1, minReadingTime: 3 },
    experienced: { minReactions: 20, minComments: 5, minReadingTime: 5 },
    expert: { minReactions: 50, minComments: 10, minReadingTime: 8 },
  },
  sourceName: "Mrakchi.dev",
};
