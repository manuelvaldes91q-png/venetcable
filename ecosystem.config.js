module.exports = {
  apps: [{
    name: "venetcable",
    script: "node_modules/.bin/next",
    args: "start -p 7990",
    env: {
      NODE_OPTIONS: "--max-old-space-size=512",
      OPENROUTER_API_KEY: "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",
      DB_PATH: "./data/mikrotik-monitor.db",
    },
  }],
};
