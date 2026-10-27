import { readFileSync } from 'node:fs';
import { parseWorkflow } from '../src/core/parse-workflow.js';
import type { Workflow } from '../src/core/types.js';

export function node(name: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, type: 'n8n-nodes-base.set', parameters: {}, ...extra };
}

export function workflow(nodes: unknown[], connections: unknown = {}, settings: unknown = {}): Workflow {
  return parseWorkflow(JSON.stringify({ nodes, connections, settings }));
}

export function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

export function connection(source: string, target: string, type = 'main', outputIndex = 0): Record<string, unknown> {
  return { [source]: { [type]: Array.from({ length: outputIndex + 1 }, (_, index) =>
    index === outputIndex ? [{ node: target, type, index: 0 }] : null) } };
}
