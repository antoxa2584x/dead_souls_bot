/**
 * PM2 process definition.
 *
 * Must be .cjs: package.json sets "type": "module", so a plain .js file here
 * would be parsed as ESM and PM2 expects CommonJS.
 *
 * IMPORTANT — fork mode with exactly one instance.
 * Telegram allows only one long-polling consumer per bot token. Running this
 * under PM2's cluster mode (or `-i 2`) makes every instance call getUpdates,
 * and Telegram answers all but one with:
 *     409: Conflict: terminated by other getUpdates request
 * The bot would then flap between instances and drop updates. better-sqlite3
 * is likewise happiest with a single writer.
 */
module.exports = {
  apps: [
    {
      name: 'dead-souls',
      script: 'dist/index.js',
      cwd: __dirname,

      exec_mode: 'fork',
      instances: 1,

      autorestart: true,
      // Crash-loop guard: give up after 10 restarts inside min_uptime.
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 5000,
      exp_backoff_restart_delay: 1000,

      // index.ts handles SIGINT/SIGTERM and closes the database first.
      kill_timeout: 8000,

      max_memory_restart: '300M',

      env: {
        NODE_ENV: 'production',
      },

      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
