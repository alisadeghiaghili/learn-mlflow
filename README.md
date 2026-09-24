# LearnMLflow

Interactive MLflow visualization, sandbox, and tutorial game.

**Live:** https://alisadeghiaghili.github.io/learn-mlflow/

Type `mlflow …` commands into a terminal. A live dashboard updates Tracking
(experiments, runs, params, metrics, tags, artifacts) and Model Registry
(versions + stages). Levels teach the workflow with goal predicates and
command-golf scoring.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine + goals unit tests
npm run build      # typecheck + production bundle in dist/
```

## Game commands

| Command | Meaning |
|---------|---------|
| `levels` | Level browser |
| `hint` / `solution` | Help for the current level |
| `undo` / `reset` | Step back / restart |
| `sandbox` | Free play |
| `help` | Command reference |

## MLflow command subset

```text
mlflow experiments create -n <name>
mlflow experiments set <id|name>
mlflow experiments list

mlflow runs create [--name <name>]
mlflow runs set <id|latest>
mlflow runs list
mlflow runs log -p key=value
mlflow runs log -m key=value
mlflow runs tag key=value
mlflow runs log-artifact <name>
mlflow runs delete <id>
mlflow runs finish [id] [FINISHED|FAILED|KILLED]

mlflow models register -n <name> [--run <id>]
mlflow models list | get <name>
mlflow models transition -n <name> --version <n> --stage <None|Staging|Production|Archived>
mlflow models archive -n <name> --version <n>
```

Chain commands with `;` (golf counts each segment).

## Curriculum

Eight sequences plus fidelity/capstone packs:

| Sequence | What you learn |
|----------|----------------|
| Introduction | Experiments, runs, params, metrics, tags, artifacts, comparison |
| Deep Tracking | Metric steps, nested runs, source/env, search, experiment tags, compare table |
| Artifacts, Data & Evaluation | Artifact store, datasets, `mlflow.evaluate`, builtin classification, promotion gates |
| Model Registry | Register, stages, versions, retirement |
| Registry Production | Flavors, signatures, aliases, load URIs, approval gate |
| Models & Serving | Load, predict (signature-gated), serve HTTP, invoke, rollback drill |
| Autolog & Ops | autolog, system metrics, fluent vs client, `mlflow run` projects |
| GenAI Tracking | Prompts, traces, scorers, LLM evaluation |
| Capstones | Release runbook end-to-end |

Also taught: fluent Python API (`mlflow.start_run`, `log_metric`, …), `MlflowClient`, explain-why errors, metric sparklines/history charts, comparison tables, payload contracts, docker packaging, OpenAI autolog, Recipes stages, and **export of any level solution as real Python or a shell script** for a live MLflow server.

## Fidelity (updated)

The web app is a **high-fidelity simulator** of MLflow Tracking / Registry / Models / Evaluate / GenAI: same vocabulary, commands, state machine, and runbooks. It does not host a tracking server in the browser.

**Closing the last mile for real:** [`lab/`](./lab) runs the curriculum contract against a **real** `mlflow` package (file store). CI job *Lab verify (real MLflow)* executes `lab/verify_curriculum.py` and `lab/serve_smoke.py` on every change to that lab. After the capstones, run the lab locally once — that is the transfer test.

| Claim | Score |
|-------|:-----:|
| Operate MLflow workflows (this app + export scripts) | **9.5–9.8** |
| Transfer to a real `mlflow` install (lab verified) | **9.0** |
| Own a production tracking server / artifact store | needs your infra |

## Architecture

```text
src/engine/   pure state machine (types, world, commands, goals, history)
src/levels/   declarative levels (intro Tracking + Model Registry)
src/ui/       terminal, viz, dialogs, progress
tests/        node:test unit tests
```

See [DESIGN.md](./DESIGN.md) for the visual system and product model.

## License

Apache-2.0
