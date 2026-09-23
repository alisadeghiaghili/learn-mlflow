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
