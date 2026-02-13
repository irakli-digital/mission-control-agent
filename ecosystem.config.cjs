module.exports = {
  apps: [
    {
      name: 'mc-api',
      script: 'api/server.js',
      cwd: __dirname,
      env: {
        NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
        MC_PORT: 3847,
        MC_ADMIN_USER: process.env.MC_ADMIN_USER || 'admin',
        MC_ADMIN_PASS: process.env.MC_ADMIN_PASS || 'admin',
      },
    },
    {
      name: 'mc-notify',
      script: 'api/notify-daemon.js',
      cwd: __dirname,
      env: {
        NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
      },
    },
  ],
};
