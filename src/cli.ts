#!/usr/bin/env node
import { open, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyzeWorkflow } from './core/analyze-workflow.js';
import { InputError, OperationError } from './core/errors.js';
import { readWorkflow } from './core/parse-workflow.js';
import { jsonReporter } from './reporters/json-reporter.js';
import { terminalReporter } from './reporters/terminal-reporter.js';

const help = `FlowAudit 0.1.0 - análise estática local de workflows n8n
Uso: flowaudit <arquivo.json> [--format terminal|json] [--output arquivo]
     flowaudit --help
     flowaudit --version

O destino de --output deve ser novo; arquivos existentes não são sobrescritos.
Códigos de saída: 0 análise concluída (com ou sem achados), 1 entrada/argumentos
inválidos, 2 falha de leitura, escrita ou operação interna.
`;

interface Options { input: string; format: 'terminal' | 'json'; output?: string }

function parseArgs(args: string[]): Options {
  let input: string | undefined;
  let format: 'terminal' | 'json' = 'terminal';
  let output: string | undefined;
  const seen = new Set<string>();
  let positional = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (!positional && arg === '--') { positional = true; continue; }
    if (!positional && (arg === '--format' || arg === '--output')) {
      if (seen.has(arg)) throw new InputError('Opção repetida. Use --help para consultar a sintaxe.');
      seen.add(arg);
      const value = args[++index];
      if (!value || value.startsWith('--') || value.includes('\0')) throw new InputError('Opção sem valor válido. Use --help.');
      if (arg === '--format') {
        if (value !== 'terminal' && value !== 'json') throw new InputError('Formato inválido. Use terminal ou json.');
        format = value;
      } else output = value;
    } else if ((!positional && arg.startsWith('-')) || !arg || arg.includes('\0') || input !== undefined) {
      throw new InputError('Argumentos inválidos. Use --help para consultar a sintaxe.');
    } else input = arg;
  }
  if (!input) throw new InputError('Informe um arquivo JSON local. Use --help para consultar a sintaxe.');
  return { input, format, ...(output !== undefined ? { output } : {}) };
}

async function saveReport(input: string, output: string, content: string): Promise<void> {
  try {
    const source = await realpath(input);
    const destination = resolve(output);
    if (source === destination) throw new OperationError('O relatório não pode substituir o arquivo de entrada.');
    // Exclusive creation also protects symlinks, hard links and existing destinations.
    const handle = await open(destination, 'wx', 0o600);
    try { await handle.writeFile(content, 'utf8'); } finally { await handle.close(); }
  } catch (error) {
    if (error instanceof OperationError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new OperationError('O arquivo de saída já existe. Escolha um destino novo.');
    }
    throw new OperationError('Não foi possível salvar o relatório. Verifique a pasta e as permissões.');
  }
}

export interface CliIO { stdout(text: string): void; stderr(text: string): void }

export async function runCli(args: string[], io: CliIO): Promise<number> {
  try {
    if (args.length === 1 && ['--help', '-h', '--version'].includes(args[0]!)) {
      io.stdout(args[0] === '--version' ? '0.1.0\n' : help);
      return 0;
    }
    const options = parseArgs(args);
    const report = analyzeWorkflow(await readWorkflow(options.input));
    const content = options.format === 'json' ? jsonReporter(report) : terminalReporter(report);
    if (options.output !== undefined) await saveReport(options.input, options.output, content);
    io.stdout(content);
    return 0;
  } catch (error) {
    if (error instanceof InputError || error instanceof OperationError) {
      io.stderr(`FlowAudit: ${error.message}\n`);
      return error instanceof InputError ? 1 : 2;
    }
    io.stderr('FlowAudit: falha interna durante a análise. Nenhum detalhe da entrada foi registrado.\n');
    return 2;
  }
}

// Importing the CLI for tests does not start a process or parse host arguments.
if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  process.exitCode = await runCli(process.argv.slice(2), {
    stdout: (text) => { process.stdout.write(text); },
    stderr: (text) => { process.stderr.write(text); },
  });
}
