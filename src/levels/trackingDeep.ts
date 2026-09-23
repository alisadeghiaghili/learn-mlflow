/**
 * Deep Tracking — metric series, nested runs, source/env, search.
 */

import type { Level } from '../engine/types';
import {
  all,
  minRuns,
  runHasChild,
  runHasEnv,
  runHasMetricSteps,
  runHasParam,
  runHasSource,
  searchMatches,
} from '../engine/goals';
import { withExperiment, withRuns } from './builders';

export const trackingDeepLevels: Level[] = [
  {
    id: 'deep-metric-steps',
    sequenceId: 'tracking-deep',
    name: 'Metric Steps (Epochs)',
    about: 'Log a loss curve, not just one number.',
    hint: 'mlflow runs log -m loss=0.5 --step 0  (then step 1, 2…)',
    solutionCommand:
      'mlflow runs create --name curve; mlflow runs log -p model=mlp; mlflow runs log -m loss=0.50 --step 0; mlflow runs log -m loss=0.35 --step 1; mlflow runs log -m loss=0.22 --step 2; mlflow runs log -m loss=0.15 --step 3',
    startWorld: withExperiment('iris'),
    goal: all(
      runHasParam('model'),
      runHasMetricSteps('loss', 4),
    ),
    learning: [
      'Metrics support step series for epoch curves',
      'Last value alone hides overfitting and instability',
    ],
    goalSteps: [
      'Create a run and log param model',
      'Log metric loss at 4 different --step values',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## One number is not a training curve',
          '',
          'Logging `loss=0.15` once tells a reviewer nothing. Logging `loss` at steps 0..N draws the curve that proves convergence, early-stopping quality, or a diverging optimizer.',
          '',
          'MLflow keeps **metric history**: each log with `--step` appends a point. The UI charts the series; the API can return the full history.',
          '',
          '```',
          'mlflow runs log -m loss=0.50 --step 0',
          'mlflow runs log -m loss=0.35 --step 1',
          'mlflow runs log -m loss=0.22 --step 2',
          'mlflow runs log -m loss=0.15 --step 3',
          '```',
          '',
          'Production habit: log `train_*` and `val_*` every epoch. If validation loss rises while train falls, you caught overfit *in the tracker* — before the incident channel does.',
        ],
      },
      {
        type: 'demo',
        before: ['Watch three loss points attach to one run.'],
        after: ['The run now holds a mini-curve. Open Metrics on a real MLflow UI and this becomes a chart.'],
        command:
          'mlflow runs create; mlflow runs log -m loss=0.6 --step 0; mlflow runs log -m loss=0.4 --step 1; mlflow runs log -m loss=0.3 --step 2',
      },
      {
        type: 'text',
        markdown: [
          'On one run: param `model`, and metric `loss` with **at least 4** distinct steps.',
        ],
      },
    ],
  },
  {
    id: 'deep-nested-runs',
    sequenceId: 'tracking-deep',
    name: 'Nested Runs',
    about: 'Child runs for folds, trials, or sub-pipelines.',
    hint: 'mlflow runs create --nested   or  --parent <id>',
    solutionCommand:
      'mlflow runs create --name sweep; mlflow runs create --name fold-1 --nested; mlflow runs log -m acc=0.88; mlflow runs create --name fold-2 --nested; mlflow runs log -m acc=0.91',
    startWorld: withExperiment('iris'),
    goal: all(minRuns(3, 'iris'), runHasChild('iris')),
    learning: [
      'Nested runs model folds, HPO trials, or sub-steps',
      'Parent aggregates intent; children hold detail',
    ],
    goalSteps: [
      'Create a parent run',
      'Create at least two nested child runs',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Trees of attempts',
          '',
          'Cross-validation and hyperparameter search produce a *tree*, not a flat list. MLflow models that with **nested runs** (parent → children).',
          '',
          '```',
          'mlflow runs create --name sweep',
          'mlflow runs create --name fold-1 --nested',
          'mlflow runs create --name fold-2 --nested',
          '```',
          '',
          'Why it matters: a 5-fold CV should not drown your experiment list in five peer rows. The parent is the logical “CV job”; each fold is a child with its own metrics. HPO frameworks (Optuna, Ray) do exactly this so you can roll up best-trial without a custom spreadsheet.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Create one parent run and **two or more** nested children in `iris`.',
        ],
      },
    ],
  },
  {
    id: 'deep-source-env',
    sequenceId: 'tracking-deep',
    name: 'Source & Environment',
    about: 'Reproduce the run — or do not call it science.',
    hint: 'mlflow runs source --git <sha> --entry train.py',
    solutionCommand:
      'mlflow runs create --name reproducible; mlflow runs source --git abc1234 --entry train.py --version 2.14.0; mlflow runs env --python 3.11.8 --mlflow 2.14.0',
    startWorld: withExperiment('iris'),
    goal: all(runHasSource('iris'), runHasEnv('iris')),
    learning: [
      'Record git SHA + entry point on every production run',
      'Pin Python and MLflow versions for reproducibility',
    ],
    goalSteps: [
      'Record source (git + entry) on a run',
      'Record environment (python + mlflow) on the same run',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The run is a scientific claim',
          '',
          'A metric without provenance is a rumor. MLflow can snapshot **where the code lived** (git commit, entry point) and **what interpreter produced it** (Python, MLflow, library versions).',
          '',
          '```',
          'mlflow runs source --git abc1234 --entry train.py --version 2.14.0',
          'mlflow runs env --python 3.11.8 --mlflow 2.14.0',
          '```',
          '',
          'Anti-pattern we see in audits: “acc=0.97” with no SHA. Six months later the feature pipeline changed and nobody can reproduce the model. If you take one ops habit from this pack: **never finish a run without source+env**. Autolog does this for you — we cover that later.',
        ],
      },
      {
        type: 'text',
        markdown: ['Record source and environment on a run in `iris`.'],
      },
    ],
  },
  {
    id: 'deep-search',
    sequenceId: 'tracking-deep',
    name: 'Search Like an Analyst',
    about: 'Filter runs by params and metrics.',
    hint: 'mlflow runs search "metrics.acc > 0.9"',
    solutionCommand:
      'mlflow runs create --name a; mlflow runs log -p lr=0.01; mlflow runs log -m acc=0.72; mlflow runs create --name b; mlflow runs log -p lr=0.01; mlflow runs log -m acc=0.93; mlflow runs search "metrics.acc > 0.9"',
    startWorld: withExperiment('iris'),
    goal: searchMatches('metrics.acc > 0.9', 1, 'iris'),
    learning: [
      'Search filters turn a run list into a decision tool',
      'Compare candidates with param/metric predicates',
    ],
    goalSteps: [
      'Have a run with metrics.acc > 0.9 in iris',
      'Use mlflow runs search to match it',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Lists do not scale; queries do',
          '',
          'After fifty runs you stop scrolling and start **querying**. MLflow search syntax is a small filter language over params, metrics, tags, and status:',
          '',
          '```',
          'mlflow runs search "metrics.acc > 0.9"',
          'mlflow runs search "params.lr = \'0.01\'"',
          'mlflow runs search "tags.stage = \'train\' and metrics.f1 >= 0.85"',
          '```',
          '',
          'This is how production teams answer “which candidates beat the champion?” without exporting CSVs. Learn the predicate form now; it maps 1:1 to the Python `MlflowClient.search_runs` API.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Create runs so at least one has `acc > 0.9`, then search for it.',
        ],
      },
    ],
  },
  {
    id: 'deep-experiment-tags',
    sequenceId: 'tracking-deep',
    name: 'Experiment-Level Tags',
    about: 'Ownership and domain live on the experiment.',
    hint: 'mlflow experiments tag iris owner=data-platform',
    solutionCommand:
      'mlflow experiments create -n churn --tag owner=data-platform; mlflow experiments tag churn domain=retention',
    startWorld: withRuns('iris', [
      { name: 'warm', params: { lr: '0.01' }, metrics: { acc: 0.8 } },
    ]),
    goal: all(
      (w) => w.experiments.some((e) => e.name === 'churn' && e.tags.owner === 'data-platform'),
      (w) => w.experiments.some((e) => e.name === 'churn' && e.tags.domain === 'retention'),
    ),
    learning: [
      'Experiment tags carry ownership and domain',
      'Tags make multi-team tracking servers navigable',
    ],
    goalSteps: [
      'Create experiment churn with tag owner=data-platform',
      'Add tag domain=retention to experiment churn',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Who owns this experiment?',
          '',
          'Runs say what happened. **Experiments** need organization metadata: owning team, business domain, cost center. That is what experiment tags are for.',
          '',
          '```',
          'mlflow experiments create -n churn --tag owner=data-platform',
          'mlflow experiments tag churn domain=retention',
          '```',
          '',
          'In a shared tracking server with 200 experiments, tags are how platform teams route alerts, enforce budgets, and find the right humans. Put `owner` on day one — retrofitting ownership after an outage is miserable.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Create `churn` with `owner=data-platform`, then add `domain=retention`.',
        ],
      },
    ],
  },
];
