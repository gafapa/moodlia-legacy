import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDirectory = path.join(rootDirectory, 'packages', 'moodlia');
const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) {
  throw new Error('Run this package helper through npm run npm:pack:dry-run.');
}
const args = [npmCliPath, 'pack', ...process.argv.slice(2)];

const child = spawn(process.execPath, args, {
  cwd: packageDirectory,
  stdio: 'inherit',
  shell: false
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
