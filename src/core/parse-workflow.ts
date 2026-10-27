import { open } from 'node:fs/promises';
import { z } from 'zod';
import { InputError, OperationError } from './errors.js';
import type { Connection, ConnectionIssue, Workflow } from './types.js';

export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_JSON_DEPTH = 100;
// Validate dictionaries without copying their keys: Zod's record parser omits
// __proto__, which is a valid node name or parameter key in untrusted JSON.
const record = z.custom<Record<string, unknown>>(isRecord);
const nodeSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  type: z.string().min(1),
  typeVersion: z.number().positive().optional(),
  parameters: record.default({}),
  disabled: z.boolean().optional(),
  onError: z.string().optional(),
  continueOnFail: z.boolean().optional(),
  retryOnFail: z.boolean().optional(),
});
const workflowSchema = z.object({
  name: z.string().optional(),
  nodes: z.array(nodeSchema),
  connections: record.default({}),
  settings: record.default({}),
});
const edgeSchema = z.object({
  node: z.string().min(1),
  type: z.string().min(1),
  index: z.number().int().nonnegative(),
});

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkDepth(value: unknown): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.depth > MAX_JSON_DEPTH) {
      throw new InputError('JSON excede a profundidade máxima de 100 níveis.');
    }
    if (typeof current.value === 'object' && current.value !== null) {
      for (const child of Object.values(current.value)) {
        stack.push({ value: child, depth: current.depth + 1 });
      }
    }
  }
}

export function parseWorkflow(text: string): Workflow {
  if (Buffer.byteLength(text, 'utf8') > MAX_INPUT_BYTES) {
    throw new InputError('Arquivo excede o limite de 10 MiB (10.485.760 bytes).');
  }
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/u, ''));
  } catch {
    // JSON.parse errors can include excerpts containing secrets.
    throw new InputError('JSON inválido: confira a sintaxe do arquivo.');
  }
  checkDepth(data);
  const result = workflowSchema.safeParse(data);
  if (!result.success) {
    // Never expose Zod messages, keys or input values supplied by the file.
    throw new InputError('Estrutura inválida: esperado um workflow com nodes (name e type), connections e settings com tipos compatíveis.');
  }
  const parsed = result.data;
  const names = new Set<string>();
  for (const node of parsed.nodes) {
    if (names.has(node.name)) {
      throw new InputError('Nomes de nós duplicados impedem interpretar as conexões. Renomeie os nós.');
    }
    names.add(node.name);
  }

  const connections: Connection[] = [];
  const connectionIssues: ConnectionIssue[] = [];
  const issue = (location: string, description: string): void => {
    connectionIssues.push({ location, description });
  };
  // Numeric locations avoid reflecting untrusted connection names into reports.
  Object.entries(parsed.connections).forEach(([source, groups], sourceIndex) => {
    const sourcePath = `connections[${sourceIndex}]`;
    if (!names.has(source)) issue(sourcePath, 'A origem da conexão não corresponde a um nó existente.');
    if (!isRecord(groups)) {
      issue(sourcePath, 'Esperado um objeto de tipos de conexão na origem.');
      return;
    }
    Object.entries(groups).forEach(([sourceType, outputs], typeIndex) => {
      const typePath = `${sourcePath}.types[${typeIndex}]`;
      if (!sourceType || !Array.isArray(outputs)) {
        issue(typePath, 'Tipo de conexão vazio ou saídas fora do formato de lista.');
        return;
      }
      outputs.forEach((targets: unknown, outputIndex: number) => {
        const outputPath = `${typePath}.outputs[${outputIndex}]`;
        if (targets === null) return; // n8n permits unconnected output slots.
        if (!Array.isArray(targets)) {
          issue(outputPath, 'Esperada uma lista de destinos ou null para uma saída vazia.');
          return;
        }
        targets.forEach((target: unknown, targetIndex: number) => {
          const location = `${outputPath}[${targetIndex}]`;
          const edge = edgeSchema.safeParse(target);
          if (!edge.success) {
            issue(location, 'Destino inválido: esperado node, type e index inteiro não negativo.');
          } else if (!names.has(edge.data.node)) {
            issue(location, 'O destino da conexão não corresponde a um nó existente.');
          } else if (names.has(source)) {
            connections.push({ source, target: edge.data.node, sourceType,
              targetType: edge.data.type, outputIndex, inputIndex: edge.data.index });
          }
        });
      });
    });
  });
  // Zod optional properties include undefined; normalize for exact optional types.
  return {
    ...(parsed.name !== undefined ? { name: parsed.name } : {}),
    nodes: parsed.nodes.map((node) => ({
      name: node.name, type: node.type, parameters: node.parameters,
      ...(node.id !== undefined ? { id: node.id } : {}),
      ...(node.typeVersion !== undefined ? { typeVersion: node.typeVersion } : {}),
      ...(node.disabled !== undefined ? { disabled: node.disabled } : {}),
      ...(node.onError !== undefined ? { onError: node.onError } : {}),
      ...(node.continueOnFail !== undefined ? { continueOnFail: node.continueOnFail } : {}),
      ...(node.retryOnFail !== undefined ? { retryOnFail: node.retryOnFail } : {}),
    })),
    settings: parsed.settings,
    connections,
    connectionIssues,
  };
}

export async function readWorkflow(filePath: string): Promise<Workflow> {
  let handle;
  try {
    handle = await open(filePath, 'r');
    const stat = await handle.stat();
    if (!stat.isFile()) throw new InputError('A entrada deve ser um arquivo JSON regular.');
    if (stat.size > MAX_INPUT_BYTES) throw new InputError('Arquivo excede o limite de 10 MiB (10.485.760 bytes).');
    // Bound reads even if another process grows the file after stat().
    const buffer = Buffer.alloc(MAX_INPUT_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (size > MAX_INPUT_BYTES) throw new InputError('Arquivo excede o limite de 10 MiB (10.485.760 bytes).');
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size));
    } catch {
      throw new InputError('O arquivo deve usar codificação UTF-8 válida.');
    }
    return parseWorkflow(text);
  } catch (error) {
    if (error instanceof InputError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') throw new InputError('Arquivo de entrada não encontrado.');
    if (code === 'EISDIR') throw new InputError('A entrada deve ser um arquivo JSON regular.');
    throw new OperationError('Não foi possível ler o arquivo de entrada. Verifique o caminho e as permissões.');
  } finally {
    await handle?.close();
  }
}
