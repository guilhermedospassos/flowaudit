import type { Report } from '../core/types.js';

export function jsonReporter(report: Report): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
