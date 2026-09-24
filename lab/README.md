# LearnMLflow Lab — real MLflow transfer

The web app teaches the **model** of MLflow (Tracking, Registry, Models, Evaluate, GenAI).
This lab proves the exported solutions against a **real** `mlflow` package and file store.

## Quick start

```bash
cd lab
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
python verify_curriculum.py
```

Expected: `LAB OK` and a `mlruns/` directory with real runs.

## What is verified

| Skill | Real API |
|-------|----------|
| Experiment / run | `mlflow.set_experiment`, `start_run`, `end_run` |
| Params / metrics / tags | `log_param`, `log_metric`, `set_tag` |
| Artifacts / model | `log_artifact`, `sklearn.log_model` |
| Registry | `register_model`, `transition_model_version_stage` |
| Load / predict | `mlflow.pyfunc.load_model`, `predict` |
| Evaluate | `mlflow.evaluate` |
| Client | `MlflowClient.search_runs` |

Optional (heavier):

```bash
pip install -r requirements-serve.txt
python serve_smoke.py   # builds a model and hits it in-process
```

## Why this exists

Game fluency ≠ production fluency. Run this lab once after the capstones so the
last mile is not a simulation. Then use `mlflow server --backend-store-uri ./mlruns`
and the UI against the same artifacts.
