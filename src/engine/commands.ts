/**
 * Expanded command surface for the full curriculum.
 *
 * Groups: experiments, runs, artifacts, models, autolog, evaluate, datasets, genai
 */

import type { CommandResult, Run, Stage, World } from './types';
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
  describeModelVersion,
  finishRun,
  getExperiment,
  getExperimentByName,
  getModel,
  listRuns,
  loadModel,
  logArtifact,
  logDataset,
  logEval,
  logMetric,
  logParam,
  logPrompt,
  logSystemMetrics,
  logTag,
  logTrace,
  markAutologged,
  predict,
  registerModel,
  resolveRun,
  searchRuns,
  serveModel,
  servePredict,
  setActiveExperiment,
  setActiveParent,
  setAlias,
  setApproval,
  setAutolog,
  setSource,
  stopServe,
  tagExperiment,
  transitionStage,
} from './world';
import { tryFluent } from './fluent';
import { explain } from './errors';

function fail(world: World, error: string, code = 'unknown-fluent'): CommandResult {
  return { ok: false, error, why: explain(code), world };
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

function formatRunLine(run: Run): string {
  return (
    '  ' +
    run.id +
    '  ' +
    run.status.padEnd(8) +
    '  ' +
    run.name.padEnd(16) +
    (run.parentId ? ' [nested]' : '') +
    '  p' +
    String(Object.keys(run.params).length) +
    ' m' +
    String(Object.keys(run.metrics).length) +
    ' a' +
    String(run.artifacts.length)
  );
}

function helpLines(): string[] {
  return [
    'LearnMLflow commands',
    '',
    'Tracking',
    '  mlflow experiments create -n <name> [--tag k=v]',
    '  mlflow experiments set <id|name>',
    '  mlflow experiments list | tag <name> k=v',
    '  mlflow runs create [--name <name>] [--nested] [--parent <id>]',
    '  mlflow runs set <id|latest> | set-parent <id|none>',
    '  mlflow runs list | search "<filter>" | delete <id> | finish [id]',
    '  mlflow runs log -p key=value | -m key=value [--step N]',
    '  mlflow runs tag key=value',
    '  mlflow runs source --git <sha> --entry <path> [--version <v>]',
    '  mlflow runs env --python <v> --mlflow <v>',
    '  mlflow runs log-artifact <name> [--model] [--flavor <f>]',
    '',
    'Artifacts & data',
    '  mlflow artifacts list [--run <id>]',
    '  mlflow datasets log <name> [--type csv|pq|sql]',
    '',
    'Model Registry (aliases first — stages are legacy)',
    '  mlflow models register -n <name> [--run <id>] [--flavor <f>] [--signature <s>]',
    '  mlflow models alias -n <name> --alias champion --version <n>',
    '  mlflow models load -n <name> @champion',
    '  mlflow models list | get <name> | describe -n <name> --version <n> --text <t>',
    '  mlflow models approve|reject -n <name> --version <n>',
    '  mlflow models transition -n <name> --version <n> --stage <S>   # legacy',
    '  mlflow models archive -n <name> --version <n>                 # legacy',
    '  mlflow models predict --rows <n>',
    '  mlflow models serve -n <name> --port <p> [--stage <S>] [--json]',
    '  mlflow models invoke --json "..." | docker-build | stop-serve',
    '',
    'Training helpers',
    '  mlflow autolog <sklearn|pytorch|openai|off>',
    '  mlflow evaluate --metric <name> --value <v> | --builtin classification',
    '  mlflow recipes run | train | evaluate | prepare',
    '  mlflow run . -P key=value',
    '',
    'GenAI',
    '  mlflow genai log-prompt "<text>"',
    '  mlflow genai log-trace --name <n> --kind LLM|CHAIN|TOOL|RETRIEVER',
    '  mlflow genai score --name <s> --value <v>',
    '',
    'Game',
    '  levels  hint  solution  undo  reset  sandbox  clear  help',
  ];
}

function flagValue(args: string[], ...names: string[]): string | null {
  for (let i = 0; i < args.length; i += 1) {
    for (const n of names) {
      if (args[i] === n && args[i + 1] != null) return args[i + 1];
      if (args[i].startsWith(n + '=')) return args[i].slice(n.length + 1);
    }
  }
  return null;
}

function hasFlag(args: string[], ...names: string[]): boolean {
  return args.some((a) => names.includes(a) || names.some((n) => a.startsWith(n + '=')));
}

function execExperiments(
  world: World,
  action: string,
  args: string[],
): CommandResult {
  if (action === 'create') {
    let name = flagValue(args, '-n', '--name');
    if (!name) {
      name = args.find((a) => !a.startsWith('-')) ?? null;
    }
    if (!name) return fail(world, 'Usage: mlflow experiments create -n <name>');
    if (getExperimentByName(world, name)) {
      return fail(world, "Experiment '" + name + "' already exists.");
    }
    const created = createExperiment(world, name);
    let w = created.world;
    const tagPair = flagValue(args, '--tag');
    if (tagPair) {
      const kv = parseKeyValue(tagPair);
      if (kv) w = tagExperiment(w, created.experiment.id, kv.key, kv.value);
    }
    return ok(w, [
      "Created experiment '" +
        created.experiment.name +
        "' (id=" +
        created.experiment.id +
        ')',
      "Active experiment is now '" + created.experiment.name + "'",
    ]);
  }
  if (action === 'set') {
    const ref = args[0];
    if (!ref) return fail(world, 'Usage: mlflow experiments set <id|name>');
    const exp =
      getExperiment(world, ref) ?? getExperimentByName(world, ref);
    if (!exp) return fail(world, "Experiment '" + ref + "' not found.");
    return ok(setActiveExperiment(world, exp.id), [
      "Active experiment is now '" + exp.name + "' (id=" + exp.id + ')',
    ]);
  }
  if (action === 'list') {
    if (!world.experiments.length) {
      return ok(world, ['No experiments yet.']);
    }
    const lines = ['Experiment_id    Name                 # Runs', '-'.repeat(48)];
    for (const e of world.experiments) {
      const mark = e.id === world.activeExperimentId ? '*' : ' ';
      lines.push(
        mark + e.id.padEnd(16) + ' ' + e.name.padEnd(20) + ' ' + String(e.runIds.length),
      );
    }
    return ok(world, lines);
  }
  if (action === 'tag') {
    const name = args[0];
    const pair = args.find((a) => a.includes('=') && !a.startsWith('-'));
    const kv = pair ? parseKeyValue(pair) : null;
    if (!name || !kv) return fail(world, 'Usage: mlflow experiments tag <name> key=value');
    const exp = getExperimentByName(world, name) ?? getExperiment(world, name);
    if (!exp) return fail(world, "Experiment '" + name + "' not found.");
    return ok(tagExperiment(world, exp.id, kv.key, kv.value), [
      'Tagged experiment ' + exp.name + '  ' + kv.key + '=' + kv.value,
    ]);
  }
  return fail(world, 'Usage: mlflow experiments create|set|list|tag');
}

function execRuns(world: World, action: string, args: string[]): CommandResult {
  if (action === 'create') {
    if (!world.activeExperimentId) {
      return fail(world, 'No active experiment. Create one first.');
    }
    const name = flagValue(args, '--name', '-n');
    const parent = flagValue(args, '--parent');
    const nested = hasFlag(args, '--nested');
    const parentId = nested ? world.activeRunId : parent;
    const created = createRun(
      world,
      world.activeExperimentId,
      name ?? undefined,
      parentId ?? null,
    );
    let w = created.world;
    const flavor = w.autologFlavor;
    if (flavor) {
      w = markAutologged(w, created.run.id);
      w = logParam(w, created.run.id, 'framework', flavor);
      w = logMetric(w, created.run.id, 'train_loss', 0.42, 0);
      w = logMetric(w, created.run.id, 'train_loss', 0.28, 1);
      w = logMetric(w, created.run.id, 'train_loss', 0.18, 2);
      w = logSystemMetrics(w, created.run.id);
      w = logArtifact(w, created.run.id, 'model.pkl', 'model', flavor);
    }
    w = setSource(
      w,
      created.run.id,
      {
        git: w.autologFlavor ? 'abc1234' : null,
        entry: w.autologFlavor ? 'train.py' : null,
      },
      {
        python: w.autologFlavor ? '3.11.8' : null,
        mlflow: w.autologFlavor ? '2.14.0' : null,
      },
    );
    return ok(w, [
      'Run ' + created.run.id + ' started' + (parentId ? ' (nested under ' + parentId + ')' : ''),
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
  if (action === 'set-parent') {
    const ref = args[0];
    if (!ref || ref === 'none') {
      return ok(setActiveParent(world, null), ['Active parent run: none']);
    }
    const run = resolveRun(world, ref);
    if (!run) return fail(world, "Run '" + ref + "' not found.");
    return ok(setActiveParent(world, run.id), ['Active parent run: ' + run.id]);
  }
  if (action === 'list') {
    const runs = listRuns(world, world.activeExperimentId ?? undefined);
    if (!runs.length) return ok(world, ['No runs.']);
    const lines = [
      'Run_id    Status    Name             Nest  Counts',
      '-'.repeat(56),
    ];
    for (const r of runs) {
      const mark = r.id === world.activeRunId ? '*' : ' ';
      lines.push(mark + formatRunLine(r));
    }
    return ok(world, lines);
  }
  if (action === 'search') {
    // filter is remaining args joined, or quoted already stripped by tokenize
    const filter = args.join(' ');
    const hits = searchRuns(world, filter);
    if (!hits.length) return ok(world, ['No runs matched.']);
    const lines = ['Run_id    Name             acc    lr', '-'.repeat(40)];
    for (const r of hits) {
      lines.push(
        '  ' +
          r.id +
          '  ' +
          r.name.padEnd(16) +
          String(r.metrics.acc ?? '-').padEnd(6) +
          ' ' +
          (r.params.lr ?? '-'),
      );
    }
    return ok(world, ['Matched ' + String(hits.length) + ' run(s)', ...lines]);
  }
  if (action === 'log') {
    let target = flagValue(args, '--run', '-r');
    let step = Number(flagValue(args, '--step') ?? '0');
    if (!Number.isFinite(step)) step = 0;
    let key = '';
    let value: string | null = null;
    let kind: 'param' | 'metric' | null = null;
    for (let i = 0; i < args.length; i += 1) {
      const a = args[i];
      if (a === '-p' || a === '--param') {
        kind = 'param';
        value = args[++i] ?? null;
        const kv = value ? parseKeyValue(value) : null;
        if (!kv) return fail(world, 'Expected key=value for -p');
        key = kv.key;
        value = kv.value;
      } else if (a === '-m' || a === '--metric') {
        kind = 'metric';
        value = args[++i] ?? null;
        const kv = value ? parseKeyValue(value) : null;
        if (!kv) return fail(world, 'Expected key=value for -m');
        key = kv.key;
        value = kv.value;
      }
    }
    if (!kind) return fail(world, 'Usage: mlflow runs log -p k=v | -m k=v [--step N]');
    const run = target ? resolveRun(world, target) : activeRunOr(world);
    if (!run) return fail(world, 'No active run.');
    if (kind === 'param') {
      return ok(logParam(world, run.id, key, value as string), [
        'Logged param  ' + key + '=' + value,
      ]);
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return fail(world, "Metric value must be numeric, got '" + value + "'");
    }
    return ok(logMetric(world, run.id, key, num, step), [
      'Logged metric ' + key + '=' + String(num) + ' step=' + String(step),
    ]);
  }
  if (action === 'tag') {
    const pair = args.find((a) => a.includes('=') && !a.startsWith('--'));
    const target = flagValue(args, '--run');
    const kv = pair ? parseKeyValue(pair) : null;
    if (!kv) return fail(world, 'Usage: mlflow runs tag key=value');
    const run = target ? resolveRun(world, target) : activeRunOr(world);
    if (!run) return fail(world, 'No active run.');
    return ok(logTag(world, run.id, kv.key, kv.value), [
      'Tagged  ' + kv.key + '=' + kv.value,
    ]);
  }
  if (action === 'source') {
    const run = activeRunOr(world);
    if (!run) return fail(world, 'No active run.');
    const git = flagValue(args, '--git') ?? undefined;
    const entry = flagValue(args, '--entry') ?? undefined;
    const version = flagValue(args, '--version') ?? undefined;
    return ok(
      setSource(world, run.id, {
        git: git ?? null,
        entry: entry ?? null,
        version: version ?? null,
      }, {}),
      ['Recorded source on ' + run.id],
    );
  }
  if (action === 'env') {
    const run = activeRunOr(world);
    if (!run) return fail(world, 'No active run.');
    const python = flagValue(args, '--python');
    const mlflow = flagValue(args, '--mlflow');
    return ok(
      setSource(world, run.id, {}, {
        python: python ?? null,
        mlflow: mlflow ?? null,
      }),
      ['Recorded environment on ' + run.id],
    );
  }
  if (action === 'log-artifact' || action === 'log-artifacts') {
    const name = args.find((a) => !a.startsWith('-'));
    const target = flagValue(args, '--run');
    const flavor = flagValue(args, '--flavor');
    const isModel = hasFlag(args, '--model');
    if (!name) return fail(world, 'Usage: mlflow runs log-artifact <name>');
    const run = target ? resolveRun(world, target) : activeRunOr(world);
    if (!run) return fail(world, 'No active run.');
    return ok(
      logArtifact(
        world,
        run.id,
        name,
        isModel ? 'model' : 'file',
        flavor ?? (isModel ? 'sklearn' : undefined),
      ),
      ['Logged artifact ' + name + (isModel ? ' (model)' : '')],
    );
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
        !['FINISHED', 'FAILED', 'KILLED'].includes(a.toUpperCase()),
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
    const status = (statusArg?.toUpperCase() ?? 'FINISHED') as Run['status'];
    return ok(finishRun(world, run.id, status), [
      'Run ' + run.id + ' -> ' + status,
    ]);
  }
  return fail(world, 'Unknown runs action');
}

function execArtifacts(world: World, action: string, args: string[]): CommandResult {
  if (action === 'list') {
    const target = flagValue(args, '--run');
    const run = target ? resolveRun(world, target) : activeRunOr(world);
    if (!run) return fail(world, 'No run selected.');
    if (!run.artifacts.length) {
      return ok(world, ['No artifacts on run ' + run.id]);
    }
    const lines = run.artifacts.map(
      (a) =>
        '  ' +
        a.path.padEnd(20) +
        ' ' +
        a.kind.padEnd(6) +
        ' ' +
        String(a.size).padStart(8) +
        (a.flavor ? '  flavor=' + a.flavor : ''),
    );
    return ok(world, ['Artifacts for ' + run.id, ...lines]);
  }
  return fail(world, 'Usage: mlflow artifacts list');
}

function execModels(world: World, action: string, args: string[]): CommandResult {
  if (action === 'register') {
    const name = flagValue(args, '-n', '--name');
    const runRef = flagValue(args, '--run', '-r');
    const flavor = flagValue(args, '--flavor') ?? 'sklearn';
    const signature = flagValue(args, '--signature');
    if (!name) return fail(world, 'Usage: mlflow models register -n <name>');
    const allRuns = listRuns(world);
    const run = runRef
      ? resolveRun(world, runRef)
      : world.activeRunId
        ? world.runs[world.activeRunId]
        : allRuns[allRuns.length - 1];
    if (!run) return fail(world, 'No run to register.');
    let w = logArtifact(world, run.id, 'model', 'model', flavor);
    const registered = registerModel(w, name, run.id, '', flavor, signature);
    return ok(registered.world, [
      'Registered ' +
        name +
        ' v' +
        String(registered.version.version) +
        ' flavor=' +
        flavor +
        ' from ' +
        run.id,
    ]);
  }
  if (action === 'list') {
    const models = Object.values(world.models);
    if (!models.length) return ok(world, ['No registered models.']);
    const lines = [
      'Name                 Vers  Flavor    Latest stage  Aliases',
      '-'.repeat(60),
    ];
    for (const m of models) {
      const latest = m.versions[m.versions.length - 1];
      const aliases = latest?.aliases.join(',') ?? '-';
      lines.push(
        m.name.padEnd(20) +
          ' ' +
          String(m.versions.length).padEnd(5) +
          ' ' +
          (latest?.flavor ?? '-').padEnd(9) +
          ' ' +
          (latest?.stage ?? '-').padEnd(13) +
          ' ' +
          aliases,
      );
    }
    return ok(world, lines);
  }
  if (action === 'get') {
    const name = args.find((a) => !a.startsWith('-'));
    if (!name) return fail(world, 'Usage: mlflow models get <name>');
    const model = getModel(world, name);
    if (!model) return fail(world, "Model '" + name + "' not found.");
    const lines = [
      'Model: ' + model.name,
      model.description ? '  ' + model.description : '',
      '',
      'Ver  Stage       Flavor     Signature  Aliases',
      '-'.repeat(52),
      ...model.versions.map((v) => {
        const mark = v.stage === 'Production' ? '*' : ' ';
        return (
          mark +
          String(v.version).padEnd(3) +
          ' ' +
          v.stage.padEnd(11) +
          ' ' +
          v.flavor.padEnd(10) +
          ' ' +
          (v.signature ?? '-').padEnd(10) +
          ' ' +
          (v.aliases.join(',') || '-')
        );
      }),
    ].filter(Boolean);
    return ok(world, lines);
  }
  if (action === 'describe') {
    const name = flagValue(args, '-n', '--name');
    const version = Number(flagValue(args, '--version') ?? '0');
    const text = flagValue(args, '--text');
    if (!name || !version || !text) {
      return fail(
        world,
        'Usage: mlflow models describe -n <name> --version <n> --text <t>',
      );
    }
    const updated = describeModelVersion(world, name, version, text);
    return ok(updated, ['Updated description on ' + name + ' v' + String(version)]);
  }
  if (action === 'transition') {
    const name = flagValue(args, '-n', '--name');
    const version = Number(flagValue(args, '--version') ?? '0');
    const stage = flagValue(args, '--stage');
    if (!name || !version || !stage) {
      return fail(
        world,
        'Usage: mlflow models transition -n <name> --version <n> --stage <S>',
      );
    }
    if (!isStage(stage)) {
      return fail(world, "Unknown stage '" + stage + "'");
    }
    const result = transitionStage(world, name, version, stage);
    if (!result) return fail(world, 'Version not found.');
    return ok(result.world, [
      'Transitioned ' + name + ' v' + String(version) + ' -> ' + stage,
    ]);
  }
  if (action === 'archive') {
    const name = flagValue(args, '-n', '--name');
    const version = Number(flagValue(args, '--version') ?? '0');
    if (!name || !version) {
      return fail(world, 'Usage: mlflow models archive -n <name> --version <n>');
    }
    const result = transitionStage(world, name, version, 'Archived');
    if (!result) return fail(world, 'Version not found.');
    return ok(result.world, ['Archived ' + name + ' v' + String(version)]);
  }
  if (action === 'alias') {
    const name = flagValue(args, '-n', '--name');
    const alias = flagValue(args, '--alias');
    const version = Number(flagValue(args, '--version') ?? '0');
    if (!name || !alias || !version) {
      return fail(
        world,
        'Usage: mlflow models alias -n <name> --alias <a> --version <n>',
      );
    }
    const result = setAlias(world, name, alias, version);
    if (!result) return fail(world, 'Version not found.');
    return ok(result.world, [
      'Alias @' + alias + ' -> ' + name + ' v' + String(version),
    ]);
  }
  if (action === 'load') {
    const name = flagValue(args, '-n', '--name') ?? args.find((a) => !a.startsWith('-'));
    if (!name) return fail(world, 'Usage: mlflow models load -n <name> [--stage S | --version n | @alias]');
    let ref: Stage | number | string = 'Production';
    const stage = flagValue(args, '--stage');
    const version = flagValue(args, '--version');
    const aliasArg = args.find((a) => a.startsWith('@'));
    if (stage) ref = isStage(stage) ? stage : stage;
    else if (version) ref = Number(version);
    else if (aliasArg) ref = aliasArg.slice(1);
    const result = loadModel(world, name, ref);
    if (!result) return fail(world, "Cannot resolve model '" + name + "' ref");
    return ok(result.world, [
      'Loaded ' + result.uri + '  (v' + String(result.version.version) + ', flavor=' + result.version.flavor + ')',
    ]);
  }
  if (action === 'predict') {
    const rows = Number(flagValue(args, '--rows') ?? '3');
    if (!world.loadedModelUri) {
      return fail(world, 'No model loaded. Use `mlflow models load` first.', 'no-model');
    }
    const model = world.loadedModelName
      ? world.models[world.loadedModelName]
      : undefined;
    const ver = model?.versions.find((v) => v.version === world.loadedModelVersion);
    if (ver && !ver.signature) {
      return fail(
        world,
        'Refusing to predict: model has no signature',
        'no-signature',
      );
    }
    const result = predict(world, rows);
    if (!result) return fail(world, 'Predict failed', 'no-model');
    return ok(result.world, [
      'Predictions (' + String(result.values.length) + ' rows):',
      '  [' + result.values.join(', ') + ']',
      '  latency=' + String(world.lastPredictLatencyMs ?? 12) + 'ms (est.)',
    ]);
  }
  if (action === 'serve') {
    const name = flagValue(args, '-n', '--name');
    const port = Number(flagValue(args, '--port') ?? '5001');
    const stage = flagValue(args, '--stage') ?? 'Production';
    const alias = flagValue(args, '--alias');
    if (!name) return fail(world, 'Usage: mlflow models serve -n <name> --port <p>');
    const ref = alias ?? (isStage(stage) ? stage : 'Production');
    const loaded = loadModel(world, name, ref);
    if (!loaded) return fail(world, "Cannot resolve model '" + name + "'");
    const served = serveModel(loaded.world, loaded.uri, port);
    return ok(served, [
      'Serving ' + loaded.uri + ' on http://127.0.0.1:' + String(port),
      'POST /invocations  ready',
    ]);
  }
  if (action === 'invoke') {
    if (!world.served?.ready) return fail(world, 'Server is not running.', 'no-model');
    const payload = flagValue(args, '--json') ?? flagValue(args, '--content-type');
    if (payload && world.loadedModelName) {
      const model = world.models[world.loadedModelName];
      const ver = model?.versions.find((v) => v.version === world.loadedModelVersion);
      if (ver && !ver.signature) {
        return fail(
          world,
          '400 Bad Request: payload rejected — model has no signature',
          'no-signature',
        );
      }
    }
    return ok(servePredict(world, 1), [
      '200 OK',
      'Content-Type: application/json',
      'prediction recorded on ' + world.served.modelUri,
    ]);
  }
  if (action === 'stop-serve') {
    return ok(stopServe(world), ['Server stopped.']);
  }
  if (action === 'docker-build' || action === 'build-image') {
    const name = flagValue(args, '-n', '--name');
    const flavor = flagValue(args, '--flavor') ?? 'sklearn';
    if (!name) return fail(world, 'Usage: mlflow models docker-build -n <name>', 'no-arg');
    return ok(world, [
      '=== mlflow models build-docker -n ' + name + ' (simulated) ===',
      'FROM python:3.11-slim',
      'COPY model/ /opt/ml/model',
      'RUN pip install mlflow==2.14.0 ' + flavor,
      'EXPOSE 8080',
      'CMD ["mlflow", "models", "serve", "-m", "/opt/ml/model", "-h", "0.0.0.0", "-p", "8080"]',
      'Image tagged: ' + name + ':latest',
    ]);
  }
  if (action === 'approve' || action === 'reject') {
    const name = flagValue(args, '-n', '--name');
    const version = Number(flagValue(args, '--version') ?? '0');
    if (!name || !version) {
      return fail(
        world,
        'Usage: mlflow models approve|reject -n <name> --version <n>',
        'no-arg',
      );
    }
    const result = setApproval(
      world,
      name,
      version,
      action === 'approve' ? 'approved' : 'rejected',
    );
    if (!result) return fail(world, 'Version not found', 'missing-version');
    return ok(result.world, [
      (action === 'approve' ? 'Approved ' : 'Rejected ') +
        name +
        ' v' +
        String(version),
    ]);
  }
  return fail(world, 'Unknown models action', 'unknown-fluent');
}

function execAutolog(world: World, action: string): CommandResult {
  if (action === 'off') {
    return ok(setAutolog(world, null), ['autolog disabled']);
  }
  if (action === 'openai' || action === 'pytorch' || action === 'sklearn' || action === 'transformers') {
    return ok(setAutolog(world, action), [
      'autolog enabled for ' + action + ' — new runs will record params, metrics, model',
    ]);
  }
  if (!action) return fail(world, 'Usage: mlflow autolog <sklearn|pytorch|openai|off>', 'no-arg');
  return ok(setAutolog(world, action), [
    'autolog enabled for ' + action + ' — new runs will record params, metrics, model',
  ]);
}

function execEvaluate(world: World, args: string[]): CommandResult {
  const metric = flagValue(args, '--metric');
  const value = flagValue(args, '--value');
  const higher = flagValue(args, '--higher-better') ?? 'true';
  const run = activeRunOr(world);
  if (!metric || value == null) {
    return fail(world, 'Usage: mlflow evaluate --metric <name> --value <v>');
  }
  if (!run) return fail(world, 'No active run.');
  const num = Number(value);
  if (!Number.isFinite(num)) return fail(world, 'value must be numeric');
  return ok(logEval(world, run.id, metric, num, higher !== 'false'), [
    'Evaluated ' + metric + '=' + String(num) + ' on ' + run.id,
  ]);
}

function execDatasets(world: World, action: string, args: string[]): CommandResult {
  if (action === 'log') {
    const name = args.find((a) => !a.startsWith('-'));
    const type = flagValue(args, '--type') ?? 'csv';
    const run = activeRunOr(world);
    if (!name) return fail(world, 'Usage: mlflow datasets log <name>');
    if (!run) return fail(world, 'No active run.');
    return ok(logDataset(world, run.id, name, type), [
      'Logged dataset ' + name + ' (type=' + type + ')',
    ]);
  }
  return fail(world, 'Usage: mlflow datasets log <name>');
}

function execGenai(world: World, action: string, args: string[]): CommandResult {
  const run = activeRunOr(world);
  if (!run) return fail(world, 'No active run.');
  if (action === 'log-prompt') {
    const prompt = args.join(' ');
    if (!prompt) return fail(world, 'Usage: mlflow genai log-prompt "<text>"');
    return ok(logPrompt(world, run.id, prompt), ['Logged prompt on ' + run.id]);
  }
  if (action === 'log-trace') {
    const name = flagValue(args, '--name') ?? 'span';
    const kind = (flagValue(args, '--kind') ?? 'LLM') as Run['traces'][number]['kind'];
    const status = (flagValue(args, '--status') ?? 'OK') as Run['traces'][number]['status'];
    return ok(logTrace(world, run.id, name, kind, status), [
      'Logged trace ' + name + ' kind=' + kind,
    ]);
  }
  return fail(world, 'Usage: mlflow genai log-prompt|log-trace');
}

export function executeCommand(raw: string, world: World): CommandResult {
  const line = raw.trim();
  if (!line) return ok(world);

  const lower = line.toLowerCase();
  if (lower === 'help' || lower === '?') return ok(world, helpLines());
  if (lower === 'clear' || lower === 'cls') return ok(world, [TOK_CLEAR]);

  const fluent = tryFluent(line, world);
  if (fluent) return fluent;

  const tokens = tokenize(line);
  if (!tokens.length) return ok(world);

  const bare = tokens[0].toLowerCase();
  if (bare === 'levels' || bare === 'level') return ok(world, [TOK_LEVELS]);
  if (bare === 'hint') return ok(world, [TOK_HINT]);
  if (bare === 'solution') return ok(world, [TOK_SOLUTION]);
  if (bare === 'undo') return ok(world, [TOK_UNDO]);
  if (bare === 'reset') return ok(world, [TOK_RESET]);
  if (bare === 'sandbox') return ok(world, [TOK_SANDBOX]);

  if (tokens[0] === 'mlflow') {
    const rest = tokens.slice(1);
    if (!rest.length) return fail(world, 'Usage: mlflow <group> ...');
    const group = rest[0].toLowerCase();
    const action = (rest[1] ?? '').toLowerCase();
    const args = rest.slice(2);
    if (group === 'experiments') return execExperiments(world, action, args);
    if (group === 'runs') return execRuns(world, action, args);
    if (group === 'artifacts') return execArtifacts(world, action, args);
    if (group === 'models') return execModels(world, action, args);
    if (group === 'autolog') return execAutolog(world, action);
    if (group === 'evaluate') {
      const builtin = flagValue(rest.slice(1), '--builtin');
      if (builtin === 'classification') {
        const run = activeRunOr(world);
        if (!run) return fail(world, 'No active run', 'no-run');
        let w = logEval(world, run.id, 'precision', 0.91);
        w = logEval(w, run.id, 'recall', 0.88);
        w = logEval(w, run.id, 'f1_score', 0.89);
        return ok(w, [
          'mlflow.evaluate(classification) wrote precision/recall/f1_score',
          'precision=0.91  recall=0.88  f1_score=0.89',
        ]);
      }
      return execEvaluate(world, rest.slice(1));
    }
    if (group === 'run') {
      const entry =
        rest.find((a) => !a.startsWith('-') && a.includes('.')) ?? 'MLproject';
      let pLr = flagValue(rest, '-P') ?? rest.find((a) => a.startsWith('lr='))?.slice(3);
      if (pLr && pLr.includes('=')) pLr = pLr.slice(pLr.indexOf('=') + 1);
      if (!world.activeExperimentId) {
        return fail(world, 'No active experiment', 'no-experiment');
      }
      const created = createRun(world, world.activeExperimentId, 'mlflow-run');
      let w = setSource(
        created.world,
        created.run.id,
        { git: 'proj0001', entry },
        { python: '3.11.8', mlflow: '2.14.0' },
      );
      w = logParam(w, created.run.id, 'entry', entry);
      if (pLr) w = logParam(w, created.run.id, 'lr', pLr);
      w = logMetric(w, created.run.id, 'rmse', 2.5);
      w = finishRun(w, created.run.id, 'FINISHED');
      return ok(w, [
        '=== mlflow run (simulated) ===',
        'Run ' + created.run.id + ' from entry ' + entry,
        pLr ? 'param lr=' + pLr : 'params: defaults',
        'rmse=2.5',
      ]);
    }
    if (group === 'recipes') {
    // Lightweight Recipes pipeline teaching: prepare → train → evaluate
    const stage = action || 'run';
    if (!world.activeExperimentId) {
      return fail(world, 'No active experiment', 'no-experiment');
    }
    const created = createRun(world, world.activeExperimentId, 'recipe-' + stage);
    let w = created.world;
    w = logParam(w, created.run.id, 'recipe.stage', stage);
    w = logTag(w, created.run.id, 'mlflow.pipeline', 'recipe');
    w = logDataset(w, created.run.id, 'recipe-data', 'csv');
    if (stage === 'run' || stage === 'train') {
      w = logParam(w, created.run.id, 'estimator', 'sklearn.ensemble');
      w = logMetric(w, created.run.id, 'training_score', 0.9, 0);
    }
    if (stage === 'run' || stage === 'evaluate') {
      w = logEval(w, created.run.id, 'rmse', 1.8);
      w = logEval(w, created.run.id, 'r2_score', 0.81);
      w = logArtifact(w, created.run.id, 'model', 'model', 'sklearn');
    }
    if (stage === 'run' || stage === 'prepare') {
      w = logArtifact(w, created.run.id, 'transformed.csv', 'file');
    }
    w = finishRun(w, created.run.id, 'FINISHED');
    return ok(w, [
      '=== mlflow recipes ' + stage + ' (simulated) ===',
      'Recipe stages: prepare -> train -> evaluate',
      'Run ' + created.run.id + ' recorded as pipeline step',
    ]);
  }
  if (group === 'datasets') return execDatasets(world, action, args);
    if (group === 'genai') {
      if (action === 'score') {
        const name = flagValue(args, '--name') ?? 'score';
        const value = Number(flagValue(args, '--value') ?? '0');
        const run = activeRunOr(world);
        if (!run) return fail(world, 'No active run', 'no-run');
        return ok(logEval(world, run.id, name, value), [
          'Scorer ' + name + '=' + String(value),
        ]);
      }
      return execGenai(world, action, args);
    }
    return fail(world, 'Unknown group `' + rest[0] + '`', 'unknown-fluent');
  }

  // Python-flavored teaching shortcuts used in dialogs
  if (tokens[0] === 'import' && tokens[1] === 'mlflow') {
    return ok(world, ['(simulated) import mlflow  — Tracking API ready']);
  }
  if (tokens[0] === 'mlflow.sklearn' || line.startsWith('mlflow.sklearn.autolog')) {
    return executeCommand('mlflow autolog sklearn', world);
  }

  return fail(
    world,
    'Unknown command `' + tokens[0] + '`. Type `help` for the command list.',
  );
}
