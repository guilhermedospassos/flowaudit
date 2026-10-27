# Changelog

## 0.1.0 — MVP inicial

### Implementado

- CLI local para exports JSON de um workflow n8n, com Node.js 22.12+.
- Parser com validação, limite de 10 MiB e profundidade de 100 níveis.
- Regras FA001–FA005 para conectividade, nós desativados, possíveis segredos, estratégia de erro HTTP e conexões inválidas.
- Suporte a conexões convencionais e de subnós de IA.
- Relatórios de terminal e JSON, exportação para arquivo e códigos de saída previsíveis.
- Instalação com compilação automática, comando `npm start` e executável `flowaudit` no pacote distribuído.
- Testes offline, cobertura e integração contínua para Windows/Linux e Node.js 22/24.

### Segurança

- Sanitização de valores detectados e de sequências de controle nos metadados dos relatórios.
- Correções para múltiplos tokens no mesmo parâmetro, chaves `__proto__`, valores com espaços nas extremidades e segredos recompostos pela limpeza de sequências de terminal.
- Pastas de testes privados e relatórios excluídas do Git e do pacote npm.
- Actions oficiais fixadas por SHA, auditoria de dependências na CI e teste de exclusão de dados privados do pacote.

A inclusão neste changelog descreve o conteúdo da versão; não implica que ela já tenha sido publicada no npm ou no GitHub.
