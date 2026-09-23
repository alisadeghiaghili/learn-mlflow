/**
 * World factory and pure mutators for the MLflow simulation.
 */

import type {
  ArtifactEntry,
  DatasetRef,
  Experiment,
  ModelVersion,
  RegisteredModel,
  Run,
  RunStatus,
  Stage,
  TraceSpan,
  World,
} from './types';

export function createEmptyWorld(): World {
  return {
    experiments: [],
    runs: {},
    models: {},
    activeExperimentId: null,
    activeRunId: null,
    activeParentRunId: null,
    loadedModelUri: null,
    loadedModelName: null,
    loadedModelVersion: null,
    served: null,
    autologFlavor: null,
    nextExperimentId: 1,
    nextRunId: 1,
    clock: 1_700_000_000_000,
    lastPredictions: [],
  };
}

function hexId(n: number): string {
  return (0x10000000 + n * 0x111111).toString(16).slice(0, 8);
}

export function cloneWorld(world: World): World {
  return {
    experiments: world.experiments.map((e) => ({
      ...e,
      runIds: [...e.runIds],
      tags: { ...e.tags },
    })),
    runs: Object.fromEntries(
      Object.entries(world.runs).map(([id, r]) => [
        id,
        {
          ...r,
          params: { ...r.params },
          metrics: { ...r.metrics },
          metricHistory: Object.fromEntries(
            Object.entries(r.metricHistory).map(([k, pts]) => [
              k,
              pts.map((p) => ({ ...p })),
            ]),
          ),
          tags: { ...r.tags },
          artifacts: r.artifacts.map((a) => ({ ...a })),
          datasets: r.datasets.map((d) => ({ ...d })),
          evalResults: r.evalResults.map((e) => ({ ...e })),
          prompts: [...r.prompts],
          traces: r.traces.map((t) => ({ ...t })),
          source: { ...r.source },
          env: { ...r.env },
        },
      ]),
    ),
    models: Object.fromEntries(
      Object.entries(world.models).map(([name, m]) => [
        name,
        {
          ...m,
          versions: m.versions.map((v) => ({ ...v, aliases: [...v.aliases] })),
        },
      ]),
    ),
    activeExperimentId: world.activeExperimentId,
    activeRunId: world.activeRunId,
    activeParentRunId: world.activeParentRunId,
    loadedModelUri: world.loadedModelUri,
    loadedModelName: world.loadedModelName,
    loadedModelVersion: world.loadedModelVersion,
    served: world.served ? { ...world.served } : null,
    autologFlavor: world.autologFlavor,
    nextExperimentId: world.nextExperimentId,
    nextRunId: world.nextRunId,
    clock: world.clock,
    lastPredictions: [...world.lastPredictions],
  };
}

export function getExperiment(world: World, id: string): Experiment | null {
  return world.experiments.find((e) => e.id === id) ?? null;
}

