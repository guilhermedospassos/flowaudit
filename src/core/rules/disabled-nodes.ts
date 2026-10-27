import type { Rule } from '../types.js';

export const disabledNodes: Rule = {
  id: 'FA002', name: 'Nós desativados', severity: 'INFO',
  description: 'Informa a presença de nós explicitamente desativados.',
  analyze: (workflow) => workflow.nodes.flatMap((node, nodeIndex) => node.disabled === true ? [{
    ruleId: 'FA002', severity: 'INFO' as const, nodeName: node.name, nodeIndex,
    description: 'Nó desativado (disabled=true). Essa configuração pode ser intencional.',
    suggestion: 'Confirme se o nó deve permanecer desativado ou se pode ser removido para facilitar a manutenção.',
  }] : []),
};
