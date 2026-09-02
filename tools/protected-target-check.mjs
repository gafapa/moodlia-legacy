import { spawn } from 'node:child_process';
import { requireEnv } from '../tests/helpers/env.mjs';

const includePhpLint = process.argv.includes('--php-lint');

if (!requireEnv(['MOODLE_BASE_URL', 'MOODLE_REST_TOKEN'])) {
  throw new Error('MOODLE_BASE_URL and MOODLE_REST_TOKEN are required for protected target checks.');
}

const checks = [
  ['npm', ['run', 'test:static']],
  ['npm', ['run', 'npm:sync:check']],
  ['node', ['--check', 'tests/smoke/protected-target-readonly.test.mjs']],
  ['node', ['--test', 'tests/smoke/protected-target-readonly.test.mjs']]
];

if (includePhpLint) {
  checks.push(['npm', ['run', 'plugin:php:lint:server']]);
}

for (const [command, args] of checks) {
  await run(command, args);
}

console.log('MoodlIA protected target checks completed.');

function run(command, args) {
  const label = `${command} ${args.join(' ')}`;
  console.log(`\n> ${label}`);
  const resolved = resolveCommand(command, args);

  return new Promise((resolve, reject) => {
    const child = spawn(resolved.command, resolved.args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} exited with code ${code ?? 1}`));
    });
  });
}

function resolveCommand(command, args) {
  if (command === 'npm') {
    if (!process.env.npm_execpath) {
      throw new Error('Run protected target checks through an npm release script.');
    }
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...args]
    };
  }
  if (command === 'node') {
    return {
      command: process.execPath,
      args
    };
  }

  return { command, args };
}
