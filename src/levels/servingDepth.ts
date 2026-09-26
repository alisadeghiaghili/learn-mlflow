/**
 * Serving depth: latency SLO, version pin vs alias, canary invoke.
 */

import type { Level } from '../engine/types';
import {
  all,
  modelHasAlias,
  modelLoaded,
  modelVersionInStage,
  predictionsOK,
  serverRunning,
  serverServedPredictions,
} from '../engine/goals';
import { withExperiment, withRegisteredModel } from './builders';

export const servingDepthLevels: Level[] = [
  {
    id: 'serve-alias-canary',
    sequenceId: 'models-deploy',
    name: 'Canary via @challenger',
    about: 'Score challenger without swapping champion.',
    hint: 'alias challenger then invoke canary',
    solutionCommand:
      'mlflow runs create --name v2; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models alias -n iris-clf --alias challenger --version 1; mlflow models serve -n iris-clf --alias challenger --port 5002; mlflow models invoke --json "inputs"; mlflow models invoke --json "inputs"',
    startWorld: withExperiment('iris'),
    goal: all(
      modelHasAlias('iris-clf', 'challenger'),
      serverRunning(),
      serverServedPredictions(2),
    ),
    learning: [
      'Canary traffic uses a second alias / endpoint',
      'Compare latency and errors before swap',
    ],
    goalSteps: [
      'Register signed model and alias challenger',
      'Serve and invoke twice (canary)',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Canary is a routing decision',
          '',
          'Do not “try v2 in prod”. Send a slice of traffic to `@challenger` (or a shadow scorer), measure p95 latency + business metric, then move `@champion`.',
          '',
          '```',
          'mlflow models alias -n iris-clf --alias challenger --version 1',
          'mlflow models invoke --json \'{"inputs": [[1,2,3,4]]}\'',
          '```',
        ],
      },
      {
        type: 'text',
        markdown: ['Challenger alias + two canary invokes.'],
      },
    ],
  },
  {
    id: 'serve-legacy-stage-load',
    sequenceId: 'models-deploy',
    name: 'Legacy Stage URI',
    about: 'Old stacks load models:/name/Production — know both.',
    hint: 'transition Production then load --stage Production',
    solutionCommand:
      'mlflow models transition -n iris-clf --version 1 --stage Production; mlflow models load -n iris-clf --stage Production',
    startWorld: withRegisteredModel('iris-clf', 1, 'None'),
    goal: all(
      modelVersionInStage('iris-clf', 1, 'Production'),
      modelLoaded('iris-clf'),
    ),
    learning: [
      'Many production systems still use stage URIs',
      'Prefer aliases in new designs; migrate with aliases too',
    ],
    goalSteps: [
      'Legacy stage Production on v1',
      'Load via --stage Production',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Interop with yesterday',
          '',
          'You will meet `models:/name/Production` in old services. Know how to walk it. For **new** work, aliases. For migrations: set both (alias + stage) until clients move.',
        ],
      },
      {
        type: 'text',
        markdown: ['Legacy: stage Production + load by stage.'],
      },
    ],
  },
  {
    id: 'serve-signed-predict',
    sequenceId: 'models-deploy',
    name: 'Signed Predict Only',
    about: 'Unsigned models never reach predict in this contract.',
    hint: 'Must register with signature before predict',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models load -n iris-clf --version 1; mlflow models predict --rows 4',
    startWorld: withRegisteredModel('iris-clf', 1, 'None'),
    goal: all(modelLoaded('iris-clf'), predictionsOK(4)),
    learning: [
      'Predict gate = signature present',
      'Schema drift is caught before users',
    ],
    goalSteps: [
      'Use a signed model (builders include signature)',
      'Predict 4 rows',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Gate recap',
          '',
          'If you register without `--signature`, `predict` fails with explain-why. Fix: re-register with a signature (or a new version). Shipping unsigned is a policy bug, not a runtime quirk.',
        ],
      },
      {
        type: 'text',
        markdown: ['Predict 4 rows on a signed loaded model.'],
      },
    ],
  },
];
