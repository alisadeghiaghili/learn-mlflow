/**
 * Models & Serving — load, predict, HTTP endpoint.
 */

import type { Level } from '../engine/types';
import {
  all,
  modelLoaded,
  modelVersionInStage,
  predictionsLogged,
  serverRunning,
  serverServedPredictions,
} from '../engine/goals';
import { withRegisteredModel } from './builders';

export const modelsDeployLevels: Level[] = [
  {
    id: 'dep-predict',
    sequenceId: 'models-deploy',
    name: 'Predict In-Process',
    about: 'Load a registered model and call it.',
    hint: 'mlflow models load -n iris-clf --version 1  then  mlflow models predict --rows 5',
    solutionCommand:
      'mlflow models load -n iris-clf --version 1; mlflow models predict --rows 5',
    startWorld: withRegisteredModel('iris-clf', 1, 'None'),
    goal: all(modelLoaded('iris-clf'), predictionsLogged(5)),
    learning: [
      'pyfunc load gives a uniform predict() API',
      'Smoke-test the binary before staging it',
    ],
    goalSteps: [
      'Load iris-clf version 1',
      'Run predict for 5 rows',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Smoke-test before you promote',
          '',
          'The smallest honest integration test: load the exact binary the Registry points at, run `predict` on a few rows. If this crashes, staging is theater.',
          '',
          '```',
          'mlflow models load -n iris-clf --version 1',
          'mlflow models predict --rows 5',
          '```',
          '',
          '`load_model` returns a **pyfunc** — one interface across sklearn/torch/custom. Your service should depend on that interface, not on pickle internals.',
        ],
      },
      {
        type: 'text',
        markdown: ['Load `iris-clf` v1 and predict on 5 rows.'],
      },
    ],
  },
  {
    id: 'dep-serve',
    sequenceId: 'models-deploy',
    name: 'Serve HTTP',
    about: 'mlflow models serve is the local scoring endpoint.',
    hint: 'mlflow models serve -n iris-clf --port 5001 --stage Production',
    solutionCommand:
      'mlflow models transition -n iris-clf --version 1 --stage Production; mlflow models serve -n iris-clf --port 5001 --stage Production',
    startWorld: withRegisteredModel('iris-clf', 1, 'None'),
    goal: all(
      modelVersionInStage('iris-clf', 1, 'Production'),
      serverRunning(),
    ),
    learning: [
      'Serving wraps predict in POST /invocations',
      'Local serve mirrors the production contract',
    ],
    goalSteps: [
      'Put v1 in Production',
      'Serve iris-clf on port 5001',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## One command from model to HTTP',
          '',
          '`mlflow models serve` starts a scoring server with `POST /invocations`. It is not your k8s ingress — it *is* the contract your platform will later wrap.',
          '',
          '```',
          'mlflow models serve -n iris-clf --port 5001 --stage Production',
          '```',
          '',
          'Practice the full loop locally: register → stage → serve → invoke. Teams that skip this discover payload mismatches in production.',
        ],
      },
      {
        type: 'text',
        markdown: ['Serve `iris-clf` from Production on port 5001.'],
      },
    ],
  },
  {
    id: 'dep-invoke',
    sequenceId: 'models-deploy',
    name: 'Invoke the Endpoint',
    about: 'Client path: HTTP in, prediction out.',
    hint: 'mlflow models invoke',
    solutionCommand:
      'mlflow models serve -n iris-clf --port 5001 --stage Production; mlflow models invoke; mlflow models invoke',
    startWorld: (() => {
      const w = withRegisteredModel('iris-clf', 1, 'Production');
      return w;
    })(),
    goal: all(serverRunning(), serverServedPredictions(2)),
    learning: [
      'Invoke is the client’s one-shot call',
      'Count serves predictions for canary checks',
    ],
    goalSteps: [
      'Have a running server for iris-clf',
      'Invoke it at least twice',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The client only speaks HTTP',
          '',
          'Once the server is up, any language can `POST` JSON. `mlflow models invoke` is the teaching client — one call, one logged prediction.',
          '',
          'Canary pattern: after a re-point of `@champion`, fire N invokes and compare latency/errors before cutting traffic. The tracker should record those canary runs too.',
        ],
      },
      {
        type: 'text',
        markdown: ['Serve a model and invoke it **twice**.'],
      },
    ],
  },
  {
    id: 'dep-rollback',
    sequenceId: 'models-deploy',
    name: 'Rollback Drill',
    about: 'Re-point Production and reload — the real runbook.',
    hint: 'Archive v2, transition v1 to Production, load Production',
    solutionCommand:
      'mlflow models transition -n iris-clf --version 2 --stage Production; mlflow models archive -n iris-clf --version 2; mlflow models transition -n iris-clf --version 1 --stage Production; mlflow models load -n iris-clf --stage Production',
    startWorld: withRegisteredModel('iris-clf', 2, 'None'),
    goal: all(
      modelVersionInStage('iris-clf', 1, 'Production'),
      modelVersionInStage('iris-clf', 2, 'Archived'),
      modelLoaded('iris-clf'),
    ),
    learning: [
      'Rollback is a Registry re-point, not a rebuild',
      'Keep N-1 warm and documented',
    ],
    goalSteps: [
      'Put v2 in Production then archive it',
      'Put v1 in Production',
      'Load the Production model',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Rollback is a stage transition',
          '',
          'You have v1 and v2. Assume v2 is live and wrong. The runbook:',
          '',
          '1. Archive v2 (stop new loads)',
          '2. Transition v1 → Production',
          '3. Load / bounce services on `models:/…/Production`',
          '',
          '```',
          'mlflow models archive -n iris-clf --version 2',
          'mlflow models transition -n iris-clf --version 1 --stage Production',
          'mlflow models load -n iris-clf --stage Production',
          '```',
          '',
          'Drill this while it is calm. At 2 a.m. you want muscle memory, not docs archaeology.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Start: `iris-clf` has v1 and v2 in `None`. Put v2 in Production, archive it, put v1 in Production, then load Production.',
        ],
      },
    ],
  },
];
