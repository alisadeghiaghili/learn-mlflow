/**
 * Command parser and executor for the LearnMLflow terminal.
 *
 * Accepts a simplified, CLI-faithful subset of `mlflow` plus game meta
 * commands. Returns a new World on success; never mutates the input.
 */

import type { CommandResult, Stage, World } from './types';
import { STAGES } from './types';
import {
  TOK_CLEAR,
  TOK_HINT,
  TOK_LEVELS,
  TOK_RESET,
  TOK_SANDBOX,
  TOK_SOLUTION,
  TOK_UNDO,
} from './tokens';
import {
  cloneWorld,
  createExperiment,
  createRun,
  deleteRun,
  finishRun,
  getExperiment,
  getExperimentByName,
  getModel,
  listRuns,
  logArtifact,
  logMetric,
  logParam,
  logTag,
  registerModel,
  resolveRun,
  setActiveExperiment,
  transitionStage,
} from './world';

function fail(world: World, error: string): CommandResult {
  return { ok: false, error, world };
}

function ok(world: World, lines: string[] = []): CommandResult {
  return { ok: true, lines, world };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (const ch of input.trim()) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (quote) return tokens;
  if (current) tokens.push(current);
  return tokens;
}

function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}

function activeRunOr(world: World): World['runs'][string] | null {
  return world.activeRunId ? world.runs[world.activeRunId] ?? null : null;
}

function parseKeyValue(pair: string): { key: string; value: string } | null {
  const idx = pair.indexOf('=');
  if (idx <= 0) return null;
  return { key: pair.slice(0, idx), value: pair.slice(idx + 1) };
}

function formatRunLine(run: World['runs'][string]): string {
  const status = run.status.padEnd(8);
  const name = run.name.padEnd(18);
  return (
    '  ' +
    run.id +
    '  ' +
    status +
    '  ' +
    name +
    '  ' +
    String(Object.keys(run.params).length) +
    ' params  ' +
    String(Object.keys(run.metrics).length) +
    ' metrics'
  );
}

function helpLines(): string[] {
  return [
    'LearnMLflow commands',
    '',
    'Tracking',
    '  mlflow experiments create -n <name>     Create and activate an experiment',
    '  mlflow experiments set <id|name>        Set the active experiment',
    '  mlflow experiments list                 List experiments',
    '  mlflow runs create [--name <name>]      Start a run in the active experiment',
    '  mlflow runs set <id|latest>             Set the active run',
    '  mlflow runs list [experiment]           List runs',
    '  mlflow runs log -p key=value            Log a parameter',
    '  mlflow runs log -m key=value            Log a metric',
    '  mlflow runs tag key=value               Set a tag',
    '  mlflow runs log-artifact <name>         Log an artifact file',
    '  mlflow runs delete <id>                 Delete a run',
    '  mlflow runs finish [id] [FINISHED|FAILED|KILLED]',
    '',
    'Model Registry',
    '  mlflow models register -n <name> [--run <id>]   Register a model version',
    '  mlflow models list                       List registered models',
    '  mlflow models get <name>                 Show model versions',
    '  mlflow models transition -n <name> --version <n> --stage <S>',
    '  mlflow models archive -n <name> --version <n>',
    '  Stages: None | Staging | Production | Archived',
    '',
    'Game',
    '  levels  hint  solution  undo  reset  sandbox  clear  help',
  ];
}

function execExperiments(world: World, action: string, args: string[]): CommandResult {
  if (action === 'create') {
    let name: string | null = null;
    for (let i = 0; i < args.length; i += 1) {
      if (args[i] === '-n' || args[i] === '--name') name = args[i + 1] ?? null;
      else if (args[i].startsWith('--name=')) name = args[i].slice(7);
    }
    if (!name) {
      const pos = args.find((a) => !a.startsWith('-'));
      name = pos ?? null;
    }
    if (!name) return fail(world, 'Usage: mlflow experiments create -n <name>');
    if (getExperimentByName(world, name)) {
      return fail(world, "Experiment '" + name + "' already exists.");
    }
    const created = createExperiment(world, name);
    return ok(created.world, [
      "Created experiment '" + created.experiment.name + "' (id=" + created.experiment.id + ')',
      "Active experiment is now '" + created.experiment.name + "'",
    ]);
  }

  if (action === 'set') {
    const ref = args[0];
    if (!ref) return fail(world, 'Usage: mlflow experiments set <id|name>');
    const exp =
      getExperiment(world, ref) ??
      getExperimentByName(world, ref) ??
      world.experiments.find((e) => e.name === ref);
    if (!exp) return fail(world, "Experiment '" + ref + "' not found.");
    return ok(setActiveExperiment(world, exp.id), [
      "Active experiment is now '" + exp.name + "' (id=" + exp.id + ')',
    ]);
  }

  if (action === 'list') {
    if (world.experiments.length === 0) {
      return ok(world, [
        'No experiments yet. Create one with `mlflow experiments create -n <name>`.',
      ]);
    }
    const lines = ['Experiment_id    Name                 # Runs', '-'.repeat(48)];
    for (const e of world.experiments) {
      const mark = e.id === world.activeExperimentId ? '*' : ' ';
      lines.push(mark + e.id.padEnd(16) + ' ' + e.name.padEnd(20) + ' ' + String(e.runIds.length));
    }
    return ok(world, lines);
  }

  return fail(world, 'Usage: mlflow experiments create|set|list');
}

