/**
 * World factory and pure mutators for the MLflow simulation.
 *
 * All functions return new World objects (structural sharing via shallow copy).
 * IDs look like real MLflow: experiments `1`, `2`; runs `a1b2c3d4` hex-ish.
 */

import type {
  Experiment,
  ModelVersion,
  RegisteredModel,
  Run,
  Stage,
  World,
} from './types';

/** Create an empty tracking server + registry. */
export function createEmptyWorld(): World {
  return {
    experiments: [],
    runs: {},
    models: {},
    activeExperimentId: null,
    activeRunId: null,
    nextExperimentId: 1,
    nextRunId: 1,
    clock: 1_700_000_000_000,
  };
}

function hexId(n: number): string {
  return (0x10000000 + n * 0x111111).toString(16).slice(0, 8);
}

export function cloneWorld(world: World): World {
  return {
    experiments: world.experiments.map((e) => ({ ...e, runIds: [...e.runIds] })),
    runs: Object.fromEntries(
      Object.entries(world.runs).map(([id, r]) => [
        id,
        {
          ...r,
          params: { ...r.params },
          metrics: { ...r.metrics },
          tags: { ...r.tags },
          artifacts: [...r.artifacts],
        },
      ]),
    ),
    models: Object.fromEntries(
      Object.entries(world.models).map(([name, m]) => [
        name,
        {
          ...m,
          versions: m.versions.map((v) => ({ ...v })),
        },
      ]),
    ),
    activeExperimentId: world.activeExperimentId,
    activeRunId: world.activeRunId,
    nextExperimentId: world.nextExperimentId,
    nextRunId: world.nextRunId,
    clock: world.clock,
  };
}

export function getExperiment(world: World, id: string): Experiment | null {
  return world.experiments.find((e) => e.id === id) ?? null;
}

export function getExperimentByName(world: World, name: string): Experiment | null {
  return world.experiments.find((e) => e.name === name) ?? null;
}

export function getRun(world: World, id: string): Run | null {
  return world.runs[id] ?? null;
}

export function getModel(world: World, name: string): RegisteredModel | null {
  return world.models[name] ?? null;
}

export function listRuns(world: World, experimentId?: string): Run[] {
  return Object.values(world.runs)
    .filter((r) => (experimentId ? r.experimentId === experimentId : true))
    .sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
}

export function createExperiment(world: World, name: string): { world: World; experiment: Experiment } {
  const next = cloneWorld(world);
  const experiment: Experiment = {
    id: String(next.nextExperimentId),
    name,
    runIds: [],
  };
  next.experiments.push(experiment);
  next.nextExperimentId += 1;
  next.activeExperimentId = experiment.id;
  return { world: next, experiment };
}

export function setActiveExperiment(world: World, id: string): World {
  const next = cloneWorld(world);
  next.activeExperimentId = id;
  return next;
}

export function createRun(world: World, experimentId: string, name?: string): { world: World; run: Run } {
  const next = cloneWorld(world);
  const id = hexId(next.nextRunId);
  next.nextRunId += 1;
  const run: Run = {
    id,
    experimentId,
    name: name ?? `run-${id}`,
    status: 'RUNNING',
    params: {},
    metrics: {},
    tags: {},
    artifacts: [],
    startedAt: next.clock,
    endedAt: null,
  };
  next.clock += 1000;
  next.runs[id] = run;
  const exp = next.experiments.find((e) => e.id === experimentId);
  if (exp) exp.runIds.push(id);
  next.activeRunId = id;
  return { world: next, run };
}

export function finishRun(
  world: World,
  runId: string,
  status: Run['status'] = 'FINISHED',
): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.status = status;
  run.endedAt = next.clock;
  next.clock += 500;
  if (next.activeRunId === runId) next.activeRunId = null;
  return next;
}

export function deleteRun(world: World, runId: string): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  delete next.runs[runId];
  const exp = next.experiments.find((e) => e.id === run.experimentId);
  if (exp) exp.runIds = exp.runIds.filter((id) => id !== runId);
  if (next.activeRunId === runId) next.activeRunId = null;
  for (const model of Object.values(next.models)) {
    model.versions = model.versions.filter((v) => v.runId !== runId);
  }
  return next;
}

export function logParam(world: World, runId: string, key: string, value: string): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.params[key] = value;
  return next;
}

export function logMetric(world: World, runId: string, key: string, value: number): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.metrics[key] = value;
  return next;
}

export function logTag(world: World, runId: string, key: string, value: string): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.tags[key] = value;
  return next;
}

export function logArtifact(world: World, runId: string, name: string): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  if (!run.artifacts.includes(name)) run.artifacts.push(name);
  return next;
}

export function registerModel(
  world: World,
  name: string,
  runId: string,
  description = '',
): { world: World; version: ModelVersion } {
  const next = cloneWorld(world);
  let model = next.models[name];
  if (!model) {
    model = { name, versions: [], description: '' };
    next.models[name] = model;
  }
  const version: ModelVersion = {
    version: model.versions.length + 1,
    modelName: name,
    runId,
    stage: 'None',
    createdAt: next.clock,
    description,
  };
  next.clock += 1000;
  model.versions.push(version);
  return { world: next, version };
}

export function transitionStage(
  world: World,
  name: string,
  version: number,
  stage: Stage,
): { world: World; version: ModelVersion } | null {
  const next = cloneWorld(world);
  const model = next.models[name];
  if (!model) return null;
  const ver = model.versions.find((v) => v.version === version);
  if (!ver) return null;
  ver.stage = stage;
  return { world: next, version: ver };
}

export function setModelDescription(
  world: World,
  name: string,
  description: string,
): World {
  const next = cloneWorld(world);
  const model = next.models[name];
  if (!model) return world;
  model.description = description;
  return next;
}

/** Resolve a run reference: exact id, prefix, or `latest`. */
export function resolveRun(world: World, ref: string): Run | null {
  if (ref === 'latest' || ref === 'active') {
    if (ref === 'active' && world.activeRunId) return world.runs[world.activeRunId] ?? null;
    const all = listRuns(world);
    return all[all.length - 1] ?? null;
  }
  if (world.runs[ref]) return world.runs[ref];
  const matches = listRuns(world).filter((r) => r.id.startsWith(ref));
  return matches.length === 1 ? matches[0] : null;
}
