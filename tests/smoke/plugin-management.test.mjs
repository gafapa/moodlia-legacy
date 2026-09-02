import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { loadContract, toRestFunctionName } from '../helpers/contract.mjs';
import { getEnv, getTimeout, requireEnv, resolveCliCommand } from '../helpers/env.mjs';
import { callMcp } from '../helpers/mcp.mjs';
import { callRestFunction } from '../helpers/moodle-rest.mjs';
import { fromRoot } from '../helpers/paths.mjs';

const execFileAsync = promisify(execFile);
const hasConfig = requireEnv(['MOODLE_BASE_URL', 'MOODLE_REST_TOKEN']);

async function callMcpTool(name, toolArguments = {}) {
  return callMcp('tools/call', {
    name,
    arguments: toolArguments
  });
}

async function callCli(args) {
  const configured = resolveCliCommand();
  const localCli = fromRoot('cli/moodle-mcp.mjs');
  const commandPath = configured ?? localCli;
  const command = commandPath.endsWith('.mjs') || commandPath.endsWith('.js') ? process.execPath : commandPath;
  const commandArgs = command === process.execPath ? [commandPath, ...args] : args;
  const { stdout } = await execFileAsync(command, [...commandArgs, '--format', 'json'], {
    timeout: getTimeout(),
    env: {
      ...process.env,
      MOODLE_BASE_URL: getEnv('MOODLE_BASE_URL'),
      MOODLE_REST_TOKEN: getEnv('MOODLE_REST_TOKEN')
    }
  });
  return JSON.parse(stdout.trim());
}

function assertInventory(payload) {
  assert.equal(payload.total, payload.plugins.length);
  assert.ok(payload.total > 0);
  const components = payload.plugins.map((plugin) => plugin.component);
  assert.deepEqual(components, [...components].sort());
  assert.ok(components.includes('local_moodlia'));
}

function normalizeDetails(details) {
  return {
    component: details.component,
    plugin_type: details.plugin_type,
    source: details.source,
    status: details.status,
    dependency_count: details.dependency_count,
    required_by_count: details.required_by_count
  };
}

function normalizeDependencies(dependencies) {
  return {
    component: dependencies.component,
    satisfied: dependencies.satisfied,
    dependencies: dependencies.dependencies,
    required_by: dependencies.required_by
  };
}

test('plugin inventory, details, and dependencies behave consistently across REST, MCP, and CLI', {
  skip: !hasConfig
}, async () => {
  const contract = await loadContract();
  const restInventory = await callRestFunction(toRestFunctionName(contract, 'list_plugins'));
  const mcpInventory = await callMcpTool('list_plugins');
  const cliInventory = await callCli(['list-plugins']);

  for (const inventory of [restInventory, mcpInventory, cliInventory]) {
    assertInventory(inventory);
  }
  assert.deepEqual(mcpInventory, restInventory);
  assert.deepEqual(cliInventory, restInventory);

  const moodlia = restInventory.plugins.find((plugin) => plugin.component === 'local_moodlia');
  const filtered = await callRestFunction(toRestFunctionName(contract, 'list_plugins'), {
    plugin_type: moodlia.plugin_type,
    source: moodlia.source,
    status: moodlia.status
  });
  assertInventory(filtered);
  for (const plugin of filtered.plugins) {
    assert.equal(plugin.plugin_type, moodlia.plugin_type);
    assert.equal(plugin.source, moodlia.source);
    assert.equal(plugin.status, moodlia.status);
  }

  const restDetails = await callRestFunction(toRestFunctionName(contract, 'get_plugin_details'), {
    component: 'local_moodlia'
  });
  const mcpDetails = await callMcpTool('get_plugin_details', { component: 'local_moodlia' });
  const cliDetails = await callCli(['get-plugin-details', '--component', 'local_moodlia']);
  assert.deepEqual(normalizeDetails(mcpDetails), normalizeDetails(restDetails));
  assert.deepEqual(normalizeDetails(cliDetails), normalizeDetails(restDetails));

  const restDependencies = await callRestFunction(toRestFunctionName(contract, 'get_plugin_dependencies'), {
    component: 'local_moodlia'
  });
  const mcpDependencies = await callMcpTool('get_plugin_dependencies', { component: 'local_moodlia' });
  const cliDependencies = await callCli(['get-plugin-dependencies', '--component', 'local_moodlia']);
  assert.deepEqual(normalizeDependencies(mcpDependencies), normalizeDependencies(restDependencies));
  assert.deepEqual(normalizeDependencies(cliDependencies), normalizeDependencies(restDependencies));
  assert.equal(restDetails.dependency_count, restDependencies.dependencies.length);
  assert.equal(restDetails.required_by_count, restDependencies.required_by.length);

  await assert.rejects(
    () => callRestFunction(toRestFunctionName(contract, 'get_plugin_details'), {
      component: 'local_moodlia_missing_test_plugin'
    }),
    /known Moodle plugin/
  );
});
