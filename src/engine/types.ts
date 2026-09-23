/**
 * Core domain types for the LearnMLflow world engine.
 *
 * The engine is a pure in-memory simulation of MLflow Tracking + Model
 * Registry. No DOM, no network — UI consumes World snapshots only.
 */

export type Stage = 'None' | 'Staging' | 'Production' | 'Archived';

export const STAGES: readonly Stage[] = [
  'None',
  'Staging',
  'Production',
  'Archived',
] as const;

export interface Run {
  id: string;
  experimentId: string;
  name: string;
  status: 'RUNNING' | 'FINISHED' | 'FAILED' | 'KILLED';
  params: Record<string, string>;
  metrics: Record<string, number>;
  tags: Record<string, string>;
  artifacts: string[];
  startedAt: number;
  endedAt: number | null;
}

export interface Experiment {
  id: string;
  name: string;
  runIds: string[];
}

export interface ModelVersion {
  version: number;
  modelName: string;
  runId: string;
  stage: Stage;
  createdAt: number;
  description: string;
}

export interface RegisteredModel {
  name: string;
  versions: ModelVersion[];
  description: string;
}

export interface World {
  experiments: Experiment[];
  runs: Record<string, Run>;
  models: Record<string, RegisteredModel>;
  activeExperimentId: string | null;
  activeRunId: string | null;
  nextExperimentId: number;
  nextRunId: number;
  clock: number;
}

export type CommandResult =
  | { ok: true; lines: string[]; world: World }
  | { ok: false; error: string; world: World };

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
  /** Short learning outcomes for share posts and the curriculum summary. */
  learning?: string[];
  /** Checklist shown in the right panel; each line is one required outcome. */
  goalSteps?: string[];
  disabledCommands?: string[];
}

export interface Sequence {
  id: string;
  displayName: string;
  about: string;
  tab: 'main' | 'registry';
}
