#!/usr/bin/env python
"""In-process scoring smoke: log_model -> load_model -> pyfunc predict.

Complements verify_curriculum.py by focusing on the Models contract
(flavor + signature + predict) without a network server.

Args:
    None

Returns:
    int: exit code

Raises:
    AssertionError: when predict shape or signature behavior is wrong.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path


def main() -> int:
    """Run a Models smoke path on real MLflow.

    Args:
        None

    Returns:
        int: process exit code.

    Raises:
        AssertionError: predict contract violation.
    """
    import mlflow
    import mlflow.sklearn
    import numpy as np
    from mlflow.models import infer_signature
    from sklearn.linear_model import LogisticRegression

    workdir = Path(tempfile.mkdtemp(prefix="learn-mlflow-serve-"))
    uri = workdir.joinpath("mlruns").as_uri()
    mlflow.set_tracking_uri(uri)
    mlflow.set_registry_uri(uri)
    mlflow.set_experiment("serve-smoke")

    x = np.array([[0.0, 0.0], [1.0, 1.0], [1.0, 0.0], [0.0, 1.0]])
    y = np.array([0, 1, 1, 0])
    model = LogisticRegression().fit(x, y)
    signature = infer_signature(x, model.predict(x))

    with mlflow.start_run(run_name="log") as run:
        mlflow.sklearn.log_model(model, "model", signature=signature)
        run_id = run.info.run_id

    loaded = mlflow.pyfunc.load_model(f"runs:/{run_id}/model")
    preds = loaded.predict(x[:2])
    assert len(preds) == 2
    print("predictions:", preds)
    print("SERVE SMOKE OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
