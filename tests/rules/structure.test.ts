import { describe, expect, it } from 'vitest';
import { disconnectedNodes } from '../../src/core/rules/disconnected-nodes.js';
import { disabledNodes } from '../../src/core/rules/disabled-nodes.js';
import { invalidConnections } from '../../src/core/rules/invalid-connections.js';
import { parseWorkflow } from '../../src/core/parse-workflow.js';
import { connection, fixture, node, workflow } from '../helpers.js';

describe('FA001', () => {
  it('flags isolated nodes, including unused isolated triggers', () => {
    expect(disconnectedNodes.analyze(workflow([node('A'), node('Trigger', { type: 'n8n-nodes-base.manualTrigger' })]))).toHaveLength(2);
  });
  it.each(['n8n-nodes-base.manualTrigger', 'n8n-nodes-base.webhook', 'n8n-nodes-base.start', '@n8n/n8n-nodes-langchain.chatTrigger'])('allows %s to start a connected flow', (type) => {
    expect(disconnectedNodes.analyze(workflow([node('A', { type }), node('B')], connection('A', 'B')))).toEqual([]);
  });
  it('does not flag terminal nodes or AI subnodes with outgoing special links', () => {
    expect(disconnectedNodes.analyze(parseWorkflow(fixture('ai-workflow.json')))).toEqual([]);
  });
  it('flags a source with no input as a conservative review', () => {
    expect(disconnectedNodes.analyze(workflow([node('A'), node('B')], connection('A', 'B')))).toMatchObject([{ nodeName: 'A' }]);
  });
  it('ignores notes and does not let notes or self-loops conceal isolation', () => {
    expect(disconnectedNodes.analyze(workflow([node('Note', { type: 'n8n-nodes-base.stickyNote' })]))).toEqual([]);
    expect(disconnectedNodes.analyze(workflow([node('A')], connection('A', 'A')))).toHaveLength(1);
    expect(disconnectedNodes.analyze(workflow([node('Note', { type: 'n8n-nodes-base.stickyNote' }), node('A')], connection('Note', 'A')))).toMatchObject([{ nodeName: 'A' }]);
  });
});

describe('FA002', () => {
  it('reports disabled nodes at INFO', () => {
    expect(disabledNodes.analyze(workflow([node('A', { disabled: true })]))).toMatchObject([{ ruleId: 'FA002', severity: 'INFO' }]);
  });
  it('does not report enabled nodes or missing flags', () => {
    expect(disabledNodes.analyze(workflow([node('A'), node('B', { disabled: false })]))).toEqual([]);
  });
});

describe('FA005', () => {
  it('reports missing sources and targets while keeping valid edges', () => {
    const parsed = workflow([node('A'), node('B')], {
      A: { main: [[{ node: 'Missing', type: 'main', index: 0 }, { node: 'B', type: 'main', index: 0 }]] },
      Missing: { main: [[{ node: 'B', type: 'main', index: 0 }]] },
    });
    expect(invalidConnections.analyze(parsed)).toHaveLength(2);
    expect(parsed.connections).toHaveLength(1);
  });
  it.each([null, [], { main: {} }, { main: [42] }, { main: [[{}]] }, { main: [[{ node: 'A', type: 'main', index: -1 }]] },
    { '': [] }, { main: [[{ node: 'A', type: 'main', index: 0.5 }]] },
  ])('reports recoverable malformed groups %#', (groups) => {
    expect(invalidConnections.analyze(workflow([node('A')], { A: groups })).length).toBeGreaterThan(0);
  });
  it('accepts empty/null slots, multiple targets, different inputs and AI connections', () => {
    expect(invalidConnections.analyze(parseWorkflow(fixture('ai-workflow.json')))).toEqual([]);
    expect(invalidConnections.analyze(workflow([node('A'), node('B')], { A: { main: [null, [], [{ node: 'B', type: 'main', index: 1 }]] } }))).toEqual([]);
  });
});
