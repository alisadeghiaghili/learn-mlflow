/**
 * MLproject / reproducible projects track (lightweight simulation).
 */

import type { Level } from '../engine/types';
import { all, runHasEnv, runHasParam, runHasSource } from '../engine/goals';
import { emptyStart, withExperiment } from './builders';

export const projectLevels: Level[] = [
  {
    id: 'proj-contract',
    sequenceId: 'train-ops',
    name: 'Project Entry Point',
    about: 'An MLproject is a contract for how training runs.',
    hint: 'Record entry point + params like an MLproject would declare',
    solutionCommand:
      'mlflow experiments create -n pricing; mlflow runs create --name via-entry; mlflow runs source --git abc1234 --entry MLproject --version 0.1.0; mlflow runs log -p entry=main; mlflow runs log -p lr=0.05',
    startWorld: emptyStart(),
    goal: all(
      runHasSource(),
      runHasParam('entry'),
      runHasParam('lr'),
    ),
    learning: [
      'MLproject declares entry points and parameters',
      'Reproducible projects pin code + params together',
    ],
    goalSteps: [
      'Record source with entry MLproject',
      'Log params entry and lr',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Packaging a training job',
          '',
          'An **MLproject** file declares: name, entry points (`main`, `train`), parameters with defaults/types, and the environment (conda/docker). It turns `python train.py --lr 0.05` into a **reproducible unit** anyone can `mlflow run . -P lr=0.05`.',
          '',
          '```yaml',
          'name: pricing',
          'entry_points:',
          '  main:',
          '    parameters:',
          '      lr: { type: float, default: 0.01 }',
          '    command: "python train.py --lr {lr}"',
          '```',
          '',
          'Even without a full Projects backend in this sandbox, record the same *contract* on the run: entry point + parameters. That is what makes a job re-runnable next quarter.',
        ],
      },
      {
        type: 'text',
        markdown: [
          'In experiment `pricing`: a run with source entry `MLproject` and params `entry` + `lr`.',
        ],
      },
    ],
  },
  {
    id: 'proj-rerun',
    sequenceId: 'train-ops',
    name: 'Re-run the Contract',
    about: 'Same entry, changed param — a real experiment.',
    hint: 'Two runs share entry, differ on lr',
    solutionCommand:
      'mlflow runs create --name lr001; mlflow runs source --git abc1234 --entry train.py; mlflow runs log -p lr=0.01; mlflow runs log -m rmse=3.2; mlflow runs create --name lr005; mlflow runs source --git abc1234 --entry train.py; mlflow runs log -p lr=0.05; mlflow runs log -m rmse=2.7',
    startWorld: withExperiment('pricing'),
    goal: all(
      (w) => Object.values(w.runs).filter((r) => r.params.lr).length >= 2,
      (w) => Object.values(w.runs).some((r) => r.params.lr === '0.05'),
    ),
    learning: [
      'One entry point, many parameterizations = experiments',
      'Compare metrics under a fixed code contract',
    ],
    goalSteps: [
      'Two runs with different lr',
      'One of them uses lr=0.05',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## Controlled change only',
          '',
          'Projects discipline: hold entry point + code SHA fixed, vary **one parameter**. Then the metric delta is attributable. Change five things at once and you have a mystery, not an experiment.',
          '',
          'Do exactly that here: two runs, same entry, `lr=0.01` vs `lr=0.05`.',
        ],
      },
      {
        type: 'text',
        markdown: ['Two runs in `pricing` with different `lr`, one of them `0.05`.'],
      },
    ],
  },
  {
    id: 'proj-env-pin',
    sequenceId: 'train-ops',
    name: 'Pin the Environment',
    about: 'Projects without env pins do not reproduce.',
    hint: 'mlflow runs env --python ... --mlflow ...',
    solutionCommand:
      'mlflow runs create --name pinned; mlflow runs source --git def5678 --entry train.py; mlflow runs env --python 3.11.8 --mlflow 2.14.0; mlflow runs log -p lr=0.02',
    startWorld: withExperiment('pricing'),
    goal: all(runHasSource(), runHasEnv(), runHasParam('lr')),
    learning: [
      'Environment pins are part of the project contract',
      'Source + env + params = re-runnable job',
    ],
    goalSteps: [
      'Record source and env',
      'Log param lr',
    ],
    dialog: [
      {
        type: 'text',
        markdown: [
          '## The last mile of reproducibility',
          '',
          'A conda/docker env in an MLproject is what makes `mlflow run` work on a colleague’s laptop. In this simulator you record the equivalent on the run: Python + MLflow versions next to source and params.',
          '',
          'Definition of done for a project job: **source + env + params + metrics + model**. Anything less is a notebook screenshot.',
        ],
      },
      {
        type: 'text',
        markdown: ['One run with source, env, and `lr` in `pricing`.'],
      },
    ],
  },
];
