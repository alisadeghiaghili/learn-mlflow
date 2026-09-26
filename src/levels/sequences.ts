/**
 * Sequence catalog.
 */

import type { Sequence } from '../engine/types';

export const sequences: Sequence[] = [
  {
    id: 'intro',
    displayName: 'Introduction Sequence',
    about: 'Experiments, runs, params, metrics — Tracking foundations',
    tab: 'main',
  },
  {
    id: 'tracking-deep',
    displayName: 'Deep Tracking',
    about: 'Metric steps, nested runs, source/env, search filters',
    tab: 'main',
  },
  {
    id: 'artifacts-data',
    displayName: 'Artifacts, Data & Evaluation',
    about: 'Artifact store, datasets, mlflow.evaluate',
    tab: 'main',
  },
  {
    id: 'registry',
    displayName: 'Model Registry',
    about: 'Aliases first (@champion), then legacy stages',
    tab: 'registry',
  },
  {
    id: 'registry-deep',
    displayName: 'Registry Production',
    about: 'Flavors, signatures, aliases, load paths',
    tab: 'registry',
  },
  {
    id: 'models-deploy',
    displayName: 'Models & Serving',
    about: 'Load, predict, serve an HTTP endpoint',
    tab: 'models',
  },
  {
    id: 'train-ops',
    displayName: 'Autolog & Ops',
    about: 'autolog, reproducibility pack, ops habits',
    tab: 'ops',
  },
  {
    id: 'genai',
    displayName: 'GenAI Tracking',
    about: 'Prompts, traces, LLM evaluation',
    tab: 'ai',
  },
];
