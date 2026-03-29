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
