module.exports = {
  apps: [
    {
      name: 'willeai-publisher',
      script: 'server.js',
      cwd: '/home/admin/project/willeai-publisher',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
