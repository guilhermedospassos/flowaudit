# Segurança

O FlowAudit trata exports JSON como dados não confiáveis e faz análise estática local. Não executa workflows ou expressões, não acessa instâncias n8n e não envia o conteúdo analisado pela rede.

## Relatar uma vulnerabilidade

Use a opção **Security → Report a vulnerability** no repositório GitHub quando o relato privado estiver habilitado. Se ela não estiver disponível, abra uma issue pedindo um canal privado, sem publicar detalhes de exploração, segredos ou exports reais.

Inclua a versão do FlowAudit e do Node.js, o comportamento observado, o impacto e uma reprodução sintética mínima. Nunca anexe exports de produção ou credenciais. As correções de segurança serão documentadas no changelog e acompanhadas de testes de regressão.

## Cuidados ao usar

- Os achados são heurísticos; ausência de alertas não comprova ausência de segredos ou falhas.
- Mantenha exports reais em `local-workflows/` e relatórios em `local-reports/`. Não os adicione ao Git com `--force`.
- Relatórios incluem nomes de workflows e nós. Mesmo sanitizados, podem conter informações internas; revise-os antes de compartilhar.
- A entrada tem limite de 10 MiB e 100 níveis de profundidade. O arquivo original não é alterado, e relatórios existentes não são sobrescritos.
- A análise funciona offline. Instalar dependências e consultar `npm audit` requer rede; essas consultas não enviam workflows.

## Desenvolvimento e publicação

Antes de publicar uma versão, execute os testes, cobertura, typecheck, build e `npm audit`. Revise os arquivos do commit e o conteúdo de `npm pack --dry-run`. Não publique uma versão com alertas relevantes sem avaliação e correção documentadas.

Esta política não oferece uma garantia de ausência de vulnerabilidades nem um prazo de atendimento.
