/**
 * Terminal: shell-like history, word-by-word Tab completion, ghost suffix.
 * Focus stays in the input after every command.
 */

export type LogKind = 'cmd' | 'out' | 'err' | 'sys' | 'meta' | 'ok';

export interface TerminalHandle {
  log: (kind: LogKind, text: string, prompt?: string) => void;
  clear: () => void;
  focus: () => void;
  setPrompt: (text: string) => void;
  setHint: (command: string | null) => void;
  setExtraCompletions: (commands: string[]) => void;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

const BASE_COMMANDS = [
  'mlflow experiments create -n fraud-detection',
  'mlflow experiments create -n iris',
  'mlflow experiments create -n churn',
  'mlflow experiments set',
  'mlflow experiments list',
  'mlflow runs create',
  'mlflow runs create --name',
  'mlflow runs set',
  'mlflow runs set latest',
  'mlflow runs list',
  'mlflow runs log -p lr=0.01',
  'mlflow runs log -p max_depth=8',
  'mlflow runs log -p model=rf',
  'mlflow runs log -m acc=0.95',
  'mlflow runs log -m f1=0.91',
  'mlflow runs log -m loss=0.12',
  'mlflow runs tag stage=train',
  'mlflow runs tag purpose=baseline',
  'mlflow runs log-artifact model.pkl',
  'mlflow runs log-artifact report.html',
  'mlflow runs delete',
  'mlflow runs finish',
  'mlflow models register -n iris-clf',
  'mlflow models register -n churn',
  'mlflow models list',
  'mlflow models get',
  'mlflow models transition -n iris-clf --version 1 --stage Staging',
  'mlflow models transition -n iris-clf --version 1 --stage Production',
  'mlflow models archive -n iris-clf --version 1',
  'levels',
  'hint',
  'solution',
  'undo',
  'reset',
  'sandbox',
  'clear',
  'help',
];

interface WordState {
  head: string[];
  current: string;
  afterSpace: boolean;
}

function parseLine(value: string): WordState {
  const endsWithSpace = /\s$/.test(value);
  const trimmed = value.replace(/\s+$/, '');
  if (!trimmed) {
    return { head: [], current: '', afterSpace: endsWithSpace };
  }
  const parts = trimmed.split(/\s+/);
  if (endsWithSpace) {
    return { head: parts, current: '', afterSpace: true };
  }
  return {
    head: parts.slice(0, -1),
    current: parts[parts.length - 1]!,
    afterSpace: false,
  };
}

export function createTerminal(
  root: HTMLElement,
  onCommand: (line: string) => void,
): TerminalHandle {
  root.classList.add('terminal');
  root.innerHTML = `
    <div class="terminal-scroll" role="log" aria-live="polite"></div>
    <div class="term-hint" hidden></div>
    <div class="term-input-row">
      <span class="term-prompt">mlflow &gt;</span>
      <div class="term-input-wrap">
        <div class="term-ghost" aria-hidden="true"></div>
        <input class="term-input" autocomplete="off" spellcheck="false"
          placeholder="" aria-label="MLflow command input" />
      </div>
    </div>
  `;

  const scroll = root.querySelector('.terminal-scroll') as HTMLElement;
  const hintEl = root.querySelector('.term-hint') as HTMLElement;
  const wrapEl = root.querySelector('.term-input-wrap') as HTMLElement;
  const ghostEl = root.querySelector('.term-ghost') as HTMLElement;
  const input = root.querySelector('.term-input') as HTMLInputElement;
  const promptEl = root.querySelector('.term-prompt') as HTMLElement;

  const history: string[] = [];
  let historyIdx = -1;
  let draft = '';
  let hint = '';
  let extraCompletions: string[] = [];
  let wordCycle: string[] = [];
  let wordIdx = 0;
  let wordKey = '';
  let measureCtx: CanvasRenderingContext2D | null = null;

  function allCompletions(): string[] {
    return [
      ...new Set<string>([
        ...extraCompletions,
        ...BASE_COMMANDS,
        ...history.slice().reverse(),
      ]),
    ];
  }

  function matchingCommands(head: string[], current: string): string[] {
    const cur = current.toLowerCase();
    return allCompletions().filter((cmd) => {
      const words = cmd.split(/\s+/);
      if (words.length <= head.length) {
        if (head.length && words.length === head.length) {
          return words.every((w, i) => w === head[i]);
        }
        return false;
      }
      for (let i = 0; i < head.length; i += 1) {
        if (words[i] !== head[i]) return false;
      }
      if (!cur) return true;
      return (words[head.length] ?? '').toLowerCase().startsWith(cur);
    });
  }

  function nextWords(head: string[], current: string): string[] {
    const matches = matchingCommands(head, current);
    const words: string[] = [];
    const push = (w: string | undefined) => {
      if (!w) return;
      if (!words.includes(w)) words.push(w);
    };
    if (hint) {
      const hw = hint.split(/\s+/);
      const okHead = head.every((h, i) => hw[i] === h);
      if (okHead) push(hw[head.length]);
    }
    for (const cmd of matches) {
      push(cmd.split(/\s+/)[head.length]);
    }
    return words.filter(
      (w) => !current || w.toLowerCase().startsWith(current.toLowerCase()),
    );
  }

  function measureText(text: string): number {
    if (!measureCtx) {
      measureCtx = document.createElement('canvas').getContext('2d');
    }
    const ctx = measureCtx;
    if (!ctx) return text.length * 7.2;
    const font = getComputedStyle(input).font;
    ctx.font = font || '12px monospace';
    return ctx.measureText(text).width;
  }

  function syncGhost(): void {
    const value = input.value;
    ghostEl.dataset.visible = '0';
    ghostEl.textContent = '';
    wrapEl.classList.remove('has-ghost');
    if (!value) return;

    const { head, current, afterSpace } = parseLine(value);
    const words = nextWords(head, afterSpace ? '' : current);
    const first = words[0];
    if (!first) return;

    if (afterSpace) {
      ghostEl.textContent = first;
      ghostEl.style.left = `${measureText(value)}px`;
      ghostEl.dataset.visible = '1';
      wrapEl.classList.add('has-ghost');
      return;
    }

    if (
      !first.toLowerCase().startsWith(current.toLowerCase()) ||
      first.length <= current.length
    ) {
      return;
    }

    ghostEl.textContent = first.slice(current.length);
    ghostEl.style.left = `${measureText(value)}px`;
    ghostEl.dataset.visible = '1';
    wrapEl.classList.add('has-ghost');
  }

  function applyTab(e: KeyboardEvent): void {
    e.preventDefault();
    const value = input.value;
    const { head, current, afterSpace } = parseLine(value);
    const cycleKey = `${head.join(' ')}|${afterSpace ? '' : current}`;

    if (!value && hint) {
      const firstWord = hint.split(/\s+/)[0]!;
      input.value = firstWord;
      wordCycle = [firstWord];
      wordIdx = 0;
      wordKey = firstWord;
      focus();
      syncGhost();
      return;
    }

    const options = nextWords(head, afterSpace ? '' : current);
    if (!options.length) {
      syncGhost();
      return;
    }

    if (cycleKey !== wordKey || !wordCycle.length) {
      wordKey = cycleKey;
      wordCycle = options;
      wordIdx = 0;
    } else {
      wordIdx = (wordIdx + 1) % wordCycle.length;
    }

    const chosen = wordCycle[wordIdx] ?? options[0]!;
    const headText = head.length ? `${head.join(' ')} ` : '';
    input.value = `${headText}${chosen}`;
    focus();
    syncGhost();

    if (wordCycle.length > 1) {
      const preview = wordCycle.slice(0, 6).join(' · ');
      hintEl.hidden = false;
      hintEl.innerHTML = `Tab word <strong>${wordIdx + 1}/${wordCycle.length}</strong>: <code>${escapeHtml(preview)}</code>${
        wordCycle.length > 6 ? ' …' : ''
      }`;
    } else if (hint) {
      hintEl.hidden = false;
      hintEl.innerHTML = `Next: <code>${escapeHtml(hint)}</code> <span class="par-note">· Tab fills a word</span>`;
    }
  }

  function focus(): void {
    if (document.querySelector('.modal-backdrop')) return;
    input.focus();
    const len = input.value.length;
    try {
      input.setSelectionRange(len, len);
    } catch {
      // ignore
    }
  }

  function renderLine(kind: LogKind, text: string, promptText?: string): HTMLElement {
    const line = document.createElement('div');
    line.className = `term-line ${kind}`;
    if (kind === 'cmd') {
      const p = document.createElement('span');
      p.className = 'prompt';
      p.textContent = (promptText ?? promptEl.textContent ?? 'mlflow >') + ' ';
      line.append(p, document.createTextNode(text));
    } else {
      line.textContent = text;
    }
    return line;
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      applyTab(e);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      input.value = '';
      wordCycle = [];
      wordKey = '';
      syncGhost();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (document.querySelector('.modal-backdrop')) return;
      const value = input.value;
      input.value = '';
      const trimmed = value.trim();
      if (trimmed) {
        history.push(trimmed);
        historyIdx = history.length;
      }
      wordCycle = [];
      wordKey = '';
      onCommand(value);
      focus();
      syncGhost();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      if (historyIdx === history.length) draft = input.value;
      historyIdx = Math.max(0, historyIdx - 1);
      input.value = history[historyIdx] ?? '';
      wordCycle = [];
      syncGhost();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!history.length) return;
      historyIdx = Math.min(history.length, historyIdx + 1);
      input.value =
        historyIdx >= history.length
          ? draft
          : (history[historyIdx] ?? '');
      wordCycle = [];
      syncGhost();
    }
  });
  input.addEventListener('input', () => syncGhost());

  return {
    log(kind, text, promptText) {
      scroll.append(renderLine(kind, text, promptText));
      scroll.scrollTop = scroll.scrollHeight;
    },
    clear() {
      scroll.innerHTML = '';
    },
    focus,
    setPrompt(text) {
      promptEl.textContent = text;
    },
    setHint(command) {
      hint = command ?? '';
      input.placeholder = hint
        ? `Try: ${hint}`
        : 'Type a command — help · levels · hint';
      hintEl.hidden = !hint;
      if (hint) {
        hintEl.innerHTML = `Next: <code>${escapeHtml(hint)}</code> <span class="par-note">· Tab fills a word</span>`;
      } else {
        hintEl.textContent = '';
      }
      syncGhost();
    },
    setExtraCompletions(commands) {
      extraCompletions = commands.filter(Boolean);
    },
  };
}
