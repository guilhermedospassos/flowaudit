import { describe, expect, it } from 'vitest';
import { hardcodedSecrets } from '../../src/core/rules/hardcoded-secrets.js';
import { parseWorkflow } from '../../src/core/parse-workflow.js';
import { node, workflow } from '../helpers.js';

describe('FA003', () => {
  it('does not lose secrets under a prototype-like parameter key', () => {
    const parsed = parseWorkflow('{"nodes":[{"name":"A","type":"x","parameters":{"__proto__":{"password":"fictional-prototype-secret"}}}]}');
    const findings = hardcodedSecrets.analyze(parsed);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.location).toBe('parameters["__proto__"]["password"]');
    expect(JSON.stringify(findings)).not.toContain('fictional-prototype-secret');
  });
  it.each([
    { apiKey: 'fictional-api-key-123' }, { password: 'fictional-password' }, { token: 'fictional-token' },
    { clientSecret: 'fictional-client-secret' }, { access_token: 'fictional-access-token' },
    { headers: { Authorization: 'Bearer fictional-bearer-token' } },
    { headerParameters: { parameters: [{ name: 'x-api-key', value: 'fictional-header-key' }] } },
    { queryParameters: { parameters: [{ name: 'token', value: 'fictional-query-token' }] } },
    { jsonHeaders: '{"Authorization":"Bearer fictional-json-token"}' },
    { notes: 'sk-fictional0123456789abcdef' }, { notes: 'ghp_fictional0123456789abcdef' },
    { url: 'https://example.invalid/?api_key=fictional-url-key' },
    { url: 'https://user:fictional-password@example.invalid/' },
    { password: 123456 }, { tokens: [{ password: 'fictional-array-secret' }] },
    { authorization: 'Bearer literal-prefix-{{$json.token}}' },
  ])('detects a sensitive literal without echoing it %#', (parameters) => {
    const findings = hardcodedSecrets.analyze(workflow([node('A', { parameters })]));
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]).toMatchObject({ ruleId: 'FA003', severity: 'HIGH' });
    expect(JSON.stringify(findings)).not.toContain('fictional');
  });
  it.each([
    { password: '' }, { password: '   ' }, { apiKey: '<API_KEY>' }, { apiKey: 'YOUR_API_KEY' },
    { password: 'changeme' }, { token: '********' }, { token: '[REDACTED]' }, { token: '${TOKEN}' },
    { password: '={{ $env.PASSWORD }}' }, { token: '{{ $json.token }}' },
    { headers: { Authorization: 'Bearer {{$env.TOKEN}}' } },
    { headers: { Authorization: 'Bearer {{ $env.TOKEN }}' } },
    { url: 'https://example.invalid/?token=<TOKEN>' },
    { url: 'https://example.invalid/?token={{ $env.TOKEN }}' },
    { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
    { jsonHeaders: '{"Authorization":"Bearer {{$env.TOKEN}}"}' },
    { maxTokens: 2000, tokenCount: 32, credentialId: 'not-secret', credentialName: 'managed' },
    { contentType: 'application/json' }, { payload: { enabled: true, empty: null } },
    { badJson: '{not-json', ordinaryArray: [1, false, null] },
  ])('avoids a false positive %#', (parameters) => {
    expect(hardcodedSecrets.analyze(workflow([node('A', { parameters })]))).toEqual([]);
  });
  it('ignores n8n credential references outside parameters', () => {
    expect(hardcodedSecrets.analyze(workflow([node('A', { credentials: { httpHeaderAuth: { id: '123', name: 'My key' } } })]))).toEqual([]);
  });
  it('does not evaluate a parameter expression', () => {
    const expression = '={{ (() => { throw new Error("must not execute") })() }}';
    expect(() => hardcodedSecrets.analyze(workflow([node('A', { parameters: { apiKey: expression } })]))).not.toThrow();
  });
});
