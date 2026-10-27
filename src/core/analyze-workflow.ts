import type { Report, Rule, Workflow } from './types.js';
import { severities } from './types.js';
import { disconnectedNodes } from './rules/disconnected-nodes.js';
import { disabledNodes } from './rules/disabled-nodes.js';
import { hardcodedSecrets } from './rules/hardcoded-secrets.js';
import { httpErrorHandling } from './rules/http-error-handling.js';
import { invalidConnections } from './rules/invalid-connections.js';
import { findSecrets, compare } from '../utils/secret-detection.js';
import { createSanitizer } from '../utils/sanitize.js';

export const rules: readonly Rule[] = [disconnectedNodes, disabledNodes, hardcodedSecrets, httpErrorHandling, invalidConnections];

export function analyzeWorkflow(workflow: Workflow): Report {
  const secrets = workflow.nodes.flatMap((node) => findSecrets(node.parameters).flatMap((match) => match.values));
  const sanitize = createSanitizer(secrets);
  const findings = rules.flatMap((rule) => rule.analyze(workflow)).map((finding) => ({
    ...finding,
    ...(finding.nodeName !== undefined ? { nodeName: sanitize(finding.nodeName) } : {}),
    ...(finding.location !== undefined ? { location: sanitize(finding.location) } : {}),
    description: sanitize(finding.description), suggestion: sanitize(finding.suggestion),
  })).sort((a, b) => severities.indexOf(a.severity) - severities.indexOf(b.severity)
    || compare(a.ruleId, b.ruleId) || (a.nodeIndex ?? -1) - (b.nodeIndex ?? -1)
    || compare(a.location ?? '', b.location ?? ''));
  const bySeverity = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const finding of findings) bySeverity[finding.severity]++;
  return {
    schemaVersion: '1', tool: { name: 'FlowAudit', version: '0.1.0' },
    workflow: { ...(workflow.name !== undefined ? { name: sanitize(workflow.name) } : {}), nodeCount: workflow.nodes.length },
    summary: { total: findings.length, bySeverity }, findings,
  };
}
