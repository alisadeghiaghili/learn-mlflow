/**
 * Fidelity tests: fluent API, signature gate, approval, explain-why.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { executeCommand } from '../src/engine/commands';
import { tryFluent } from '../src/engine/fluent';
import { explain } from '../src/engine/errors';
import { createEmptyWorld, createExperiment, createRun, registerModel } from '../src/engine/world';
import type { World } from '../src/engine/types';

function run(world: World, ...cmds: string[]): World {
  let w = world;
  for (const c of cmds) {
    const result = executeCommand(c, w);
    assert.equal(result.ok, true, 'command failed: ' + c + (result.ok ? '' : ' ' + result.error));
    if (result.ok) w = result.world;
  }
  return w;
}

describe('fluent API', () => {
  it('set_experiment + start_run + logs', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow.set_experiment("iris")',
      'mlflow.start_run(run_name="t")',
      'mlflow.log_param("lr", 0.01)',
      'mlflow.log_metric("acc", 0.95, step=0)',
      'mlflow.set_tag("api", "fluent")',
    );
    assert.equal(w.experiments[0]!.name, 'iris');
    const id = w.activeRunId!;
    assert.equal(w.runs[id]!.params.lr, '0.01');
    assert.equal(w.runs[id]!.metrics.acc, 0.95);
    assert.equal(w.runs[id]!.tags.api, 'fluent');
  });

  it('predict refuses unsigned model with explain-why', () => {
    let w = createEmptyWorld();
    const exp = createExperiment(w, 'e');
    w = exp.world;
    const created = createRun(w, '1');
    w = created.world;
    const reg = registerModel(w, 'm', created.run.id, '', 'sklearn', null);
    w = reg.world;
    w = run(w, 'mlflow models load -n m --version 1');
    const result = executeCommand('mlflow models predict --rows 1', w);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /signature/i);
      assert.ok(result.why);
    }
  });

  it('explain() teaches the constraint', () => {
    assert.match(explain('no-run'), /start_run/i);
    assert.match(explain('no-signature'), /signature/i);
  });

  it('approval workflow works', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n e',
      'mlflow runs create',
      'mlflow runs log-artifact model.pkl --model --flavor sklearn',
      'mlflow models register -n m --flavor sklearn --signature "Tensor<double>-1"',
      'mlflow models approve -n m --version 1',
    );
    assert.equal(w.models.m!.versions[0]!.approval, 'approved');
  });

  it('fluent returns null for non-python lines', () => {
    assert.equal(tryFluent('mlflow runs list', createEmptyWorld()), null);
  });
});
