import { describe, expect, it } from 'vitest';
import { httpErrorHandling } from '../../src/core/rules/http-error-handling.js';
import { connection, node, workflow } from '../helpers.js';

const http = (extra: Record<string, unknown> = {}) => node('HTTP', { type: 'n8n-nodes-base.httpRequest', ...extra });

describe('FA004', () => {
  it('suggests review without declaring default stop behavior a bug', () => {
    const findings = httpErrorHandling.analyze(workflow([http()]));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ severity: 'LOW' });
    expect(findings[0]?.description).toContain('retryOnFail: não observado');
    expect(findings[0]?.suggestion).toContain('interromper o workflow é intencional');
  });
  it.each([{ retryOnFail: true }, { continueOnFail: true }, { onError: 'stopWorkflow' }, { onError: 'continueRegularOutput' },
    { parameters: { options: { response: { response: { neverError: true } } } } },
    { parameters: { options: { ignoreResponseCode: true } } }, { parameters: { ignoreResponseCode: true } },
  ])('recognizes explicit strategies %#', (strategy) => {
    expect(httpErrorHandling.analyze(workflow([http(strategy)]))).toEqual([]);
  });
  it('recognizes workflow-level error handlers without inspecting their content', () => {
    expect(httpErrorHandling.analyze(workflow([http()], {}, { errorWorkflow: 'fictional-handler-id' }))).toEqual([]);
  });
  it('recognizes separate error output only when connected to a valid target', () => {
    const nodes = [http({ onError: 'continueErrorOutput' }), node('Handler')];
    expect(httpErrorHandling.analyze(workflow(nodes, connection('HTTP', 'Handler', 'main', 1)))).toEqual([]);
    expect(httpErrorHandling.analyze(workflow(nodes))).toHaveLength(1);
    expect(httpErrorHandling.analyze(workflow(nodes, connection('HTTP', 'Missing', 'main', 1)))).toHaveLength(1);
  });
  it('does not mistake an inactive error wire or a success output for an error strategy', () => {
    expect(httpErrorHandling.analyze(workflow([http(), node('Handler')], connection('HTTP', 'Handler', 'main', 1)))).toHaveLength(1);
    expect(httpErrorHandling.analyze(workflow([http({ onError: 'continueErrorOutput' }), node('Handler')], connection('HTTP', 'Handler')))).toHaveLength(1);
  });
  it('tolerates unexpected optional parameter shapes and unknown future onError values', () => {
    expect(httpErrorHandling.analyze(workflow([http({ onError: 'future', parameters: { options: { response: null } } })]))).toHaveLength(1);
    expect(httpErrorHandling.analyze(workflow([http({ parameters: { options: [] } })], {}, { errorWorkflow: 42 }))).toHaveLength(1);
  });
  it('ignores other node types and disabled HTTP nodes', () => {
    expect(httpErrorHandling.analyze(workflow([node('A'), http({ disabled: true })]))).toEqual([]);
  });
});
