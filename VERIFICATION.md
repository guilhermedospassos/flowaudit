# Verificação local — 27/10/2026

Ambiente: Windows, Node.js 24.22.0, npm 11.19.1 e Git 2.56.0.

## Resultados executados

| Verificação | Resultado |
| --- | --- |
| `npm ci --offline --logs-dir .tmp/npm-logs --no-audit --no-fund --loglevel=error` | Instalação limpa concluída: 70 pacotes recuperados do cache npm. |
| `npm run typecheck` | Passou, incluindo código-fonte, testes e configuração do Vitest. |
| `npm test` | 133 testes passaram em 7 arquivos após a revisão de segurança e distribuição. |
| `npm run test:coverage` | 133 testes passaram; limites globais de cobertura atendidos. |
| `npm run build` | Passou; CLI JavaScript e declarações geradas em `dist/`. |
| `node dist/cli.js examples/basic-workflow.json` | 2 nós, nenhum achado e código 0. |
| `node dist/cli.js examples/workflow-with-findings.json --format json --output .tmp/final-report.json` | 5 achados; arquivo JSON exportado e valores sensíveis omitidos. |
| `npm start -- examples/basic-workflow.json` | 2 nós, nenhum achado; usa o build automático feito por `npm ci`. |
| Instalação do pacote `.tgz` em pasta separada | Executável instalado funcional, com apenas FlowAudit e Zod; exports privados analisados sem erros ou alterações nos originais. |
| `npm audit --json` no PowerShell externo | Resultado lido localmente: zero vulnerabilidades conhecidas reportadas. |

Cobertura V8 medida após a instalação limpa:

| Métrica | Cobertura |
| --- | --- |
| Statements | 96,45% |
| Branches | 93,10% |
| Functions | 96,36% |
| Lines | 97,87% |

O teste de integração compila a CLI em uma pasta temporária dentro do projeto e executa o JavaScript emitido. Ele verifica que stdout contém apenas JSON e stderr permanece vazio. Outro teste cria marcadores sintéticos privados e verifica sua exclusão do pacote npm. Os demais testes exercitam as funções da CLI, leitura/escrita, parser, regras, falsos positivos, conexões de IA e sanitização.

## Correções verificadas

- Casos parametrizados da CLI passaram a encapsular o array de argumentos em um objeto. Isso evita que o Vitest expanda os argumentos e faça o caso vazio receber `undefined`.
- Dicionários são validados sem copiar suas propriedades, preservando `__proto__` como dado. Há regressões para conexões com esse nome e detecção de segredos dentro desse parâmetro, sem alteração de protótipos.
- A entrada do Zod no lockfile recebeu URL e integridade SHA-512 calculada a partir do pacote original em cache. O `npm ci` offline confirmou a instalação reproduzível para a plataforma local.

## Limites desta verificação

A instalação inicial e a auditoria npm foram feitas pelo usuário em um PowerShell externo. O terminal gerenciado desta sessão não tem acesso ao registro npm; a reinstalação local foi validada offline. Para o teste de instalação do pacote de distribuição, o arquivo original do Zod em cache foi fornecido explicitamente junto ao `.tgz`.

Neste terminal, `npm run analyze -- examples/basic-workflow.json` encontra uma restrição do tsx ao consultar o usuário do Windows: `uv_os_get_passwd` retorna `ENOMEM`. Essa falha ocorre na inicialização da ferramenta de desenvolvimento, antes do código FlowAudit. A CLI compilada funciona e foi testada neste mesmo terminal. O usuário confirmou a execução bem-sucedida do comando npm de desenvolvimento no PowerShell externo: 2 nós, nenhum achado e relatório esperado.

O GitHub Actions foi configurado para Windows/Linux e Node.js 22/24. As verificações locais foram executadas em Windows com Node.js 24; o estado da matriz remota deve ser consultado na [página de Actions](https://github.com/guilhermedospassos/flowaudit/actions). Não confunda a matriz configurada com compatibilidade já confirmada por execução.

## Versionamento local

Git foi inicializado na branch `main`. O usuário criou o commit local `6f4e693` (`feat: implement FlowAudit MVP`) no PowerShell externo e o repositório público [guilhermedospassos/flowaudit](https://github.com/guilhermedospassos/flowaudit). As alterações posteriores de segurança e distribuição estão documentadas em [SECURITY_REVIEW.md](SECURITY_REVIEW.md). Como o terminal gerenciado não pode escrever em `.git/index.lock`, o versionamento e o push são feitos pelo usuário no PowerShell externo.
