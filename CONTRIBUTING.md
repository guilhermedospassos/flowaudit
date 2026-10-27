# Contribuir com o FlowAudit

O projeto usa TypeScript strict e módulos ESM. Requer Node.js 22.12 ou superior e npm. A documentação principal é escrita em português brasileiro; código e identificadores usam inglês.

## Preparar o ambiente

Baixe ou clone o repositório e abra um terminal na pasta do projeto:

```sh
npm ci
npm start -- examples/basic-workflow.json
```

`npm ci` instala as versões do lockfile e compila a CLI automaticamente. Para trabalhar no código sem recompilar a cada execução:

```sh
npm run analyze -- examples/workflow-with-findings.json
```

## Antes de enviar uma alteração

```sh
npm run typecheck
npm test
npm run test:coverage
npm run build
```

Inclua testes para mudanças de comportamento e mantenha o README atualizado. Cada regra precisa de casos positivos e negativos. Para erros de segurança, acrescente testes de regressão com dados fictícios.

As regras ficam em `src/core/rules/` e são registradas em `src/core/analyze-workflow.ts`. O parser valida e normaliza os dados; os reporters recebem o relatório sanitizado. Preserve a ordenação determinística e os códigos de saída documentados.

## Dados e escopo

Nunca inclua exports de produção, credenciais ou dados pessoais em commits, issues ou pull requests. Use `local-workflows/` e `local-reports/` para testes privados; ambos são ignorados pelo Git. Crie reproduções sintéticas para bugs encontrados em workflows reais.

O MVP faz análise estática local. Não adicione telemetria, chamadas a instâncias n8n, execução de workflows ou envio de dados sem uma discussão explícita de escopo.

Descreva no pull request o problema, a alteração e as verificações executadas. Não declare testes ou compatibilidade que não verificou.
