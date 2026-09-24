/**
 * Short "why this failed" explanations for common errors.
 * Surfaced under the error line so learners learn the constraint, not just the message.
 */

const REASONS: Record<string, string> = {
  'no-experiment':
    'MLflow attaches every run to an experiment. Call set_experiment / experiments create first — otherwise there is nowhere to put the run.',
  'no-run':
    'Logging needs a target run. start_run() opens one; the CLI uses the active run after `mlflow runs create`.',
  'no-arg':
    'The call is missing required arguments. Check the signature: names are strings, metrics are numbers.',
  'bad-metric':
    'Metrics are numeric time series. Params are strings. If it is not a number, it is probably a param or a tag.',
  'no-model':
    'Nothing is loaded yet. load_model("models:/name/Production") first, then predict.',
  'no-signature':
    'Production models declare an input/output contract. Register with a signature before load/predict — unsigned models are a common silent-scoring bug.',
  'bad-uri':
    'Model URIs look like models:/<name>/<stage> or models:/<name>@alias or runs:/<run_id>/model.',
  'missing-version':
    'That version number is not on the model. List versions with `mlflow models get <name>`.',
  'unknown-fluent':
    'This simulator covers the common fluent/client calls. Use the CLI form (mlflow runs log …) or help.',
  'already-exists':
    'Names are unique in a tracking server. Reuse with set_experiment or pick a new name.',
  'not-found':
    'Reference does not resolve. Check id vs name vs alias — experiments use names, runs use hex ids, models use name@alias.',
};

export function explain(code: string): string {
  return REASONS[code] ?? REASONS['unknown-fluent']!;
}