export function getExperimentByName(
  world: World,
  name: string,
): Experiment | null {
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

export function createExperiment(
  world: World,
  name: string,
): { world: World; experiment: Experiment } {
  const next = cloneWorld(world);
  const experiment: Experiment = {
    id: String(next.nextExperimentId),
    name,
    runIds: [],
    tags: {},
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

export function tagExperiment(
  world: World,
  id: string,
  key: string,
  value: string,
): World {
  const next = cloneWorld(world);
  const exp = next.experiments.find((e) => e.id === id);
  if (!exp) return world;
  exp.tags[key] = value;
  return next;
}

export function createRun(
  world: World,
  experimentId: string,
  name?: string,
  parentId?: string | null,
): { world: World; run: Run } {
  const next = cloneWorld(world);
  const id = hexId(next.nextRunId);
  next.nextRunId += 1;
  const run: Run = {
    id,
    experimentId,
    name: name ?? `run-${id}`,
    status: 'RUNNING',
    parentId: parentId ?? next.activeParentRunId,
    params: {},
    metrics: {},
    metricHistory: {},
    tags: {},
    artifacts: [],
    datasets: [],
    evalResults: [],
    prompts: [],
    traces: [],
    source: { git: null, entry: null, version: null },
    env: { python: null, mlflow: null },
    autologged: false,
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
  status: RunStatus = 'FINISHED',
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

export function logParam(
  world: World,
  runId: string,
  key: string,
  value: string,
): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.params[key] = value;
  return next;
}

export function logMetric(
  world: World,
  runId: string,
  key: string,
  value: number,
  step = 0,
): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.metrics[key] = value;
  const series = run.metricHistory[key] ?? [];
  series.push({ step, value, timestamp: next.clock });
  run.metricHistory[key] = series;
  next.clock += 1;
  return next;
}

export function logTag(
  world: World,
  runId: string,
  key: string,
  value: string,
): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.tags[key] = value;
  return next;
}

export function logArtifact(
  world: World,
  runId: string,
  name: string,
  kind: ArtifactEntry['kind'] = 'file',
  flavor?: string,
  size = 1024,
): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  if (run.artifacts.some((a) => a.path === name)) return world;
  run.artifacts.push({ path: name, size, kind, flavor });
  return next;
}

export function logDataset(
  world: World,
  runId: string,
  name: string,
  sourceType = 'csv',
): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  const digest = 'd' + (run.datasets.length + 1).toString(16).padStart(7, '0');
  const ref: DatasetRef = { name, digest, sourceType };
  run.datasets.push(ref);
  run.tags[`mlflow.data.${name}`] = digest;
  return next;
}

export function logEval(
  world: World,
  runId: string,
  name: string,
  value: number,
  greaterIsBetter = true,
): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.evalResults.push({ name, value, greaterIsBetter });
  run.metrics[name] = value;
  const series = run.metricHistory[name] ?? [];
  series.push({ step: 0, value, timestamp: next.clock });
  run.metricHistory[name] = series;
  return next;
}

export function logPrompt(world: World, runId: string, prompt: string): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.prompts.push(prompt);
  return next;
}

export function logTrace(
  world: World,
  runId: string,
  name: string,
  kind: TraceSpan['kind'],
  status: TraceSpan['status'] = 'OK',
): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.traces.push({ name, kind, status });
  return next;
}

export function setSource(
  world: World,
  runId: string,
  source: Partial<Run['source']>,
  env: Partial<Run['env']>,
): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.source = { ...run.source, ...source };
  run.env = { ...run.env, ...env };
  return next;
}

export function markAutologged(world: World, runId: string): World {
  const next = cloneWorld(world);
  const run = next.runs[runId];
  if (!run) return world;
  run.autologged = true;
  return next;
}

export function setAutolog(world: World, flavor: string | null): World {
  const next = cloneWorld(world);
  next.autologFlavor = flavor;
  return next;
}

export function setActiveParent(world: World, parentId: string | null): World {
  const next = cloneWorld(world);
  next.activeParentRunId = parentId;
  return next;
}

