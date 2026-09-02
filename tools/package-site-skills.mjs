import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createZipFromDirectory } from './lib/reproducible-zip.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const sourceRoot = path.join(projectRoot, 'skills');
const outputRoot = path.join(projectRoot, 'dist', 'downloads');
const checkOnly = process.argv.includes('--check');
const skillNames = [
  'design-portable-moodle-content',
  'operate-moodle-with-moodlia',
];

function createZipArchive(skillName) {
  const skillRoot = path.join(sourceRoot, skillName);
  if (!fs.existsSync(skillRoot)) {
    throw new Error(`Skill source not found: ${skillRoot}`);
  }

  return createZipFromDirectory({
    sourceDirectory: skillRoot,
    archiveRoot: skillName
  });
}

fs.mkdirSync(outputRoot, { recursive: true });
let staleArchiveCount = 0;

for (const skillName of skillNames) {
  const archive = createZipArchive(skillName);
  const outputPath = path.join(outputRoot, `${skillName}.zip`);

  if (checkOnly) {
    const currentArchive = fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : Buffer.alloc(0);
    if (!currentArchive.equals(archive)) {
      staleArchiveCount += 1;
      console.error(`Stale skill archive: ${path.relative(projectRoot, outputPath)}`);
    }
    continue;
  }

  fs.writeFileSync(outputPath, archive);
  console.log(`Packaged ${path.relative(projectRoot, outputPath)} (${archive.length} bytes).`);
}

if (checkOnly) {
  if (staleArchiveCount > 0) {
    console.error('Run npm run site:package-skills to refresh website downloads.');
    process.exit(1);
  }
  console.log(`Website skill archives are current (${skillNames.length} bundles).`);
}
