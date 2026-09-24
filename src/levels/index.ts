/**
 * Level catalog — full curriculum.
 */

import type { Level, Sequence } from '../engine/types';
import { sequences } from './sequences';
import { introLevels } from './intro';
import { trackingDeepLevels } from './trackingDeep';
import { artifactsDataLevels } from './artifactsData';
import { registryLevels } from './registry';
import { registryDeepLevels } from './registryDeep';
import { modelsDeployLevels } from './modelsDeploy';
import { trainOpsLevels } from './trainOps';
import { projectLevels } from './projects';
import { capstoneLevels } from './capstone';
import { genaiLevels } from './genai';

export const levels: Level[] = [
  ...introLevels,
  ...trackingDeepLevels,
  ...artifactsDataLevels,
  ...registryLevels,
  ...registryDeepLevels,
  ...modelsDeployLevels,
  ...trainOpsLevels,
  ...projectLevels,
  ...genaiLevels,
  ...capstoneLevels,
];

export { sequences };

export function getLevel(id: string): Level | null {
  return levels.find((l) => l.id === id) ?? null;
}

export function getSequence(id: string): Sequence | null {
  return sequences.find((s) => s.id === id) ?? null;
}

export function levelsForSequence(sequenceId: string): Level[] {
  return levels.filter((l) => l.sequenceId === sequenceId);
}

export function nextLevel(id: string, solved: Set<string>): Level | null {
  const idx = levels.findIndex((l) => l.id === id);
  for (let i = idx + 1; i < levels.length; i += 1) {
    if (!solved.has(levels[i]!.id)) return levels[i]!;
  }
  return null;
}
