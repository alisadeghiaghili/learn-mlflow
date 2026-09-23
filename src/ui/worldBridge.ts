/**
 * Bridge helpers for the UI shell (sandbox seed world).
 */

import type { World } from '../engine/types';
import {
  createEmptyWorld as empty,
  createExperiment,
  createRun,
  logMetric,
  logParam,
  logTag,
} from '../engine/world';

export {
  createExperiment,
  createRun,
  logMetric,
  logParam,
  logTag,
  cloneWorld,
} from '../engine/world';

export function createEmptyWorld(): World {
  return empty();
}

/** Seed world for sandbox free-play. */
export function sandboxWorld(): World {
  let w = empty();
  const exp = createExperiment(w, 'Default');
  w = exp.world;
  const run = createRun(w, exp.experiment.id, 'baseline');
  w = run.world;
  w = logParam(w, run.run.id, 'lr', '0.01');
  w = logMetric(w, run.run.id, 'acc', 0.82);
  w = logTag(w, run.run.id, 'purpose', 'baseline');
  w.activeRunId = null;
  return w;
}
