/**
 * Terminal scrollback and prompt input.
 */

export interface TerminalHandle {
  log: (kind: 'cmd' | 'out' | 'err' | 'sys', text: string, prompt?: string) => void;
  clear: () => void;
  focus: () => void;
  setPrompt: (text: string) => void;
}

export function createTerminal(
  root: HTMLElement,
  onCommand: (line: string) => void,
): TerminalHandle {
  root.classList.add('terminal');

  const scroll = document.createElement('div');
  scroll.className = 'terminal-scroll';
  scroll.setAttribute('role', 'log');
  scroll.setAttribute('aria-live', 'polite');

  const inputRow = document.createElement('div');
  inputRow.className = 'term-input-row';
  const prompt = document.createElement('span');
  prompt.className = 'term-prompt';
  prompt.textContent = 'mlflow >';
  const input = document.createElement('input');
  input.className = 'term-input';
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.placeholder = 'type a command... (help)';
  input.setAttribute('aria-label', 'MLflow command input');
  inputRow.append(prompt, input);
  root.append(scroll, inputRow);

  const history: string[] = [];
  let historyIndex = -1;

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      const line = input.value;
      input.value = '';
      historyIndex = -1;
      if (line.trim()) history.push(line);
      onCommand(line);
      return;
    }
    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (history.length === 0) return;
      historyIndex = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] ?? '';
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (historyIndex < 0) return;
      historyIndex += 1;
      if (historyIndex >= history.length) {
        historyIndex = -1;
        input.value = '';
      } else {
        input.value = history[historyIndex] ?? '';
      }
    }
  });

  return {
    log(kind, text, promptText) {
      const line = document.createElement('div');
      line.className = 'term-line ' + kind;
      if (kind === 'cmd') {
        const p = document.createElement('span');
        p.className = 'prompt';
        p.textContent = (promptText ?? 'mlflow >') + ' ';
        line.append(p, document.createTextNode(text));
      } else {
        line.textContent = text;
      }
      scroll.append(line);
      scroll.scrollTop = scroll.scrollHeight;
    },
    clear() {
      scroll.innerHTML = '';
    },
    focus() {
      input.focus();
    },
    setPrompt(text) {
      prompt.textContent = text;
    },
  };
}
