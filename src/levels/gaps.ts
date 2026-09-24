/**
 * Gap-closing levels: docker image, payload contract, OpenAI autolog, Recipes.
 */

import type { Level } from '../engine/types';
import {
  all,
  modelExists,
  modelHasSignature,
  modelVersionInStage,
  predictionsOK,
  runHasDataset,
  runHasEval,
  runHasParam,
  runHasPrompt,
  runHasTrace,
  serverRunning,
  serverServedPredictions,
} from '../engine/goals';
import { emptyStart, withExperiment } from './builders';

export const gapLevels: Level[] = [
  {
    id: 'gap-payload-contract',
    sequenceId: 'models-deploy',
    name: 'Payload Contract',
    about: 'HTTP scoring validates the signature before inference.',
    hint: 'Serve a signed model, then invoke with --json payload',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models transition -n iris-clf --version 1 --stage Production; mlflow models serve -n iris-clf --port 5001 --stage Production; mlflow models invoke --json "{\"inputs\": [[1,2,3,4]]}"',
    startWorld: withExperiment('iris'),
    goal: all(serverRunning(), serverServedPredictions(1), modelHasSignature('iris-clf')),
    learning: [
      'POST /invocations carries a typed payload',
      'Unsigned models reject traffic at the edge',
    ],
    goalSteps: [
      'Register a signed model and serve Production',
      'Invoke with a JSON payload',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The wire contract',
          '',
          'Clients do not call `model.predict(df)` across the network. They `POST` JSON to `/invocations`. The **signature** is what lets the server reject `{"inputs": "oops"}` with 400 before it becomes a 500 in the model.',
          '',
          '```',
          'mlflow models invoke --json \'{"inputs": [[1,2,3,4]]}\'',
          '```',
          '',
          'Design the payload with the client team *before* training finishes. Schema is an interface, not an implementation detail.',
        ],
      },
      {
        type: 'text',
        markdown: ['Signed model + serve + JSON invoke in `iris`.'],
      },
    ],
  },
  {
    id: 'gap-docker-image',
    sequenceId: 'models-deploy',
    name: 'Docker Image Build',
    about: 'Package model + runtime into a deployable image.',
    hint: 'mlflow models docker-build -n iris-clf --flavor sklearn',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models docker-build -n iris-clf --flavor sklearn',
    startWorld: withExperiment('iris'),
    goal: all(modelExists('iris-clf'), modelHasSignature('iris-clf')),
    learning: [
      'build-docker produces a self-contained scoring image',
      'The image freezes Python deps + model + server',
    ],
    goalSteps: [
      'Register a signed sklearn model',
      'Build a docker image for it',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## From URI to container',
          '',
          '`mlflow models build-docker` wraps the model flavor + a serving process into an image. K8s then runs the same artifact everywhere — laptop, staging, prod — without “works on my conda”.',
          '',
          '```',
          'mlflow models docker-build -n iris-clf --flavor sklearn',
          '```',
          '',
          'The sandbox prints the Dockerfile contract. In real ops you pin base image digests and scan for CVEs before the Registry ever sees Production.',
        ],
      },
      {
        type: 'text',
        markdown: ['Signed register + `docker-build` for `iris-clf`.'],
      },
    ],
  },
  {
    id: 'gap-openai-autolog',
    sequenceId: 'genai',
    name: 'OpenAI Autolog',
    about: 'LLM SDKs can log prompts, tokens, and traces.',
    hint: 'mlflow autolog openai  then create a run with prompt + trace',
    solutionCommand:
      'mlflow autolog openai; mlflow runs create --name llm-call; mlflow genai log-prompt "Summarize Model Registry in one sentence."; mlflow genai log-trace --name chat --kind LLM; mlflow runs log -m tokens_in=48 --step 0; mlflow runs log -m tokens_out=32 --step 0',
    startWorld: withExperiment('tutor-bot'),
    goal: all(
      runHasPrompt('tutor-bot'),
      runHasTrace('LLM', 'tutor-bot'),
      runHasParam('framework', 'openai'),
    ),
    learning: [
      'LLM autolog captures SDK calls as traces and token metrics',
      'Token metrics are the cost dimension of quality',
    ],
    goalSteps: [
      'Enable openai autolog',
      'Log prompt + LLM trace',
      'Log token metrics (tokens_in/out)',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Autolog for the LLM stack',
          '',
          'Just as `sklearn.autolog` watches `.fit`, `mlflow.openai.autolog` (and OpenTelemetry bridges) watch chat completions: prompt, model name, tokens, latency — as a **trace**.',
          '',
          '```',
          'mlflow autolog openai',
          'mlflow genai log-prompt "..."',
          'mlflow runs log -m tokens_in=48 --step 0',
          '```',
          '',
          'Log tokens next to faithfulness. A +2pp quality gain at 10× cost is not a free lunch.',
        ],
      },
      {
        type: 'text',
        markdown: ['OpenAI autolog + prompt + LLM trace + token metrics in `tutor-bot`.'],
      },
    ],
  },
  {
    id: 'gap-recipes-pipeline',
    sequenceId: 'train-ops',
    name: 'Recipes Pipeline',
    about: 'prepare → train → evaluate as tracked steps.',
    hint: 'mlflow recipes run',
    solutionCommand:
      'mlflow experiments create -n pricing; mlflow recipes run',
    startWorld: emptyStart(),
    goal: all(
      runHasDataset('recipe-data'),
      runHasEval('rmse'),
      runHasParam('recipe.stage'),
    ),
    learning: [
      'Recipes encode opinionated ML pipelines',
      'Each stage leaves Tracking breadcrumbs',
    ],
    goalSteps: [
      'Create experiment pricing',
      'Run a recipes pipeline that logs dataset, params, eval',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Pipelines, not notebooks',
          '',
          'MLflow **Recipes** (and MLOps pipelines generally) split work into typed stages: `prepare` → `train` → `evaluate` (then `register`). Each stage is a tracked run with datasets and metrics — reproducible without tribal knowledge.',
          '',
          '```',
          'mlflow recipes run',
          '```',
          '',
          'The sandbox records the contract. In production, Recipes/step.yaml + CI replace the “run cells 3–7 on Tuesday” workflow.',
        ],
      },
      {
        type: 'text',
        markdown: ['In `pricing`, execute a recipes pipeline run.'],
      },
    ],
  },
  {
    id: 'assess-mixed-1',
    sequenceId: 'tracking-deep',
    name: 'Assessment: Tracking',
    about: 'No hints. Rebuild a clean experiment from memory.',
    hint: 'Hints disabled — use help if stuck on syntax.',
    solutionCommand:
      'mlflow experiments create -n audit; mlflow runs create --name a1; mlflow runs log -p model=gbm; mlflow runs log -m rmse=1.4 --step 0; mlflow runs log -m rmse=1.1 --step 1; mlflow runs source --git deadbee --entry train.py; mlflow runs env --python 3.11.8 --mlflow 2.14.0; mlflow runs tag stage=candidate',
    startWorld: emptyStart(),
    goal: all(
      (w) => w.experiments.some((e) => e.name === 'audit'),
      runHasParam('model'),
      (w) =>
        Object.values(w.runs).some((r) => (r.metricHistory.rmse?.length ?? 0) >= 2),
      (w) =>
        Object.values(w.runs).some((r) => Boolean(r.source.git) && Boolean(r.env.python)),
    ),
    learning: [
      'Assessment: Tracking fundamentals without hand-holding',
    ],
    goalSteps: [
      'Experiment audit + run with param model',
      'rmse with 2+ steps',
      'source + env recorded',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Closed-book tracking drill',
          '',
          'Build an auditable run: experiment `audit`, param `model`, metric `rmse` at two steps, plus source and env. No demo. Syntax is in `help`.',
          '',
          'This is the bar for “I can set up Tracking without a tutorial”.',
        ],
      },
    ],
  },
  {
    id: 'assess-mixed-2',
    sequenceId: 'registry-deep',
    name: 'Assessment: Ship Path',
    about: 'No hints. Full signed release under policy.',
    hint: 'Hints disabled — recall the release runbook.',
    solutionCommand:
      'mlflow runs create --name c; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow evaluate --builtin classification; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models describe -n iris-clf --version 1 --text "assessed release"; mlflow models approve -n iris-clf --version 1; mlflow models transition -n iris-clf --version 1 --stage Production; mlflow models load -n iris-clf --stage Production',
    startWorld: withExperiment('iris'),
    goal: all(
      runHasEval('f1_score'),
      modelExists('iris-clf'),
      modelVersionInStage('iris-clf', 1, 'Production'),
      modelHasSignature('iris-clf'),
      predictionsOK(0),
      (w) => w.models['iris-clf']?.versions[0]?.approval === 'approved',
    ),
    learning: ['Assessment: ship a model under policy without hints'],
    goalSteps: [
      'Eval + signed register + notes',
      'Approve then Production',
      'Load Production',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Closed-book release drill',
          '',
          'Ship `iris-clf` v1: eval scores, signature, description, **approval**, Production, load. If you can do this cold, you can run a release.',
        ],
      },
    ],
  },
  {
    id: 'assess-mixed-3',
    sequenceId: 'genai',
    name: 'Assessment: LLM Ops',
    about: 'No hints. Prompt + trace + scorers + cost.',
    hint: 'Hints disabled.',
    solutionCommand:
      'mlflow autolog openai; mlflow runs create --name llm; mlflow genai log-prompt "What is a model alias?"; mlflow genai log-trace --name chat --kind LLM; mlflow genai score --name faithfulness --value 0.9; mlflow runs log -m tokens_in=40 --step 0',
    startWorld: withExperiment('tutor-bot'),
    goal: all(
      runHasPrompt('tutor-bot'),
      runHasTrace('LLM', 'tutor-bot'),
      runHasEval('faithfulness', 0.8),
    ),
    learning: ['Assessment: LLM tracking loop without hints'],
    goalSteps: [
      'openai autolog + prompt + LLM trace',
      'faithfulness scorer >= 0.8',
      'token metric logged',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Closed-book LLM ops drill',
          '',
          'One run: autolog openai, prompt, LLM trace, faithfulness ≥ 0.8, token metric. That is a minimal production LLM loop.',
        ],
      },
    ],
  },
];
