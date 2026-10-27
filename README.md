# FlowAudit

CLI de análise estática de arquivos JSON exportados do n8n. Ajuda a revisar conexões, manutenção, tratamento de erros HTTP e possíveis segredos inseridos diretamente em parâmetros.

A análise funciona localmente. Não executa workflows ou expressões, não acessa instâncias n8n, não usa IA, não exige credenciais e não transmite o conteúdo analisado. A instalação inicial das dependências requer acesso ao npm.

## Funcionalidades

- Validação com Zod e mensagens de erro sem conteúdo da entrada ou stack traces.
- Cinco regras independentes com achados e recomendações em português.
- Interpretação de conexões convencionais e de IA, múltiplas saídas e entradas.
- Relatórios de terminal e JSON, com contagens por severidade.
- Exportação para um arquivo novo, preservando os arquivos existentes.
- Ordenação determinística: severidade, identificador da regra, índice do nó e caminho.

## Instalação e uso

Requer Node.js 22.12 ou superior e npm. O ambiente principal de desenvolvimento é Windows com Node.js 24. A ferramenta ainda não foi publicada no npm.

```powershell
cd C:\Users\Guilherme\Documents\flowaudit
npm ci
npm run analyze -- examples/basic-workflow.json
npm run analyze -- examples/workflow-with-findings.json
npm run analyze -- examples/basic-workflow.json --format json
npm run analyze -- examples/basic-workflow.json --format json --output report.json
npm run analyze -- --help
```

O `package-lock.json` fixa as versões para instalação reproduzível com `npm ci`. Caminhos com espaços devem estar entre aspas. URLs não são baixadas: o argumento representa um arquivo local.

```powershell
npm run build
node dist/cli.js "C:\workflows\Meu fluxo.json" --format json
node dist/cli.js --version
```

`--format` aceita `terminal` (padrão) ou `json`. `--output` salva o mesmo relatório enviado a stdout, em UTF-8. A pasta de destino precisa existir e o arquivo deve ser novo. Tentativas de substituir a entrada, arquivos existentes ou seus aliases são recusadas. Para caminhos iniciados com hífen, coloque as opções antes de `--` e o caminho depois dele.

O `.npmrc` local suprime os banners do npm para que `npm run analyze -- arquivo.json --format json` produza apenas JSON em stdout. Erros vão para stderr e não geram um relatório parcial em stdout.

### Exemplo de relatório

Para `examples/basic-workflow.json`:

```text
FlowAudit - análise estática local
Workflow: Fluxo básico
Nós: 2 | Achados: 0
HIGH: 0 | MEDIUM: 0 | LOW: 0 | INFO: 0

Nenhum achado nas regras disponíveis.

Análise heurística: revise os achados no contexto do workflow.
```

O exemplo `workflow-with-findings.json` usa somente dados fictícios e produz cinco achados: um HIGH, um MEDIUM, dois LOW e um INFO. Trecho do JSON:

```json
{
  "schemaVersion": "1",
  "tool": { "name": "FlowAudit", "version": "0.1.0" },
  "workflow": { "name": "Exemplo com pontos de revisão", "nodeCount": 3 },
  "summary": {
    "total": 5,
    "bySeverity": { "HIGH": 1, "MEDIUM": 1, "LOW": 2, "INFO": 1 }
  },
  "findings": [
    {
      "ruleId": "FA003",
      "severity": "HIGH",
      "nodeName": "Consultar API",
      "nodeIndex": 1,
      "location": "parameters[\"headerParameters\"][\"parameters\"][0][\"value\"]",
      "description": "Possível valor sensível literal em parâmetro. O valor foi omitido.",
      "suggestion": "Use credenciais gerenciadas pelo n8n ou uma referência dinâmica. Se houve compartilhamento, revise a necessidade de revogar o segredo."
    }
  ]
}
```