export function registerModel(
  world: World,
  name: string,
  runId: string,
  description = '',
  flavor = 'sklearn',
  signature: string | null = null,
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
    flavor,
    signature,
    aliases: [],
    runUri: `runs:/${runId}/model`,
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

export function setAlias(
  world: World,
  name: string,
  alias: string,
  version: number,
): { world: World; version: ModelVersion } | null {
  const next = cloneWorld(world);
  const model = next.models[name];
  if (!model) return null;
  const ver = model.versions.find((v) => v.version === version);
  if (!ver) return null;
  for (const v of model.versions) {
    v.aliases = v.aliases.filter((a) => a !== alias);
  }
  ver.aliases.push(alias);
  return { world: next, version: ver };
}

export function describeModelVersion(
  world: World,
  name: string,
  version: number,
  description: string,
): World {
  const next = cloneWorld(world);
  const model = next.models[name];
  if (!model) return world;
  const ver = model.versions.find((v) => v.version === version);
  if (!ver) return world;
  ver.description = description;
  return next;
}

export function loadModel(
  world: World,
  name: string,
  ref: Stage | number | string,
): { world: World; uri: string; version: ModelVersion } | null {
  const next = cloneWorld(world);
  const model = next.models[name];
  if (!model || model.versions.length === 0) return null;
  let ver: ModelVersion | undefined;
  let uri = '';
  if (typeof ref === 'number') {
    ver = model.versions.find((v) => v.version === ref);
    uri = `models:/${name}/${ref}`;
  } else if (['None', 'Staging', 'Production', 'Archived'].includes(ref)) {
    ver = [...model.versions].reverse().find((v) => v.stage === ref);
    uri = `models:/${name}/${ref}`;
  } else {
    ver = model.versions.find((v) => v.aliases.includes(ref));
    uri = `models:/${name}@${ref}`;
  }
  if (!ver) return null;
  next.loadedModelUri = uri;
  next.loadedModelName = name;
  next.loadedModelVersion = ver.version;
  return { world: next, uri, version: ver };
}

export function predict(
  world: World,
  rows: number,
): { world: World; values: number[] } | null {
  if (!world.loadedModelUri) return null;
  const next = cloneWorld(world);
  const values: number[] = [];
  for (let i = 0; i < rows; i += 1) {
    values.push(Number(((i * 0.17 + 0.3) % 1).toFixed(3)));
  }
  next.lastPredictions = values;
  return { world: next, values };
}

export function serveModel(
  world: World,
  modelUri: string,
  port: number,
): World {
  const next = cloneWorld(world);
  next.served = { modelUri, port, ready: true, predictions: 0 };
  return next;
}

export function stopServe(world: World): World {
  const next = cloneWorld(world);
  next.served = null;
  return next;
}

export function servePredict(world: World, n = 1): World {
  const next = cloneWorld(world);
  if (next.served) next.served.predictions += n;
  return next;
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

export function resolveRun(world: World, ref: string): Run | null {
  if (ref === 'latest' || ref === 'active') {
    if (ref === 'active' && world.activeRunId) {
      return world.runs[world.activeRunId] ?? null;
    }
    const all = listRuns(world);
    return all[all.length - 1] ?? null;
  }
  if (world.runs[ref]) return world.runs[ref];
  const matches = listRuns(world).filter((r) => r.id.startsWith(ref));
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Very small filter language for `mlflow runs search`:
 *   params.lr = '0.01'
 *   metrics.acc > 0.9
 *   tags.stage = 'train'
 *   name = 'baseline'
 */
export function searchRuns(world: World, filter: string): Run[] {
  const trimmed = filter.trim();
  if (!trimmed) return listRuns(world);
  const m = trimmed.match(
    /^(params|metrics|tags)\.([A-Za-z0-9_.-]+)\s*(=|!=|>=|<=|>|<)\s*(.+)$/,
  );
  if (m) {
    const [, field, key, op, rawValue] = m;
    const value = rawValue!.trim().replace(/^['"]|['"]$/g, '');
    return listRuns(world).filter((r) => {
      let actual: string | number;
      if (field === 'params') actual = r.params[key!] ?? '';
      else if (field === 'metrics') actual = r.metrics[key!] ?? Number.NaN;
      else actual = r.tags[key!] ?? '';
      return compare(actual, op!, value);
    });
  }
  const simple = trimmed.match(/^(name|status|id)\s*(=|!=)\s*(.+)$/);
  if (simple) {
    const [, field, op, rawValue] = simple;
    const value = rawValue!.trim().replace(/^['"]|['"]$/g, '');
    return listRuns(world).filter((r) => {
      const actual =
        field === 'name' ? r.name : field === 'status' ? r.status : r.id;
      return compare(actual, op!, value);
    });
  }
  return [];
}

function compare(
  actual: string | number,
  op: string,
  value: string,
): boolean {
  const numA = typeof actual === 'number' ? actual : Number(actual);
  const numV = Number(value);
  const bothNum = Number.isFinite(numA) && Number.isFinite(numV);
  switch (op) {
    case '=':
      return bothNum ? numA === numV : String(actual) === value;
    case '!=':
      return bothNum ? numA !== numV : String(actual) !== value;
    case '>':
      return bothNum && numA > numV;
    case '>=':
      return bothNum && numA >= numV;
    case '<':
      return bothNum && numA < numV;
    case '<=':
      return bothNum && numA <= numV;
    default:
      return false;
  }
}
