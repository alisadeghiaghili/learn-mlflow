/**
 * Translate sandbox commands into real MLflow Python / CLI snippets.
 * Lets learners copy a runnable script out of a level solution.
 */

/** Map a simulated command to real Python (fluent/client). */
export function toPython(command: string): string | null {
  const c = command.trim();
  if (!c || c === 'import mlflow') return null;

  let m = c.match(/^mlflow experiments create -n (.+?)(?: --tag .+)?$/);
  if (m) return `mlflow.set_experiment("${m[1]}")`;

  m = c.match(/^mlflow experiments set (.+)$/);
  if (m) return `mlflow.set_experiment("${m[1]}")`;

  m = c.match(/^mlflow runs create(?: --name (.+?))?(?: --nested)?$/);
  if (m) {
    const name = m[1] ? `, run_name="${m[1]}"` : '';
    const nested = c.includes('--nested') ? ', nested=True' : '';
    return `mlflow.start_run(${[name.slice(2), nested.slice(2)].filter(Boolean).join(', ')})`;
  }

  if (c === 'mlflow runs finish' || c.startsWith('mlflow runs finish')) {
    return 'mlflow.end_run()';
  }

  m = c.match(/^mlflow runs log -p ([^=]+)=(.+)$/);
  if (m) return `mlflow.log_param("${m[1]}", "${m[2]}")`;

  m = c.match(/^mlflow runs log -m ([^=]+)=([0-9.]+)(?: --step (\d+))?$/);
  if (m) {
    const step = m[3] ? `, step=${m[3]}` : '';
    return `mlflow.log_metric("${m[1]}", ${m[2]}${step})`;
  }

  m = c.match(/^mlflow runs tag ([^=]+)=(.+)$/);
  if (m) return `mlflow.set_tag("${m[1]}", "${m[2]}")`;

  m = c.match(/^mlflow runs log-artifact (.+?)(?: --model)?(?: --flavor .+)?$/);
  if (m && c.includes('--model')) {
    return `mlflow.sklearn.log_model(model, artifact_path="${m[1]}")`;
  }
  if (m) return `mlflow.log_artifact("${m[1]}")`;

  m = c.match(/^mlflow runs source --git (\S+) --entry (\S+)/);
  if (m) {
    return `# tracked automatically via mlflow.set_tracking_uri + source hooks\ngit_sha = "${m[1]}"  # entry=${m[2]}`;
  }

  m = c.match(/^mlflow runs env --python (\S+) --mlflow (\S+)/);
  if (m) {
    return `# captured by mlflow (python ${m[1]}, mlflow ${m[2]})`;
  }

  m = c.match(/^mlflow datasets log (.+?)(?: --type .+)?$/);
  if (m) {
    return `from mlflow.data import from_pandas\ndataset = from_pandas(df, source="${m[1]}")\nmlflow.log_input(dataset)`;
  }

  if (c.startsWith('mlflow evaluate --builtin classification')) {
    return 'mlflow.evaluate(model, eval_data, model_type="classifier")';
  }

  m = c.match(/^mlflow evaluate --metric (\S+) --value ([0-9.]+)/);
  if (m) return `mlflow.log_metric("${m[1]}", ${m[2]})  # from mlflow.evaluate`;

  m = c.match(/^mlflow models register -n (.+?)(?: --flavor .+)?(?: --signature .+)?(?: --run .+)?$/);
  if (m) {
    return `mlflow.register_model("runs:/${'{{run_id}}'}/model", "${m[1]}")`;
  }

  m = c.match(/^mlflow models transition -n (.+?) --version (\d+) --stage (.+)$/);
  if (m) {
    return `client.transition_model_version_stage("${m[1]}", ${m[2]}, "${m[3]}")`;
  }

  m = c.match(/^mlflow models archive -n (.+?) --version (\d+)$/);
  if (m) {
    return `client.transition_model_version_stage("${m[1]}", ${m[2]}, "Archived")`;
  }

  m = c.match(/^mlflow models alias -n (.+?) --alias (.+?) --version (\d+)$/);
  if (m) {
    return `client.set_registered_model_alias("${m[1]}", "${m[2]}", ${m[3]})`;
  }

  m = c.match(/^mlflow models load -n (.+?)(?: --stage (.+)| --version (\d+))?/);
  if (m) {
    const ref = m[3] ?? m[2] ?? 'Production';
    return `model = mlflow.pyfunc.load_model("models:/${m[1]}/${ref}")`;
  }

  if (c.startsWith('mlflow models predict')) {
    return 'preds = model.predict(eval_data)';
  }

  if (c.startsWith('mlflow models serve')) {
    return '# mlflow models serve -m models:/name/Production -p 5001 --env-manager local';
  }

  if (c.startsWith('mlflow models invoke') || c.startsWith('mlflow models stop-serve')) {
    return '# curl -X POST http://127.0.0.1:5001/invocations -H "Content-Type: application/json" -d \'{"inputs": [[1,2,3,4]]}\'';
  }

  if (c.startsWith('mlflow models approve')) {
    return '# registry UI / client.set_registered_model_alias + stage + description (policy) \n# e.g. client.update_model_version(name, version, description="approved by ...")';
  }

  m = c.match(/^mlflow autolog (.+)$/);
  if (m && m[1] === 'off') return 'mlflow.autolog(disable=True)';
  if (m) return `mlflow.${m[1]}.autolog()`;

  m = c.match(/^mlflow run \. -P (\S+)$/);
  if (m) return `# mlflow run . -P ${m[1]}   # or python train.py --${m[1].replace('=', ' ')}`;

  m = c.match(/^mlflow genai log-prompt (.+)$/);
  if (m) return `mlflow.log_dict({{"prompt": ${m[1]}}}, "prompt.json")`;

  m = c.match(/^mlflow genai log-trace --name (\S+) --kind (\S+)/);
  if (m) return `# OpenTelemetry/MLflow trace span: ${m[1]} kind=${m[2]}`;

  m = c.match(/^mlflow genai score --name (\S+) --value ([0-9.]+)/);
  if (m) return `mlflow.log_metric("${m[1]}", ${m[2]})  # scorer`;

  return null;
}

/** Build a copy-paste training script from a solution command chain. */
export function solutionToPythonScript(solutionCommand: string): string {
  const parts = solutionCommand
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const lines = ['import mlflow', ''];
  for (const cmd of parts) {
    const py = toPython(cmd);
    if (py) lines.push(py);
    else lines.push(`# ${cmd}`);
  }
  lines.push('', '# --- end of level solution sketch ---');
  return lines.join('\n');
}

/** Build a real shell script using the official MLflow CLI surface. */
export function solutionToShellScript(solutionCommand: string): string {
  const parts = solutionCommand
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    '#!/usr/bin/env bash',
    '# Generated from LearnMLflow — run against a real MLflow tracking server',
    'set -euo pipefail',
    '',
    ...parts,
    '',
  ].join('\n');
}
