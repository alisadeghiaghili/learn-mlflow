/**
 * localStorage progress for solved levels and golf scores.
 */

const KEY_SOLVED = 'learnmlflow.solved';
const KEY_GOLF = 'learnmlflow.golf';

export interface Progress {
  solved: Set<string>;
  golf: Map<string, number>;
}

export function loadProgress(): Progress {
  const solved = new Set<string>();
  const golf = new Map<string, number>();
  try {
    const rawS = localStorage.getItem(KEY_SOLVED);
    if (rawS) {
      for (const id of JSON.parse(rawS) as string[]) solved.add(id);
    }
    const rawG = localStorage.getItem(KEY_GOLF);
    if (rawG) {
      for (const [k, v] of Object.entries(JSON.parse(rawG) as Record<string, number>)) {
        golf.set(k, v);
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return { solved, golf };
}

export function saveSolved(solved: Set<string>): void {
  try {
    localStorage.setItem(KEY_SOLVED, JSON.stringify([...solved]));
  } catch {
    // quota / private mode
  }
}

export function saveGolf(golf: Map<string, number>): void {
  try {
    localStorage.setItem(KEY_GOLF, JSON.stringify(Object.fromEntries(golf)));
  } catch {
    // ignore
  }
}
