module.exports = {
  apps: [
    {
      name: 'mc-api',
      script: 'api/server.js',
      cwd: __dirname,
      env: {
        NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
        MC_PORT: 3847,
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
