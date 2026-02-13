export default {
  port: parseInt(process.env.MC_PORT) || 3847,
  dbUrl: process.env.NEON_DATABASE_URL,
  adminUser: process.env.MC_ADMIN_USER || 'irakli.digital@gmail.com',
  adminPass: process.env.MC_ADMIN_PASS || 'Digitalhub!986',
};