function execRuns(world: World, action: string, args: string[]): CommandResult {
  if (action === 'create') {
    if (!world.activeExperimentId || !getExperiment(world, world.activeExperimentId)) {
      return fail(
        world,
        'No active experiment. Use `mlflow experiments create -n <name>` or `mlflow experiments set <id|name>`.',
      );
    }
    let name: string | undefined;
    for (let i = 0; i < args.length; i += 1) {
      if (args[i] === '--name' || args[i] === '-n') name = args[i + 1];
      else if (args[i].startsWith('--name=')) name = args[i].slice(7);
    }
    const expId = world.activeExperimentId;
    const created = createRun(world, expId, name);
    return ok(created.world, [
      'Run ' + created.run.id + ' started in experiment ' + expId,
      'Active run: ' + created.run.id,
    ]);
  }

  if (action === 'set') {
    const ref = args[0];
    if (!ref) return fail(world, 'Usage: mlflow runs set <id|latest>');
    const run = resolveRun(world, ref);
    if (!run) return fail(world, "Run '" + ref + "' not found.");
    const next = cloneWorld(world);
    next.activeRunId = run.id;
    return ok(next, ['Active run: ' + run.id]);
  }

  if (action === 'list') {
    const expRef = args[0];
    let expId: string | undefined;
    if (expRef) {
      const exp = getExperiment(world, expRef) ?? getExperimentByName(world, expRef);
      if (!exp) return fail(world, "Experiment '" + expRef + "' not found.");
      expId = exp.id;
    } else {
      expId = world.activeExperimentId ?? undefined;
    }
    const runs = listRuns(world, expId);
    if (runs.length === 0) {
      return ok(world, ['No runs. Create one with `mlflow runs create`.']);
    }
    const lines = [
      'Run_id    Status    Name                Params  Metrics',
      '-'.repeat(56),
    ];
    for (const r of runs) {
      const mark = r.id === world.activeRunId ? '*' : ' ';
      lines.push(mark + formatRunLine(r));
    }
    return ok(world, lines);
  }

  if (action === 'log') {
    let target: string | null = null;
    let key = '';
    let value: string | null = null;
    let kind: 'param' | 'metric' | null = null;
    for (let i = 0; i < args.length; i += 1) {
      const a = args[i];
      if (a === '-p' || a === '--param') {
        kind = 'param';
        value = args[++i] ?? null;
        const kv = value ? parseKeyValue(value) : null;
        if (kv) {
          key = kv.key;
          value = kv.value;
        } else {
          return fail(world, 'Expected key=value for -p/--param');
        }
      } else if (a === '-m' || a === '--metric') {
        kind = 'metric';
        value = args[++i] ?? null;
        const kv = value ? parseKeyValue(value) : null;
        if (kv) {
          key = kv.key;
          value = kv.value;
        } else {
          return fail(world, 'Expected key=value for -m/--metric');
        }
      } else if (a === '--run' || a === '-r') {
        target = args[++i] ?? null;
      } else if (a.startsWith('--run=')) {
        target = a.slice(6);
      }
    }
    if (!kind) {
      return fail(world, 'Usage: mlflow runs log -p key=value | -m key=value');
    }
    const run = target ? resolveRun(world, target) : activeRunOr(world);
    if (!run) {
      return fail(
        world,
        'No active run. Use `mlflow runs create` or `mlflow runs log --run <id>`.',
      );
    }
    if (kind === 'param') {
      return ok(logParam(world, run.id, key, value as string), [
        'Logged param  ' + key + '=' + value + '  -> ' + run.id,
      ]);
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return fail(world, "Metric value must be numeric, got '" + value + "'");
    }
    return ok(logMetric(world, run.id, key, num), [
      'Logged metric ' + key + '=' + String(num) + '  -> ' + run.id,
    ]);
  }

  if (action === 'tag') {
    const pair = args.find((a) => a.includes('=') && !a.startsWith('--'));
    const target = args.find((a) => a.startsWith('--run='))?.slice(6);
    const kv = pair ? parseKeyValue(pair) : null;
    if (!kv) return fail(world, 'Usage: mlflow runs tag key=value [--run <id>]');
    const run = target ? resolveRun(world, target) : activeRunOr(world);
    if (!run) return fail(world, 'No active run.');
    return ok(logTag(world, run.id, kv.key, kv.value), [
      'Tagged  ' + kv.key + '=' + kv.value + '  -> ' + run.id,
    ]);
  }

  if (action === 'log-artifact' || action === 'log-artifacts') {
    const name = args.find((a) => !a.startsWith('-'));
    const target = args.find((a) => a.startsWith('--run='))?.slice(6);
    if (!name) {
      return fail(world, 'Usage: mlflow runs log-artifact <name> [--run <id>]');
    }
    const run = target ? resolveRun(world, target) : activeRunOr(world);
    if (!run) return fail(world, 'No active run.');
    return ok(logArtifact(world, run.id, name), [
      "Logged artifact '" + name + "' -> " + run.id,
    ]);
  }

  if (action === 'delete') {
    const ref = args[0];
    if (!ref) return fail(world, 'Usage: mlflow runs delete <id>');
    const run = resolveRun(world, ref);
    if (!run) return fail(world, "Run '" + ref + "' not found.");
    return ok(deleteRun(world, run.id), ['Deleted run ' + run.id]);
  }

  if (action === 'finish') {
    const ref = args.find(
      (a) =>
        !a.startsWith('-') &&
        a.toUpperCase() !== 'FINISHED' &&
        a.toUpperCase() !== 'FAILED' &&
        a.toUpperCase() !== 'KILLED',
    );
    const statusArg = args.find((a) =>
      ['FINISHED', 'FAILED', 'KILLED'].includes(a.toUpperCase()),
    );
    const run = ref
      ? resolveRun(world, ref)
      : world.activeRunId
        ? world.runs[world.activeRunId]
        : null;
    if (!run) return fail(world, 'No run to finish.');
    const status = (statusArg?.toUpperCase() ?? 'FINISHED') as
      | 'FINISHED'
      | 'FAILED'
      | 'KILLED';
    return ok(finishRun(world, run.id, status), ['Run ' + run.id + ' -> ' + status]);
  }

  return fail(
    world,
    'Usage: mlflow runs create|set|list|log|tag|log-artifact|delete|finish',
  );
}

