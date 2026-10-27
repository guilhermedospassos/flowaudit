import type { Report } from '../core/types.js';

export function terminalReporter(report: Report): string {
  const counts = report.summary.bySeverity;
  const lines = [
    'FlowAudit - análise estática local',
    `Workflow: ${report.workflow.name || '(sem nome)'}`,
    `Nós: ${report.workflow.nodeCount} | Achados: ${report.summary.total}`,
    `HIGH: ${counts.HIGH} | MEDIUM: ${counts.MEDIUM} | LOW: ${counts.LOW} | INFO: ${counts.INFO}`,
    '',
  ];
  for (const finding of report.findings) {
    lines.push(`[${finding.severity}] ${finding.ruleId}${finding.nodeName !== undefined ? ` - ${finding.nodeName}` : ''}`,
      ...(finding.location ? [`  Local: ${finding.location}`] : []),
      `  ${finding.description}`, `  Recomendação: ${finding.suggestion}`, '');
  }
  if (!report.findings.length) lines.push('Nenhum achado nas regras disponíveis.', '');
  lines.push('Análise heurística: revise os achados no contexto do workflow.');
  return `${lines.join('\n')}\n`;
}
