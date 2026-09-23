/**
 * Level catalog.
 */

import type { Level, Sequence } from '../engine/types';
import { sequences } from './sequences';
import { introLevels } from './intro';
import { registryLevels } from './registry';

export const levels: Level[] = [...introLevels, ...registryLevels];

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

/** Next unsolved level after `id`, in catalog order. */
export function nextLevel(id: string, solved: Set<string>): Level | null {
  const idx = levels.findIndex((l) => l.id === id);
  for (let i = idx + 1; i < levels.length; i += 1) {
    if (!solved.has(levels[i].id)) return levels[i];
  }
  return null;
}
