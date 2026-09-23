/**
 * Level-clear celebration with confetti, fanfare, and social share.
 */

import type { Level } from '../engine/types';
import {
  buildShareTargets,
  COFFEE_BUTTON_HTML,
  type ShareContext,
  shareWithClipboard,
} from './share';
import { launchConfetti, playFanfare } from './confetti';
import { closeModal, renderMarkdown } from './dialogs';
import type { CurriculumSummary } from './progress';
import { nextLevel } from '../levels';

const CHEERS = [
  'That is how Tracking is supposed to feel.',
  'Run locked in. Nice.',
  'Registry updated — ship it.',
  'Clean. The dashboard agrees.',
  'That is a real MLflow habit now.',
];

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export interface CelebrateOpts {
  level: Level;
  used: number;
  curriculum: CurriculumSummary;
  onNext: (level: Level) => void;
  onStay: () => void;
  onBrowse: () => void;
}

export function showCelebrate(opts: CelebrateOpts): void {
  const { level, used, curriculum } = opts;
  const par = level.solutionCommand.split(';').filter((s) => s.trim()).length;
  const underPar = used <= par;
  const ctx: ShareContext = {
    levelName: level.name,
    levelId: level.id,
    commands: used,
    par,
    curriculum,
  };
  const share = buildShareTargets(ctx);
  const next = nextLevel(level.id, new Set(curriculum.learned.map((l) => l.id)));
  const cheer = CHEERS[Math.floor(Math.random() * CHEERS.length)]!;
  const series =
    curriculum.learned.find((l) => l.id === level.id)?.seriesTitle ??
    level.sequenceId;

  const golfLine = underPar
    ? `**${used}** commands — matched par ${par}.`
    : `**${used}** commands. Ideal is ${par}. Still counts — you got there.`;

  const learnedPreview = curriculum.learned
    .map(
      (l) =>
        `<li>${escapeHtml(l.seriesTitle)}: ${escapeHtml(l.name)}</li>`,
    )
    .join('');

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="celebrate" aria-live="polite">
      <div class="celebrate-visual" aria-hidden="true">
        <div class="celebrate-ring"></div>
        <div class="celebrate-star">★</div>
      </div>
      <div class="celebrate-badge">LEVEL CLEARED</div>
      <h3 class="celebrate-title">${escapeHtml(level.name)}</h3>
      <p class="celebrate-sub">${escapeHtml(series)} · <code>${escapeHtml(level.id)}</code></p>
      <p class="celebrate-cheer">${escapeHtml(cheer)}</p>
      <div class="celebrate-stats"></div>
      <div class="celebrate-progress">
        <div class="prog-track"><div class="prog-fill" style="width:${curriculum.percent}%"></div></div>
        <div class="par-note">${curriculum.solvedCount} / ${curriculum.total} levels solved · progress saved in this browser</div>
      </div>
      <div class="share-block">
        <div class="share-title">Share what you learned</div>
        <div class="learned-preview">
          <div class="par-note">Your curriculum so far</div>
          <ul>${learnedPreview || '<li>Solve more levels to build your list.</li>'}</ul>
        </div>
        <div class="share-row" role="group" aria-label="Share">
          <button type="button" class="share-btn linkedin" data-share="linkedin">LinkedIn</button>
          <button type="button" class="share-btn x" data-share="x">X / Twitter</button>
          <button type="button" class="share-btn facebook" data-share="facebook">Facebook</button>
          <button type="button" class="share-btn copy" data-share="copy">Copy post</button>
        </div>
        <div class="share-status" data-share-status hidden></div>
        <div class="share-coffee">${COFFEE_BUTTON_HTML}</div>
      </div>
      <div class="celebrate-next"></div>
    </div>
  `;
  const stats = body.querySelector('.celebrate-stats');
  if (stats) stats.append(renderMarkdown([golfLine]));
  const nextBox = body.querySelector('.celebrate-next');
  if (nextBox) {
    nextBox.append(
      renderMarkdown([
        next
          ? `Next up: **${next.name}** — \`${next.id}\``
          : 'You cleared every level. Browse them again or play in sandbox.',
      ]),
    );
  }

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  const stay = document.createElement('button');
  stay.type = 'button';
  stay.className = 'ghost';
  stay.textContent = 'Bask in it';
  stay.onclick = () => {
    confetti?.stop();
    closeModal();
    opts.onStay();
  };
  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'primary';
  if (next) {
    primary.textContent = `Celebrate on: ${next.id}`;
    primary.onclick = () => {
      confetti?.stop();
      closeModal();
      opts.onNext(next);
    };
  } else {
    primary.textContent = 'Browse levels';
    primary.onclick = () => {
      confetti?.stop();
      closeModal();
      opts.onBrowse();
    };
  }
  actions.append(stay, document.createElement('div'), primary);
  actions.querySelector('div')!.className = 'spacer';

  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  const confetti = launchConfetti(4800);
  playFanfare();

  // Mount celebrate modal (reuse modal chrome)
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop overlay-celebrate';
  const modal = document.createElement('div');
  modal.className = 'modal modal-celebrate';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.append(body, actions);
  backdrop.append(modal);
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) {
      confetti?.stop();
      closeModal();
      opts.onStay();
    }
  });
  document.body.append(backdrop);

  modal.querySelectorAll<HTMLButtonElement>('[data-share]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const kind = (btn.dataset.share ?? 'copy') as
        | 'linkedin'
        | 'facebook'
        | 'x'
        | 'copy';
      const status = modal.querySelector<HTMLElement>('[data-share-status]');
      const result = await shareWithClipboard(kind, share);
      if (!status) return;
      status.hidden = false;
      if (kind === 'copy') {
        status.textContent = result.copied
          ? 'Post copied to clipboard.'
          : 'Copy failed — select the text manually.';
        return;
      }
      status.textContent = result.copied
        ? 'Share window opened · post copied as backup.'
        : 'Share window opened.';
    });
  });

  modal.addEventListener('keydown', (ev) => {
    const key = (ev as KeyboardEvent).key;
    if (key === 'Enter') {
      ev.preventDefault();
      ev.stopPropagation();
    }
  });
}
