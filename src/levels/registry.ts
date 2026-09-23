/**
 * Registry sequence — Model Registry stages.
 */

import type { Level } from '../engine/types';
import {
  all,
  modelExists,
  modelVersionInStage,
  runHasArtifact,
} from '../engine/goals';
import { withExperiment, withRegisteredModel } from './builders';

export const registryLevels: Level[] = [
  {
    id: 'reg-register',
    sequenceId: 'registry',
    name: 'Register a Model',
    about: 'Promote a run artifact into the Model Registry.',
    hint: 'mlflow models register -n iris-clf',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl; mlflow models register -n iris-clf',
    startWorld: withExperiment('iris'),
    goal: all(modelExists('iris-clf', 1), runHasArtifact('model.pkl')),
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Model Registry',
          '',
          'Training a model is not enough — you need a **named, versioned** artifact the team can promote to staging or production.',
          '',
          'The registry does that. Each `register` creates the next **version** of a model from a run.',
          '',
          '```',
          'mlflow runs log-artifact model.pkl',
          'mlflow models register -n iris-clf',
          '```',
        ],
      },
      {
        type: 'demo',
        before: ['Create a run, log `model.pkl`, register it as `demo-model`.'],
        after: ['A version card appears in the Registry board under stage **None**.'],
        command:
          'mlflow runs create; mlflow runs log-artifact model.pkl; mlflow models register -n demo-model',
      },
      {
        type: 'text',
        markdown: [
          'Clear this level: a run with artifact `model.pkl`, and model named exactly `iris-clf` with ≥ 1 version.',
        ],
      },
    ],
  },
  {
    id: 'reg-staging',
    sequenceId: 'registry',
    name: 'Move to Staging',
    about: 'Staging is the pre-production holding bay.',
    hint: 'mlflow models transition -n iris-clf --version 1 --stage Staging',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl; mlflow models register -n iris-clf; mlflow models transition -n iris-clf --version 1 --stage Staging',
    startWorld: withExperiment('iris'),
    goal: modelVersionInStage('iris-clf', 1, 'Staging'),
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Stages',
          '',
          'A registered version sits in `None` until someone **transitions** it. The classic path:',
          '',
          '```',
          'None → Staging → Production → Archived',
          '```',
          '',
          '```',
          'mlflow models transition -n iris-clf --version 1 --stage Staging',
          '```',
          '',
          'Watch the version card slide across the board — that is the promotion.',
        ],
      },
      {
        type: 'demo',
        before: ['Register a model and promote v1 to Staging.'],
        after: ['The card slides into the Staging column. Stage colors match MLflow’s mental model.'],
        command:
          'mlflow runs create; mlflow runs log-artifact model.pkl; mlflow models register -n demo-model; mlflow models transition -n demo-model --version 1 --stage Staging',
      },
      {
        type: 'text',
        markdown: [
          'Get `iris-clf` version **1** into `Staging`.',
        ],
      },
    ],
  },
  {
    id: 'reg-production',
    sequenceId: 'registry',
    name: 'Ship to Production',
    about: 'Production is what serves traffic.',
    hint: '… --stage Production',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl; mlflow models register -n iris-clf; mlflow models transition -n iris-clf --version 1 --stage Staging; mlflow models transition -n iris-clf --version 1 --stage Production',
    startWorld: withExperiment('iris'),
    goal: modelVersionInStage('iris-clf', 1, 'Production'),
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Production',
          '',
          'When a version is validated in staging, promote it to `Production`. That is the version clients should load.',
          '',
          'You can jump straight from `None` to `Production` if you want — the stage is a label, not a state machine lock. Teams usually walk the path so each promotion is an explicit decision.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Put `iris-clf` v1 into `Production`.',
        ],
      },
    ],
  },
  {
    id: 'reg-two-versions',
    sequenceId: 'registry',
    name: 'Two Versions',
    about: 'Register twice; versions increment.',
    hint: 'Register the same name twice from two different runs.',
    solutionCommand:
      'mlflow runs create --name v1-train; mlflow runs log-artifact model.pkl; mlflow models register -n iris-clf; mlflow runs create --name v2-train; mlflow runs log-artifact model.pkl; mlflow models register -n iris-clf; mlflow models transition -n iris-clf --version 2 --stage Staging',
    startWorld: withExperiment('iris'),
    goal: all(modelExists('iris-clf', 2), modelVersionInStage('iris-clf', 2, 'Staging')),
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Versions',
          '',
          'Registering the **same model name** again does not overwrite — it appends version 2, 3, …',
          '',
          'That history is the point: you can roll back to v1 without digging through artifact stores.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Clear this level:',
          '1. Model `iris-clf` with ≥ **2** versions',
          '2. Version **2** in `Staging`',
        ],
      },
    ],
  },
  {
    id: 'reg-archive',
    sequenceId: 'registry',
    name: 'Archive the Old One',
    about: 'Archived versions stay in history but leave the active board columns.',
    hint: 'mlflow models archive -n iris-clf --version 1',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl; mlflow models register -n iris-clf; mlflow runs create; mlflow runs log-artifact model.pkl; mlflow models register -n iris-clf; mlflow models transition -n iris-clf --version 2 --stage Production; mlflow models archive -n iris-clf --version 1',
    startWorld: withRegisteredModel('iris-clf', 2, 'None'),
    goal: all(
      modelVersionInStage('iris-clf', 1, 'Archived'),
      modelVersionInStage('iris-clf', 2, 'Production'),
    ),
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Archive',
          '',
          'When a new version takes Production, archive the previous one so nobody loads it by accident.',
          '',
          '```',
          'mlflow models archive -n iris-clf --version 1',
          '```',
          '',
          'Or: `mlflow models transition … --stage Archived` — same result.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'You start with `iris-clf` already at v1 and v2 (both `None`).',
          '',
          '1. Put **v2** in `Production`',
          '2. Put **v1** in `Archived`',
        ],
      },
    ],
  },
  {
    id: 'reg-promotion-path',
    sequenceId: 'registry',
    name: 'Full Promotion Path',
    about: 'Walk a model through every stage — the whole story.',
    hint: 'None → Staging → Production → Archived on one version, or split across versions.',
    solutionCommand:
      'mlflow runs create; mlflow runs log -p model=gbm; mlflow runs log -m acc=0.96; mlflow runs log-artifact model.pkl; mlflow models register -n churn; mlflow models transition -n churn --version 1 --stage Staging; mlflow models transition -n churn --version 1 --stage Production; mlflow models transition -n churn --version 1 --stage Archived',
    startWorld: withExperiment('churn'),
    goal: modelVersionInStage('churn', 1, 'Archived'),
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The Full Path',
          '',
          'One version, every stage:',
          '',
          '```',
          'None -> Staging -> Production -> Archived',
          '```',
          '',
          'In production teams the last step happens when **v2** is promoted and **v1** is retired.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Register a model named `churn` (from any run), then drive **version 1** all the way to `Archived`.',
        ],
      },
    ],
  },
];
