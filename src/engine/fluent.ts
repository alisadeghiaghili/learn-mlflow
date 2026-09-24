/**
 * Fluent Python-style API surface for teaching the real MLflow client.
 *
 * Accepts lines like:
 *   mlflow.set_experiment("iris")
 *   mlflow.start_run(run_name="train")
 *   mlflow.log_param("lr", 0.01)
 *   mlflow.log_metric("acc", 0.95, step=1)
 * Mapped onto the same World engine as the CLI.
 */

import type { CommandResult, World } from './types';
import {
  cloneWorld,
  createExperiment,
  createRun,
  finishRun,
  getExperimentByName,
  listRuns,
  loadModel,
  logArtifact,
  logMetric,
  logParam,
  logPrompt,
  logTag,
  logTrace,
  registerModel,
  resolveRun,
  setActiveExperiment,
  setSource,
  transitionStage,
} from './world';
import { explain } from './errors';

function ok(world: World, lines: string[] = []): CommandResult {
  return { ok: true, lines, world };
}

function fail(world: World, error: string, code: string): CommandResult {
  return { ok: false, error, why: explain(code), world };
}

function parseArgs(src: string): string[] {
  const args: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (const ch of src) {
    if (quote) {
      if (ch === quote) {
        quote = null;
        args.push(current);
        current = '';
      } else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current = '';
      continue;
    }
    if (ch === ',' || ch === ' ') {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) args.push(current);
  return args;
}

function parseKw(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*("[^"]*"|'[^']*'|[^,)]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
  return out;
}

function activeOrLatest(world: World) {
  if (world.activeRunId) return world.runs[world.activeRunId] ?? null;
  const all = listRuns(world);
  return all[all.length - 1] ?? null;
}

/** Translate a fluent / client line if it matches; else null. */
export function tryFluent(raw: string, world: World): CommandResult | null {
  const line = raw.trim().replace(/;$/, '');
  if (!line) return null;

  if (line === 'import mlflow' || line.startsWith('from mlflow')) {
    return ok(world, ['(simulated) MLflow fluent API ready']);
  }
  if (line.startsWith('client = ') || line === 'client') {
    return ok(world, ['(simulated) MlflowClient() ready']);
  }

  // mlflow.sklearn.autolog()
  if (/^mlflow\.\w+\.autolog\s*\(/.test(line)) {
    const flavor = line.split('.')[1];
    return ok(world, [
      'autolog enabled for ' + flavor,
    ]);
  }

  const setExp = line.match(/^mlflow\.set_experiment\s*\((.*)\)$/);
  if (setExp) {
    const args = parseArgs(setExp[1]!);
    const name = args[0] ?? '';
    if (!name) return fail(world, 'set_experiment requires a name', 'no-arg');
    const existing = getExperimentByName(world, name);
    if (existing) {
      return ok(setActiveExperiment(world, existing.id), [
        'Active experiment is now ' + name,
      ]);
    }
    const created = createExperiment(world, name);
    return ok(created.world, [
      "Created experiment '" + name + "' (id=" + created.experiment.id + ')',
    ]);
  }

  const startRun = line.match(/^mlflow\.start_run\s*(?:\((.*)\))?$/);
  if (startRun) {
    if (!world.activeExperimentId) {
      return fail(world, 'No active experiment', 'no-experiment');
    }
    const kw = parseKw(startRun[1] ?? '');
    const nested = (startRun[1] ?? '').includes('nested=True');
    const parentId = nested ? world.activeRunId : null;
    const created = createRun(
      world,
      world.activeExperimentId,
      kw.run_name,
      parentId,
    );
    let w = setSource(created.world, created.run.id, {
      git: 'fluent123',
      entry: 'train.py',
    }, {});
    return ok(w, [
      'Run ' + created.run.id + ' started',
      'Active run: ' + created.run.id,
    ]);
  }

  if (/^mlflow\.end_run\s*\(/.test(line)) {
    const run = activeOrLatest(world);
    if (!run) return fail(world, 'No active run', 'no-run');
    return ok(finishRun(world, run.id, 'FINISHED'), [
      'Run ' + run.id + ' -> FINISHED',
    ]);
  }

  const logParamL = line.match(/^mlflow\.log_param\s*\((.*)\)$/);
  if (logParamL) {
    const args = parseArgs(logParamL[1]!);
    const run = activeOrLatest(world);
    if (!run) return fail(world, 'No active run — call start_run()', 'no-run');
    if (args.length < 2) {
      return fail(world, 'log_param(key, value) needs two arguments', 'no-arg');
    }
    return ok(logParam(world, run.id, args[0]!, args[1]!), [
      'Logged param  ' + args[0] + '=' + args[1],
    ]);
  }

  const logMetricL = line.match(/^mlflow\.log_metric\s*\((.*)\)$/);
  if (logMetricL) {
    const kw = parseKw(logMetricL[1]!);
    const args = parseArgs(logMetricL[1]!.split(',')[0] + ',' + logMetricL[1]!.split(',')[1]);
    const key = (args[0] ?? '').replace(/^["']|["']$/g, '');
    const value = Number(args[1]);
    const step = Number(kw.step ?? '0');
    const run = activeOrLatest(world);
    if (!run) return fail(world, 'No active run — call start_run()', 'no-run');
    if (!key || !Number.isFinite(value)) {
      return fail(world, 'log_metric(key, value) needs a numeric value', 'bad-metric');
    }
    return ok(logMetric(world, run.id, key, value, step), [
      'Logged metric ' + key + '=' + String(value) + ' step=' + String(step),
    ]);
  }

  const setTagL = line.match(/^mlflow\.set_tag\s*\((.*)\)$/);
  if (setTagL) {
    const args = parseArgs(setTagL[1]!);
    const run = activeOrLatest(world);
    if (!run) return fail(world, 'No active run', 'no-run');
    return ok(logTag(world, run.id, args[0]!, args[1]!), [
      'Tagged  ' + args[0] + '=' + args[1],
    ]);
  }

  const logArt = line.match(/^mlflow\.log_artifact\s*\((.*)\)$/);
  if (logArt) {
    const args = parseArgs(logArt[1]!);
    const run = activeOrLatest(world);
    if (!run) return fail(world, 'No active run', 'no-run');
    return ok(logArtifact(world, run.id, args[0]!, 'file'), [
      'Logged artifact ' + args[0],
    ]);
  }

  const logModel = line.match(/^mlflow\.\w+\.log_model\s*\((.*)\)/);
  if (logModel) {
    const kw = parseKw(logModel[1]!);
    const run = activeOrLatest(world);
    if (!run) return fail(world, 'No active run', 'no-run');
    const flavor = line.includes('sklearn')
      ? 'sklearn'
      : line.includes('pytorch')
        ? 'pytorch'
        : 'pyfunc';
    const artifact_path = kw.artifact_path ?? 'model';
    let w = logArtifact(world, run.id, artifact_path, 'model', flavor);
    return ok(w, ['Logged model at ' + artifact_path + ' flavor=' + flavor]);
  }

  const reg = line.match(/^mlflow\.\w+\.register_model\s*\((.*)\)/);
  if (reg) {
    const args = parseArgs(reg[1]!);
    const modelUri = args[0] ?? '';
    const name = args[1] ?? '';
    const runRef = modelUri.replace(/^runs:\//, '').split('/')[0];
    const run = resolveRun(world, runRef) ?? activeOrLatest(world);
    if (!run || !name) {
      return fail(world, 'register_model(model_uri, name) needs a run and name', 'no-arg');
    }
    const registered = registerModel(world, name, run.id, '', 'sklearn');
    return ok(registered.world, [
      'Registered ' +
        name +
        ' v' +
        String(registered.version.version) +
        ' from ' +
        run.id,
    ]);
  }

  const trans = line.match(/^mlflow\.\w+\.transition_model_version_stage\s*\((.*)\)/);
  if (trans) {
    const kw = parseKw(trans[1]!);
    const args = parseArgs(trans[1]!);
    const name = args[0] ?? kw.name;
    const version = Number(args[1] ?? kw.version);
    const stage = args[2] ?? kw.stage;
    const result = transitionStage(
      world,
      name!,
      version,
      stage as Parameters<typeof transitionStage>[3],
    );
    if (!result) return fail(world, 'Version not found', 'missing-version');
    return ok(result.world, [
      'Transitioned ' + name + ' v' + String(version) + ' -> ' + stage,
    ]);
  }

  const load = line.match(/^mlflow\.\w+\.load_model\s*\((.*)\)/);
  if (load) {
    const uri = parseArgs(load[1]!)[0] ?? '';
    const m = uri.match(/^models:\/\/([^/@]+)(?:\/([^@]+)|@(.+))?$/);
    if (!m) return fail(world, 'Expected models:/name/stage or models:/name@alias', 'bad-uri');
    const name = m[1]!;
    const ref = m[2] ?? m[3] ?? 'Production';
    const num = Number(ref);
    const result = loadModel(
      world,
      name,
      Number.isFinite(num) && ref !== '' ? num : ref,
    );
    if (!result) return fail(world, 'Cannot resolve ' + uri, 'bad-uri');
    return ok(result.world, ['Loaded ' + result.uri + '  (v' + result.version.version + ')']);
  }

  const predict = line.match(/^model\.predict\s*\((.*)\)/);
  if (predict) {
    if (!world.loadedModelUri) {
      return fail(world, 'No model loaded', 'no-model');
    }
    if (world.loadedModelName) {
      const model = world.models[world.loadedModelName];
      const ver = model?.versions.find((v) => v.version === world.loadedModelVersion);
      if (ver && !ver.signature) {
        return fail(
          world,
          'Refusing to predict: model has no signature',
          'no-signature',
        );
      }
    }
    const next = cloneWorld(world);
    next.lastPredictions = [0.1, 0.9, 0.4];
    return ok(next, ['[0.1, 0.9, 0.4]']);
  }

  const clientCreate = line.match(/^client\.create_experiment\s*\((.*)\)/);
  if (clientCreate) {
    const name = parseArgs(clientCreate[1]!)[0] ?? '';
    const created = createExperiment(world, name);
    return ok(created.world, ['Created experiment ' + name]);
  }

  const clientLogM = line.match(/^client\.log_metric\s*\((.*)\)/);
  if (clientLogM) {
    const args = parseArgs(clientLogM[1]!);
    const runId = args[0] ?? '';
    const key = args[1] ?? '';
    const value = Number(args[2]);
    const kw = parseKw(clientLogM[1]!);
    const step = Number(kw.step ?? '0');
    const run = resolveRun(world, runId) ?? activeOrLatest(world);
    if (!run) return fail(world, 'Run not found', 'no-run');
    return ok(logMetric(world, run.id, key, value, step), [
      'Logged metric ' + key + '=' + String(value),
    ]);
  }

  const logPromptL = line.match(/^mlflow\.\w*\.?log_prompt\s*\((.*)\)/);
  if (logPromptL) {
    const text = parseArgs(logPromptL[1]!)[0] ?? '';
    const run = activeOrLatest(world);
    if (!run) return fail(world, 'No active run', 'no-run');
    return ok(logPrompt(world, run.id, text), ['Logged prompt']);
  }

  const logTraceL = line.match(/^mlflow\.\w*\.?log_trace\s*\((.*)\)/);
  if (logTraceL) {
    const kw = parseKw(logTraceL[1]!);
    const run = activeOrLatest(world);
    if (!run) return fail(world, 'No active run', 'no-run');
    return ok(
      logTrace(
        world,
        run.id,
        kw.name ?? 'span',
        (kw.kind as 'LLM') ?? 'LLM',
        (kw.status as 'OK') ?? 'OK',
      ),
      ['Logged trace'],
    );
  }

  if (line.startsWith('mlflow.') || line.startsWith('client.')) {
    return fail(
      world,
      'Unrecognized fluent call: ' + line.split('(')[0],
      'unknown-fluent',
    );
  }

  return null;
}
