/**
 * Modal dialogs: level intro (text + demos), levels browser, win / hint / solution.
 */

import type { Level, ModalStep, Sequence } from '../engine/types';

export function closeModal(): void {
  document.querySelectorAll('.modal-backdrop').forEach((n) => n.remove());
}

function mount(title: string, body: HTMLElement, actions: HTMLElement): void {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const h = document.createElement('h2');
  h.textContent = title;
  modal.append(h, body, actions);
  backdrop.append(modal);
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) closeModal();
  });
  document.body.append(backdrop);
}

function btn(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (primary) b.classList.add('primary');
  b.onclick = onClick;
  return b;
}

function actionsBar(...nodes: (HTMLElement | 'spacer')[]): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'modal-actions';
  for (const n of nodes) {
    if (n === 'spacer') {
      const s = document.createElement('div');
      s.className = 'spacer';
      bar.append(s);
    } else {
      bar.append(n);
    }
  }
  return bar;
}

/** Minimal markdown: ## heading, **bold**, `code`, fenced blocks, lists. */
export function renderMarkdown(paras: string[]): HTMLElement {
  const box = document.createElement('div');
  let inCode = false;
  let codeBuf: string[] = [];
  let listBuf: HTMLUListElement | null = null;

  const flushCode = () => {
    if (!inCode) return;
    const pre = document.createElement('pre');
    pre.textContent = codeBuf.join('\n');
    box.append(pre);
    codeBuf = [];
    inCode = false;
  };

  for (const raw of paras) {
    const line = raw ?? '';
    if (line.trim() === '```') {
      if (inCode) flushCode();
      else {
        inCode = true;
        codeBuf = [];
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    if (listBuf && !line.trim().startsWith('- ') && line.trim() !== '') {
      listBuf = null;
    }
    if (line.trim().startsWith('- ')) {
      if (!listBuf) {
        listBuf = document.createElement('ul');
        box.append(listBuf);
      }
      const li = document.createElement('li');
      fillInline(li, line.trim().slice(2));
      listBuf.append(li);
      continue;
    }
    listBuf = null;
    if (line.trim() === '') {
      box.append(document.createElement('br'));
      continue;
    }
    if (line.startsWith('## ')) {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = line.slice(3);
      p.style.fontSize = '15px';
      p.append(strong);
      box.append(p);
      continue;
    }
    const p = document.createElement('p');
    fillInline(p, line);
    box.append(p);
  }
  flushCode();
  return box;
}

function fillInline(node: HTMLElement, text: string): void {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      node.append(strong);
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      const code = document.createElement('code');
      code.textContent = part.slice(1, -1);
      node.append(code);
    } else {
      node.append(document.createTextNode(part));
    }
  }
}

export function showLevelDialog(
  level: Level,
  opts: {
    onDemo: (command: string) => void;
    onClose: () => void;
  },
): void {
  const body = document.createElement('div');
  let step = 0;

  const renderStep = () => {
    body.innerHTML = '';
    const s: ModalStep | undefined = level.dialog[step];
    if (!s) {
      mount(
        level.name,
        renderMarkdown(['Ready when you are. Close this and type in the terminal.']),
        actionsBar(
          btn(
            'Start level',
            () => {
              closeModal();
              opts.onClose();
            },
            true,
          ),
        ),
      );
      return;
    }

    if (s.type === 'text') {
      body.append(renderMarkdown(s.markdown));
    } else {
      body.append(renderMarkdown(s.before));
      const demo = document.createElement('div');
      demo.className = 'demo-box';
      const pre = document.createElement('pre');
      pre.textContent = s.command;
      demo.append(pre);
      demo.append(
        btn(
          'Run demo',
          () => {
            opts.onDemo(s.command);
            step += 1;
            renderStep();
            body.append(renderMarkdown(s.after));
          },
          true,
        ),
      );
      body.append(demo);
    }

    const isLast = step >= level.dialog.length - 1;
    mount(
      level.name,
      body,
      actionsBar(
        btn('Hint', () => showHint(level)),
        'spacer',
        step > 0
          ? btn('Back', () => {
              step -= 1;
              renderStep();
            })
          : btn('Skip', () => {
              closeModal();
              opts.onClose();
            }),
        isLast
          ? btn(
              'Let’s go',
              () => {
                closeModal();
                opts.onClose();
              },
              true,
            )
          : btn(
              'Next',
              () => {
                step += 1;
                renderStep();
              },
              true,
            ),
      ),
    );
  };

  renderStep();
}

