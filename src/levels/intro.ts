/**
 * Intro sequence — Tracking fundamentals.
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
    goal: all(hasExperiment('fraud-detection'), activeExperimentIs('fraud-detection')),
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Experiments',
          '',
          'An **experiment** is the top-level container for ML work: runs live inside it, and you compare runs within the same experiment.',
          '',
          'In a real tracking server every project (or problem) usually gets its own experiment — `churn`, `pricing`, `fraud-detection`.',
          '',
          'Creating one is enough for this level. Use:',
          '',
          '```',
          'mlflow experiments create -n <name>',
          '```',
        ],
      },
      {
        type: 'demo',
        before: [
          'Hit the button to create an experiment named `demo` and watch it appear in the viz panel.',
        ],
        after: [
          'There — the experiment is listed and marked active (`*`). New runs will land here.',
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
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Runs',
          '',
          'A **run** records one attempt at solving the problem: the code snapshot context, its parameters, metrics, and artifacts.',
          '',
          'You already have an experiment `iris` active. Start a run with:',
          '',
          '```',
          'mlflow runs create',
          '```',
          '',
          'The run gets a short hex id (like real MLflow) and appears as a card in the viz.',
        ],
      },
      {
        type: 'demo',
        before: ['Start a demo run and watch a card pop in.'],
        after: ['The run is `RUNNING` and is now the active run — later logs attach to it.'],
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
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Parameters',
          '',
          '**Parameters** record the inputs to training: learning rate, tree depth, feature set… They answer *“what did we try?”*',
          '',
          'Log them on the active run:',
          '',
          '```',
          'mlflow runs log -p key=value',
          '```',
          '',
          'Log two params on a run: `lr` and `max_depth` (any values).',
        ],
      },
      {
        type: 'demo',
        before: ['Create a run and log `lr=0.01`.'],
        after: ['The param appears on the run card as a blue badge.'],
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
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Metrics',
          '',
          '**Metrics** are numbers you compare across runs: accuracy, AUC, latency, loss.',
          '',
          '```',
          'mlflow runs log -m acc=0.95',
          '```',
          '',
          'The viz draws a small sparkline tick per metric on the run card. Values must be numeric.',
        ],
      },
      {
        type: 'demo',
        before: ['Log accuracy `0.72` on a fresh run.'],
        after: ['Amber badge — that is the metric. Better runs will light up greener later.'],
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
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Tags & Artifacts',
          '',
          '**Tags** are string labels: git commit, stage, owner. **Artifacts** are files the run produced: the model, a confusion matrix, a notebook export.',
          '',
          '```',
          'mlflow runs tag stage=train',
          'mlflow runs log-artifact model.pkl',
          '```',
        ],
      },
      {
        type: 'demo',
        before: ['Tag a run and log one artifact.'],
        after: ['Tag shows as a muted chip; artifacts stack as file rows under the metrics.'],
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
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Comparing Runs',
          '',
          'Real workflows create **many** runs — different models, different grids — then compare metrics side by side.',
          '',
          'Give runs names with `--name` so you can tell them apart in the list.',
          '',
          '```',
          'mlflow runs create --name baseline',
          'mlflow runs create --name gbm',
          '```',
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
