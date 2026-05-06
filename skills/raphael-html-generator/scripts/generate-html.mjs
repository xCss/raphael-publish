#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { access } from 'node:fs/promises';

function parseArgs(argv) {
  const args = {
    theme: undefined,
    input: undefined,
    output: undefined,
    markdown: undefined,
    title: undefined,
    paramsJson: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--input' || arg === '-i') {
      args.input = next;
      index += 1;
    } else if (arg === '--output' || arg === '-o') {
      args.output = next;
      index += 1;
    } else if (arg === '--markdown') {
      args.markdown = next;
      index += 1;
    } else if (arg === '--title') {
      args.title = next;
      index += 1;
    } else if (arg === '--theme') {
      args.theme = next;
      index += 1;
    } else if (arg === '--params-json') {
      args.paramsJson = next;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function usage() {
  return `Usage:
  node skills/raphael-html-generator/scripts/generate-html.mjs --input article.json --output article.html
  node skills/raphael-html-generator/scripts/generate-html.mjs --markdown article.md --title "标题" --theme wechat --output article.html

Options:
  -i, --input <file>       JSON template parameters
      --params-json <json> Inline JSON template parameters
      --markdown <file>    Markdown source file
      --title <title>      HTML title when using --markdown
      --theme <id>         Raphael theme id, default apple
  -o, --output <file>      Output HTML path
`;
}

async function readParameters(args) {
  if (args.paramsJson) return JSON.parse(args.paramsJson);

  if (args.input) {
    const input = await readFile(resolve(args.input), 'utf8');
    return JSON.parse(input);
  }

  if (args.markdown) {
    return {
      title: args.title,
      theme: args.theme,
      markdown: await readFile(resolve(args.markdown), 'utf8'),
    };
  }

  throw new Error('Provide --input, --params-json, or --markdown.');
}

async function findRepoRoot(startDir) {
  let currentDir = startDir;

  while (true) {
    try {
      await access(join(currentDir, 'src/lib/templateHtml.ts'));
      return currentDir;
    } catch {
      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        throw new Error('Could not find repository root containing src/lib/templateHtml.ts.');
      }
      currentDir = parentDir;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }

  if (!args.output) throw new Error('Provide --output.');

  const scriptPath = fileURLToPath(import.meta.url);
  const repoRoot = await findRepoRoot(dirname(scriptPath));
  const parameters = await readParameters(args);
  if (args.theme && !parameters.theme) parameters.theme = args.theme;
  if (args.title && !parameters.title) parameters.title = args.title;

  const server = await createServer({
    root: repoRoot,
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    globalThis.DOMParser = dom.window.DOMParser;
    globalThis.Node = dom.window.Node;
    globalThis.FileReader = dom.window.FileReader;
    globalThis.Blob = dom.window.Blob;
    const { renderMarkdownToHtml } = await server.ssrLoadModule('/src/lib/templateHtml.ts');
    const html = await renderMarkdownToHtml({ parameters });
    const outputPath = resolve(args.output);
    await writeFile(outputPath, html, 'utf8');
    process.stdout.write(`Generated ${outputPath}\n`);
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}`);
  process.exit(1);
});
