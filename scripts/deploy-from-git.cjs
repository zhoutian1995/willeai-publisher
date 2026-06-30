#!/usr/bin/env node

const { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, copyFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { spawnSync } = require('node:child_process');

const repoUrl = process.env.REPO_URL || 'https://github.com/zhoutian1995/willeai-publisher.git';
const branch = process.env.BRANCH || 'main';
const deployPath = process.env.DEPLOY_PATH || '/home/admin/project/willeai-publisher';
const checkoutPath = process.env.CHECKOUT_PATH || '/home/admin/project/willeai-publisher-checkout';
const stateFile = process.env.STATE_FILE || '/home/admin/project/willeai-publisher.deploy-state';
const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS || 60000);
const once = process.argv.includes('--once');
const forceDeploy = process.argv.includes('--force') || process.env.FORCE_DEPLOY === '1';

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${output ? `\n${output}` : ''}`);
  }

  return (result.stdout || '').trim();
}

function remoteSha() {
  const output = run('git', ['ls-remote', repoUrl, `refs/heads/${branch}`], { capture: true });
  const [sha] = output.split(/\s+/);
  if (!sha) {
    throw new Error(`Cannot resolve ${repoUrl} refs/heads/${branch}`);
  }
  return sha;
}

function readLastSha() {
  if (!existsSync(stateFile)) {
    return '';
  }
  return readFileSync(stateFile, 'utf8').trim();
}

function writeLastSha(sha) {
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, `${sha}\n`, 'utf8');
}

function ensureCheckout() {
  if (existsSync(join(checkoutPath, '.git'))) {
    run('git', ['fetch', '--depth=1', 'origin', branch], { cwd: checkoutPath });
    run('git', ['checkout', '-B', branch, 'FETCH_HEAD'], { cwd: checkoutPath });
    return;
  }

  const tmpPath = `${checkoutPath}.tmp`;
  rmSync(tmpPath, { recursive: true, force: true });
  mkdirSync(dirname(checkoutPath), { recursive: true });
  run('git', ['clone', '--depth=1', '--branch', branch, repoUrl, tmpPath]);
  rmSync(checkoutPath, { recursive: true, force: true });
  renameSync(tmpPath, checkoutPath);
}

function ensureNginx() {
  mkdirSync('/var/www/publish.willeai.cn', { recursive: true });
  copyFileSync(
    join(deployPath, 'scripts/nginx.publish.willeai.cn.conf'),
    '/www/server/panel/vhost/nginx/publish.willeai.cn.conf',
  );
  run('nginx', ['-t']);
  run('nginx', ['-s', 'reload']);
}

function reloadApplication() {
  const describe = spawnSync('pm2', ['describe', 'willeai-publisher'], {
    cwd: deployPath,
    encoding: 'utf8',
    stdio: 'ignore',
  });

  if (describe.status === 0) {
    run('pm2', ['reload', 'willeai-publisher', '--update-env'], { cwd: deployPath });
  }
  else {
    run('pm2', ['start', 'scripts/ecosystem.config.cjs', '--only', 'willeai-publisher'], { cwd: deployPath });
  }

  run('pm2', ['save'], { cwd: deployPath });
}

function deploy(sha) {
  log(`Deploying ${sha}`);
  ensureCheckout();
  run('node', ['--check', 'server.js'], { cwd: checkoutPath });
  run('node', ['--check', 'public/app.js'], { cwd: checkoutPath });
  mkdirSync(deployPath, { recursive: true });
  run('rsync', [
    '-az',
    '--delete',
    '--exclude=.git',
    '--exclude=.env',
    `${checkoutPath}/`,
    `${deployPath}/`,
  ]);
  reloadApplication();
  ensureNginx();
  writeLastSha(sha);
  log(`Deployed ${sha}`);
}

function checkOnce() {
  const sha = remoteSha();
  const lastSha = readLastSha();

  if (!forceDeploy && sha === lastSha) {
    log(`No change (${sha})`);
    return;
  }

  deploy(sha);
}

async function loop() {
  while (true) {
    try {
      checkOnce();
    }
    catch (error) {
      console.error(`[${new Date().toISOString()}] Deploy check failed: ${error.message}`);
    }

    if (once) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
}

loop();
