/**
 * Undo / reset history for the game session.
 *
 * Snapshots are deep clones taken before each successful command, so `undo`
 * restores the previous World exactly. `reset` reloads the level (or empty
 * sandbox) start world.
 */

import type { World } from './types';
import { cloneWorld } from './world';

export interface History {
  /** Previous worlds, oldest first. */
  past: World[];
  /** Cap to avoid unbounded growth in sandbox. */
  limit: number;
}

export function createHistory(limit = 100): History {
  return { past: [], limit };
}

/** Push a snapshot of `world` (pre-command). */
export function pushHistory(history: History, world: World): History {
  const past = [...history.past, cloneWorld(world)];
  if (past.length > history.limit) past.shift();
  return { past, limit: history.limit };
}

/**
 * Pop the last snapshot.
 * @returns null if empty, else [restoredWorld, restOfHistory]
 */
export function popHistory(history: History): { world: World; history: History } | null {
  if (history.past.length === 0) return null;
  const past = history.past.slice(0, -1);
  const world = cloneWorld(history.past[history.past.length - 1]);
  return { world, history: { past, limit: history.limit } };
}

export function clearHistory(history: History): History {
  return { past: [], limit: history.limit };
}

/**
 * Count "golf" commands in a solution string, mirroring `;` chaining.
 * Empty segments do not count.
 */
export function countCommands(solutionCommand: string): number {
  return solutionCommand
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean).length;
}