function execModels(world: World, action: string, args: string[]): CommandResult {
  if (action === 'register') {
    let name: string | null = null;
    let runRef: string | null = null;
    for (let i = 0; i < args.length; i += 1) {
      const a = args[i];
      if (a === '-n' || a === '--name') name = args[i + 1] ?? null;
      else if (a.startsWith('--name=')) name = a.slice(7);
      else if (a === '--run' || a === '-r') runRef = args[i + 1] ?? null;
      else if (a.startsWith('--run=')) runRef = a.slice(6);
    }
    if (!name) return fail(world, 'Usage: mlflow models register -n <name> [--run <id>]');
    const all = listRuns(world);
    const run = runRef
      ? resolveRun(world, runRef)
      : world.activeRunId
        ? world.runs[world.activeRunId]
        : all[all.length - 1];
    if (!run) {
      return fail(world, 'No run to register. Create a run first or pass --run <id>.');
    }
    const registered = registerModel(world, name, run.id);
    return ok(registered.world, [
      "Registered model '" +
        name +
        "' version " +
        String(registered.version.version) +
        ' from run ' +
        run.id,
    ]);
  }

  if (action === 'list') {
    const models = Object.values(world.models);
    if (models.length === 0) {
      return ok(world, [
        'No registered models. Use `mlflow models register -n <name>`.',
      ]);
    }
    const lines = ['Name                 Versions  Latest stage', '-'.repeat(48)];
    for (const m of models) {
      const latest = m.versions[m.versions.length - 1];
      lines.push(
        m.name.padEnd(20) +
          ' ' +
          String(m.versions.length).padEnd(9) +
          ' ' +
          (latest?.stage ?? '-'),
      );
    }
    return ok(world, lines);
  }

  if (action === 'get' || action === 'versions') {
    const name = args.find((a) => !a.startsWith('-'));
    if (!name) return fail(world, 'Usage: mlflow models get <name>');
    const model = getModel(world, name);
    if (!model) return fail(world, "Model '" + name + "' not found.");
    const lines = [
      'Model: ' + model.name,
      model.description ? '  ' + model.description : '',
      '',
      'Version  Stage        Run',
      '-'.repeat(40),
      ...model.versions.map((v) => {
        const mark = v.stage === 'Production' ? '*' : ' ';
        return mark + String(v.version).padEnd(8) + ' ' + v.stage.padEnd(12) + ' ' + v.runId;
      }),
    ].filter(Boolean);
    return ok(world, lines);
  }

  if (action === 'transition') {
    let name: string | null = null;
    let version: number | null = null;
    let stage: string | null = null;
    for (let i = 0; i < args.length; i += 1) {
      const a = args[i];
      if (a === '-n' || a === '--name') name = args[i + 1] ?? null;
      else if (a.startsWith('--name=')) name = a.slice(7);
      else if (a === '--version' || a === '-v') version = Number(args[++i]);
      else if (a.startsWith('--version=')) version = Number(a.slice(10));
      else if (a === '--stage') stage = args[++i] ?? null;
      else if (a.startsWith('--stage=')) stage = a.slice(8);
    }
    if (!name || version == null || !Number.isFinite(version) || !stage) {
      return fail(
        world,
        'Usage: mlflow models transition -n <name> --version <n> --stage <None|Staging|Production|Archived>',
      );
    }
    if (!isStage(stage)) {
      return fail(
        world,
        "Unknown stage '" + stage + "'. Use: None | Staging | Production | Archived",
      );
    }
    const result = transitionStage(world, name, version, stage);
    if (!result) {
      return fail(world, "Model '" + name + "' version " + String(version) + ' not found.');
    }
    return ok(result.world, [
      'Transitioned ' +
        name +
        ' v' +
        String(result.version.version) +
        ' -> ' +
        stage,
    ]);
  }

  if (action === 'archive') {
    let name: string | null = null;
    let version: number | null = null;
    for (let i = 0; i < args.length; i += 1) {
      const a = args[i];
      if (a === '-n' || a === '--name') name = args[i + 1] ?? null;
      else if (a.startsWith('--name=')) name = a.slice(7);
      else if (a === '--version' || a === '-v') version = Number(args[++i]);
      else if (a.startsWith('--version=')) version = Number(a.slice(10));
    }
    if (!name || version == null) {
      return fail(world, 'Usage: mlflow models archive -n <name> --version <n>');
    }
    const result = transitionStage(world, name, version, 'Archived');
    if (!result) {
      return fail(world, "Model '" + name + "' version " + String(version) + ' not found.');
    }
    return ok(result.world, ['Archived ' + name + ' v' + String(result.version.version)]);
  }

  return fail(world, 'Usage: mlflow models register|list|get|transition|archive');
}

