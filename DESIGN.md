# LearnMLflow — Design

## Product

Interactive MLflow sandbox + tutorial game, modeled on [learnGitBranching](https://github.com/pcottle/learnGitBranching).
Learner types `mlflow …` commands into a terminal; a live dashboard updates as Tracking / Model Registry state changes. Levels use goal predicates (not exact tree equality — MLflow state is richer than a commit graph). Sandbox mode is free-play with `undo` / `reset`. Command golf tracks how many commands it takes to clear a level.

## Style anchor

A dark **experiment cockpit** — half MLflow UI, half LGB terminal game.
Feels like Grafana’s density + LGB’s toy-visualization energy, not like a SaaS marketing site.

## Palette

| Role | Hex | Use |
|------|-----|-----|
| Background | `#0B1220` | App canvas |
| Surface | `#121A2A` | Panels, terminal body |
| Surface raised | `#1A2438` | Cards, dialog |
| Ink | `#E8EEF7` | Primary text |
| Muted | `#8B9BB4` | Secondary labels |
| Accent | `#2DD4BF` | Primary CTA, active run, prompt |
| Accent 2 | `#F59E0B` | Metrics, Production stage |
| Danger | `#F87171` | Errors, Archived |
| Info | `#60A5FA` | Staging, params |
| Success | `#34D399` | Win / logged OK |

Stage colors: None `#8B9BB4` · Staging `#60A5FA` · Production `#F59E0B` · Archived `#F87171`.

## Typography

- **Display / UI**: `Inter, "Segoe UI", system-ui, sans-serif`
- **Terminal / IDs / metrics**: `"JetBrains Mono", "Fira Code", ui-monospace, monospace`
- Scale: title 22/600, panel 13/600, body 13/400, code 12/500, caption 11/400
- High contrast between mono identifiers and sans prose.

## Layout

Split workspace (LGB pattern):

```
┌─────────────────────────────────────────────────────┐
│ header: LearnMLflow · sequence · golf · levels btn   │
├──────────────────┬──────────────────────────────────┤
│  terminal (38%)  │  live viz (62%)                  │
│  scrollback +    │  ┌ experiments ┬ runs ┬ registry │
│  prompt          │  │ sidebar     │ cards│ kanban   │
│                  │  └─────────────┴──────┴──────────│
└──────────────────┴──────────────────────────────────┘
```

- Spacing rhythm: 4 / 8 / 12 / 16 / 24
- Dense but scannable; max ~3 primary panels visible
- Mobile: stack terminal above viz

## Signature moments

1. **Run birth** — `mlflow runs create` pops a run card with a short entrance; metrics log as animated sparkline ticks.
2. **Stage slide** — `mlflow models transition … --stage Production` slides the version card across the kanban board (None → Staging → Production → Archived) with a trail.

## Engine model (simplified, faithful vocabulary)

```ts
World {
  experiments: Experiment[]   // id, name, runs
  activeExperimentId: string | null
  activeRunId: string | null
  models: RegisteredModel[]   // name, versions[] (runId, stage, createdAt)
  history: WorldSnapshot[]    // for undo
}
```

Commands (subset of real `mlflow` CLI):

```
mlflow experiments create|set|list
mlflow runs create|set|list|log|tag|log-artifact|delete
mlflow models register|list|get|transition|archive|versions
levels · hint · solution · undo · reset · help · clear
```

## Levels

Sequences (tabs):

1. **intro** — Tracking basics (experiment → run → params/metrics/tags/artifacts)
2. **registry** — Model Registry (register → stages → archive)

Each level:

```ts
{
  id, sequenceId, name, about, hint, solutionCommand,
  startWorld, goal(world): boolean,
  dialog: ModalStep[]   // text + optional demo command
}
```

Win check is a **predicate**, not a tree match. Golf = `userCommandCount` vs `solutionCommand` count.

## Architecture

```
src/
  engine/     pure state machine (types, world, commands, goals, history)
  levels/     declarative level data
  ui/         terminal, viz, dialogs, levels browser
  style/      CSS
tests/        engine + goal unit tests (node:test)
```

Pure engine, no DOM. UI is a thin reactive shell. Tests cover engine + goals only.

## Non-goals (v0)

- Real MLflow backend / REST
- Artifacts content (names only)
- i18n (English first)
- Level builder / gist import
- Model signatures, datasets, prompts/LLM (later sequences)

## Inspired by

`pcottle/learnGitBranching` — split terminal+viz, sandbox-first, levels with dialogs + demos, golf, undo/reset, goal trees.
