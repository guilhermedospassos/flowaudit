import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/cli.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
async function directory(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'flowaudit-cli-')); directories.push(dir); return dir;
}
async function run(args: string[]) {
  let stdout = ''; let stderr = '';
  const code = await runCli(args, { stdout: (s) => { stdout += s; }, stderr: (s) => { stderr += s; } });
  return { code, stdout, stderr };
}
const input = resolve('examples/basic-workflow.json');

describe('CLI', () => {
  it('supports help and version', async () => {
    expect((await run(['--help'])).stdout).toContain('Uso:');
    expect((await run(['-h'])).code).toBe(0);
    expect((await run(['--version'])).stdout).toBe('0.1.0\n');
  });
  it('renders terminal and JSON reports and accepts options before the path', async () => {
    expect((await run([input])).stdout).toContain('Nós: 2 | Achados: 0');
    const result = await run(['--format', 'json', input]);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout).workflow.nodeCount).toBe(2);
  });
  it('saves the exact JSON report without modifying input', async () => {
    const dir = await directory(); const output = join(dir, 'report.json');
    const before = await readFile(input);
    const result = await run([input, '--format', 'json', '--output', output]);
    expect(result.code).toBe(0);
    expect(await readFile(output, 'utf8')).toBe(result.stdout);
    expect(await readFile(input)).toEqual(before);
  });
  it('refuses overwrites, including aliases to the analyzed file', async () => {
    const dir = await directory(); const source = join(dir, 'source.json'); const alias = join(dir, 'alias.json');
    const content = '{"nodes":[]}'; await writeFile(source, content); await link(source, alias);
    for (const output of [source, alias]) {
      const result = await run([source, '--output', output]);
      expect(result.code).toBe(2); expect(result.stdout).toBe('');
      expect(await readFile(source, 'utf8')).toBe(content);
    }
  });
  it('reports write errors without printing the report', async () => {
    const dir = await directory();
    const result = await run([input, '--output', join(dir, 'missing', 'report.json')]);
    expect(result.code).toBe(2); expect(result.stdout).toBe(''); expect(result.stderr).toContain('salvar');
  });
  it('returns zero for findings and sanitizes their values', async () => {
    const result = await run(['examples/workflow-with-findings.json', '--format', 'json']);
    expect(result.code).toBe(0); expect(JSON.parse(result.stdout).summary.total).toBe(5);
    expect(result.stdout).not.toContain('flowaudit-fictional-demo-token');
  });
  it.each([[], ['missing.json'], ['tests/fixtures/invalid-json.json'], ['tests/fixtures/incompatible.json'],
    [input, '--format', 'xml'], [input, '--output'], [input, '--format'], [input, '--unknown'], [input, input],
    [input, '--format', 'json', '--format', 'json'], ['\0'], [input, '--output', '\0'],
  ].map((args) => ({ args })))('returns code 1 with stderr only for invalid arguments or input %#', async ({ args }) => {
    const result = await run(args); expect(result.code).toBe(1); expect(result.stdout).toBe('');
    expect(result.stderr).not.toContain(' at ');
  });
  it('accepts a double-dash positional path', async () => {
    expect((await run(['--format', 'json', '--', input])).code).toBe(0);
  });
  it('handles unexpected internal failures with a generic error', async () => {
    const result: string[] = [];
    const code = await runCli(['--version'], { stdout: () => { throw new Error('fictional-sensitive-error'); }, stderr: (s) => { result.push(s); } });
    expect(code).toBe(2); expect(result.join('')).not.toContain('fictional-sensitive-error');
  });
  it('builds and executes the distributed CLI with JSON-only stdout', async () => {
    // Keep emitted modules inside the project so their dependencies resolve
    // from node_modules, without depending on an existing dist directory.
    await mkdir('.tmp', { recursive: true });
    const dir = await mkdtemp(resolve('.tmp/flowaudit-cli-')); directories.push(dir);
    const outputDir = join(dir, 'dist');
    await promisify(execFile)(process.execPath, ['node_modules/typescript/bin/tsc', '--outDir', outputDir]);
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [join(outputDir, 'cli.js'), input, '--format', 'json']);
    expect(JSON.parse(stdout).summary.total).toBe(0); expect(stderr).toBe('');
  }, 15_000);
});
