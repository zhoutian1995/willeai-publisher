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
    {
      name: 'willeai-publisher-deployer',
      script: 'scripts/deploy-from-git.cjs',
      cwd: '/home/admin/project/willeai-publisher',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        REPO_URL: 'https://github.com/zhoutian1995/willeai-publisher.git',
        BRANCH: 'main',
        DEPLOY_PATH: '/home/admin/project/willeai-publisher',
        CHECKOUT_PATH: '/home/admin/project/willeai-publisher-checkout',
        STATE_FILE: '/home/admin/project/willeai-publisher.deploy-state',
        POLL_INTERVAL_MS: '60000',
      },
    },
  ],
};
