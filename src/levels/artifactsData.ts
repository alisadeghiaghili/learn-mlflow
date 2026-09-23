/**
 * Artifacts, datasets, and evaluation.
 */

import type { Level } from '../engine/types';
import {
  all,
  runHasArtifact,
  runHasDataset,
  runHasEval,
  runHasParam,
} from '../engine/goals';
import { withExperiment } from './builders';

export const artifactsDataLevels: Level[] = [
  {
    id: 'art-list-model',
    sequenceId: 'artifacts-data',
    name: 'Artifact Store',
    about: 'Models and reports are files with a URI.',
    hint: 'mlflow runs log-artifact model.pkl --model --flavor sklearn',
    solutionCommand:
      'mlflow runs create --name ship; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow runs log-artifact confusion.png; mlflow artifacts list',
    startWorld: withExperiment('iris'),
    goal: all(
      runHasArtifact('model.pkl', 'iris', 'model'),
      runHasArtifact('confusion.png', 'iris', 'file'),
    ),
    learning: [
      'Artifacts are the heavy outputs stored under the run URI',
      'Mark model artifacts so the Registry can find them',
    ],
    goalSteps: [
      'Log a model artifact model.pkl',
      'Log a file artifact confusion.png',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Numbers are cheap; files are the product',
          '',
          'The trained binary, the SHAP plot, the eval notebook — those live in the **artifact store** under a URI of the form `runs:/<run_id>/artifacts/...`. Metrics describe quality; artifacts *are* the thing you ship.',
          '',
          '```',
          'mlflow runs log-artifact model.pkl --model --flavor sklearn',
          'mlflow runs log-artifact confusion.png',
          'mlflow artifacts list',
          '```',
          '',
          'Design rule: every run that claims a good metric must also deposit the **model file** and the **evaluation evidence**. Otherwise the metric cannot be audited and the model cannot be rolled back.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Log `model.pkl` as a **model** artifact and `confusion.png` as a file artifact.',
        ],
      },
    ],
  },
  {
    id: 'data-log-dataset',
    sequenceId: 'artifacts-data',
    name: 'Dataset Lineage',
    about: 'Which data produced this metric?',
    hint: 'mlflow datasets log iris-train --type csv',
    solutionCommand:
      'mlflow runs create --name lineage; mlflow datasets log iris-train --type csv; mlflow datasets log iris-val --type csv',
    startWorld: withExperiment('iris'),
    goal: all(
      runHasDataset('iris-train', 'iris'),
      runHasDataset('iris-val', 'iris'),
    ),
    learning: [
      'Datasets are first-class lineage objects in MLflow',
      'Link train/val sets so metrics are interpretable',
    ],
    goalSteps: [
      'Log dataset iris-train on a run',
      'Log dataset iris-val on a run',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Metrics without data lineage are folklore',
          '',
          '“0.93 accuracy” means nothing until you know *on which snapshot*. MLflow **datasets** attach a named object + digest to the run so later you can ask which data version moved the metric.',
          '',
          '```',
          'mlflow datasets log iris-train --type csv',
          'mlflow datasets log iris-val --type csv',
          '```',
          '',
          'Always log **train and eval** sets separately. Mixing them is how silent leakage ships. Digests change when rows change — that is your canary when someone “just refreshes” a table.',
        ],
      },
      {
        type: 'text',
        markdown: ['Log `iris-train` and `iris-val` datasets on one run.'],
      },
    ],
  },
  {
    id: 'data-evaluate',
    sequenceId: 'artifacts-data',
    name: 'mlflow.evaluate',
    about: 'Evaluation metrics belong to a defined contract.',
    hint: 'mlflow evaluate --metric accuracy --value 0.93',
    solutionCommand:
      'mlflow runs create --name eval; mlflow runs log -p model=gbm; mlflow evaluate --metric accuracy --value 0.93; mlflow evaluate --metric f1 --value 0.90 --higher-better true',
    startWorld: withExperiment('iris'),
    goal: all(
      runHasParam('model'),
      runHasEval('accuracy', 0.9),
      runHasEval('f1', 0.85),
    ),
    learning: [
      'Evaluation results are structured, not ad-hoc metric names',
      'Record greater-is-better semantics with the score',
    ],
    goalSteps: [
      'Log param model',
      'Evaluate accuracy >= 0.9',
      'Evaluate f1 >= 0.85',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Evaluation is a contract, not a free-for-all',
          '',
          'Ad-hoc `log_metric("acc2", …)` piles up unexplained keys. `mlflow.evaluate` records a **named result** with direction (`greaterIsBetter`) so dashboards and gates can reason automatically.',
          '',
          '```',
          'mlflow evaluate --metric accuracy --value 0.93',
          'mlflow evaluate --metric f1 --value 0.90 --higher-better true',
          '```',
          '',
          'In production gates you will write: *promote if accuracy ≥ champion − ε and fairness metric ≥ floor*. Structured eval results make those gates one query instead of a Python archaeology project.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'On one run: param `model`, eval `accuracy` ≥ 0.9, eval `f1` ≥ 0.85.',
        ],
      },
    ],
  },
  {
    id: 'data-gate-story',
    sequenceId: 'artifacts-data',
    name: 'Build a Promotion Gate',
    about: 'Combine lineage + eval like a release checklist.',
    hint: 'Dataset + model artifact + eval metrics on one candidate run',
    solutionCommand:
      'mlflow runs create --name candidate; mlflow datasets log iris-val --type csv; mlflow runs log-artifact model.pkl --model --flavor sklearn; mlflow evaluate --metric accuracy --value 0.94; mlflow runs tag stage=candidate',
    startWorld: withExperiment('iris'),
    goal: all(
      runHasDataset('iris-val', 'iris'),
      runHasArtifact('model.pkl', 'iris', 'model'),
      runHasEval('accuracy', 0.9),
      (w) =>
        Object.values(w.runs).some((r) => r.tags.stage === 'candidate'),
    ),
    learning: [
      'A shippable run bundles data, model, eval, and stage tag',
      'Release checklists map 1:1 to Tracking fields',
    ],
    goalSteps: [
      'Log dataset iris-val',
      'Log model artifact model.pkl',
      'Evaluate accuracy >= 0.9',
      'Tag the run stage=candidate',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The promotion checklist, encoded',
          '',
          'Before a model touches Staging, serious teams check: eval on the right data, model file present, score above floor, owner tagged. That checklist is not a wiki page — it is **fields on the run**.',
          '',
          'This level is a mini release gate: dataset lineage + model artifact + eval score + `stage=candidate`. When all four exist, a CI job can flip the Registry stage with confidence.',
          '',
          'Anti-pattern: promoting because “the notebook looked good”. If it is not on the run, it did not happen.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'Create a candidate run with all four gate fields in `iris`.',
        ],
      },
    ],
  },
];
