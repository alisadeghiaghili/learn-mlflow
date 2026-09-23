/**
 * Goal predicates and helpers for levels.
 *
 * Unlike a fixed goal-tree snapshot, MLflow state is rich (params, metrics,
 * stages). Goals are boolean predicates over World — easy to write,
 * easy to test, and honest about what "solved" means.
 */

import type { GoalFn, Stage, World } from './types';
import { listRuns } from './world';

/** True when an experiment with this name exists. */
export function hasExperiment(name: string): GoalFn {
  return (w) => w.experiments.some((e) => e.name === name);
}

/** True when the active experiment is `name`. */
export function activeExperimentIs(name: string): GoalFn {
  return (w) =>
    w.activeExperimentId != null &&
    w.experiments.some((e) => e.id === w.activeExperimentId && e.name === name);
}

/** At least `n` runs exist (optionally in a named experiment). */
export function minRuns(n: number, experimentName?: string): GoalFn {
  return (w) => {
    const exp = experimentName
      ? w.experiments.find((e) => e.name === experimentName)
      : null;
    if (experimentName && !exp) return false;
    return listRuns(w, exp?.id).length >= n;
  };
}

/** Some run has param `key` equal to `value` (or any value if omitted). */
export function runHasParam(
  key: string,
  value?: string,
  experimentName?: string,
): GoalFn {
  return (w) =>
    listRuns(w, findExpId(w, experimentName)).some((r) => {
      if (!(key in r.params)) return false;
      return value === undefined || r.params[key] === value;
    });
}

/** Some run has metric `key` at least `min` (or equal if `equals` set). */
export function runHasMetric(
  key: string,
  opts: { min?: number; max?: number; equals?: number } = {},
  experimentName?: string,
): GoalFn {
  return (w) =>
    listRuns(w, findExpId(w, experimentName)).some((r) => {
      if (!(key in r.metrics)) return false;
      const v = r.metrics[key];
      if (opts.equals !== undefined) return v === opts.equals;
      if (opts.min !== undefined && v < opts.min) return false;
      if (opts.max !== undefined && v > opts.max) return false;
      return true;
    });
}

export function runHasTag(
  key: string,
  value?: string,
  experimentName?: string,
): GoalFn {
  return (w) =>
    listRuns(w, findExpId(w, experimentName)).some((r) => {
      if (!(key in r.tags)) return false;
      return value === undefined || r.tags[key] === value;
    });
}

export function runHasArtifact(name: string, experimentName?: string): GoalFn {
  return (w) =>
    listRuns(w, findExpId(w, experimentName)).some((r) =>
      r.artifacts.includes(name),
    );
}

/** A registered model exists with at least `n` versions. */
export function modelExists(name: string, minVersions = 1): GoalFn {
  return (w) => {
    const m = w.models[name];
    return !!m && m.versions.length >= minVersions;
  };
}

/** Model version is in a given stage. */
export function modelVersionInStage(
  name: string,
  version: number,
  stage: Stage,
): GoalFn {
  return (w) => {
    const m = w.models[name];
    if (!m) return false;
    const v = m.versions.find((x) => x.version === version);
    return !!v && v.stage === stage;
  };
}

/** At least one version of the model is in `stage`. */
export function modelHasStage(name: string, stage: Stage): GoalFn {
  return (w) => {
    const m = w.models[name];
    return !!m && m.versions.some((v) => v.stage === stage);
  };
}

/** All listed goals must hold. */
export function all(...goals: GoalFn[]): GoalFn {
  return (w) => goals.every((g) => g(w));
}

/** At least one goal holds. */
export function any(...goals: GoalFn[]): GoalFn {
  return (w) => goals.some((g) => g(w));
}

function findExpId(w: World, experimentName?: string): string | undefined {
  if (!experimentName) return undefined;
  return w.experiments.find((e) => e.name === experimentName)?.id;
}
