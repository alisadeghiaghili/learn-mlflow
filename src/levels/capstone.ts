/**
 * Capstone + fidelity levels: fluent API, approval, compare, classification eval,
 * mlflow run, genai scorers.
 */

import type { Level } from '../engine/types';
import {
  all,
  compareTagged,
  evalHas,
  minRuns,
  modelExists,
  modelLoaded,
  modelVersionApproval,
  modelVersionInStage,
  predictionsOK,
  runHasEnv,
  runHasMetricSteps,
  runHasParam,
  runHasPrompt,
  runHasSource,
  runHasSystemMetrics,
  runHasTag,
} from '../engine/goals';
import { emptyStart, withExperiment, withRegisteredModel } from './builders';

export const capstoneLevels: Level[] = [
  {
    id: 'fid-fluent',
    sequenceId: 'train-ops',
    name: 'Fluent Python API',
    about: 'Same Tracking story via mlflow.* calls.',
    hint: 'mlflow.set_experiment("iris")  ·  mlflow.start_run()  ·  mlflow.log_param("lr", 0.01)',
    solutionCommand:
      'mlflow.set_experiment("iris"); mlflow.start_run(run_name="fluent"); mlflow.log_param("lr", 0.01); mlflow.log_metric("acc", 0.95, step=0); mlflow.set_tag("api", "fluent"); mlflow.end_run()',
    startWorld: emptyStart(),
    goal: all(
      runHasParam('lr'),
      runHasTag('api', 'fluent'),
      minRuns(1),
    ),
    learning: [
      'Fluent API is what notebooks and training scripts use',
      'CLI and fluent share one Tracking backend',
    ],
    goalSteps: [
      'set_experiment + start_run via fluent API',
      'log_param lr and log_metric acc',
      'set_tag api=fluent and end_run',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## You will not type CLI in a training script',
          '',
          'Production code uses the **fluent API**. The CLI you have been using is a thin shell around the same store. Learn both — ops uses CLI, training uses Python.',
          '',
          '```python',
          'import mlflow',
          'mlflow.set_experiment("iris")',
          'mlflow.start_run(run_name="fluent")',
          'mlflow.log_param("lr", 0.01)',
          'mlflow.log_metric("acc", 0.95, step=0)',
          'mlflow.set_tag("api", "fluent")',
          'mlflow.end_run()',
          '```',
          '',
          'In this sandbox, type those Python lines as commands. They hit the same World state as `mlflow runs log …`. If fluent and CLI ever disagree, the model of Tracking is wrong — here they cannot.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Reproduce a small Tracking story **only** with fluent calls: experiment `iris`, param `lr`, metric `acc`, tag `api=fluent`.',
        ],
      },
    ],
  },
  {
    id: 'fid-client-vs-fluent',
    sequenceId: 'train-ops',
    name: 'Client vs Fluent',
    about: 'MlflowClient when you need explicit run ids.',
    hint: 'client.create_experiment(...); client.log_metric(run_id, "acc", 0.9)',
    solutionCommand:
      'client.create_experiment("pricing"); mlflow.start_run(run_name="via-client"); mlflow.log_param("model", "gbm"); client.log_metric("abc", "acc", 0.91, step=1); client.log_metric("abc", "acc", 0.93, step=2)',
    startWorld: emptyStart(),
    goal: all(minRuns(1), runHasMetricSteps('acc', 2)),
    learning: [
      'Client API takes explicit ids — needed for multi-run jobs',
      'Fluent is the ambient active-run style',
    ],
    goalSteps: [
      'Create experiment with client API',
      'Log a stepped metric with client.log_metric',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Ambient state vs explicit ids',
          '',
          '**Fluent** (`mlflow.log_metric`) writes to the *active* run — perfect for a single training process. **MlflowClient** takes `run_id` — required when one process orchestrates many runs (HPO worker, batch scoring).',
          '',
          '```python',
          'client = MlflowClient()',
          'client.create_experiment("pricing")',
          'client.log_metric(run_id, "acc", 0.93, step=2)',
          '```',
          '',
          'Rule of thumb: scripts → fluent; services and orchestrators → client.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Use `client.*` at least once and log **two steps** of metric `acc`.',
        ],
      },
    ],
  },
  {
    id: 'fid-system-metrics',
    sequenceId: 'train-ops',
    name: 'System Metrics',
    about: 'CPU/memory next to quality metrics.',
    hint: 'Enable autolog and create a run (records system metrics)',
    solutionCommand:
      'mlflow autolog sklearn; mlflow runs create --name heavy',
    startWorld: withExperiment('iris'),
    goal: runHasSystemMetrics('iris'),
    learning: [
      'Ops needs resource metrics beside model quality',
      'OOM and cost show up first in system metrics',
    ],
    goalSteps: ['Produce a run that recorded system metrics'],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Quality without cost is incomplete',
          '',
          'A model that is +1pp better but 3× the GPU-hours is a business tradeoff. MLflow can log **system metrics** (CPU, memory, disk) on the run so latency/cost incidents share a timeline with loss curves.',
          '',
          'Autolog in real deployments often enables system metrics. Here: enable autolog and create a run — the snapshot appears as `sys cpu=…` on the card.',
        ],
      },
      {
        type: 'text',
        markdown: ['Create a run that includes system metrics in `iris`.'],
      },
    ],
  },
  {
    id: 'cap-approval',
    sequenceId: 'registry-deep',
    name: 'Approval Gate',
    about: 'Humans sign off before Production.',
    hint: 'mlflow models approve -n iris-clf --version 1',
    solutionCommand:
      'mlflow models transition -n iris-clf --version 1 --stage Staging; mlflow models describe -n iris-clf --version 1 --text "validated offline"; mlflow models approve -n iris-clf --version 1; mlflow models transition -n iris-clf --version 1 --stage Production',
    startWorld: withRegisteredModel('iris-clf', 1, 'None'),
    goal: all(
      modelVersionApproval('iris-clf', 1, 'approved'),
      modelVersionInStage('iris-clf', 1, 'Production'),
    ),
    learning: [
      'Production promotion includes a human approval step',
      'Rejected candidates stay out of the ship channel',
    ],
    goalSteps: [
      'Move v1 through Staging with a description',
      'Approve version 1',
      'Promote to Production',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Approval is a product requirement',
          '',
          'Regulated and high-risk systems do not let `transition --stage Production` be enough. A reviewer **approves** the version (or rejects it). The Registry then has an audit trail: who shipped what, when, with notes.',
          '',
          '```',
          'mlflow models describe -n iris-clf --version 1 --text "validated offline"',
          'mlflow models approve -n iris-clf --version 1',
          'mlflow models transition -n iris-clf --version 1 --stage Production',
          '```',
          '',
          'Try the failure mode: promoting without approval still works in this sandbox (stages are labels) — but the goal requires `approved` first, like a real policy engine would.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'From `iris-clf` v1 in `None`: stage → describe → **approve** → Production.',
        ],
      },
    ],
  },
  {
    id: 'cap-signature-gate',
    sequenceId: 'registry-deep',
    name: 'Signature or Silence',
    about: 'Unsigned models refuse to predict.',
    hint: 'Register with --signature then load and predict',
    solutionCommand:
      'mlflow runs create; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models load -n iris-clf --version 1; mlflow models predict --rows 3',
    startWorld: withExperiment('iris'),
    goal: all(modelLoaded('iris-clf'), predictionsOK(3)),
    learning: [
      'Predict refuses unsigned models in this contract',
      'Signatures catch schema drift at the edge',
    ],
    goalSteps: [
      'Register with a signature',
      'Load and predict 3 rows',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The gate that saves weekends',
          '',
          'Try `predict` on an unsigned model here — you get an error with a **why** line. That is intentional teaching: production scorers should not guess dtypes.',
          '',
          '```',
          'mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"',
          'mlflow models load -n iris-clf --version 1',
          'mlflow models predict --rows 3',
          '```',
          '',
          'Same rule as `no signature → no production`. Enforce it in CI, not in code review comments.',
        ],
      },
      {
        type: 'text',
        markdown: ['Register **with** a signature, load, predict 3 rows.'],
      },
    ],
  },
  {
    id: 'cap-compare-table',
    sequenceId: 'tracking-deep',
    name: 'Comparison Table',
    about: 'Tag candidates and read the matrix.',
    hint: 'mlflow runs tag compare=yes  on two runs',
    solutionCommand:
      'mlflow runs create --name baseline; mlflow runs log -p lr=0.01; mlflow runs log -m acc=0.81; mlflow runs tag compare=yes; mlflow runs create --name gbm; mlflow runs log -p lr=0.05; mlflow runs log -m acc=0.93; mlflow runs tag compare=yes',
    startWorld: withExperiment('iris'),
    goal: all(compareTagged(2, 'iris'), minRuns(2, 'iris')),
    learning: [
      'Comparison tables are how model selection is defended',
      'Tag candidates instead of keeping a spreadsheet',
    ],
    goalSteps: [
      'Two runs tagged compare=yes',
      'Different params/metrics so the table is meaningful',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Decision artifacts, not screenshots',
          '',
          'Tag two runs `compare=yes` and the viz builds a **field × run** matrix. This is the slide you paste into a model review — generated from the tracker, not retyped.',
          '',
          '```',
          'mlflow runs tag compare=yes',
          '```',
          '',
          'Anti-pattern: Excel of metrics that diverges from the Tracking server on day two.',
        ],
      },
      {
        type: 'text',
        markdown: ['Two runs in `iris` tagged `compare=yes`.'],
      },
    ],
  },
  {
    id: 'cap-classification-eval',
    sequenceId: 'artifacts-data',
    name: 'Builtin Classification Eval',
    about: 'precision / recall / f1 from one evaluate call.',
    hint: 'mlflow evaluate --builtin classification',
    solutionCommand:
      'mlflow runs create --name clf; mlflow runs log -p model=rf; mlflow evaluate --builtin classification',
    startWorld: withExperiment('iris'),
    goal: all(
      runHasParam('model'),
      evalHas('precision', 0.8),
      evalHas('recall', 0.8),
      evalHas('f1_score', 0.8),
    ),
    learning: [
      'Builtin evaluators compute the standard suite',
      'Stop hand-logging metrics libraries already know',
    ],
    goalSteps: [
      'Log param model',
      'Run builtin classification evaluate',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## One call, the standard suite',
          '',
          '`mlflow.evaluate` with a builtin evaluator writes precision, recall, f1 (and more) under consistent names. Consistent names make cross-run charts possible.',
          '',
          '```',
          'mlflow evaluate --builtin classification',
          '```',
          '',
          'Still log **business** metrics yourself. Builtin covers the textbook suite.',
        ],
      },
      {
        type: 'text',
        markdown: ['Param `model` + builtin classification eval on one run.'],
      },
    ],
  },
  {
    id: 'cap-mlflow-run',
    sequenceId: 'train-ops',
    name: 'mlflow run Project',
    about: 'Execute an entry with parameters.',
    hint: 'mlflow run . -P lr=0.05',
    solutionCommand:
      'mlflow experiments create -n pricing; mlflow run . -P lr=0.05',
    startWorld: emptyStart(),
    goal: all(runHasSource(), runHasEnv(), runHasParam('lr', '0.05')),
    learning: [
      'mlflow run is the reproducible project runner',
      'Parameters override declared defaults',
    ],
    goalSteps: [
      'Create experiment pricing',
      'mlflow run with -P lr=0.05',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## `mlflow run` is the unit of reproduction',
          '',
          'Given an MLproject entry, `mlflow run . -P lr=0.05` starts a run with that parameter, pinned env, and recorded source. It is how teammates share “the job”, not a 20-line shell history.',
          '',
          '```',
          'mlflow run . -P lr=0.05',
          '```',
          '',
          'This sandbox simulates the contract: source + env + params on the run. In real life it also builds the conda/docker env.',
        ],
      },
      {
        type: 'text',
        markdown: ['In `pricing`, execute `mlflow run` with `lr=0.05`.'],
      },
    ],
  },
  {
    id: 'cap-genai-scorer',
    sequenceId: 'genai',
    name: 'Custom Scorers',
    about: 'Named scorer outputs for LLM release gates.',
    hint: 'mlflow genai score --name faithfulness --value 0.9',
    solutionCommand:
      'mlflow runs create --name rag; mlflow genai log-prompt "Define Model Registry."; mlflow genai score --name faithfulness --value 0.9; mlflow genai score --name toxicity --value 0.05 --higher-better false',
    startWorld: withExperiment('tutor-bot'),
    goal: all(
      runHasPrompt('tutor-bot'),
      evalHas('faithfulness', 0.8),
      evalHas('toxicity'),
    ),
    learning: [
      'Scorers are named, gated quality dimensions',
      'Toxicity is lower-is-better — record direction',
    ],
    goalSteps: [
      'Log a prompt',
      'Score faithfulness >= 0.8',
      'Score toxicity (any value)',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Gates need named scorers',
          '',
          'A prompt change ships when **faithfulness ≥ floor** and **toxicity ≤ ceiling**. Those names must be stable across runs — `genai score` writes them as eval results so promotion logic is uniform for classical and LLM models.',
          '',
          '```',
          'mlflow genai score --name faithfulness --value 0.9',
          '```',
        ],
      },
      {
        type: 'text',
        markdown: ['Prompt + faithfulness + toxicity scores in `tutor-bot`.'],
      },
    ],
  },
  {
    id: 'cap-release-runbook',
    sequenceId: 'registry-deep',
    name: 'Capstone: Ship a Model',
    about: 'The full release path under policy.',
    hint: 'Train → artifacts → eval → register+sign → approve → Production → load',
    solutionCommand:
      'mlflow runs create --name ship; mlflow runs tag stage=candidate; mlflow datasets log iris-val --type csv; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow evaluate --builtin classification; mlflow models register -n iris-clf --flavor sklearn --signature "Tensor<double>-1"; mlflow models describe -n iris-clf --version 1 --text "release 2024-11"; mlflow models approve -n iris-clf --version 1; mlflow models transition -n iris-clf --version 1 --stage Staging; mlflow models transition -n iris-clf --version 1 --stage Production; mlflow models load -n iris-clf --stage Production',
    startWorld: withExperiment('iris'),
    goal: all(
      runHasTag('stage', 'candidate'),
      evalHas('f1_score', 0.5),
      modelExists('iris-clf'),
      modelVersionApproval('iris-clf', 1, 'approved'),
      modelVersionInStage('iris-clf', 1, 'Production'),
      modelLoaded('iris-clf'),
    ),
    learning: [
      'End-to-end release is a sequence of Tracking decisions',
      'Policy: candidate tag, eval, signature, approval, then stage',
    ],
    goalSteps: [
      'Candidate run with data lineage + eval',
      'Register signed model + release notes',
      'Approve and promote to Production',
      'Load Production successfully',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Capstone: the release runbook',
          '',
          'This is the checklist an MLE runs before telling Slack “v1 is live”. Every step is a field you already know:',
          '',
          '1. Candidate run (`stage=candidate`) + dataset lineage',
          '2. Model artifact + builtin eval scores',
          '3. Register with **signature**, write release notes',
          '4. **Approve**, Staging → Production',
          '5. `load` the Production URI (smoke test)',
          '',
          'When this feels boring, the process is working. Incidents come from exciting releases.',
        ],
      },
      {
        type: 'text',
        markdown: ['Execute the full runbook in `iris`. Goal steps are on the right.'],
      },
    ],
  },
];
