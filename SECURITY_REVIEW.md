# Revisão de segurança antes da publicação

Data: 27/10/2026. Revisão local do código, configuração, distribuição e compatibilidade do FlowAudit. As regressões usam dados sintéticos; os exports privados foram analisados somente no computador do usuário. Não equivale a uma auditoria independente.

## Problemas encontrados e corrigidos

1. **Múltiplos segredos no mesmo parâmetro:** a detecção registrava o primeiro token de cada padrão. Um segundo token repetido no nome de um nó ou workflow podia aparecer no relatório. A coleta agora inclui todas as ocorrências de Bearer/Basic, formatos conhecidos de chave e senhas/tokens em URLs.
2. **Segredo reaparecendo após limpeza de terminal:** remover sequências de escape de um nome podia recompor um valor sensível depois da sanitização. O sanitizador agora considera também a forma limpa dos segredos e repete a remoção após limpar o texto.
3. **Espaços nas extremidades de valores sensíveis:** o valor sem espaços podia reaparecer em um nome, pois apenas a string original era removida. A coleta inclui a forma original e a forma sem espaços externos.

Os testes reproduziram as falhas antes das correções e passaram depois delas. Foram acrescentados sete casos de regressão cobrindo múltiplos tokens, URLs, nomes, espaços externos, sequências de terminal e relatórios JSON/terminal, além de um teste de exclusão de dados privados do pacote. Nenhum dado real foi incluído nos testes.

## Verificações executadas

- `npm test`: 133 testes passaram em 7 arquivos.
- `npm run test:coverage`: 97,87% de linhas, 93,10% de branches, 96,36% de funções e 96,45% de statements; limites atendidos.
- `npm run typecheck` e `npm run build`: passaram.
- Entrada: revisão dos limites de 10 MiB e 100 níveis, validação de tipos e erros sanitizados, com testes existentes.
- Arquivos: preservação da entrada e criação exclusiva de relatórios, incluindo testes contra sobrescrita e aliases.
- Produção: não foram encontradas chamadas de rede, execução de expressões, `eval`, `new Function` ou subprocessos em `src`.
- Rastreio local dos 45 arquivos candidatos à publicação, incluindo os ainda não versionados: não foram encontrados valores não fictícios nos padrões examinados de chaves privadas, tokens GitHub/OpenAI e IDs de acesso AWS. Esse rastreio não abrange todos os formatos possíveis de segredo.
- `git check-ignore`: confirmou exclusão de `local-workflows/` e `local-reports/`. Nenhum arquivo dessas pastas estava versionado.
- `npm pack --dry-run --json --ignore-scripts --cache .tmp/npm-cache --logs-dir .tmp/npm-logs`: passou. A lista contém somente `dist`, README, licença e metadados do pacote; nenhuma pasta de dados locais foi incluída. Nenhum pacote foi publicado.
- `git diff --check`: passou.
- O usuário executou `npm audit --json` no PowerShell com rede. O resultado salvo em `local-reports/npm-audit.json` foi lido localmente: zero vulnerabilidades conhecidas reportadas, incluindo as dependências de desenvolvimento. Essa é uma consulta ao estado da base de avisos naquele momento, não uma garantia de ausência de vulnerabilidades.
- `npm ci` offline foi repetido com a compilação automática habilitada; `npm start` executou a CLI resultante com sucesso.
- Um pacote `.tgz` foi instalado em uma pasta separada, com somente FlowAudit e Zod. Como o terminal não tem acesso à rede, o arquivo original do Zod em cache foi fornecido explicitamente nessa instalação de teste. O executável instalado analisou os exports privados com JSON válido em stdout e stderr vazio.
- As actions oficiais da CI foram verificadas nos repositórios de origem e fixadas pelos commits das tags v7. O pipeline também consulta `npm audit --audit-level=high`, usa apenas `contents: read` e não persiste credenciais no checkout.

## Dados locais para testes

Copie os exports para `local-workflows/` e mantenha os relatórios em `local-reports/`. As duas pastas foram criadas e estão ignoradas pelo Git. Não copie exports reais para `examples/` ou `tests/fixtures/`.

A análise dos exports privados foi executada com o motor e com a CLI instalada do pacote. Todos foram aceitos, sem alterações nos originais; análises repetidas foram determinísticas. Conteúdo bruto e nomes privados não foram impressos nem enviados a serviços externos. Relatórios e a identificação dos arquivos ficam em `local-reports/`, fora do Git. Os achados são recomendações para revisão, sem garantia de que os workflows funcionem ou estejam livres de segredos.

## Publicação e acompanhamento

- O código e os documentos são destinados ao repositório público [guilhermedospassos/flowaudit](https://github.com/guilhermedospassos/flowaudit). Exports, relatórios e o arquivo da auditoria npm permanecem locais.
- A execução local cobre Windows com Node.js 24. A matriz configurada para Linux/Windows e Node.js 22/24 precisa ser confirmada pelos [resultados do GitHub Actions](https://github.com/guilhermedospassos/flowaudit/actions).
- Consulte [SECURITY.md](SECURITY.md) para relato de vulnerabilidades e repita a auditoria de dependências antes de cada versão. O projeto não publica pacotes automaticamente.
