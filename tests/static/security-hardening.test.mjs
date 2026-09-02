import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { fromRoot } from '../helpers/paths.mjs';

test('dependency lockfile uses the official npm registry with integrity hashes', async () => {
  const lockfile = JSON.parse(await fs.readFile(fromRoot('package-lock.json'), 'utf8'));

  for (const [packagePath, definition] of Object.entries(lockfile.packages)) {
    if (!definition.resolved) {
      continue;
    }

    assert.equal(
      new URL(definition.resolved).host,
      'registry.npmjs.org',
      `${packagePath} must resolve from the official npm registry`
    );
    assert.match(definition.integrity ?? '', /^sha512-/, `${packagePath} must include a SHA-512 integrity hash`);
  }
});

test('CI pins third-party actions and requires Node 24, PHP lint, and dependency audit', async () => {
  const workflow = await fs.readFile(fromRoot('.github/workflows/ci.yml'), 'utf8');
  const moodleWorkflow = await fs.readFile(fromRoot('.github/workflows/moodle-plugin-ci.yml'), 'utf8');
  const packageJson = JSON.parse(await fs.readFile(fromRoot('package.json'), 'utf8'));
  const gitignore = await fs.readFile(fromRoot('.gitignore'), 'utf8');
  const iconGenerator = await fs.readFile(fromRoot('tools/generate-app-icons.mjs'), 'utf8');
  const skillPackager = await fs.readFile(fromRoot('tools/package-site-skills.mjs'), 'utf8');
  const zipWriter = await fs.readFile(fromRoot('tools/lib/reproducible-zip.mjs'), 'utf8');
  const actionReferences = [...`${workflow}\n${moodleWorkflow}`.matchAll(/^\s*uses:\s*([^\s#]+)/gm)]
    .map((match) => match[1]);

  assert.ok(actionReferences.length >= 4);
  for (const reference of actionReferences) {
    assert.match(reference, /@[a-f0-9]{40}$/, `${reference} must be pinned to an immutable commit`);
  }

  assert.match(workflow, /node-version:\s*'24'/);
  assert.match(workflow, /php-version:\s*'8\.2'/);
  assert.match(workflow, /npm run lint:php -- --required/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /npm run release:artifacts/);
  assert.ok(
    workflow.indexOf('npm run release:artifacts') < workflow.indexOf('npm run test:site'),
    'generated site artifacts must be prepared before website tests'
  );
  assert.equal(
    packageJson.scripts['release:artifacts'],
    'npm run site:prepare && npm run plugin:boilerplate:check && npm run plugin:marketplace:check && ' +
      'npm run plugin:archive && npm run release:checksums'
  );
  assert.match(moodleWorkflow, /MOODLE_BRANCH:\s*MOODLE_502_STABLE/);
  assert.match(moodleWorkflow, /php-version:\s*'8\.3'/);
  assert.match(moodleWorkflow, /database:\s*\r?\n\s+- pgsql\s*\r?\n\s+- mariadb/);
  assert.match(moodleWorkflow, /moodle-plugin-ci phpcs --max-warnings 0/);
  assert.match(moodleWorkflow, /moodle-plugin-ci phpdoc --max-warnings 0/);
  assert.match(moodleWorkflow, /moodle-plugin-ci validate/);
  assert.match(moodleWorkflow, /moodle-plugin-ci phpunit --fail-on-warning/);
  for (const ignoredOutput of [
    '/dist/operations.generated.js',
    '/dist/icons/',
    '/dist/downloads/',
    '/site/',
    '/empaquetado/'
  ]) {
    assert.ok(gitignore.includes(ignoredOutput), `${ignoredOutput} must have an explicit artifact policy`);
  }
  assert.match(iconGenerator, /Application icon source not found/);
  assert.match(skillPackager, /createZipFromDirectory/);
  assert.doesNotMatch(skillPackager, /dosDate|crcTable|2026/);
  assert.match(zipWriter, /from 'fflate'/);
  assert.match(zipWriter, /zipSync/);
  assert.doesNotMatch(zipWriter, /crcTable|writeUInt\d+LE|0x04034b50/);
  assert.match(zipWriter, /SOURCE_DATE_EPOCH/);
  assert.match(zipWriter, /Date\.UTC\(1980,\s*0,\s*1/);
});

test('MCP endpoint implements lifecycle, origin validation, bounded input, and CallToolResult', async () => {
  const source = await fs.readFile(fromRoot('plugin/moodlia/mcp.php'), 'utf8');

  assert.match(source, /\$method === 'initialize'/);
  assert.match(source, /\$method === 'notifications\/initialized'/);
  assert.match(source, /\$method === 'ping'/);
  assert.match(source, /local_moodlia_mcp_validate_origin/);
  assert.match(source, /CONTENT_TYPE/);
  assert.match(source, /HTTP_ACCEPT/);
  assert.match(source, /HTTP_MCP_PROTOCOL_VERSION/);
  assert.match(source, /LOCAL_MOODLIA_MCP_MAX_REQUEST_BYTES/);
  assert.match(source, /'structuredContent' => \$payload/);
  assert.match(source, /'isError' => false/);
});

test('file overwrites and token provisioning retain the previous asset until replacement succeeds', async () => {
  const folderUpload = await fs.readFile(fromRoot('plugin/moodlia/classes/operation/upload_folder_file.php'), 'utf8');
  const backupTools = await fs.readFile(fromRoot('plugin/moodlia/classes/operation/course_backup_tools.php'), 'utf8');
  const tokenTool = await fs.readFile(fromRoot('tools/create-moodlia-token-ui.mjs'), 'utf8');

  assert.match(folderUpload, /replace_file_with\(\$draftfile\)/);
  assert.match(backupTools, /replace_file_with\(\$draftfile\)/);
  assert.doesNotMatch(folderUpload, /\$existing->delete\(\)/);
  assert.match(tokenTool, /getAuthenticatedUser/);
  assert.doesNotMatch(tokenTool, /value\s*=\s*['"]2['"]/);
});
