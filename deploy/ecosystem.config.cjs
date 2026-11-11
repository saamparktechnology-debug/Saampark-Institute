/**
 * PM2 Production Process Manager Configuration for Hostinger VPS (C-030)
 * Usage: pm2 start deploy/ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "argon-lms-backend",
      cwd: "./backend",
      script: "dist/server.js",
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        DEFAULT_TIMEZONE: "Asia/Kolkata",
      },
    },
    {
      name: "argon-lms-frontend",
      cwd: "./frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "768M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