Esse trecho mostra apenas o primeiro achado; o relatório completo contém os cinco. O relatório não inclui parâmetros, credenciais, conexões completas, nome do arquivo de entrada ou o workflow original. Não há timestamp: a mesma entrada produz o mesmo relatório.

### Códigos de saída

| Código | Significado |
| --- | --- |
| `0` | Análise concluída, com ou sem achados; também help/version. |
| `1` | Argumentos ou entrada inválidos: arquivo inexistente, JSON inválido, esquema incompatível, nomes duplicados, limite excedido. |
| `2` | Falha operacional: leitura sem permissão, escrita recusada ou falha interna. |

Achados HIGH não alteram o código de saída neste MVP. Não existe opção de limiar para falhar builds.

## Regras

| Regra | Severidade | Comportamento |
| --- | --- | --- |
| FA001 — Nós desconectados | LOW | Revisa nós isolados e fontes sem entrada. Triggers conectados podem iniciar sem entrada; nós finais podem não ter saída. Reconhece ligações especiais, inclusive subnós de IA. Ignora sticky notes e ligações apenas consigo mesmo. |
| FA002 — Nós desativados | INFO | Informa `disabled=true`, que pode ser intencional. |
| FA003 — Possíveis credenciais expostas | HIGH | Busca campos sensíveis, pares name/value de headers/query/body, Bearer/Basic, alguns formatos de chave e segredos em URLs. Inspeciona objetos e JSON serializado em parâmetros. |
| FA004 — Revisão de falhas HTTP | LOW | Revisa HTTP Request sem estratégia observável ou com `continueErrorOutput` sem destino válido na saída principal 1. Considera onError, continueOnFail, retryOnFail, errorWorkflow e opções conhecidas de ignorar status HTTP. |
| FA005 — Conexões inválidas | MEDIUM | Relata origens/destinos inexistentes e grupos, saídas ou destinos malformados. Continua com as ligações válidas. |

A FA003 ignora referências a credenciais gerenciadas na propriedade `credentials`, placeholders comuns e referências dinâmicas completas, incluindo `={{ $env.API_KEY }}`. Não presume que IDs e nomes de credenciais sejam segredos. Valores detectados nunca são incluídos nos achados; também são removidos de nomes e caminhos refletidos no relatório. Caracteres de controle de terminal são removidos e textos refletidos têm limite de 512 caracteres. `nodeIndex` permite localizar um nó mesmo que seu nome seja sanitizado.

A FA004 aceita `stopWorkflow` explícito como uma estratégia intencional. Retry, continuação ou um errorWorkflow configurado também são indicadores de estratégia, sem garantir sua eficácia. Uma conexão no segundo slot sozinha não comprova que a saída de erro está ativa. Nós HTTP desativados são tratados pela FA002.

## Formato aceito e limites

- Um objeto JSON representando **um** workflow; arrays de exports em lote e pacotes `.n8np` ficam fora do MVP.
- UTF-8, com ou sem BOM, até **10 MiB (10.485.760 bytes)**. Leitura limitada mesmo se o arquivo crescer durante a análise.
- Profundidade máxima de 100 níveis para evitar estruturas abusivas.
- `nodes` é obrigatório e pode ser vazio. Cada nó precisa de `name` e `type` não vazios.
- `id` e `typeVersion` são opcionais; se presentes, devem ser string não vazia e número positivo. `parameters` é um objeto opcional, assumido vazio quando ausente.
- `name`, `settings` e `connections` do workflow são opcionais. Se presentes, precisam ter os tipos esperados. Campos extras de metadados são aceitos e descartados.
- Flags conhecidas como `disabled`, `retryOnFail` e `continueOnFail` devem ser booleanas. `onError` precisa ser string; valores futuros não são tratados como estratégias conhecidas.
- Nomes de nós duplicados e estruturas essenciais incompatíveis impedem interpretar o workflow e encerram a análise com código 1.
- Dentro de `connections`, problemas localizados geram FA005. Slots `null` e listas vazias são válidos. Tipos de ligação não são limitados a uma enumeração fechada.
- `nodeIndex` é o índice zero-based no array `nodes`. `location` de parâmetros usa propriedades entre colchetes; conexões usam índices zero-based de origem, tipo, saída e destino, conforme a ordem do arquivo.