export function showHint(level: Level): void {
  mount('Hint', renderMarkdown([level.hint]), actionsBar(btn('Close', closeModal, true)));
}

export function showSolution(level: Level): void {
  const par = level.solutionCommand.split(';').filter((s) => s.trim()).length;
  mount(
    'Solution',
    renderMarkdown([
      'Par is **' + String(par) + '** commands.',
      '',
      '```',
      level.solutionCommand,
      '```',
    ]),
    actionsBar(btn('Close', closeModal, true)),
  );
}

export function showHelp(): void {
  mount(
    'Help',
    renderMarkdown([
      '## Game',
      '',
      '- `levels` — pick a level',
      '- `hint` / `solution` — help for the current level',
      '- `undo` / `reset` — step back or restart the level',
      '- `sandbox` — free play (no goals)',
      '',
      '## MLflow (subset)',
      '',
      '```',
      'mlflow experiments create -n <name>',
      'mlflow experiments set <id|name>',
      'mlflow experiments list',
      'mlflow runs create [--name <name>]',
      'mlflow runs log -p key=value',
      'mlflow runs log -m key=value',
      'mlflow runs tag key=value',
      'mlflow runs log-artifact <name>',
      'mlflow models register -n <name>',
      'mlflow models transition -n <name> --version <n> --stage <S>',
      'mlflow models archive -n <name> --version <n>',
      '```',
    ]),
    actionsBar(btn('Close', closeModal, true)),
  );
}

export function showLevelsBrowser(
  sequences: Sequence[],
  levelsBySeq: Map<string, Level[]>,
  solved: Set<string>,
  golf: Map<string, number>,
  onPick: (level: Level) => void,
): void {
  const body = document.createElement('div');
  for (const seq of sequences) {
    const h = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = seq.displayName;
    h.append(strong, document.createTextNode(' — ' + seq.about));
    body.append(h);
    const list = document.createElement('div');
    list.className = 'level-list';
    for (const level of levelsBySeq.get(seq.id) ?? []) {
      const row = document.createElement('div');
      row.className = 'level-row' + (solved.has(level.id) ? ' solved' : '');
      const idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = solved.has(level.id) ? '✓' : '·';
      const name = document.createElement('span');
      name.textContent = level.name;
      const meta = document.createElement('span');
      meta.className = 'meta';
      const best = golf.get(level.id);
      meta.textContent = best !== undefined ? 'best ' + String(best) : '';
      row.append(idx, name, meta);
      row.onclick = () => {
        closeModal();
        onPick(level);
      };
      list.append(row);
    }
    body.append(list);
  }
  mount('Levels', body, actionsBar(btn('Close', closeModal, true)));
}

export function showWin(
  level: Level,
  used: number,
  par: number,
  onNext: () => void,
): void {
  const body = document.createElement('div');
  const banner = document.createElement('div');
  banner.className = 'win-banner';
  banner.textContent =
    used <= par
      ? 'Cleared in ' + String(used) + ' commands (par ' + String(par) + ') — golf complete'
      : 'Cleared in ' + String(used) + ' commands (par ' + String(par) + ')';
  body.append(banner);
  body.append(
    renderMarkdown([
      level.name + ' is done.',
      used <= par
        ? 'You matched the solution length. Nice.'
        : 'Can you clear it in ' +
          String(par) +
          ' commands? `' +
          level.solutionCommand +
          '` is one way.',
    ]),
  );
  mount(
    'Level complete',
    body,
    actionsBar(btn('Close', closeModal), 'spacer', btn('Next level', onNext, true)),
  );
}

export function showError(title: string, message: string): void {
  mount(title, renderMarkdown([message]), actionsBar(btn('Close', closeModal, true)));
}
