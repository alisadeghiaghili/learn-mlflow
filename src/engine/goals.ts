/**
 * Goal predicates for levels. Boolean predicates over World.
 */

import type { GoalFn, Run, Stage, World } from './types';
import { listRuns, searchRuns } from './world';

export function hasExperiment(name: string): GoalFn {
  return (w) => w.experiments.some((e) => e.name === name);
}

export function experimentHasTag(
  name: string,
  key: string,
  value?: string,
): GoalFn {
  return (w) => {
    const e = w.experiments.find((x) => x.name === name);
    if (!e || !(key in e.tags)) return false;
    return value === undefined || e.tags[key] === value;
  };
}

export function activeExperimentIs(name: string): GoalFn {
  return (w) =>
    w.activeExperimentId != null &&
    w.experiments.some(
      (e) => e.id === w.activeExperimentId && e.name === name,
    );
}

export function minRuns(n: number, experimentName?: string): GoalFn {
  return (w) => listRuns(w, findExpId(w, experimentName)).length >= n;
}

export function someRun(pred: (r: Run, w: World) => boolean, experimentName?: string): GoalFn {
  return (w) => listRuns(w, findExpId(w, experimentName)).some((r) => pred(r, w));
}

export function runHasParam(
  key: string,
  value?: string,
  experimentName?: string,
): GoalFn {
  return someRun((r) => {
    if (!(key in r.params)) return false;
    return value === undefined || r.params[key] === value;
  }, experimentName);
}

export function runHasMetric(
  key: string,
  opts: { min?: number; max?: number; equals?: number } = {},
  experimentName?: string,
): GoalFn {
  return someRun((r) => {
    if (!(key in r.metrics)) return false;
    const v = r.metrics[key];
    if (opts.equals !== undefined) return v === opts.equals;
    if (opts.min !== undefined && v < opts.min) return false;
    if (opts.max !== undefined && v > opts.max) return false;
    return true;
  }, experimentName);
}

/** Metric key has at least `n` logged steps (epoch-style series). */
export function runHasMetricSteps(
  key: string,
  minSteps: number,
  experimentName?: string,
): GoalFn {
  return someRun((r) => (r.metricHistory[key]?.length ?? 0) >= minSteps, experimentName);
}

export function runHasTag(
  key: string,
  value?: string,
  experimentName?: string,
): GoalFn {
  return someRun((r) => {
    if (!(key in r.tags)) return false;
    return value === undefined || r.tags[key] === value;
  }, experimentName);
}

export function runHasArtifact(
  name: string,
  experimentName?: string,
  kind?: 'file' | 'model' | 'dir',
): GoalFn {
  return someRun(
    (r) =>
      r.artifacts.some(
        (a) => a.path === name && (kind === undefined || a.kind === kind),
      ),
    experimentName,
  );
}

export function runHasSource(experimentName?: string): GoalFn {
  return someRun((r) => Boolean(r.source.git || r.source.entry), experimentName);
}

export function runHasEnv(experimentName?: string): GoalFn {
  return someRun((r) => Boolean(r.env.python || r.env.mlflow), experimentName);
}

export function runHasDataset(name: string, experimentName?: string): GoalFn {
  return someRun((r) => r.datasets.some((d) => d.name === name), experimentName);
}

export function runHasEval(
  name: string,
  minValue?: number,
  experimentName?: string,
): GoalFn {
  return someRun((r) => {
    const e = r.evalResults.find((x) => x.name === name);
    if (!e) return false;
    return minValue === undefined || e.value >= minValue;
  }, experimentName);
}

export function runHasPrompt(experimentName?: string): GoalFn {
  return someRun((r) => r.prompts.length > 0, experimentName);
}

export function runHasTrace(
  kind?: Run['traces'][number]['kind'],
  experimentName?: string,
): GoalFn {
  return someRun(
    (r) =>
      r.traces.some((t) => kind === undefined || t.kind === kind),
    experimentName,
  );
}

export function runHasChild(experimentName?: string): GoalFn {
  return someRun((r) => r.parentId != null, experimentName);
}

