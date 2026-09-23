/**
 * Helpers to build start Worlds for levels.
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
  setAutolog,
  setSource,
  transitionStage,
} from '../engine/world';

export function emptyStart(): World {
  return createEmptyWorld();
}

export function sandboxStart(): World {
  let w = createEmptyWorld();
  const exp = createExperiment(w, 'Default');
  w = exp.world;
  const run = createRun(w, w.experiments[0]!.id, 'baseline');
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
    steps?: Record<string, number[]>;
    tags?: Record<string, string>;
    artifacts?: Array<{ path: string; kind?: 'file' | 'model' | 'dir' }>;
  }>,
): World {
  let w = createExperiment(createEmptyWorld(), experimentName).world;
  const expId = w.experiments[0]!.id;
  for (const spec of specs) {
    const created = createRun(w, expId, spec.name);
    w = created.world;
    for (const [k, v] of Object.entries(spec.params ?? {})) {
      w = logParam(w, created.run.id, k, v);
    }
    for (const [k, series] of Object.entries(spec.steps ?? {})) {
      series.forEach((v, i) => {
        w = logMetric(w, created.run.id, k, v, i);
      });
    }
    for (const [k, v] of Object.entries(spec.metrics ?? {})) {
      w = logMetric(w, created.run.id, k, v, 0);
    }
    for (const [k, v] of Object.entries(spec.tags ?? {})) {
      w = logTag(w, created.run.id, k, v);
    }
    for (const a of spec.artifacts ?? []) {
      w = logArtifact(w, created.run.id, a.path, a.kind ?? 'file');
    }
    w.activeRunId = null;
  }
  return w;
}

export function withRegisteredModel(
  name: string,
  versionCount = 1,
  stage: 'None' | 'Staging' | 'Production' | 'Archived' = 'None',
): World {
  let w = withExperiment('iris');
  for (let i = 0; i < versionCount; i += 1) {
    const created = createRun(w, w.experiments[0]!.id, `train-${i + 1}`);
    w = created.world;
    w = logParam(w, created.run.id, 'model', 'sklearn.ensemble');
    w = logMetric(w, created.run.id, 'acc', 0.8 + i * 0.05);
    w = logArtifact(w, created.run.id, 'model.pkl', 'model');
    const reg = registerModel(w, name, created.run.id, '', 'sklearn');
    w = reg.world;
    if (i === versionCount - 1) {
      const t = transitionStage(w, name, reg.version.version, stage);
      if (t) w = t.world;
    }
    w.activeRunId = null;
  }
  return w;
}

export function withAutolog(flavor = 'sklearn'): World {
  let w = withExperiment('iris');
  w = setAutolog(w, flavor);
  w = setSource(w, '', {}, {});
  return w;
}
