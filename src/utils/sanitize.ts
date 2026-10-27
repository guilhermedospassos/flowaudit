import { stripVTControlCharacters } from 'node:util';

export function createSanitizer(secrets: string[]): (value: string) => string {
  const values = [...new Set(secrets.filter(Boolean).flatMap((secret) => [
    secret, JSON.stringify(secret).slice(1, -1),
  ]))].sort((a, b) => b.length - a.length);
  return (value) => {
    let safe = value;
    for (const secret of values) safe = safe.split(secret).join('[REDACTED]');
    return stripVTControlCharacters(safe)
      .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/gu, ' ')
      .slice(0, 512);
  };
}
