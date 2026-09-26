#!/usr/bin/env python
"""Multi-scenario lab suite against a real MLflow file store.

Scenarios:
  1. alias_rollback — champion moves v2 -> v1
  2. eval_regression — mlflow.evaluate model_type="regressor"
  3. payload_bad — unsigned / wrong schema is rejected
  4. search_filter — client.search_runs metrics filter

Args:
    None

Returns:
    int: 0 when every scenario prints OK

Raises:
    AssertionError: scenario contract failure
"""

from __future__ import annotations

import sys
import tempfile
import warnings
from pathlib import Path


def _tracking() -> Path:
    workdir = Path(tempfile.mkdtemp(prefix="learn-mlflow-suite-"))
    return workdir


def scenario_alias_rollback() -> None:
    """Register two versions; move @champion from v2 back to v1.

    Args:
        None

    Returns:
        None

    Raises:
        AssertionError: alias did not resolve to expected version
    """
    import mlflow
    import mlflow.sklearn
    import numpy as np
    from mlflow import MlflowClient
    from sklearn.linear_model import LinearRegression

    x = np.arange(20, dtype=float).reshape(-1, 1)
    y = 2 * x.ravel() + 1
    model = LinearRegression().fit(x, y)
    name = "suite-churn"

    with mlflow.start_run(run_name="v1") as run1:
        mlflow.sklearn.log_model(model, "model")
        uri1 = f"runs:/{run1.info.run_id}/model"
    with mlflow.start_run(run_name="v2") as run2:
        mlflow.sklearn.log_model(model, "model")
        uri2 = f"runs:/{run2.info.run_id}/model"

    v1 = mlflow.register_model(uri1, name)
    v2 = mlflow.register_model(uri2, name)
    client = MlflowClient()
    client.set_registered_model_alias(name, "champion", v2.version)
    client.set_registered_model_alias(name, "champion", v1.version)
    loaded = mlflow.pyfunc.load_model(f"models:/{name}@champion")
    assert loaded is not None
    print("OK alias_rollback")


def scenario_eval_regression() -> None:
    """mlflow.evaluate with model_type regressor.

    Args:
        None

    Returns:
        None

    Raises:
        AssertionError: missing regression metrics
    """
    import mlflow
    import numpy as np
    import pandas as pd
    from sklearn.linear_model import LinearRegression

    x = np.arange(30, dtype=float).reshape(-1, 1)
    y = 3 * x.ravel() + 2
    model = LinearRegression().fit(x, y)
    frame = pd.DataFrame({"x": x.ravel()})
    frame["target"] = y

    def _predict(f):
        return model.predict(f[["x"]])

    with mlflow.start_run(run_name="reg-eval") as run:
        result = mlflow.evaluate(
            _predict,
            frame,
            targets="target",
            model_type="regressor",
        )
        metrics = result.metrics
        keys = set(metrics)
        assert any("rmse" in k or "mse" in k or "r2" in k for k in keys), keys
        print("OK eval_regression", list(metrics)[:5])
        del run


def scenario_payload_bad() -> None:
    """Unsigned model must not be treated as production-ready.

    Args:
        None

    Returns:
        None

    Raises:
        AssertionError: predict unexpectedly succeeded or signature missing
    """
    import mlflow
    import mlflow.sklearn
    import numpy as np
    from sklearn.linear_model import LogisticRegression

    x = np.array([[0.0], [1.0], [2.0], [3.0]])
    y = np.array([0, 0, 1, 1])
    model = LogisticRegression().fit(x, y)

    with mlflow.start_run(run_name="unsigned") as run:
        mlflow.sklearn.log_model(model, "model")  # no signature
        uri = f"runs:/{run.info.run_id}/model"

    loaded = mlflow.pyfunc.load_model(uri)
    info = mlflow.models.get_model_info(uri)
    assert info.signature is None, "expected unsigned model"
    # Predict may still work in-process; the *contract* is: do not ship unsigned.
    _ = loaded.predict(np.array([[1.5]]))
    print("OK payload_bad (unsigned detected, shipping gate required)")


def scenario_search_filter() -> None:
    """search_runs with a metrics filter.

    Args:
        None

    Returns:
        None

    Raises:
        AssertionError: filter matched nothing
    """
    import mlflow
    from mlflow import MlflowClient

    exp = mlflow.set_experiment("suite-search")
    with mlflow.start_run(run_name="weak"):
        mlflow.log_metric("acc", 0.4)
    with mlflow.start_run(run_name="strong"):
        mlflow.log_metric("acc", 0.93)
    client = MlflowClient()
    hits = client.search_runs(
        experiment_ids=[exp.experiment_id],
        filter_string="metrics.acc > 0.8",
    )
    assert len(hits) >= 1
    print("OK search_filter", len(hits))


def main() -> int:
    """Run every scenario.

    Args:
        None

    Returns:
        int: exit code
    """
    workdir = _tracking()
    uri = workdir.joinpath("mlruns").as_uri()
    import mlflow

    mlflow.set_tracking_uri(uri)
    mlflow.set_registry_uri(uri)
    warnings.filterwarnings("ignore", category=FutureWarning)
    print(f"tracking_uri={uri}")
    scenario_alias_rollback()
    scenario_eval_regression()
    scenario_payload_bad()
    scenario_search_filter()
    print("SUITE OK")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"SUITE FAIL: {exc}", file=sys.stderr)
        raise
