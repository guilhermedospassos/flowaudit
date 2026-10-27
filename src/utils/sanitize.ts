import { stripVTControlCharacters } from 'node:util';

function cleanText(value: string): string {
  return stripVTControlCharacters(value)
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/gu, ' ');
}

export function createSanitizer(secrets: string[]): (value: string) => string {
  const values = [...new Set(secrets.flatMap((secret) => [secret, cleanText(secret)])
    .flatMap((secret) => [secret, JSON.stringify(secret).slice(1, -1)])
    .filter(Boolean))].sort((a, b) => b.length - a.length);
  const redact = (value: string): string => {
    let safe = value;
    for (const secret of values) safe = safe.split(secret).join('[REDACTED]');
    return safe;
  };
  // Cleaning can join characters around an escape sequence into a secret.
  return (value) => redact(cleanText(redact(value))).slice(0, 512);
}
