import { isRecord } from '../core/parse-workflow.js';

export interface SecretMatch { location: string; values: string[] }

function sensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/gu, '');
  return /(?:password|passwd|apikey|secret|accesstoken|refreshtoken|authtoken|authorization|privatekey|clientsecret)/u.test(normalized)
    || /^(?:token|pwd|cookie|setcookie)$/u.test(normalized);
}

function literal(value: string): boolean {
  const text = value.trim().replace(/^(?:Bearer|Basic)\s+/iu, '');
  if (!text) return false;
  if (/^(?:\*+|x{3,}|<[^>]+>|\$\{[^}]+\}|\[REDACTED\]|REDACTED|placeholder|changeme|your[-_ ].*|example|dummy|test)$/iu.test(text)) return false;
  // Ignore a whole dynamic expression, but do not ignore a literal prefix/suffix.
  if (/^=?\{\{[\s\S]*\}\}$/u.test(text)) return false;
  return true;
}

/** Iterative walk, including JSON-encoded parameter objects; never executes expressions. */
export function findSecrets(parameters: Record<string, unknown>): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const stack: Array<{ value: unknown; path: string; key: string; depth: number }> = [
    { value: parameters, path: 'parameters', key: '', depth: 0 },
  ];
  while (stack.length) {
    const { value, path, key, depth } = stack.pop()!;
    if (depth > 100) continue;
    if (typeof value === 'string') {
      const text = value.trim();
      const bearer = /\b(?:Bearer|Basic)\s+(\{\{[\s\S]*?\}\}|[^\s"'<>;,]+)/iu.exec(text);
      const knownToken = /\b(?:sk-[a-zA-Z0-9_-]{16,}|gh[pousr]_[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16})\b/u.exec(text);
      const urlSecret = /[?&](?:api[_-]?key|token|access_token|password|secret)=(\{\{[\s\S]*?\}\}|[^&#\s]+)/iu.exec(text);
      const userInfo = /:\/\/[^\s/:@]+:([^\s/@]+)@/u.exec(text);
      if ((sensitiveKey(key) && literal(text))
        || (bearer && literal(bearer[1]!)) || knownToken
        || (urlSecret && literal(urlSecret[1]!)) || (userInfo && literal(userInfo[1]!))) {
        const values = [value];
        for (const part of [bearer?.[1], knownToken?.[0], urlSecret?.[1], userInfo?.[1]]) {
          if (part && literal(part)) values.push(part);
        }
        matches.push({ location: path, values });
      }
      if (text.startsWith('{') || text.startsWith('[')) {
        try {
          const nested: unknown = JSON.parse(text);
          if (typeof nested === 'object' && nested !== null) {
            stack.push({ value: nested, path: `${path}.json`, key: '', depth: depth + 1 });
          }
        } catch { /* A plain parameter string is not required to be JSON. */ }
      }
    } else if (Array.isArray(value)) {
      value.forEach((child: unknown, index: number) => {
        stack.push({ value: child, path: `${path}[${index}]`, key, depth: depth + 1 });
      });
    } else if (isRecord(value)) {
      // HTTP headers/query/body collections store semantic keys in name/value pairs.
      const pairName = typeof value.name === 'string' ? value.name : '';
      Object.entries(value).forEach(([childKey, child]) => {
        stack.push({ value: child, path: `${path}[${JSON.stringify(childKey)}]`,
          key: childKey === 'value' && sensitiveKey(pairName) ? pairName : childKey,
          depth: depth + 1 });
      });
    } else if (typeof value === 'number' && sensitiveKey(key)) {
      matches.push({ location: path, values: [String(value)] });
    }
  }
  return matches.sort((a, b) => compare(a.location, b.location));
}

export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
