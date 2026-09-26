/**
 * Alias-first Registry — the modern Model Registry contract.
 * Stages remain in `registry.ts` as legacy workflow.
 */

import type { Level } from '../engine/types';
import {
  all,
  modelExists,
  modelHasAlias,
  modelHasSignature,
  modelLoaded,
  modelVersionDescribed,
} from '../engine/goals';
import { withExperiment } from './builders';

export const aliasLevels: Level[] = [
  {
    id: 'alias-champion',
    sequenceId: 'registry',
    name: 'Alias @champion',
    about: 'Named pointers beat hardcoded versions and stages.',
    hint: 'mlflow models alias -n iris-clf --alias champion --version 1',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models alias -n iris-clf --alias champion --version 1',
    startWorld: withExperiment('iris'),
    goal: all(
      modelExists('iris-clf'),
      modelHasSignature('iris-clf'),
      modelHasAlias('iris-clf', 'champion', 1),
    ),
    learning: [
      'Aliases are the modern promotion mechanism (MLflow 2.9+)',
      'clients load models:/name@alias — never models:/name/3 in prod config',
    ],
    goalSteps: [
      'Register a signed iris-clf',
      'Point alias champion at version 1',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Start here, not at stages',
          '',
          'Model Registry **stages** (`Staging` / `Production`) are deprecated in MLflow ≥ 2.9. The supported way to say “this is live” is an **alias**:',
          '',
          '```',
          'mlflow models alias -n iris-clf --alias champion --version 1',
          '```',
          '',
          'Production config then loads `models:/iris-clf@champion`. Releasing v2 is *moving the alias*, not editing YAML in five repos.',
          '',
          'Keep a **signed** model. Unsigned + alias is still a foot-gun.',
        ],
      },
      {
        type: 'text',
        markdown: ['Signed `iris-clf` + `@champion` → v1.'],
      },
    ],
  },
  {
    id: 'alias-load-uri',
    sequenceId: 'registry',
    name: 'Load @alias',
    about: 'Services resolve aliases at load time.',
    hint: 'mlflow models load -n iris-clf @champion',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models alias -n iris-clf --alias champion --version 1; mlflow models load -n iris-clf @champion',
    startWorld: withExperiment('iris'),
    goal: all(modelHasAlias('iris-clf', 'champion'), modelLoaded('iris-clf')),
    learning: [
      'load_model("models:/name@alias") is the service URI',
      'alias resolution is the rollback switch',
    ],
    goalSteps: [
      'Alias champion on iris-clf',
      'Load via @champion',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The service URI',
          '',
          '```python',
          'model = mlflow.pyfunc.load_model("models:/iris-clf@champion")',
          '```',
          '',
          'Same line in staging and prod. What differs is which version the alias points at. That is the entire rollback story.',
        ],
      },
      {
        type: 'text',
        markdown: ['Load `iris-clf` through `@champion`.'],
      },
    ],
  },
  {
    id: 'alias-rollback',
    sequenceId: 'registry',
    name: 'Rollback = Re-point Alias',
    about: 'Move @champion back to v1 after a bad v2.',
    hint: 'alias champion --version 1 after promoting v2',
    solutionCommand:
      'mlflow runs create --name v1; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow runs create --name v2; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models alias -n iris-clf --alias champion --version 2; mlflow models alias -n iris-clf --alias champion --version 1; mlflow models load -n iris-clf @champion',
    startWorld: withExperiment('iris'),
    goal: all(
      modelExists('iris-clf', 2),
      modelHasAlias('iris-clf', 'champion', 1),
      modelLoaded('iris-clf'),
    ),
    learning: [
      'Rollback is one alias move, no rebuild',
      'Keep N-1 registered and signed for this path',
    ],
    goalSteps: [
      'Two versions of iris-clf',
      'champion ends on version 1',
      'Load @champion',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## 2 a.m. runbook (alias edition)',
          '',
          '1. `@champion` → v2 (ship)',
          '2. Metrics regress / pager fires',
          '3. `@champion` → v1 (rollback)',
          '4. Services that reload the URI heal; others bounce',
          '',
          '```',
          'mlflow models alias -n iris-clf --alias champion --version 1',
          '```',
          '',
          'If your rollback needs a redeploy, you do not have aliases — you have a wish.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Two versions, `@champion` ends on **v1**, then load `@champion`.',
        ],
      },
    ],
  },
  {
    id: 'alias-challenger',
    sequenceId: 'registry',
    name: '@challenger Shadow',
    about: 'Run shadow traffic against a second alias.',
    hint: 'alias challenger --version 2 while champion stays on 1',
    solutionCommand:
      'mlflow runs create --name v1; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow runs create --name v2; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models alias -n iris-clf --alias champion --version 1; mlflow models alias -n iris-clf --alias challenger --version 2',
    startWorld: withExperiment('iris'),
    goal: all(
      modelHasAlias('iris-clf', 'champion', 1),
      modelHasAlias('iris-clf', 'challenger', 2),
    ),
    learning: [
      'champion/challenger is the safe promotion pattern',
      'shadow scoring compares without user impact',
    ],
    goalSteps: [
      '@champion on v1',
      '@challenger on v2',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Two aliases, one model',
          '',
          '`@champion` serves users. `@challenger` is scored on shadow traffic. When challenger wins on the gate metrics *and* latency, you swap the aliases. No “big bang”.',
          '',
          'This is why aliases beat a single `Production` stage: you need **two live pointers** at once.',
        ],
      },
      {
        type: 'text',
        markdown: ['`@champion`=v1 and `@challenger`=v2 on `iris-clf`.'],
      },
    ],
  },
  {
    id: 'alias-notes',
    sequenceId: 'registry',
    name: 'Release Notes on the Version',
    about: 'Describe the version you aliased.',
    hint: 'mlflow models describe -n iris-clf --version 1 --text "..."',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models describe -n iris-clf --version 1 --text "champion 2024-11 recall +2pp EU see PR-142"; mlflow models alias -n iris-clf --alias champion --version 1',
    startWorld: withExperiment('iris'),
    goal: all(
      modelVersionDescribed('iris-clf', 1),
      modelHasAlias('iris-clf', 'champion', 1),
    ),
    learning: [
      'Alias without notes is unreviewable',
      'Description is the release note of the binary',
    ],
    goalSteps: [
      'Describe v1 with a real note',
      'Alias champion to v1',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Notes travel with the pointer',
          '',
          'When you move `@champion`, the PR should read from `update_model_version(..., description=...)`. Template: *delta · ticket · limits*.',
          '',
          'Skipping notes is how a rollback becomes guesswork.',
        ],
      },
      {
        type: 'text',
        markdown: ['Describe v1 and put `@champion` on it.'],
      },
    ],
  },
];
