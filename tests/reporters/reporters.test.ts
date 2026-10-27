import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeWorkflow, rules } from '../../src/core/analyze-workflow.js';
import { parseWorkflow } from '../../src/core/parse-workflow.js';
import { jsonReporter } from '../../src/reporters/json-reporter.js';
import { terminalReporter } from '../../src/reporters/terminal-reporter.js';
import { node, workflow } from '../helpers.js';

describe('reports and engine', () => {
  it('produces a JSON report with metadata and summary, without the input workflow', () => {
    const parsed = parseWorkflow(readFileSync(new URL('../../examples/workflow-with-findings.json', import.meta.url), 'utf8'));
    const report = analyzeWorkflow(parsed);
    expect(JSON.parse(jsonReporter(report))).toEqual(report);
    expect(report.summary).toEqual({ total: 5, bySeverity: { HIGH: 1, MEDIUM: 1, LOW: 2, INFO: 1 } });
    expect(report).not.toHaveProperty('nodes');
    expect(report.workflow).not.toHaveProperty('parameters');
    expect(report.findings.map((f) => f.ruleId)).toEqual(['FA003', 'FA005', 'FA001', 'FA004', 'FA002']);
  });
  it('orders repeated results deterministically and leaves input untouched', () => {
    const parsed = workflow([node('z', { disabled: true }), node('a', { parameters: { password: 'fictional-secret' } })]);
    const before = JSON.stringify(parsed);
    expect(analyzeWorkflow(parsed)).toEqual(analyzeWorkflow(parsed));
    expect(JSON.stringify(parsed)).toBe(before);
    expect(new Set(rules.map((r) => r.id)).size).toBe(5);
    for (const rule of rules) expect(rule.name && rule.description && rule.severity).toBeTruthy();
  });
  it('removes detected secrets even when repeated in names and parameter keys', () => {
    const secret = 'fictional-regression-secret-456';
    const parsed = parseWorkflow(JSON.stringify({ name: secret, nodes: [node(secret, {
      parameters: { password: secret, [secret]: { apiKey: secret }, headers: { Authorization: `Bearer ${secret}` } },
    })] }));
    const report = analyzeWorkflow(parsed);
    for (const output of [jsonReporter(report), terminalReporter(report)]) {
      expect(output).not.toContain(secret);
      expect(output).not.toContain(`Bearer ${secret}`);
      expect(output).toContain('[REDACTED]');
    }
  });
  it('sanitizes terminal control characters and limits reflected metadata', () => {
    const parsed = parseWorkflow(JSON.stringify({ name: '\u001b[31mDanger\nspoof\u202e', nodes: [node('x'.repeat(1000))] }));
    const output = terminalReporter(analyzeWorkflow(parsed));
    expect(output).not.toMatch(/[\u001b\u202e]/u);
    expect(output).not.toContain('Danger\nspoof');
    expect(output).not.toContain('x'.repeat(513));
  });
  it('redacts JSON-escaped secret values embedded in parameter paths', () => {
    const secret = 'fictional-"quoted"-secret';
    const report = analyzeWorkflow(workflow([node('A', { parameters: { password: secret, [secret]: { apiKey: secret } } })]));
    for (const finding of report.findings) {
      expect(finding.location ?? '').not.toContain(JSON.stringify(secret).slice(1, -1));
    }
  });
  it('renders counts, recommendations, missing name and an empty result', () => {
    const output = terminalReporter(analyzeWorkflow(workflow([])));
    expect(output).toContain('Workflow: (sem nome)');
    expect(output).toContain('Nós: 0 | Achados: 0');
    expect(output).toContain('Nenhum achado');
    expect(terminalReporter(analyzeWorkflow(workflow([node('A')])))).toContain('Recomendação:');
  });
});
