/**
 * Registry production depth — flavors, signatures, aliases, load.
 */

import type { Level } from '../engine/types';
import {
  all,
  modelExists,
  modelHasAlias,
  modelHasFlavor,
  modelHasSignature,
  modelLoaded,
  modelVersionDescribed,
  modelVersionInStage,
  runHasArtifact,
} from '../engine/goals';
import { withExperiment, withRegisteredModel } from './builders';

export const registryDeepLevels: Level[] = [
  {
    id: 'regd-flavor-signature',
    sequenceId: 'registry-deep',
    name: 'Flavor & Signature',
    about: 'How to load it, and what inputs it accepts.',
    hint: 'mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"',
    startWorld: withExperiment('iris'),
    goal: all(
      modelExists('iris-clf'),
      modelHasFlavor('iris-clf', 'sklearn'),
      modelHasSignature('iris-clf'),
      runHasArtifact('model.pkl', 'iris', 'model'),
    ),
    learning: [
      'Flavor tells clients how to deserialize the model',
      'Signature is the input/output contract for serving',
    ],
    goalSteps: [
      'Log model.pkl on a run',
      'Register iris-clf with flavor sklearn',
      'Register with a signature string',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## A pickle is not an interface',
          '',
          'MLflow **flavors** (sklearn, pytorch, pyfunc, …) are loaders. The same file can expose multiple flavors so different runtimes can read it. Without a flavor, “model.pkl” is just bytes.',
          '',
          'The **signature** is stricter: declared input/output tensor types. Serving can validate payloads; data scientists see the contract in the UI before they call it.',
          '',
          '```',
          'mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"',
          '```',
          '',
          'Production rule: no signature → no production stage. Most silent scoring bugs are shape/dtype drift that a signature would have caught at the edge.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Register `iris-clf` with flavor `sklearn` and a signature on a run that has `model.pkl`.',
        ],
      },
    ],
  },
  {
    id: 'regd-alias',
    sequenceId: 'registry-deep',
    name: 'Aliases Beat Hardcoded Versions',
    about: 'Named pointers like @champion for clients.',
    hint: 'mlflow models alias -n iris-clf --alias champion --version 1',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn; mlflow models alias -n iris-clf --alias champion --version 1',
    startWorld: withExperiment('iris'),
    goal: all(modelExists('iris-clf'), modelHasAlias('iris-clf', 'champion', 1)),
    learning: [
      'Aliases are mutable named pointers to versions',
      'Clients load models:/name@alias instead of frozen versions',
    ],
    goalSteps: [
      'Register iris-clf version 1',
      'Point alias champion at version 1',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Stages age. Aliases travel.',
          '',
          'Loading `models:/iris-clf/3` in a service freezes that service on v3 until you redeploy. **Aliases** (`@champion`, `@challenger`) let ops move the pointer without code changes.',
          '',
          '```',
          'mlflow models alias -n iris-clf --alias champion --version 1',
          '```',
          '',
          'Modern MLflow teams prefer aliases for serving URIs and stages for human workflow. Use `@champion` in prod config, `@challenger` in shadow mode — swap traffic by re-pointing the alias.',
        ],
      },
      {
        type: 'text',
        markdown: ['Create v1 of `iris-clf` and alias it `champion`.'],
      },
    ],
  },
  {
    id: 'regd-describe',
    sequenceId: 'registry-deep',
    name: 'Describe the Release',
    about: 'A version without notes is unreviewable.',
    hint: 'mlflow models describe -n iris-clf --version 1 --text "..."',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn; mlflow models describe -n iris-clf --version 1 --text "gbm v3 +2pp recall on EU see PR-142"',
    startWorld: withRegisteredModel('iris-clf', 1, 'None'),
    goal: modelVersionDescribed('iris-clf', 1),
    learning: [
      'Version descriptions are the release notes of ML',
      'Write what changed and why, not just “update”',
    ],
    goalSteps: ['Add a description to iris-clf version 1'],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Release notes for models',
          '',
          'Git commits without messages are hostile. Model versions without descriptions are worse — the blast radius is production traffic.',
          '',
          '```',
          'mlflow models describe -n iris-clf --version 1 --text "gbm v3; +2pp recall on EU; see PR-142"',
          '```',
          '',
          'Template that works: *algorithm change · metric delta · ticket/PR · known limits*. Future you (or the on-call) will open this in an incident review.',
        ],
      },
      {
        type: 'text',
        markdown: ['Describe `iris-clf` version 1 with a real release note.'],
      },
    ],
  },
  {
    id: 'regd-load-uri',
    sequenceId: 'registry-deep',
    name: 'Load by Stage or Alias',
    about: 'Resolve the URI your service should use.',
    hint: 'mlflow models load -n iris-clf --stage Production',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn; mlflow models transition -n iris-clf --version 1 --stage Production; mlflow models load -n iris-clf --stage Production',
    startWorld: withRegisteredModel('iris-clf', 1, 'None'),
    goal: all(
      modelVersionInStage('iris-clf', 1, 'Production'),
      modelLoaded('iris-clf'),
    ),
    learning: [
      'Clients resolve models:/ URIs at load time',
      'Production stage is the default ship channel',
    ],
    goalSteps: [
      'Put iris-clf v1 in Production',
      'Load the model by Production stage',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The URI is the API',
          '',
          'Training code should not know run ids. Serving code should say:',
          '',
          '```',
          'mlflow.pyfunc.load_model("models:/iris-clf/Production")',
          'mlflow models load -n iris-clf --stage Production',
          '```',
          '',
          'Stage or alias — both resolve at load time. That indirection is the whole rollback story: re-point Production, restart nothing (if the service reloads), or bounce the pod.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Promote `iris-clf` v1 to Production and load it via that stage.',
        ],
      },
    ],
  },
];
