# FlowAudit

- Trabalhe somente neste projeto. Nunca use exports reais de clientes nos exemplos ou testes.
- CLI local em TypeScript strict/ESM, Node.js 22.12+. Não acrescente rede, telemetria, execução de expressões, UI ou instâncias n8n ao MVP.
- `parse-workflow.ts` valida com Zod, limita bytes/profundidade e normaliza conexões. Falhas recuperáveis alimentam FA005; entrada ambígua é rejeitada.
- Regras independentes em `src/core/rules`, registradas em `analyze-workflow.ts`. Relatórios consomem o resultado já sanitizado do motor.
- Nunca inclua valores sensíveis em mensagens, erros ou snapshots. Para falhas de sanitização, corrija a causa e inclua teste de regressão.
- Preserve determinismo, referências de IA e arquivos analisados. Não sobrescreva destinos de relatórios existentes.
- Execute `npm test`, `npm run test:coverage`, `npm run typecheck` e `npm run build`. Cada regra precisa de casos positivos e negativos; testes ficam offline.
- Documente comportamento e limites reais no README. Não afirme verificações que não executou. Não publique, crie remoto ou faça push sem autorização.
