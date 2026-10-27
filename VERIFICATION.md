# Verificação local — 27/10/2026

Ambiente: Windows, Node.js 24.22.0, npm 11.19.1 e Git 2.56.0.

## Resultados executados

| Verificação | Resultado |
| --- | --- |
| `npm ci --offline --logs-dir .tmp/npm-logs --no-audit --no-fund --loglevel=error` | Instalação limpa concluída: 70 pacotes recuperados do cache npm. |
| `npm run typecheck` | Passou, incluindo código-fonte, testes e configuração do Vitest. |
| `npm test` | 125 testes passaram em 6 arquivos. |
| `npm run test:coverage` | 125 testes passaram; limites globais de cobertura atendidos. |
| `npm run build` | Passou; CLI JavaScript e declarações geradas em `dist/`. |
| `node dist/cli.js examples/basic-workflow.json` | 2 nós, nenhum achado e código 0. |
| `node dist/cli.js examples/workflow-with-findings.json --format json --output .tmp/final-report.json` | 5 achados; arquivo JSON exportado e valores sensíveis omitidos. |

Cobertura V8 medida após a instalação limpa:

| Métrica | Cobertura |
| --- | --- |
| Statements | 96,44% |
| Branches | 93,35% |
| Functions | 95,83% |
| Lines | 97,86% |

O teste de integração compila a CLI em uma pasta temporária dentro do projeto e executa o JavaScript emitido. Ele verifica que stdout contém apenas JSON e stderr permanece vazio. Os demais testes exercitam as funções da CLI, leitura/escrita, parser, regras, falsos positivos, conexões de IA e sanitização.

## Correções verificadas

- Casos parametrizados da CLI passaram a encapsular o array de argumentos em um objeto. Isso evita que o Vitest expanda os argumentos e faça o caso vazio receber `undefined`.
- Dicionários são validados sem copiar suas propriedades, preservando `__proto__` como dado. Há regressões para conexões com esse nome e detecção de segredos dentro desse parâmetro, sem alteração de protótipos.
- A entrada do Zod no lockfile recebeu URL e integridade SHA-512 calculada a partir do pacote original em cache. O `npm ci` offline confirmou a instalação reproduzível para a plataforma local.

## Limites desta verificação

A instalação inicial foi feita pelo usuário em um PowerShell externo. O terminal gerenciado desta sessão não tem acesso ao registro npm; a reinstalação local foi validada offline, sem auditoria de vulnerabilidades pela rede.

Neste terminal, `npm run analyze -- examples/basic-workflow.json` encontra uma restrição do tsx ao consultar o usuário do Windows: `uv_os_get_passwd` retorna `ENOMEM`. Essa falha ocorre na inicialização da ferramenta de desenvolvimento, antes do código FlowAudit. A CLI compilada funciona e foi testada neste mesmo terminal. O teste anterior de execução direta por tsx passou no PowerShell externo, conforme a saída enviada pelo usuário; o comando npm de desenvolvimento ainda precisa de confirmação nesse ambiente externo.

O GitHub Actions foi configurado para Windows/Linux e Node.js 22/24. O pipeline remoto, Linux e Node.js 22 não foram executados nesta sessão. Nenhum repositório remoto foi criado e nenhum push foi executado.

## Versionamento local

Git foi inicializado na branch `main`. A tentativa de adicionar apenas os arquivos do projeto foi recusada pelo ambiente gerenciado ao criar `.git/index.lock` (`Permission denied`); não há commit nem arquivos adicionados ao índice. A exceção de propriedade usada na tentativa foi limitada ao comando Git, sem alterar configuração global. O commit precisa ser criado no PowerShell externo, que possui acesso de escrita à pasta `.git`.
