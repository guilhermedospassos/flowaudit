import type { Rule } from '../types.js';

export const invalidConnections: Rule = {
  id: 'FA005', name: 'Referências de conexão inválidas', severity: 'MEDIUM',
  description: 'Relata conexões recuperáveis que não puderam integrar o grafo.',
  analyze: (workflow) => workflow.connectionIssues.map((issue) => ({
    ruleId: 'FA005', severity: 'MEDIUM' as const, location: issue.location,
    description: issue.description,
    suggestion: 'Revise a conexão no editor n8n e exporte novamente. As demais conexões válidas foram analisadas.',
  })),
};
