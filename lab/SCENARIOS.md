# Lab suite — real MLflow scenarios beyond the happy path

| File | What it proves |
|------|----------------|
| `verify_curriculum.py` | Tracking + Registry + load + evaluate + search happy path |
| `serve_smoke.py` | sklearn log_model → pyfunc predict |
| `suite_scenarios.py` | alias rollback, regression eval, unsigned gate, search filter |

```bash
pip install -r requirements.txt
python verify_curriculum.py
python serve_smoke.py
python suite_scenarios.py
```

CI runs all three (see `.github/workflows/lab.yml`).
