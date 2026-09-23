/**
 * Share payload and curriculum summary tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildShareTargets,
  shareMessageLinkedIn,
  shareMessageX,
} from '../src/ui/share';
import {
  summarizeCurriculum,
  resumeLine,
  type LevelProgress,
} from '../src/ui/progress';
import { levels } from '../src/levels';

describe('curriculum summary', () => {
  it('marks solved levels as learned', () => {
    const progress: Record<string, LevelProgress> = {
      [levels[0]!.id]: { solved: true, bestCommands: 1 },
    };
    const summary = summarizeCurriculum(progress);
    assert.equal(summary.solvedCount, 1);
    assert.equal(summary.total, levels.length);
    assert.equal(summary.learned[0]?.id, levels[0]!.id);
    assert.ok(summary.learned[0]?.learning?.length);
    assert.ok(summary.next);
    assert.equal(summary.next.id, levels[1]!.id);
  });

  it('resume line mentions progress', () => {
    const summary = summarizeCurriculum({
      [levels[0]!.id]: { solved: true },
    });
    const line = resumeLine(summary);
    assert.match(line, /1\//);
    assert.match(line, /Welcome back/);
  });
});

describe('share messages', () => {
  const progress: Record<string, LevelProgress> = {
    [levels[0]!.id]: { solved: true, bestCommands: 1 },
    [levels[1]!.id]: { solved: true, bestCommands: 2 },
  };
  const curriculum = summarizeCurriculum(progress);
  const ctx = {
    levelName: levels[1]!.name,
    levelId: levels[1]!.id,
    commands: 2,
    par: 1,
    curriculum,
  };

  it('LinkedIn post lists learned levels and the live URL', () => {
    const text = shareMessageLinkedIn(ctx);
    assert.match(text, /LearnMLflow/);
    assert.match(text, /What I have learned so far/);
    assert.match(text, /alisadeghiaghili\.github\.io\/learn-mlflow/);
    assert.match(text, new RegExp(levels[0]!.name));
  });

  it('X post stays short and includes the URL', () => {
    const text = shareMessageX(ctx);
    assert.ok(text.length <= 280);
    assert.match(text, /learn-mlflow/);
  });

  it('builds LinkedIn, X, and Facebook targets', () => {
    const targets = buildShareTargets(ctx);
    assert.match(targets.linkedin, /linkedin\.com/);
    assert.match(targets.x, /twitter\.com\/intent\/tweet/);
    assert.match(targets.facebook, /facebook\.com\/sharer/);
    assert.ok(targets.learnedLines.length >= 2);
  });
});
