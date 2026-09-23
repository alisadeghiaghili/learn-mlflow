/**
 * Game shell: engine + terminal + viz + celebrate + progress.
 */

import type { Level, World } from '../engine/types';
import { executeCommand } from '../engine/commands';
import {
  createHistory,
  popHistory,
  pushHistory,
  clearHistory,
  type History,
} from '../engine/history';
import {
  TOK_CLEAR,
  TOK_LEVELS,
  TOK_HINT,
  TOK_SOLUTION,
  TOK_UNDO,
  TOK_RESET,
  TOK_SANDBOX,
} from '../engine/tokens';
import { cloneWorld, createEmptyWorld, sandboxWorld } from './worldBridge';
import { levelsForSequence, sequences } from '../levels';
import { createTerminal, type TerminalHandle } from './terminal';
import { renderViz, type VizTab } from './viz';
import {
  closeModal,
  showHelp,
  showHint,
  showLevelDialog,
  showLevelsBrowser,
  showSolution,
} from './dialogs';
import { showCelebrate } from './celebrate';
import {
  loadProgress,
  resumeLine,
  saveProgress,
  summarizeCurriculum,
  type LevelProgress,
} from './progress';

export interface GameShell {
  start: () => void;
}

export function createGame(root: HTMLElement): GameShell {
  let progress = loadProgress();
  let world: World = createEmptyWorld();
  let startWorld: World = createEmptyWorld();
  let history: History = createHistory();
  let currentLevel: Level | null = null;
  let mode: 'sandbox' | 'level' = 'sandbox';
  let vizTab: VizTab = 'tracking';
  let commandCount = 0;
  let won = false;
  let terminal!: TerminalHandle;
  let vizRoot!: HTMLElement;
  let metaEl!: HTMLElement;

  function persistSolved(levelId: string, used: number): void {
    const prev: LevelProgress = progress[levelId] ?? { solved: false };
    const best =
      prev.bestCommands === undefined
        ? used
        : Math.min(prev.bestCommands, used);
    progress = {
      ...progress,
      [levelId]: { solved: true, bestCommands: best },
    };
    saveProgress(progress);
  }

  function goalStepsFor(level: Level | null): string[] {
    if (!level) return [];
    return level.goalSteps ?? [level.about];
  }

  function renderAll(): void {
    renderViz(vizRoot, world, vizTab, {
      goalSteps: goalStepsFor(currentLevel),
      goalDone: currentLevel ? currentLevel.goal(world) : false,
      onSetExperiment: (id) => {
        const result = executeCommand('mlflow experiments set ' + id, world);
        if (result.ok) {
          world = result.world;
          renderAll();
        }
      },
      onSetRun: (id) => {
        const result = executeCommand('mlflow runs set ' + id, world);
        if (result.ok) {
          world = result.world;
          renderAll();
        }
      },
    });

    const levelLabel = currentLevel ? currentLevel.name : 'Sandbox';
    const seq = currentLevel
      ? (sequences.find((s) => s.id === currentLevel!.sequenceId)?.displayName ??
        '')
      : 'free play';
    metaEl.textContent =
      levelLabel + '  |  ' + seq + '  |  cmds ' + String(commandCount);

    if (currentLevel) {
      terminal.setExtraCompletions([currentLevel.solutionCommand.split(';')[0] ?? '']);
    }
  }

  function openLevels(): void {
    const bySeq = new Map<string, Level[]>();
    for (const seq of sequences) {
      bySeq.set(seq.id, levelsForSequence(seq.id));
    }
    const solved = new Set(
      Object.entries(progress)
        .filter(([, p]) => p.solved)
        .map(([id]) => id),
    );
    const golf = new Map<string, number>();
    for (const [id, p] of Object.entries(progress)) {
      if (p.bestCommands !== undefined) golf.set(id, p.bestCommands);
    }
    showLevelsBrowser(sequences, bySeq, solved, golf, (level) => loadLevel(level));
  }

  function handleMeta(segment: string): 'handled' | 'clear' | 'command' {
    const lower = segment.toLowerCase();
    if (lower === 'clear' || lower === 'cls') return 'clear';
    if (lower === 'undo') {
      const popped = popHistory(history);
      if (!popped) {
        terminal.log('out', 'Nothing to undo.');
        return 'handled';
      }
      world = popped.world;
      history = popped.history;
      if (commandCount > 0 && mode === 'level' && !won) commandCount -= 1;
      terminal.log('sys', 'Undid last command.');
      renderAll();
      return 'handled';
    }
    if (lower === 'reset') {
      world = cloneWorld(startWorld);
      history = clearHistory(history);
      commandCount = 0;
      won = false;
      terminal.log('sys', mode === 'level' ? 'Level reset.' : 'Sandbox reset.');
      renderAll();
      return 'handled';
    }
    if (lower === 'sandbox') {
      startSandbox();
      return 'handled';
    }
    if (lower === 'help' || lower === '?') {
      showHelp();
      return 'handled';
    }
    return 'command';
  }

  function checkWin(): void {
    if (won || mode !== 'level' || !currentLevel) return;
    if (!currentLevel.goal(world)) return;
    won = true;
    const level = currentLevel;
    persistSolved(level.id, commandCount);
    terminal.log('sys', 'Level complete.');
    renderAll();

    const curriculum = summarizeCurriculum(progress);
    showCelebrate({
      level,
      used: commandCount,
      curriculum,
      onNext: (nxt) => loadLevel(nxt),
      onStay: () => {
        terminal.focus();
      },
      onBrowse: () => openLevels(),
    });
  }

  function runLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    const segments = trimmed
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const segment of segments) {
      terminal.log('cmd', segment);
      const meta = handleMeta(segment);
      if (meta === 'handled') {
        terminal.focus();
        continue;
      }
      if (meta === 'clear') {
        terminal.clear();
        terminal.focus();
        continue;
      }

      if (currentLevel?.disabledCommands?.some((d) => segment.startsWith(d))) {
        terminal.log('err', 'That command is disabled in this level.');
        terminal.focus();
        continue;
      }

      history = pushHistory(history, world);
      const result = executeCommand(segment, world);
      if (!result.ok) {
        history = popHistory(history)?.history ?? history;
        terminal.log('err', result.error);
        terminal.focus();
        continue;
      }

      world = result.world;
      if (!won && mode === 'level') commandCount += 1;

      for (const out of result.lines) {
        if (out === TOK_CLEAR) {
          terminal.clear();
          continue;
        }
        if (out === TOK_LEVELS) {
          openLevels();
          continue;
        }
        if (out === TOK_HINT) {
          if (currentLevel) showHint(currentLevel);
          else terminal.log('out', 'No active level. Type levels first.');
          continue;
        }
        if (out === TOK_SOLUTION) {
          if (currentLevel) showSolution(currentLevel);
          else terminal.log('out', 'No active level.');
          continue;
        }
        if (out === TOK_UNDO || out === TOK_RESET || out === TOK_SANDBOX) {
          continue;
        }
        terminal.log('out', out);
      }

      renderAll();
      checkWin();
      terminal.focus();
    }
  }

  function loadLevel(level: Level): void {
    currentLevel = level;
    mode = 'level';
    won = false;
    commandCount = 0;
    startWorld = cloneWorld(level.startWorld);
    world = cloneWorld(level.startWorld);
    history = clearHistory(createHistory());
    vizTab = 'tracking';
    renderAll();
    terminal.log('sys', 'Level: ' + level.name);
    terminal.setHint(level.solutionCommand.split(';')[0]?.trim() ?? null);
    showLevelDialog(level, {
      onDemo: (cmd) => {
        for (const segment of cmd
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)) {
          terminal.log('cmd', segment, 'demo >');
          const result = executeCommand(segment, world);
          if (result.ok) {
            world = result.world;
            for (const out of result.lines) terminal.log('out', out);
          } else {
            terminal.log('err', result.error);
          }
        }
        renderAll();
      },
      onClose: () => {
        terminal.focus();
        checkWin();
      },
    });
  }

  function startSandbox(): void {
    currentLevel = null;
    mode = 'sandbox';
    won = false;
    commandCount = 0;
    startWorld = sandboxWorld();
    world = cloneWorld(startWorld);
    history = clearHistory(createHistory());
    vizTab = 'tracking';
    closeModal();
    terminal.setHint(null);
    terminal.log(
      'sys',
      'Sandbox mode. Type levels for tutorials, help for commands.',
    );
    renderAll();
  }

  return {
    start() {
      root.innerHTML = '';
      root.classList.add('app');

      const header = document.createElement('header');
      header.className = 'header';
      const brand = document.createElement('div');
      brand.className = 'brand';
      const brandA = document.createElement('span');
      brandA.textContent = 'Learn';
      const brandB = document.createElement('span');
      brandB.textContent = 'MLflow';
      brandB.style.color = 'var(--accent)';
      brand.append(brandA, brandB);
      metaEl = document.createElement('div');
      metaEl.className = 'header-meta';

      const actions = document.createElement('div');
      actions.className = 'header-actions';
      const sandboxBtn = document.createElement('button');
      sandboxBtn.className = 'ghost';
      sandboxBtn.textContent = 'Sandbox';
      sandboxBtn.onclick = () => {
        terminal.log('cmd', 'sandbox');
        startSandbox();
        terminal.focus();
      };
      const levelsBtn = document.createElement('button');
      levelsBtn.textContent = 'Levels';
      levelsBtn.onclick = () => openLevels();
      const helpBtn = document.createElement('button');
      helpBtn.className = 'ghost';
      helpBtn.textContent = 'Help';
      helpBtn.onclick = () => showHelp();
      actions.append(sandboxBtn, levelsBtn, helpBtn);
      header.append(brand, metaEl, actions);

      const workspace = document.createElement('div');
      workspace.className = 'workspace';
      const termHost = document.createElement('div');
      vizRoot = document.createElement('div');
      vizRoot.className = 'viz';
      vizRoot.addEventListener('viz-tab', ((ev: CustomEvent<VizTab>) => {
        vizTab = ev.detail;
        renderAll();
      }) as EventListener);
      workspace.append(termHost, vizRoot);

      const footer = document.createElement('footer');
      footer.className = 'footer-bar';
      for (const label of ['levels', 'hint', 'undo', 'reset', 'sandbox', 'help']) {
        const span = document.createElement('span');
        const kbd = document.createElement('kbd');
        kbd.textContent = label;
        span.append(kbd);
        footer.append(span);
      }

      root.append(header, workspace, footer);
      terminal = createTerminal(termHost, runLine);

      terminal.log(
        'sys',
        'LearnMLflow - interactive MLflow Tracking and Registry tutorial',
      );
      const summary = summarizeCurriculum(progress);
      if (summary.solvedCount) {
        for (const line of resumeLine(summary).split('\n')) {
          terminal.log('meta', line);
        }
      } else {
        terminal.log('out', 'Type levels to learn, or help for commands.');
      }
      startSandbox();
      terminal.focus();
    },
  };
}
