import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { loadContract } from '../helpers/contract.mjs';
import { fromRoot } from '../helpers/paths.mjs';

const operationNames = [
  'list_plugins',
  'get_plugin_details',
  'get_plugin_dependencies',
  'check_plugin_updates',
  'set_plugin_enabled'
];

test('plugin administration operations share the canonical transports and dedicated capability', async () => {
  const contract = await loadContract();

  for (const name of operationNames) {
    const operation = contract.operations.find((entry) => entry.name === name);
    assert.ok(operation, `${name} must exist in the canonical contract.`);
    assert.deepEqual(operation.transports, ['rest', 'mcp', 'cli']);
    assert.ok(operation.capabilities.includes('local/moodlia:useapi'));
    assert.ok(operation.capabilities.includes('local/moodlia:manageplugins'));
  }

  assert.equal(contract.operations.find((entry) => entry.name === 'set_plugin_enabled').type, 'write');
});

test('plugin management capability has no default role archetype grant', async () => {
  const access = await fs.readFile(fromRoot('plugin/moodlia/db/access.php'), 'utf8');
  const capability = access.match(/'local\/moodlia:manageplugins'\s*=>\s*\[([\s\S]*?)\n\s*\],\n\];/);

  assert.ok(capability, 'local/moodlia:manageplugins must be declared.');
  assert.match(capability[1], /'riskbitmask'\s*=>\s*RISK_CONFIG/);
  assert.match(capability[1], /'captype'\s*=>\s*'write'/);
  assert.match(capability[1], /'archetypes'\s*=>\s*\[\]/);
});

test('plugin state changes are guarded and verified without filesystem deployment', async () => {
  const helper = await fs.readFile(fromRoot('plugin/moodlia/classes/operation/plugin_management_tools.php'), 'utf8');
  const stateOperation = await fs.readFile(fromRoot('plugin/moodlia/classes/operation/set_plugin_enabled.php'), 'utf8');

  assert.match(helper, /core_plugin_manager::instance\(\)/);
  assert.match(helper, /getDeclaringClass\(\)->getName\(\)\s*!==\s*\\core\\plugininfo\\base::class/);
  assert.match(helper, /MULTISTATE_PLUGIN_TYPES\s*=\s*\['filter',\s*'repository'\]/);
  assert.match(stateOperation, /\$plugin->component\s*===\s*'local_moodlia'/);
  assert.match(stateOperation, /::enable_plugin\(\$plugin->name,\s*\$enabled\s*\?\s*1\s*:\s*0\)/);
  assert.match(stateOperation, /core_plugin_manager::reset_caches\(\)/);
  assert.match(stateOperation, /\$verified\s*!==\s*\$enabled/);
  assert.match(stateOperation, /resolve_requirements\(\$plugin\)/);
  assert.match(stateOperation, /other_plugins_that_require\(\$plugin->component\)/);

  const combined = `${helper}\n${stateOperation}`;
  assert.doesNotMatch(combined, /(?:unlink|rename|copy|file_put_contents|mkdir|rmdir|install_from|uninstall_plugin)\s*\(/i);
});

test('update inspection refreshes only when explicitly requested', async () => {
  const source = await fs.readFile(fromRoot('plugin/moodlia/classes/operation/check_plugin_updates.php'), 'utf8');

  assert.match(source, /if\s*\(\$refresh\)\s*\{\s*\$checker->fetch\(\);/s);
  assert.match(source, /get_update_info\(\$plugin->component\)/);
  assert.doesNotMatch(source, /install|uninstall|delete|file_put_contents/i);
});

test('plugin inventory, details, and dependency behavior have Moodle and transport tests', async () => {
  const phpunit = await fs.readFile(fromRoot('plugin/moodlia/tests/plugin_management_test.php'), 'utf8');
  const smoke = await fs.readFile(fromRoot('tests/smoke/plugin-management.test.mjs'), 'utf8');

  assert.match(phpunit, /list_plugins::execute\(\)/);
  assert.match(phpunit, /get_plugin_details::execute\('local_moodlia'\)/);
  assert.match(phpunit, /get_plugin_dependencies::execute\('local_moodlia'\)/);
  assert.match(phpunit, /test_component_reads_reject_unknown_plugins/);

  for (const operationName of ['list_plugins', 'get_plugin_details', 'get_plugin_dependencies']) {
    assert.ok(smoke.includes(`'${operationName}'`), `smoke coverage must call ${operationName}.`);
  }
  assert.match(smoke, /mcpInventory/);
  assert.match(smoke, /cliInventory/);
});
