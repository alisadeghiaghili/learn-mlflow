/**
 * Core domain types for the LearnMLflow world engine.
 *
 * Pure in-memory simulation of MLflow Tracking, Model Registry, Models,
 * and a thin slice of Evaluation + GenAI tracking. No DOM, no network.
 */

export type Stage = 'None' | 'Staging' | 'Production' | 'Archived';

export const STAGES: readonly Stage[] = [
  'None',
  'Staging',
  'Production',
  'Archived',
] as const;

export type RunStatus = 'RUNNING' | 'FINISHED' | 'FAILED' | 'KILLED';

export interface MetricPoint {
  step: number;
  value: number;
  timestamp: number;
}

export interface ArtifactEntry {
  path: string;
  size: number;
  kind: 'file' | 'model' | 'dir';
  flavor?: string;
}

export interface DatasetRef {
  name: string;
  digest: string;
  sourceType: string;
}

export interface EvalResult {
  name: string;
  value: number;
  greaterIsBetter: boolean;
}

export interface TraceSpan {
  name: string;
  kind: 'LLM' | 'CHAIN' | 'TOOL' | 'RETRIEVER';
  status: 'OK' | 'ERROR';
}

export interface Run {
  id: string;
  experimentId: string;
  name: string;
  status: RunStatus;
  parentId: string | null;
  params: Record<string, string>;
  /** Last value of each metric key (convenience). */
  metrics: Record<string, number>;
  /** Full step series for charts and epoch logging. */
  metricHistory: Record<string, MetricPoint[]>;
  tags: Record<string, string>;
  artifacts: ArtifactEntry[];
  datasets: DatasetRef[];
  evalResults: EvalResult[];
  prompts: string[];
  traces: TraceSpan[];
  source: { git: string | null; entry: string | null; version: string | null };
  env: { python: string | null; mlflow: string | null };
  /** Lightweight system metrics snapshot (ops teaching). */
  systemMetrics: Record<string, number>;
  autologged: boolean;
  startedAt: number;
  endedAt: number | null;
}

export interface Experiment {
  id: string;
  name: string;
  runIds: string[];
  tags: Record<string, string>;
}

export interface ModelVersion {
  version: number;
  modelName: string;
  runId: string;
  stage: Stage;
  createdAt: number;
  description: string;
  flavor: string;
  signature: string | null;
  aliases: string[];
  runUri: string;
  /** Release checklist status for teaching approval workflows. */
  approval: 'pending' | 'approved' | 'rejected';
}

export interface RegisteredModel {
  name: string;
  versions: ModelVersion[];
  description: string;
}

export interface ServeState {
  modelUri: string;
  port: number;
  ready: boolean;
  predictions: number;
}

export interface World {
  experiments: Experiment[];
  runs: Record<string, Run>;
  models: Record<string, RegisteredModel>;
  activeExperimentId: string | null;
  activeRunId: string | null;
  activeParentRunId: string | null;
  /** Currently loaded model URI for predict, e.g. models:/iris-clf/Production */
  loadedModelUri: string | null;
  loadedModelName: string | null;
  loadedModelVersion: number | null;
  served: ServeState | null;
  autologFlavor: string | null;
  nextExperimentId: number;
  nextRunId: number;
  clock: number;
  lastPredictions: number[];
  /** Milliseconds of last predict — used for latency teaching. */
  lastPredictLatencyMs: number | null;
}

export type CommandResult =
  | { ok: true; lines: string[]; world: World }
  | { ok: false; error: string; why?: string; world: World };

export type GoalFn = (world: World) => boolean;

export type ModalStep =
  | { type: 'text'; markdown: string[] }
  | {
      type: 'demo';
      before: string[];
      after: string[];
      command: string;
    };

export interface Level {
  id: string;
  sequenceId: string;
  name: string;
  about: string;
  hint: string;
  solutionCommand: string;
  startWorld: World;
  goal: GoalFn;
  dialog: ModalStep[];
  learning?: string[];
  goalSteps?: string[];
  disabledCommands?: string[];
}

export interface Sequence {
  id: string;
  displayName: string;
  about: string;
  tab: 'main' | 'registry' | 'models' | 'ops' | 'ai';
}
