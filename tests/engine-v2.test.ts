/**
 * Engine command tests for curriculum v2 features.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { executeCommand } from '../src/engine/commands';
import { createEmptyWorld } from '../src/engine/world';
import type { World } from '../src/engine/types';

function run(world: World, ...cmds: string[]): World {
  let w = world;
  for (const c of cmds) {
    const result = executeCommand(c, w);
    assert.equal(result.ok, true, 'command failed: ' + c);
    if (result.ok) w = result.world;
  }
  return w;
}

describe('curriculum v2 commands', () => {
  it('logs metric steps into history', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n e',
      'mlflow runs create',
      'mlflow runs log -m loss=0.5 --step 0',
      'mlflow runs log -m loss=0.3 --step 1',
    );
    const id = w.activeRunId!;
    assert.equal(w.runs[id]!.metricHistory.loss!.length, 2);
    assert.equal(w.runs[id]!.metrics.loss, 0.3);
  });

  it('creates nested runs with parent id', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n e',
      'mlflow runs create --name parent',
      'mlflow runs create --name child --nested',
    );
    const children = Object.values(w.runs).filter((r) => r.parentId);
    assert.equal(children.length, 1);
  });

  it('searches runs by metric filter', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n e',
      'mlflow runs create --name weak',
      'mlflow runs log -m acc=0.5',
      'mlflow runs create --name strong',
      'mlflow runs log -m acc=0.95',
      'mlflow runs search "metrics.acc > 0.9"',
    );
    // search returns ok lines mentioning Matched
    const r = executeCommand('mlflow runs search "metrics.acc > 0.9"', w);
    assert.equal(r.ok, true);
    if (r.ok) assert.match(r.lines.join('\n'), /Matched 1/);
  });

  it('registers with flavor and signature, sets alias, loads', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n e',
      'mlflow runs create',
      'mlflow runs log-artifact model.pkl --model --flavor sklearn',
      'mlflow models register -n m --flavor sklearn --signature "Tensor<double>-1"',
      'mlflow models alias -n m --alias champion --version 1',
      'mlflow models load -n m @champion',
    );
    assert.equal(w.loadedModelUri, 'models:/m@champion');
    assert.equal(w.models.m!.versions[0]!.aliases.includes('champion'), true);
    assert.equal(w.models.m!.versions[0]!.signature, 'Tensor<double>-1');
  });

  it('serves and invokes', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n e',
      'mlflow runs create',
      'mlflow runs log-artifact model.pkl --model --flavor sklearn',
      'mlflow models register -n m --flavor sklearn',
      'mlflow models transition -n m --version 1 --stage Production',
      'mlflow models serve -n m --port 5001 --stage Production',
      'mlflow models invoke',
    );
    assert.equal(w.served?.predictions, 1);
  });

  it('autolog fills a new run', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n e',
      'mlflow autolog sklearn',
      'mlflow runs create --name auto',
    );
    const id = w.activeRunId!;
    assert.equal(w.runs[id]!.autologged, true);
    assert.ok(w.runs[id]!.metricHistory.train_loss!.length >= 3);
    assert.ok(w.runs[id]!.source.git);
  });

  it('logs datasets, eval, prompts, traces', () => {
    const w = run(
      createEmptyWorld(),
      'mlflow experiments create -n e',
      'mlflow runs create',
      'mlflow datasets log iris-val --type csv',
      'mlflow evaluate --metric faithfulness --value 0.9',
      'mlflow genai log-prompt "hello"',
      'mlflow genai log-trace --name llm --kind LLM',
    );
    const id = w.activeRunId!;
    assert.equal(w.runs[id]!.datasets.length, 1);
    assert.equal(w.runs[id]!.evalResults[0]!.name, 'faithfulness');
    assert.equal(w.runs[id]!.prompts.length, 1);
    assert.equal(w.runs[id]!.traces[0]!.kind, 'LLM');
  });
});
