/**
 * Intro sequence — Tracking fundamentals with deeper teaching notes.
 */

import type { Level } from '../engine/types';
import {
  activeExperimentIs,
  all,
  hasExperiment,
  minRuns,
  runHasArtifact,
  runHasMetric,
  runHasParam,
  runHasTag,
} from '../engine/goals';
import { emptyStart, withExperiment } from './builders';

export const introLevels: Level[] = [
  {
    id: 'intro-experiment',
    sequenceId: 'intro',
    name: 'Create an Experiment',
    about: 'Everything in MLflow Tracking hangs off an experiment.',
    hint: 'mlflow experiments create -n fraud-detection',
    solutionCommand: 'mlflow experiments create -n fraud-detection',
    startWorld: emptyStart(),
    goal: all(
      hasExperiment('fraud-detection'),
      activeExperimentIs('fraud-detection'),
    ),
    learning: [
      'MLflow Tracking groups every run under an experiment',
      'Creating an experiment also makes it the active target for new runs',
    ],
    goalSteps: [
      'Create experiment named exactly fraud-detection',
      'Leave it active (the * marker in Experiments)',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Why experiments exist',
          '',
          'Without a grouping mechanism, training logs become a pile of numbers with no context. An **experiment** is MLflow’s unit of organization: one problem, one product, one research question.',
          '',
          'Think of it as a *project folder* in the tracking server. Every attempt at solving that problem becomes a **run** inside the folder. When you later ask “which model should we ship?”, you compare runs *inside the same experiment* — not across unrelated projects.',
          '',
          'Create one with:',
          '',
          '```',
          'mlflow experiments create -n fraud-detection',
          '```',
          '',
          'The command also **activates** the experiment. That matters: the next run you start will land here automatically. In real projects you will often `mlflow experiments set` to switch between `fraud`, `churn`, `pricing` without restarting the CLI.',
        ],
      },
      {
        type: 'demo',
        before: [
          'Watch the right panel. Creating `demo` will add a row under Experiments and mark it active with `*`.',
        ],
        after: [
          'The experiment is listed and active. New runs will attach to it until you switch.',
          '',
          'Naming tip: use the business problem (`fraud-detection`), not the model (`xgboost-v2`). Models change; the problem stays.',
        ],
        command: 'mlflow experiments create -n demo',
      },
      {
        type: 'text',
        markdown: [
          'Now create an experiment named exactly `fraud-detection` to clear this level.',
        ],
      },
    ],
  },
  {
    id: 'intro-first-run',
    sequenceId: 'intro',
    name: 'Start a Run',
    about: 'A run is one training / evaluation attempt.',
    hint: 'mlflow runs create',
    solutionCommand: 'mlflow runs create',
    startWorld: withExperiment('iris'),
    goal: minRuns(1, 'iris'),
    learning: [
      'A run is one training or evaluation attempt',
      'Runs get short hex ids and stay RUNNING until finished',
    ],
    goalSteps: ['Start at least one run inside experiment iris'],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## What a run really is',
          '',
          'A **run** is a single attempt: *this code + these params + these metrics + these files*. If you train tonight with `lr=0.01` and tomorrow with `lr=0.001`, those are two runs — not two edits of the same record.',
          '',
          'That immutability is the point. You can always go back and see exactly what produced a bad (or great) metric. MLflow gives each run a short hex id (like `a1b2c3d4`) so you can reference it from scripts and the UI.',
          '',
          '```',
          'mlflow runs create',
          '```',
          '',
          'A new run starts as `RUNNING` and becomes the **active run**. Subsequent `log` commands attach to it until you finish or switch. The viz shows it as a card — that is your experiment history growing one attempt at a time.',
        ],
      },
      {
        type: 'demo',
        before: ['Start a demo run and watch a card pop in on the right.'],
        after: [
          'Status is `RUNNING`, and the run id is now active. Everything you log next belongs to this attempt.',
        ],
        command: 'mlflow runs create --name demo',
      },
      {
        type: 'text',
        markdown: ['Create at least one run inside `iris`.'],
      },
    ],
  },
  {
    id: 'intro-params',
    sequenceId: 'intro',
    name: 'Log Parameters',
    about: 'Params are the knobs you turned for this run.',
    hint: 'mlflow runs log -p lr=0.01',
    solutionCommand:
      'mlflow runs create; mlflow runs log -p lr=0.01; mlflow runs log -p max_depth=8',
    startWorld: withExperiment('iris'),
    goal: all(runHasParam('lr'), runHasParam('max_depth')),
    learning: [
      'Parameters record the inputs (hyperparameters) of a run',
      'Params are strings and answer: what did we try?',
    ],
    goalSteps: [
      'Log param lr (any value)',
      'Log param max_depth (any value)',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Parameters vs metrics',
          '',
          '**Parameters** are the *inputs* you chose before training: learning rate, tree depth, feature set, batch size. **Metrics** are the *outputs* after training. Confusing them is the fastest way to make a tracker useless.',
          '',
          '```',
          'mlflow runs log -p lr=0.01',
          'mlflow runs log -p max_depth=8',
          '```',
          '',
          'MLflow stores params as **strings** (even numbers). That is intentional — they are labels for configuration, not series you chart. Log every knob you would need to *reproduce* this run later. If `sklearn` defaults matter, log them explicitly; “default” drifts across versions.',
          '',
          'In the viz, params show as blue badges on the run card. Two runs with different `lr` are immediately distinguishable.',
        ],
      },
      {
        type: 'demo',
        before: ['Create a run and log `lr=0.01`.'],
        after: [
          'Blue badge on the card: `p lr=0.01`. That is the experiment’s “what we tried” line.',
        ],
        command: 'mlflow runs create; mlflow runs log -p lr=0.01',
      },
      {
        type: 'text',
        markdown: [
          'Log `lr` and `max_depth` on some run in `iris`.',
        ],
      },
    ],
  },
  {
    id: 'intro-metrics',
    sequenceId: 'intro',
    name: 'Log Metrics',
    about: 'Metrics are how you score the attempt.',
    hint: 'mlflow runs log -m acc=0.95',
    solutionCommand:
      'mlflow runs create; mlflow runs log -p model=rf; mlflow runs log -m acc=0.95; mlflow runs log -m f1=0.91',
    startWorld: withExperiment('iris'),
    goal: all(
      runHasParam('model'),
      runHasMetric('acc', { min: 0.9 }),
      runHasMetric('f1', { min: 0.85 }),
    ),
    learning: [
      'Metrics are numeric outputs you compare across runs',
      'Log the business metric and the diagnostic metric together',
    ],
    goalSteps: [
      'On one run: param model',
      'On the same run: metric acc >= 0.9',
      'On the same run: metric f1 >= 0.85',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Metrics that earn their keep',
          '',
          '**Metrics** answer *how well did this attempt work?* — accuracy, AUC, F1, latency, loss. They are numbers you chart over time and compare across runs.',
          '',
          '```',
          'mlflow runs log -m acc=0.95',
          'mlflow runs log -m f1=0.91',
          '```',
          '',
          'Two rules of thumb:',
          '',
          '- Log the **business metric** stakeholders care about (churn recall, fraud precision).',
          '- Log the **diagnostic** that explains *why* (train loss vs val loss, calibration). One accuracy number cannot tell you if you overfit.',
          '',
          'Values must be numeric. Log step-wise series too (`mlflow runs log -m loss=0.4` every epoch) — MLflow keeps the history so the UI can draw curves, not just a last value.',
          '',
          'In the viz, metrics are amber badges. High scores (≥ 0.9) glow green so strong runs pop.',
        ],
      },
      {
        type: 'demo',
        before: ['Log accuracy `0.72` on a fresh run.'],
        after: [
          'Amber badge: `m acc=0.72`. Weak score, but the habit is what counts.',
        ],
        command: 'mlflow runs create; mlflow runs log -m acc=0.72',
      },
      {
        type: 'text',
        markdown: [
          'Clear this level by logging, on **one** run:',
          '- param `model`',
          '- metric `acc` ≥ 0.9',
          '- metric `f1` ≥ 0.85',
        ],
      },
    ],
  },
  {
    id: 'intro-tags-artifacts',
    sequenceId: 'intro',
    name: 'Tags & Artifacts',
    about: 'Tags label the run; artifacts store the outputs.',
    hint: 'mlflow runs tag stage=train  ·  mlflow runs log-artifact model.pkl',
    solutionCommand:
      'mlflow runs create; mlflow runs tag stage=train; mlflow runs log-artifact model.pkl; mlflow runs log-artifact report.html',
    startWorld: withExperiment('iris'),
    goal: all(
      runHasTag('stage', 'train'),
      runHasArtifact('model.pkl'),
      runHasArtifact('report.html'),
    ),
    learning: [
      'Tags are searchable string labels (git sha, stage, owner)',
      'Artifacts are the files a run produced (model, reports)',
    ],
    goalSteps: [
      'Tag a run with stage=train',
      'Log artifact model.pkl',
      'Log artifact report.html',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Tags and artifacts complete the story',
          '',
          'Params say what you *chose*. Metrics say how it *went*. **Tags** add the metadata you filter on later: git commit, `stage=train`, owner, dataset version. **Artifacts** are the heavy outputs: the serialized model, a confusion-matrix PNG, an evaluation notebook.',
          '',
          '```',
          'mlflow runs tag stage=train',
          'mlflow runs log-artifact model.pkl',
          'mlflow runs log-artifact report.html',
          '```',
          '',
          'Without artifacts you cannot *reproduce or ship* — you only have numbers. Log the model binary every time you intend to promote something. Log the evaluation report so a reviewer can open one link and trust the metric.',
          '',
          'Practical pattern: tag `mlflow.user`, `git.sha`, `data.snapshot` automatically in production pipelines. Manual tags are fine while you learn; automate them before the second week.',
        ],
      },
      {
        type: 'demo',
        before: ['Tag a run and log one artifact.'],
        after: [
          'Tag is a muted chip; the artifact stacks as a file row. Together they make the run auditable.',
        ],
        command:
          'mlflow runs create; mlflow runs tag stage=train; mlflow runs log-artifact model.pkl',
      },
      {
        type: 'text',
        markdown: [
          'On **one** run, set tag `stage=train` and log artifacts `model.pkl` **and** `report.html`.',
        ],
      },
    ],
  },
  {
    id: 'intro-two-runs',
    sequenceId: 'intro',
    name: 'Compare Two Runs',
    about: 'Tracking is only worth it when you can compare.',
    hint: 'Two runs, one with higher acc than the other.',
    solutionCommand:
      'mlflow runs create --name weak; mlflow runs log -m acc=0.61; mlflow runs create --name strong; mlflow runs log -p model=gbm; mlflow runs log -m acc=0.93',
    startWorld: withExperiment('iris'),
    goal: all(
      minRuns(2, 'iris'),
      runHasParam('model'),
      runHasMetric('acc', { min: 0.9 }),
    ),
    learning: [
      'Name runs so comparison tables stay readable',
      'Side-by-side metrics are the real payoff of Tracking',
    ],
    goalSteps: [
      'Create at least two runs in iris',
      'Some run has param model',
      'Some run has metric acc >= 0.9',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Comparison is the product',
          '',
          'A single logged run is a diary entry. Two runs are a **decision**. The moment you have `baseline` at 0.61 and `gbm` at 0.93 with different params, you can defend a model choice in a review meeting.',
          '',
          '```',
          'mlflow runs create --name baseline',
          'mlflow runs create --name gbm',
          '```',
          '',
          'Name runs (`--name`) so the comparison table is human. `a1b2c3d4` vs `f00ba12` is not a strategy. Keep names boring and descriptive: `rf-depth8`, `gbm-lr0.05`.',
          '',
          'This is also where **command golf** starts to matter: can you set up a fair comparison in few, clear commands? Colleagues will copy your CLI line into their own experiments.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Clear this level:',
          '1. At least **two** runs in `iris`',
          '2. Some run has param `model`',
          '3. Some run has metric `acc` ≥ 0.9',
        ],
      },
    ],
  },
];
