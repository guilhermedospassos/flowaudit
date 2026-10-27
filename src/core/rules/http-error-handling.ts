import type { Rule } from '../types.js';
import { isRecord } from '../parse-workflow.js';

export const httpErrorHandling: Rule = {
  id: 'FA004', name: 'Revisão de tratamento de erro HTTP', severity: 'LOW',
  description: 'Recomenda revisar estratégias HTTP ausentes ou com saídas de erro sem destino.',
  analyze(workflow) {
    return workflow.nodes.flatMap((node, nodeIndex) => {
      if (node.type !== 'n8n-nodes-base.httpRequest' || node.disabled) return [];
      const errorOutput = workflow.connections.some((edge) => edge.source === node.name
        && edge.sourceType === 'main' && edge.outputIndex === 1 && edge.targetType === 'main');
      const workflowHandler = typeof workflow.settings.errorWorkflow === 'string' && workflow.settings.errorWorkflow.trim() !== '';
      const options = isRecord(node.parameters.options) ? node.parameters.options : {};
      const response = isRecord(options.response) && isRecord(options.response.response)
        ? options.response.response : {};
      const neverError = response.neverError === true || options.ignoreResponseCode === true || node.parameters.ignoreResponseCode === true;
      const separate = node.onError === 'continueErrorOutput';
      const explicit = ['stopWorkflow', 'continueRegularOutput', 'continueErrorOutput'].includes(node.onError ?? '');
      const hasStrategy = explicit || node.continueOnFail === true || node.retryOnFail === true || workflowHandler || neverError;
      if (hasStrategy && (!separate || errorOutput)) return [];
      const observations = [
        `retryOnFail: ${node.retryOnFail === true ? 'ativo' : 'não observado'}`,
        `continueOnFail: ${node.continueOnFail === true ? 'ativo' : 'não observado'}`,
        `onError: ${explicit ? 'estratégia explícita' : 'não reconhecido ou ausente'}`,
        `saída principal 1 conectada: ${errorOutput ? 'sim' : 'não'}`,
        `errorWorkflow: ${workflowHandler ? 'configurado' : 'não observado'}`,
        `ignorar status HTTP de erro: ${neverError ? 'ativo' : 'não observado'}`,
      ];
      return [{ ruleId: 'FA004', severity: 'LOW' as const, nodeName: node.name, nodeIndex,
        description: `${separate ? 'Saída de erro selecionada sem destino válido observado.' : 'Estratégia de falhas HTTP merece revisão.'} ${observations.join('; ')}.`,
        suggestion: 'Confirme se interromper o workflow é intencional ou se convém usar retry, continuação, saída de erro ou errorWorkflow. A configuração não garante recuperação.' }];
    });
  },
};
