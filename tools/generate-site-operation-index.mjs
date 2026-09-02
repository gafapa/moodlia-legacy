import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const contractPath = path.join(projectRoot, 'contract', 'operations.json');
const outputPath = path.join(projectRoot, 'dist', 'operations.generated.js');
const checkOnly = process.argv.includes('--check');

const categoryRules = [
  {
    name: 'Assessment',
    pattern: /(?:assignment|assign_|question|quiz|grade|grading|rubric|checklist|marking_guide)/,
  },
  {
    name: 'People & access',
    pattern: /(?:user|enrol|cohort|role|group|grouping|participant|competenc|plan)/,
  },
  {
    name: 'Learning activities',
    pattern: /(?:book|forum|glossary|wiki|choice|feedback|lesson|workshop|database|data_|submission)/,
  },
  {
    name: 'Files & resources',
    pattern: /(?:file|folder|resource|url)/,
  },
  {
    name: 'Courses & structure',
    pattern: /(?:course|category|section|module|calendar|blueprint|publish|completion|backup|restore)/,
  },
];

function getCategory(operationName) {
  return categoryRules.find(({ pattern }) => pattern.test(operationName))?.name ?? 'System & discovery';
}

function normalizeParameter([name, definition]) {
  return {
    name,
    required: Boolean(definition.required),
    type: definition.type ?? 'unknown',
    enum: Array.isArray(definition.enum) ? definition.enum : undefined,
  };
}

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const operations = (contract.operations ?? contract).map((operation) => ({
  name: operation.name,
  command: operation.name.replaceAll('_', '-'),
  summary: operation.summary ?? 'No summary is available.',
  type: operation.type ?? 'unknown',
  context: operation.context ?? 'site',
  category: getCategory(operation.name),
  transports: operation.transports ?? [],
  files: operation.files ?? 'none',
  parameters: Object.entries(operation.parameters ?? {}).map(normalizeParameter),
}));

const payload = {
  contractVersion: contract.version ?? 'unknown',
  operationCount: operations.length,
  operations,
};

const generatedContent = `// Generated from contract/operations.json. Do not edit manually.\nwindow.MOODLIA_OPERATION_INDEX = ${JSON.stringify(payload, null, 2)};\n`;

if (checkOnly) {
  const currentContent = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (currentContent !== generatedContent) {
    console.error('The website operation index is stale. Run npm run site:generate.');
    process.exit(1);
  }
  console.log(`Website operation index is current (${operations.length} operations).`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, generatedContent);
console.log(`Generated ${path.relative(projectRoot, outputPath)} with ${operations.length} operations.`);
