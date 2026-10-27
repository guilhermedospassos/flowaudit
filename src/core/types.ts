export const severities = ['HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
export type Severity = (typeof severities)[number];

export interface WorkflowNode {
  id?: string;
  name: string;
  type: string;
  typeVersion?: number;
  parameters: Record<string, unknown>;
  disabled?: boolean;
  onError?: string;
  continueOnFail?: boolean;
  retryOnFail?: boolean;
}

export interface Connection {
  source: string;
  target: string;
  sourceType: string;
  targetType: string;
  outputIndex: number;
  inputIndex: number;
}

export interface ConnectionIssue {
  location: string;
  description: string;
}

/** Normalized data; only valid edges with existing endpoints enter connections. */
export interface Workflow {
  name?: string;
  nodes: WorkflowNode[];
  settings: Record<string, unknown>;
  connections: Connection[];
  connectionIssues: ConnectionIssue[];
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  nodeName?: string;
  nodeIndex?: number;
  location?: string;
  description: string;
  suggestion: string;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  analyze(workflow: Workflow): Finding[];
}

export interface Report {
  schemaVersion: '1';
  tool: { name: 'FlowAudit'; version: string };
  workflow: { name?: string; nodeCount: number };
  summary: { total: number; bySeverity: Record<Severity, number> };
  findings: Finding[];
}
