/**
 * Helper to build a start World for levels without hand-writing IDs.
 */

import type { World } from '../engine/types';
import {
  createEmptyWorld,
  createExperiment,
  createRun,
  logArtifact,
  logMetric,
  logParam,
  logTag,
  registerModel,
  transitionStage,
} from '../engine/world';

export function emptyStart(): World {
  return createEmptyWorld();
}

export function sandboxStart(): World {
  let w = createEmptyWorld();
  const exp = createExperiment(w, 'Default');
  w = exp.world;
  const run = createRun(w, w.experiments[0].id, 'baseline');
  w = run.world;
  w = logParam(w, run.run.id, 'lr', '0.01');
  w = logMetric(w, run.run.id, 'acc', 0.82);
  w = logTag(w, run.run.id, 'purpose', 'baseline');
  return w;
}

export function withExperiment(name: string): World {
  return createExperiment(createEmptyWorld(), name).world;
}

export function withRuns(
  experimentName: string,
  specs: Array<{
    name?: string;
    params?: Record<string, string>;
    metrics?: Record<string, number>;
    tags?: Record<string, string>;
    artifacts?: string[];
  }>,
): World {
  let w = createExperiment(createEmptyWorld(), experimentName).world;
  const expId = w.experiments[0].id;
  for (const spec of specs) {
    const { world, run } = createRun(w, expId, spec.name);
    w = world;
    for (const [k, v] of Object.entries(spec.params ?? {})) {
      w = logParam(w, run.id, k, v);
    }
    for (const [k, v] of Object.entries(spec.metrics ?? {})) {
      w = logMetric(w, run.id, k, v);
    }
    for (const [k, v] of Object.entries(spec.tags ?? {})) {
      w = logTag(w, run.id, k, v);
    }
    for (const a of spec.artifacts ?? []) {
      w = logArtifact(w, run.id, a);
    }
  }
  w.activeRunId = null;
  return w;
}

export function withRegisteredModel(
  name: string,
  versionCount = 1,
  stage: 'None' | 'Staging' | 'Production' | 'Archived' = 'None',
): World {
  let w = sandboxStart();
  const runId = Object.keys(w.runs)[0];
  for (let i = 0; i < versionCount; i += 1) {
    const r = createRun(w, w.experiments[0].id, `train-${i + 1}`);
    w = r.world;
    w = logParam(w, r.run.id, 'model', 'sklearn.ensemble');
    w = logMetric(w, r.run.id, 'acc', 0.8 + i * 0.05);
    w = logArtifact(w, r.run.id, 'model.pkl');
    const reg = registerModel(w, name, r.run.id);
    w = reg.world;
    if (i === versionCount - 1) {
      const t = transitionStage(w, name, reg.version.version, stage);
      if (t) w = t.world;
    }
    w.activeRunId = null;
  }
  void runId;
  return w;
}