/** Execute one user command. */
export function executeCommand(raw: string, world: World): CommandResult {
  const line = raw.trim();
  if (!line) return ok(world);

  const lower = line.toLowerCase();
  if (lower === 'help' || lower === '?') return ok(world, helpLines());
  if (lower === 'clear' || lower === 'cls') return ok(world, [TOK_CLEAR]);

  const tokens = tokenize(line);
  if (tokens.length === 0) return ok(world);

  const bare = tokens[0].toLowerCase();
  if (bare === 'levels' || bare === 'level') {
    return ok(world, [TOK_LEVELS]);
  }
  if (bare === 'hint') {
    return ok(world, [TOK_HINT]);
  }
  if (bare === 'solution' || bare === 'show solution') {
    return ok(world, [TOK_SOLUTION]);
  }
  if (bare === 'undo') {
    return ok(world, [TOK_UNDO]);
  }
  if (bare === 'reset') {
    return ok(world, [TOK_RESET]);
  }
  if (bare === 'sandbox') {
    return ok(world, [TOK_SANDBOX]);
  }

  if (tokens[0] !== 'mlflow') {
    return fail(
      world,
      'Unknown command `' + tokens[0] + '`. Type `help` for the command list.',
    );
  }

  const rest = tokens.slice(1);
  if (rest.length === 0) return fail(world, 'Usage: mlflow <group> <action> ...');

  const group = rest[0].toLowerCase();
  const action = (rest[1] ?? '').toLowerCase();
  const args = rest.slice(2);

  if (group === 'experiments') return execExperiments(world, action, args);
  if (group === 'runs') return execRuns(world, action, args);
  if (group === 'models') return execModels(world, action, args);

  return fail(world, 'Unknown group `' + rest[0] + '`. Try: experiments | runs | models');
}
