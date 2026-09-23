/**
 * Registry sequence — Model Registry stages with deeper teaching notes.
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
    learning: [
      'Model Registry versions named models from runs',
      'Registration is the bridge from experiment to release',
    ],
    goalSteps: [
      'A run with artifact model.pkl',
      'Register model iris-clf (at least version 1)',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Tracking stops at the lab door',
          '',
          'Tracking answers *what happened during training*. Production asks a different question: *which binary is live, and who approved it?* That is the **Model Registry**.',
          '',
          'Registering does not re-train. It points at a run’s artifact (`model.pkl`) and gives it a **stable name + version**. Clients load `models:/iris-clf/Production` — they never hardcode a run id from three sprints ago.',
          '',
          '```',
          'mlflow runs log-artifact model.pkl',
          'mlflow models register -n iris-clf',
          '```',
          '',
          'Each `register` appends a version (`v1`, `v2`, …). Never overwrite. Rolling back means promoting an older version — not hunting through S3 folders.',
        ],
      },
      {
        type: 'demo',
        before: [
          'Create a run, log `model.pkl`, register it as `demo-model`. Switch the top tab to Registry to see the board.',
        ],
        after: [
          'A version card sits in stage **None**. That is the waiting room until someone promotes it.',
        ],
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
    learning: [
      'Stages label lifecycle: None, Staging, Production, Archived',
      'Staging is where integration tests run before serving',
    ],
    goalSteps: [
      'Register iris-clf version 1',
      'Transition version 1 to Staging',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Stages are a social contract',
          '',
          'A registered version sits in `None` until someone **transitions** it. The classic path:',
          '',
          '```',
          'None -> Staging -> Production -> Archived',
          '```',
          '',
          '```',
          'mlflow models transition -n iris-clf --version 1 --stage Staging',
          '```',
          '',
          '`Staging` means: *candidate for release, not yet trusted by users*. Integration tests, shadow traffic, fairness checks live here. The stage label is how a team of five agrees on status without a Slack thread.',
          '',
          'Watch the version card slide across the Registry board — that movement is the promotion ritual.',
        ],
      },
      {
        type: 'demo',
        before: ['Register a model and promote v1 to Staging.'],
        after: [
          'The card slides into the Staging column. Colors track the lifecycle: gray → blue → amber → red.',
        ],
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
    learning: [
      'Production is the version serving traffic',
      'Promotion should be an explicit, audited transition',
    ],
    goalSteps: ['Put iris-clf version 1 into Production'],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Production is a pointer, not a folder',
          '',
          'When a version is validated in staging, promote it to `Production`. Serving code should load `models:/iris-clf/Production` — a **moving pointer**. Yesterday’s binary stays on disk; today’s pointer moves.',
          '',
          'That single indirection is how you roll back in seconds: transition the old version back to `Production`. No redeploy of the API if it already knows how to resolve the URI.',
          '',
          'You *can* jump straight from `None` to `Production` — the stage is a label, not a locked state machine. Teams walk the path so each promotion is an explicit decision with a paper trail.',
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
    goal: all(
      modelExists('iris-clf', 2),
      modelVersionInStage('iris-clf', 2, 'Staging'),
    ),
    learning: [
      'Same model name appends versions; it never overwrites',
      'Version history enables safe rollback',
    ],
    goalSteps: [
      'Model iris-clf with at least 2 versions',
      'Version 2 in Staging',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Versions are how you sleep at night',
          '',
          'Registering the **same model name** again does not overwrite — it appends version 2, 3, … Each version is an immutable pointer to the run that produced it.',
          '',
          'That history is the point. When v2 silently breaks precision on a segment, you roll back to v1 without digging through artifact stores or guessing which S3 prefix was “the good one”.',
          '',
          'A healthy cadence looks like: train → register vN → stage → production → archive vN-1. The Registry board becomes a timeline of release decisions.',
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
    learning: [
      'Archive retired versions so nobody loads them by accident',
      'Archived != deleted — history remains for audit',
    ],
    goalSteps: [
      'Put version 2 in Production',
      'Archive version 1',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Archive is not delete',
          '',
          'When a new version takes Production, archive the previous one so nobody loads it by accident. The run and artifact stay; only the *stage label* changes.',
          '',
          '```',
          'mlflow models archive -n iris-clf --version 1',
          '```',
          '',
          'Or: `mlflow models transition … --stage Archived` — same result. Use `archive` when the intent is “retire this”; use `transition` when you are walking the full path.',
          '',
          'You start with `iris-clf` already at v1 and v2 (both `None`). Promote v2, retire v1. That is a complete release story in two commands.',
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
    hint: 'None -> Staging -> Production -> Archived on one version.',
    solutionCommand:
      'mlflow runs create; mlflow runs log -p model=gbm; mlflow runs log -m acc=0.96; mlflow runs log-artifact model.pkl; mlflow models register -n churn; mlflow models transition -n churn --version 1 --stage Staging; mlflow models transition -n churn --version 1 --stage Production; mlflow models transition -n churn --version 1 --stage Archived',
    startWorld: withExperiment('churn'),
    goal: modelVersionInStage('churn', 1, 'Archived'),
    learning: [
      'Full lifecycle: None, Staging, Production, Archived',
      'Retirement is part of the model release process',
    ],
    goalSteps: [
      'Register model churn (any run)',
      'Drive version 1 through to Archived',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The full path, end to end',
          '',
          'One version, every stage:',
          '',
          '```',
          'None -> Staging -> Production -> Archived',
          '```',
          '',
          'In production teams the last step happens when **v2** is promoted and **v1** is retired. Walking all four yourself locks the mental model: every stage is a *decision*, not a file permission.',
          '',
          'After this level you should be able to explain to a colleague: Tracking records attempts; the Registry decides what ships. Different jobs, one platform.',
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
