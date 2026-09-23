/**
 * Autolog & ops habits.
 */

import type { Level } from '../engine/types';
import {
  all,
  autologEnabled,
  runAutologged,
  runHasEnv,
  runHasSource,
} from '../engine/goals';
import { emptyStart, withExperiment } from './builders';

export const trainOpsLevels: Level[] = [
  {
    id: 'ops-autolog',
    sequenceId: 'train-ops',
    name: 'Autolog',
    about: 'Let the library record params, metrics, model.',
    hint: 'mlflow autolog sklearn',
    solutionCommand:
      'mlflow autolog sklearn; mlflow runs create --name auto',
    startWorld: withExperiment('iris'),
    goal: all(autologEnabled('sklearn'), runAutologged('iris')),
    learning: [
      'autolog captures framework events without manual logs',
      'Prefer autolog + explicit business metrics',
    ],
    goalSteps: [
      'Enable autolog for sklearn',
      'Create a run that is autologged',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Do not hand-log what the library knows',
          '',
          '`mlflow.sklearn.autolog()` (and friends) subscribe to training APIs and record hyperparameters, metrics per epoch/fit, and the model — with source and env attached.',
          '',
          '```',
          'mlflow autolog sklearn',
          'mlflow runs create --name auto',
          '```',
          '',
          'Division of labor: **autolog** for mechanics; **you** for business metrics (precision@k, $ lift), datasets, and tags. Teams that hand-log everything drift from reality; teams that only autolog never record what the business cares about.',
        ],
      },
      {
        type: 'text',
        markdown: ['Enable `autolog sklearn`, then create a run and watch it fill in.'],
      },
    ],
  },
  {
    id: 'ops-repro-pack',
    sequenceId: 'train-ops',
    name: 'Reproducibility Pack',
    about: 'Autolog + source + env on one auditable run.',
    hint: 'Combine autolog with explicit source/env if needed',
    solutionCommand:
      'mlflow autolog sklearn; mlflow runs create --name audited; mlflow runs source --git def5678 --entry train.py; mlflow runs env --python 3.11.8 --mlflow 2.14.0',
    startWorld: withExperiment('iris'),
    goal: all(
      runAutologged('iris'),
      runHasSource('iris'),
      runHasEnv('iris'),
    ),
    learning: [
      'Auditable runs combine autolog with explicit provenance',
      'Source + env close the reproducibility gap',
    ],
    goalSteps: [
      'Enable autolog and create an autologged run',
      'Record source (git/entry) and env on a run',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The audit packet',
          '',
          'When risk or compliance asks “rebuild last month’s champion”, you need four things on one run: params, metrics, model artifact, **provenance** (git + env). Autolog covers most of it when the training library cooperates — verify it is present, fill gaps explicitly.',
          '',
          'Treat this as a definition of done for any run that might ship. If source is missing, the run is a draft.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Produce one run that is autologged **and** has source + environment recorded.',
        ],
      },
    ],
  },
  {
    id: 'ops-off-and-on',
    sequenceId: 'train-ops',
    name: 'Autolog Scope',
    about: 'Turn autolog on for the right framework only.',
    hint: 'mlflow autolog off  ·  mlflow autolog pytorch',
    solutionCommand:
      'mlflow autolog sklearn; mlflow autolog off; mlflow autolog pytorch',
    startWorld: emptyStart(),
    goal: autologEnabled('pytorch'),
    learning: [
      'Autolog is flavor-scoped, not a global magic wand',
      'Switch flavors when the stack changes',
    ],
    goalSteps: ['End with autolog enabled for pytorch'],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Scope the magic',
          '',
          'Autolog is per-flavor (`sklearn`, `pytorch`, `tensorflow`, …). Global autolog in a polyglot repo produces noisy, half-wrong runs.',
          '',
          '```',
          'mlflow autolog sklearn   # then later',
          'mlflow autolog off',
          'mlflow autolog pytorch',
          '```',
          '',
          'Explicit is better: set the flavor at the top of `train.py`, not in a shared shell profile.',
        ],
      },
      {
        type: 'text',
        markdown: ['Finish with autolog enabled for **pytorch** (not sklearn).'],
      },
    ],
  },
];
