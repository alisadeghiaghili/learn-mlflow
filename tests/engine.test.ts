/**
 * Unit tests for the world engine, command parser, history, and goals.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { executeCommand } from '../src/engine/commands';
import {
  countCommands,
  createHistory,
  popHistory,
  pushHistory,
} from '../src/engine/history';
import {
  activeExperimentIs,
  all,
  hasExperiment,
  minRuns,
  modelExists,
  modelVersionInStage,
  runHasArtifact,
  runHasMetric,
  runHasParam,
  runHasTag,
} from '../src/engine/goals';
import {
  createEmptyWorld,
  createExperiment,
  createRun,
} from '../src/engine/world';
import type { World } from '../src/engine/types';
import { TOK_LEVELS } from '../src/engine/tokens';

function run(world: World, ...cmds: string[]): World {
  let w = world;
  for (const c of cmds) {
    const result = executeCommand(c, w);
    assert.equal(result.ok, true, 'command failed: ' + c);
    if (result.ok) w = result.world;
  }
  return w;
}

describe('world factory', () => {
  it('creates an empty world', () => {
    const w = createEmptyWorld();
    assert.equal(w.experiments.length, 0);
    assert.equal(Object.keys(w.runs).length, 0);
    assert.equal(w.activeExperimentId, null);
  });

  it('creates experiments and runs with stable ids', () => {
    let w = createEmptyWorld();
    const exp = createExperiment(w, 'iris');
    w = exp.world;
    assert.equal(exp.experiment.name, 'iris');
    assert.equal(w.activeExperimentId, '1');
    const created = createRun(w, '1');
    w = created.world;
    assert.equal(created.run.experimentId, '1');
    assert.equal(w.activeRunId, created.run.id);
    assert.equal(w.experiments[0].runIds.length, 1);
  });
});

describe('command parser', () => {
  it('creates an experiment', () => {
    const result = executeCommand(
      'mlflow experiments create -n fraud',
      createEmptyWorld(),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.world.experiments[0].name, 'fraud');
    assert.equal(result.world.activeExperimentId, '1');
  });

  it('rejects unknown commands', () => {
    const result = executeCommand('git commit', createEmptyWorld());
    assert.equal(result.ok, false);
  });

  it('logs params and metrics on the active run', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n iris',
      'mlflow runs create',
      'mlflow runs log -p lr=0.01',
      'mlflow runs log -m acc=0.95',
      'mlflow runs tag stage=train',
      'mlflow runs log-artifact model.pkl',
    );
    const id = w.activeRunId as string;
    assert.equal(w.runs[id].params.lr, '0.01');
    assert.equal(w.runs[id].metrics.acc, 0.95);
    assert.equal(w.runs[id].tags.stage, 'train');
    assert.deepEqual(
      w.runs[id]!.artifacts.map((a) => a.path),
      ['model.pkl'],
    );
  });

  it('registers a model and transitions stages', () => {
    let w = run(
      createEmptyWorld(),
      'mlflow experiments create -n iris',
      'mlflow runs create',
      'mlflow runs log-artifact model.pkl',
      'mlflow models register -n iris-clf',
    );
    assert.equal(w.models['iris-clf'].versions.length, 1);
    assert.equal(w.models['iris-clf'].versions[0].stage, 'None');

    w = run(w, 'mlflow models transition -n iris-clf --version 1 --stage Staging');
    assert.equal(w.models['iris-clf'].versions[0].stage, 'Staging');

    w = run(w, 'mlflow models archive -n iris-clf --version 1');
    assert.equal(w.models['iris-clf'].versions[0].stage, 'Archived');
  });

  it('appends versions on repeated register', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n m',
      'mlflow runs create',
      'mlflow models register -n m1',
      'mlflow runs create',
      'mlflow models register -n m1',
    );
    assert.equal(w.models.m1.versions.length, 2);
    assert.equal(w.models.m1.versions[0].version, 1);
    assert.equal(w.models.m1.versions[1].version, 2);
  });

  it('returns a game token for levels', () => {
    const result = executeCommand('levels', createEmptyWorld());
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.lines, [TOK_LEVELS]);
  });

  it('does not mutate the input world', () => {
    const w0 = createEmptyWorld();
    executeCommand('mlflow experiments create -n x', w0);
    assert.equal(w0.experiments.length, 0);
  });
});

describe('history', () => {
  it('undo restores previous world', () => {
    const w0 = createEmptyWorld();
    let history = createHistory();
    history = pushHistory(history, w0);
    const w1 = run(w0, 'mlflow experiments create -n a');
    const popped = popHistory(history);
    assert.ok(popped);
    assert.equal(popped.world.experiments.length, 0);
    assert.equal(w1.experiments.length, 1);
    assert.equal(popped.history.past.length, 0);
  });

  it('counts solution golf commands', () => {
    assert.equal(countCommands('a; b;c'), 3);
    assert.equal(countCommands(''), 0);
  });
});

describe('goals', () => {
  it('checks experiment and run predicates', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n fraud-detection',
      'mlflow runs create',
      'mlflow runs log -p lr=0.01',
      'mlflow runs log -m acc=0.95',
    );
    assert.equal(hasExperiment('fraud-detection')(w), true);
    assert.equal(activeExperimentIs('fraud-detection')(w), true);
    assert.equal(minRuns(1)(w), true);
    assert.equal(runHasParam('lr')(w), true);
    assert.equal(runHasMetric('acc', { min: 0.9 })(w), true);
    assert.equal(runHasMetric('acc', { min: 0.99 })(w), false);
  });

  it('checks registry predicates', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n iris',
      'mlflow runs create',
      'mlflow runs log-artifact model.pkl',
      'mlflow models register -n iris-clf',
      'mlflow models transition -n iris-clf --version 1 --stage Production',
    );
    assert.equal(modelExists('iris-clf')(w), true);
    assert.equal(modelVersionInStage('iris-clf', 1, 'Production')(w), true);
    assert.equal(modelVersionInStage('iris-clf', 1, 'Staging')(w), false);
    assert.equal(runHasArtifact('model.pkl')(w), true);
  });

  it('all() requires every goal', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n iris',
      'mlflow runs create',
      'mlflow runs tag stage=train',
    );
    assert.equal(
      all(hasExperiment('iris'), runHasTag('stage', 'train'))(w),
      true,
    );
    assert.equal(all(hasExperiment('iris'), runHasParam('lr'))(w), false);
  });
});
