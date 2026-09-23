/**
 * Level goals must be solvable by their declared solutionCommand.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { executeCommand } from '../src/engine/commands';
import { levels } from '../src/levels';
import type { World } from '../src/engine/types';
import { cloneWorld } from '../src/engine/world';

function applySolution(start: World, solutionCommand: string): World {
  let w = cloneWorld(start);
  // Split on `;` but keep quoted segments intact.
  const segments: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (const ch of solutionCommand) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ';') {
      if (current.trim()) segments.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) segments.push(current.trim());

  for (const segment of segments) {
    const result = executeCommand(segment, w);
    assert.equal(result.ok, true, 'solution segment failed: ' + segment);
    if (result.ok) w = result.world;
  }
  return w;
}

describe('level solutions', () => {
  for (const level of levels) {
    it(level.id + ' is solvable by its solutionCommand', () => {
      const finalWorld = applySolution(level.startWorld, level.solutionCommand);
      assert.equal(
        level.goal(finalWorld),
        true,
        'goal not met for ' + level.id,
      );
    });
  }
});
