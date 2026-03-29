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
