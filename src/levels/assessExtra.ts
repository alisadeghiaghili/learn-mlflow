/**
 * Extra closed-book assessments for the 9/10 bar.
 */

import type { Level } from '../engine/types';
import {
  all,
  evalHas,
  modelHasAlias,
  modelHasSignature,
  modelLoaded,
  runHasMetricSteps,
  runHasParam,
  serverServedPredictions,
} from '../engine/goals';
import { withExperiment } from './builders';

export const assessExtraLevels: Level[] = [
  {
    id: 'assess-alias-ops',
    sequenceId: 'registry',
    name: 'Assessment: Alias Ops',
    about: 'No hints. Champion/challenger without stages.',
    hint: 'Hints disabled — alias-first release.',
    solutionCommand:
      'mlflow runs create --name c1; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow runs create --name c2; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models alias -n iris-clf --alias champion --version 1; mlflow models alias -n iris-clf --alias challenger --version 2; mlflow models load -n iris-clf @champion',
    startWorld: withExperiment('iris'),
    goal: all(
      modelHasSignature('iris-clf'),
      modelHasAlias('iris-clf', 'champion', 1),
      modelHasAlias('iris-clf', 'challenger', 2),
      modelLoaded('iris-clf'),
    ),
    learning: ['Assessment: modern registry path cold'],
    goalSteps: [
      'Two signed versions',
      '@champion=v1, @challenger=v2',
      'Load @champion',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Closed-book alias ops',
          '',
          'Ship two versions with aliases only (no stages). Load via `@champion`.',
        ],
      },
    ],
  },
  {
    id: 'assess-serve-canary',
    sequenceId: 'models-deploy',
    name: 'Assessment: Canary Serve',
    about: 'No hints. Signed model + canary invokes.',
    hint: 'Hints disabled.',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models alias -n iris-clf --alias champion --version 1; mlflow models serve -n iris-clf --alias champion --port 5001; mlflow models invoke --json "inputs"; mlflow models invoke --json "inputs"',
    startWorld: withExperiment('iris'),
    goal: all(
      modelHasSignature('iris-clf'),
      modelHasAlias('iris-clf', 'champion'),
      serverServedPredictions(2),
    ),
    learning: ['Assessment: canary path cold'],
    goalSteps: ['Signed @champion + serve', 'Two JSON invokes'],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Closed-book canary',
          '',
          'Register signed, alias champion, serve via `--alias champion`, invoke twice.',
        ],
      },
    ],
  },
  {
    id: 'assess-regression-eval',
    sequenceId: 'artifacts-data',
    name: 'Assessment: Regression Eval',
    about: 'No hints. Steps + eval on a regression story.',
    hint: 'Hints disabled.',
    solutionCommand:
      'mlflow runs create --name reg; mlflow runs log -p model=gbm; mlflow runs log -m rmse=3.2 --step 0; mlflow runs log -m rmse=2.1 --step 1; mlflow evaluate --metric rmse --value 2.1; mlflow evaluate --metric r2_score --value 0.84',
    startWorld: withExperiment('pricing'),
    goal: all(
      runHasParam('model'),
      runHasMetricSteps('rmse', 2),
      evalHas('r2_score', 0.5),
    ),
    learning: ['Assessment: regression metrics cold'],
    goalSteps: ['rmse steps >= 2', 'eval r2_score >= 0.5'],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Closed-book regression',
          '',
          'Two-step `rmse` series and eval `r2_score` ≥ 0.5 on one run in `pricing`.',
        ],
      },
    ],
  },
];
