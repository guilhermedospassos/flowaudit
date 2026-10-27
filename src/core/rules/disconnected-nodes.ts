import type { Rule } from '../types.js';

export const disconnectedNodes: Rule = {
  id: 'FA001', name: 'Nós desconectados', severity: 'LOW',
  description: 'Revisa nós isolados ou sem entrada relevante, considerando conexões de IA.',
  analyze(workflow) {
    const incoming = new Set<string>();
    const outgoing = new Set<string>();
    const special = new Set<string>();
    const visual = new Set(workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.stickyNote').map((n) => n.name));
    for (const edge of workflow.connections) {
      if (visual.has(edge.source) || visual.has(edge.target) || edge.source === edge.target) continue;
      incoming.add(edge.target);
      outgoing.add(edge.source);
      if (edge.sourceType !== 'main' || edge.targetType !== 'main') {
        special.add(edge.source);
        special.add(edge.target);
      }
    }
    return workflow.nodes.flatMap((node, nodeIndex) => {
      if (visual.has(node.name)) return [];
      const isolated = !incoming.has(node.name) && !outgoing.has(node.name);
      const trigger = /trigger$/iu.test(node.type) || ['n8n-nodes-base.webhook', 'n8n-nodes-base.start'].includes(node.type);
      if (!isolated && (incoming.has(node.name) || trigger || special.has(node.name))) return [];
      return [{ ruleId: 'FA001', severity: 'LOW' as const, nodeName: node.name, nodeIndex,
        description: isolated ? 'Nó sem conexões relevantes com outros nós; revise se deve integrar o fluxo.'
          : 'Nó com saídas, mas sem entrada observada; pode ser um ponto de início ou conexão ausente.',
        suggestion: 'Confira a intenção do nó e suas ligações. Triggers podem iniciar fluxos sem entrada; nós finais podem não ter saída.' }];
    });
  },
};
