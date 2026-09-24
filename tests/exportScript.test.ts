/**
 * Export script translation tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  solutionToPythonScript,
  solutionToShellScript,
  toPython,
} from '../src/engine/exportScript';

describe('exportScript', () => {
  it('maps CLI to fluent Python', () => {
    assert.equal(
      toPython('mlflow experiments create -n iris'),
      'mlflow.set_experiment("iris")',
    );
    assert.match(toPython('mlflow runs log -m acc=0.9 --step 1')!, /log_metric/);
    assert.match(toPython('mlflow models load -n m --stage Production')!, /load_model/);
  });

  it('builds a python script with header', () => {
    const script = solutionToPythonScript(
      'mlflow experiments create -n iris; mlflow runs create; mlflow runs log -p lr=0.01',
    );
    assert.match(script, /import mlflow/);
    assert.match(script, /set_experiment\("iris"\)/);
    assert.match(script, /log_param\("lr"/);
  });

  it('builds a shell script of real CLI lines', () => {
    const sh = solutionToShellScript('mlflow runs create; mlflow runs finish');
    assert.match(sh, /set -euo pipefail/);
    assert.match(sh, /mlflow runs create/);
  });
});
