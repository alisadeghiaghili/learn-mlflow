#!/usr/bin/env python
"""Verify LearnMLflow curriculum commands against a real MLflow file store.

Runs a compact release path: experiment -> run -> params/metrics/tags ->
artifact -> sklearn model -> registry -> load -> predict -> evaluate ->
search_runs. Exits non-zero on any failure.

Args:
    None

Returns:
    None

Raises:
    AssertionError: when a Tracking / Registry / Models contract breaks.
    Exception: re-raised from MLflow after a context message.

Examples:
    python verify_curriculum.py
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path


def main() -> int:
    """Execute the curriculum release path on real MLflow.

    Args:
        None

    Returns:
        int: process exit code (0 on success).

    Raises:
        AssertionError: contract violation in Tracking or Registry.
    """
    import mlflow
    import mlflow.sklearn
    import numpy as np
    import pandas as pd
    from mlflow import MlflowClient
    from mlflow.models import infer_signature
    from sklearn.datasets import load_iris
    from sklearn.ensemble import RandomForestClassifier

    workdir = Path(tempfile.mkdtemp(prefix="learn-mlflow-lab-"))
    tracking_uri = workdir.joinpath("mlruns").as_uri()
    mlflow.set_tracking_uri(tracking_uri)
    mlflow.set_registry_uri(tracking_uri)
    print(f"tracking_uri={tracking_uri}")

    # --- Tracking ---
    exp = mlflow.set_experiment("lab-iris")
    exp_id = exp.experiment_id
    with mlflow.start_run(run_name="rf-baseline") as run:
        params = {"model": "rf", "max_depth": "8", "lr": "0.01"}
        for key, value in params.items():
            mlflow.log_param(key, value)
        for step, loss in enumerate([0.5, 0.35, 0.22, 0.15]):
            mlflow.log_metric("loss", loss, step=step)
        mlflow.log_metric("acc", 0.95)
        mlflow.set_tag("stage", "candidate")
        mlflow.set_tag("compare", "yes")

        x, y = load_iris(return_X_y=True, as_frame=True)
        clf = RandomForestClassifier(max_depth=8, random_state=42)
        clf.fit(x, y)
        preds = clf.predict(x)
        signature = infer_signature(x, preds)
        mlflow.sklearn.log_model(clf, artifact_path="model", signature=signature)
        report = workdir.joinpath("report.txt")
        report.write_text("lab evaluation evidence\n", encoding="utf-8")
        mlflow.log_artifact(str(report))

        run_id = run.info.run_id
        acc = clf.score(x, y)
        mlflow.log_metric("train_acc", acc)

    # --- Datasets (optional surface) ---
    with mlflow.start_run(run_name="with-data") as run:
        try:
            from mlflow.data import from_pandas

            dataset = from_pandas(pd.DataFrame(x), source="iris")
            mlflow.log_input(dataset)
        except Exception as exc:  # pragma: no cover - older/newer API
            print(f"skip log_input: {exc}")
        mlflow.log_metric("rmse", 1.2)
        data_run_id = run.info.run_id

    # --- Evaluate ---
    with mlflow.start_run(run_name="evaluate") as run:
        eval_df = x.copy()
        eval_df["target"] = y
        feature_cols = list(x.columns)

        def _predict(frame):
            return clf.predict(frame[feature_cols])

        result = mlflow.evaluate(
            _predict,
            eval_df,
            targets="target",
            model_type="classifier",
        )
        metrics = result.metrics
        assert len(metrics) > 0, metrics
        print("evaluate metrics:", {k: metrics[k] for k in list(metrics)[:6]})
        eval_run_id = run.info.run_id

    # --- Registry ---
    model_name = "lab-iris-clf"
    model_uri = f"runs:/{run_id}/model"
    registered = mlflow.register_model(model_uri, model_name)
    client = MlflowClient()
    client.transition_model_version_stage(
        name=model_name, version=registered.version, stage="Staging"
    )
    # Modern registry prefers aliases; stages remain for curriculum alignment.
    client.set_registered_model_alias(model_name, "champion", registered.version)
    client.transition_model_version_stage(
        name=model_name, version=registered.version, stage="Production"
    )
    client.update_model_version(
        name=model_name,
        version=registered.version,
        description="lab release: rf depth 8, validated on iris",
    )

    # --- Load + predict (signature exists) ---
    loaded = mlflow.pyfunc.load_model(f"models:/{model_name}/Production")
    sample = x.iloc[:3]
    out = loaded.predict(sample)
    assert len(out) == 3, out

    # --- Search ---
    runs = client.search_runs(
        experiment_ids=[exp_id],
        filter_string="metrics.acc > 0.5",
        max_results=10,
    )
    assert len(runs) >= 1, f"search_runs returned nothing for exp {exp_id}"
    print(f"search_runs matched {len(runs)} run(s)")
    print(f"ids: tracking={run_id} data={data_run_id} eval={eval_run_id}")
    print("LAB OK")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"LAB FAIL: {exc}", file=sys.stderr)
        raise
