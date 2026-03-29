module.exports = {
  apps: [{
    name: "venetcable",
    script: "node_modules/.bin/next",
    args: "start -p 7990",
    env: {
      NODE_OPTIONS: "--max-old-space-size=512",
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
      DB_PATH: "./data/mikrotik-monitor.db",
    },
  }],
};