export function runAutologged(experimentName?: string): GoalFn {
  return someRun((r) => r.autologged, experimentName);
}

export function autologEnabled(flavor?: string): GoalFn {
  return (w) =>
    w.autologFlavor != null &&
    (flavor === undefined || w.autologFlavor === flavor);
}

export function searchMatches(
  filter: string,
  minCount = 1,
  experimentName?: string,
): GoalFn {
  return (w) => {
    const expId = findExpId(w, experimentName);
    const found = searchRuns(w, filter).filter((r) =>
      expId ? r.experimentId === expId : true,
    );
    return found.length >= minCount;
  };
}

export function modelExists(name: string, minVersions = 1): GoalFn {
  return (w) => {
    const m = w.models[name];
    return !!m && m.versions.length >= minVersions;
  };
}

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

export function modelHasStage(name: string, stage: Stage): GoalFn {
  return (w) => {
    const m = w.models[name];
    return !!m && m.versions.some((v) => v.stage === stage);
  };
}

export function modelHasFlavor(
  name: string,
  flavor: string,
  experimentName?: string,
): GoalFn {
  void experimentName;
  return (w) => {
    const m = w.models[name];
    return !!m && m.versions.some((v) => v.flavor === flavor);
  };
}

export function modelHasSignature(name: string, experimentName?: string): GoalFn {
  void experimentName;
  return (w) => {
    const m = w.models[name];
    return !!m && m.versions.some((v) => v.signature != null && v.signature !== '');
  };
}

export function modelHasAlias(
  name: string,
  alias: string,
  version?: number,
): GoalFn {
  return (w) => {
    const m = w.models[name];
    if (!m) return false;
    return m.versions.some(
      (v) =>
        v.aliases.includes(alias) &&
        (version === undefined || v.version === version),
    );
  };
}

export function modelVersionDescribed(name: string, version: number): GoalFn {
  return (w) => {
    const m = w.models[name];
    const v = m?.versions.find((x) => x.version === version);
    return Boolean(v && v.description && v.description.length > 3);
  };
}

export function modelVersionApproval(
  name: string,
  version: number,
  approval: 'approved' | 'rejected' | 'pending',
): GoalFn {
  return (w) => {
    const m = w.models[name];
    const v = m?.versions.find((x) => x.version === version);
    return Boolean(v && v.approval === approval);
  };
}

export function runHasSystemMetrics(experimentName?: string): GoalFn {
  return someRun((r) => Object.keys(r.systemMetrics).length > 0, experimentName);
}

export function predictionsOK(minCount = 1): GoalFn {
  return (w) => w.lastPredictions.length >= minCount;
}

export function compareTagged(minCount = 2, experimentName?: string): GoalFn {
  return (w) =>
    listRuns(w, findExpId(w, experimentName)).filter(
      (r) => r.tags.compare === 'yes',
    ).length >= minCount;
}

export function evalHas(name: string, minValue?: number): GoalFn {
  return someRun((r) => {
    const e = r.evalResults.find((x) => x.name === name);
    if (!e) return false;
    return minValue === undefined || e.value >= minValue;
  });
}

export function modelLoaded(name?: string): GoalFn {
  return (w) =>
    w.loadedModelUri != null &&
    (name === undefined || w.loadedModelName === name);
}

export function predictionsLogged(minCount = 1): GoalFn {
  return (w) => w.lastPredictions.length >= minCount;
}

export function serverRunning(): GoalFn {
  return (w) => Boolean(w.served?.ready);
}

export function serverServedPredictions(minCount = 1): GoalFn {
  return (w) => (w.served?.predictions ?? 0) >= minCount;
}

export function all(...goals: GoalFn[]): GoalFn {
  return (w) => goals.every((g) => g(w));
}

export function any(...goals: GoalFn[]): GoalFn {
  return (w) => goals.some((g) => g(w));
}

function findExpId(w: World, experimentName?: string): string | undefined {
  if (!experimentName) return undefined;
  return w.experiments.find((e) => e.name === experimentName)?.id;
}