O analisador é heurístico. Não verifica alcançabilidade a partir dos triggers, ciclos, existência de credenciais na instância, sucesso de chamadas HTTP ou validade funcional de expressões. Tipos desconhecidos são aceitos, mas triggers de comunidades podem precisar de revisão pela FA001. A detecção de segredos não substitui uma revisão antes de compartilhar um export: código, textos arbitrários e formatos não reconhecidos podem conter dados sensíveis que a ferramenta não identifica.

As referências usadas para o formato são a [documentação de exportação do n8n](https://docs.n8n.io/workflows/export-import/), os [tipos oficiais de conexões e nós](https://github.com/n8n-io/n8n/blob/master/packages/workflow/src/interfaces.ts) e a [documentação de tratamento de erros](https://docs.n8n.io/flow-logic/error-handling/). As fixtures são sintéticas; não há exports de clientes no projeto.

## Desenvolvimento e testes

Os resultados das verificações executadas nesta entrega estão em [VERIFICATION.md](VERIFICATION.md).

Stack: TypeScript strict, Node.js ESM, Zod, Vitest com cobertura V8 e tsx. Não há dependências de rede em tempo de análise ou nos testes. Não foi acrescentado lint separado: TypeScript verifica tipos, imports e variáveis não utilizados.

```powershell
npm test
npm run test:coverage
npm run typecheck
npm run build
```

Os testes cobrem parser, regras positivas e negativas, falsos positivos, IA, estratégias HTTP, relatórios, sanitização e CLI com leitura/escrita em diretórios temporários. A cobertura gera `coverage/index.html` e `coverage/lcov.info`; os limites configurados são 85% de linhas/funções/statements e 80% de branches.

O GitHub Actions está configurado para push e pull request em Windows e Linux, com Node.js 22 e 24: `npm ci`, typecheck, testes com cobertura e build. Permissão do token limitada a `contents: read`. Não há publicação automática.

## Arquitetura

```text
src/
  cli.ts                      argumentos, códigos de saída e escrita
  core/
    parse-workflow.ts          validação e normalização das conexões
    analyze-workflow.ts        regras, sanitização e consolidação
    types.ts                  contratos de dados
    errors.ts                 erros de entrada e operação
    rules/                    cinco regras independentes
  reporters/                  terminal e JSON
  utils/                      detecção de segredos e sanitização
tests/                        fixtures, regras, parser, relatórios e CLI
examples/                     workflows fictícios
.github/workflows/ci.yml       integração contínua
```

Uma regra implementa `Rule`: `id`, `name`, `description`, `severity` e `analyze(workflow)`. Retorna uma lista de `Finding` com `ruleId`, `severity`, `description`, `suggestion` e, quando aplicável, `nodeName`, `nodeIndex` e `location`. Para adicionar uma regra interna, implemente o contrato, registre-a em `core/analyze-workflow.ts` e inclua testes positivos e negativos. O parser fornece apenas arestas válidas ao grafo e mantém problemas recuperáveis separadamente.

## Roadmap

Possíveis evoluções, ainda não implementadas:

- Interface web local e relatórios HTML.
- Suporte ampliado e validado a versões do n8n.
- Regras configuráveis e comparação entre versões de workflows.
- Integração com pipelines de CI de outros projetos.
- Extensões de regras por plugins.
- IA opcional para recomendações, com controle explícito dos dados compartilhados.

O MVP não inclui login, banco de dados, serviços externos, telemetria, execução de workflows ou correção automática do JSON.

## Licença

[MIT](LICENSE).
