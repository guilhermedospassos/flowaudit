import { mkdtemp, writeFile, rm, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_INPUT_BYTES, parseWorkflow, readWorkflow } from '../../src/core/parse-workflow.js';
import { InputError } from '../../src/core/errors.js';
import { connection, fixture, node, workflow } from '../helpers.js';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

describe('parser', () => {
  it('accepts an export with optional metadata and strips unused properties', () => {
    const parsed = parseWorkflow(JSON.stringify({ nodes: [node('A', { id: '1', typeVersion: 4.2, position: [0, 0] })], meta: { future: true } }));
    expect(parsed.nodes[0]).toMatchObject({ id: '1', name: 'A', typeVersion: 4.2 });
    expect(parsed.nodes[0]).not.toHaveProperty('position');
    expect(parsed.connections).toEqual([]);
  });
  it('accepts UTF-8 BOM', () => { expect(parseWorkflow('\uFEFF{"nodes":[]}').nodes).toEqual([]); });
  it('accepts empty workflows explicitly', () => { expect(parseWorkflow(fixture('empty-workflow.json')).nodes).toEqual([]); });
  it.each(['invalid-json.json', 'incompatible.json'])('rejects %s', (file) => {
    expect(() => parseWorkflow(fixture(file))).toThrow(InputError);
  });
  it.each([null, [], {}, { nodes: [null] }, { nodes: [{ name: 'A' }] }, { nodes: [node('A', { disabled: 'true' })] },
    { nodes: [node('A', { typeVersion: '1' })] }, { nodes: [node('A', { id: 2 })] },
    { nodes: [node('A', { parameters: [] })] }, { nodes: [], settings: [] }, { nodes: [], connections: [] },
    { nodes: [node('A', { onError: false })] }, { nodes: [node('A', { retryOnFail: 1 })] },
  ])('rejects incompatible essential or known fields %#', (value) => {
    expect(() => parseWorkflow(JSON.stringify(value))).toThrow(InputError);
  });
  it('rejects duplicate names without echoing their content', () => {
    expect(() => workflow([node('sensitive-label'), node('sensitive-label')])).toThrow('Nomes de nós duplicados');
    try { workflow([node('sensitive-label'), node('sensitive-label')]); } catch (error) {
      expect(String(error)).not.toContain('sensitive-label');
    }
  });
  it('treats prototype-like names as ordinary data', () => {
    const parsed = workflow([node('__proto__'), node('constructor')], connection('__proto__', 'constructor'));
    expect(parsed.connections).toHaveLength(1);
    expect(parsed.connectionIssues).toEqual([]);
    expect({}).not.toHaveProperty('polluted');
  });
  it('preserves prototype-like parameter keys without changing object prototypes', () => {
    const parsed = parseWorkflow('{"nodes":[{"name":"A","type":"x","parameters":{"__proto__":{"password":"fictional-prototype-secret"},"constructor":{"polluted":true}}}]}');
    const parameters = parsed.nodes[0]!.parameters;
    expect(Object.hasOwn(parameters, '__proto__')).toBe(true);
    expect(parameters['__proto__']).toEqual({ password: 'fictional-prototype-secret' });
    expect(Object.getPrototypeOf(parameters)).toBe(Object.prototype);
    expect({}).not.toHaveProperty('polluted');
  });
  it('preserves all connection types, output slots and target input indices', () => {
    const parsed = workflow([node('A'), node('B')], { A: { custom_future_type: [null, [{ node: 'B', type: 'ai_tool', index: 2 }], []] } });
    expect(parsed.connections[0]).toMatchObject({ sourceType: 'custom_future_type', targetType: 'ai_tool', outputIndex: 1, inputIndex: 2 });
    expect(parsed.connectionIssues).toEqual([]);
  });
  it('rejects oversized text and excessive nesting', () => {
    expect(() => parseWorkflow(' '.repeat(MAX_INPUT_BYTES + 1))).toThrow('10 MiB');
    expect(() => parseWorkflow(`${'['.repeat(102)}0${']'.repeat(102)}`)).toThrow('profundidade');
  });
  it('measures bytes rather than characters', () => {
    expect(() => parseWorkflow(JSON.stringify({ nodes: [], name: 'á'.repeat(MAX_INPUT_BYTES / 2) }))).toThrow('10 MiB');
  });
  it('bounds file size and handles missing files, directories, UTF-8 and successful reads', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flowaudit-parser-')); directories.push(directory);
    const file = join(directory, 'workflow.json');
    await expect(readWorkflow(file)).rejects.toThrow('não encontrado');
    await expect(readWorkflow(directory)).rejects.toThrow();
    await writeFile(file, fixture('empty-workflow.json'));
    expect((await readWorkflow(file)).nodes).toEqual([]);
    await writeFile(file, Buffer.from([0xff, 0xfe]));
    await expect(readWorkflow(file)).rejects.toThrow('UTF-8');
    await truncate(file, MAX_INPUT_BYTES + 1);
    await expect(readWorkflow(file)).rejects.toThrow('10 MiB');
  });
  it('never includes JSON parser excerpts or untrusted property names in errors', () => {
    for (const text of ['{"password":"fictional-secret",oops}', '{"nodes":[],"settings":{"fictional-secret":1},"connections":false}']) {
      try { parseWorkflow(text); } catch (error) { expect(String(error)).not.toContain('fictional-secret'); }
    }
  });
});
