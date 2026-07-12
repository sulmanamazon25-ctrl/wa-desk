/** PM2 config for VPS marketing + billing API. See DEPLOY-VPS.md */
module.exports = {
  apps: [
    {
      name: "whatsapp-ai-desk",
      cwd: ".next/standalone",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1",
      },
      env_file: "../.env.production",
    },
  ],
};
