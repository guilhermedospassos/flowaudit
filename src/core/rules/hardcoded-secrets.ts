import type { Rule } from '../types.js';
import { findSecrets } from '../../utils/secret-detection.js';

export const hardcodedSecrets: Rule = {
  id: 'FA003', name: 'Possíveis credenciais expostas', severity: 'HIGH',
  description: 'Detecta indícios de segredos literais em parâmetros, sem divulgar os valores.',
  analyze: (workflow) => workflow.nodes.flatMap((node, nodeIndex) => findSecrets(node.parameters).map((match) => ({
    ruleId: 'FA003', severity: 'HIGH' as const, nodeName: node.name, nodeIndex, location: match.location,
    description: 'Possível valor sensível literal em parâmetro. O valor foi omitido.',
    suggestion: 'Use credenciais gerenciadas pelo n8n ou uma referência dinâmica. Se houve compartilhamento, revise a necessidade de revogar o segredo.',
  }))),
};
