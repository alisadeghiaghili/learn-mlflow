/**
 * Live visualization: experiments sidebar, run cards, model registry kanban,
 * and the active goal checklist with a neon orange focus ring.
 */

import type { Stage, World } from '../engine/types';
import { STAGES } from '../engine/types';
import { listRuns } from '../engine/world';

const STAGE_LABEL: Record<Stage, string> = {
  None: 'None',
  Staging: 'Staging',
  Production: 'Production',
  Archived: 'Archived',
};

export type VizTab = 'tracking' | 'registry';

export interface VizOpts {
  goalSteps?: string[];
  goalDone?: boolean;
  onSetExperiment?: (id: string) => void;
  onSetRun?: (id: string) => void;
}

export function renderViz(
  root: HTMLElement,
  world: World,
  tab: VizTab,
  opts: VizOpts = {},
): void {
  root.innerHTML = '';

  const tabs = el('div', 'viz-tabs');
  const trackBtn = el(
    'button',
    `viz-tab${tab === 'tracking' ? ' active' : ''}`,
  );
  trackBtn.textContent = 'Tracking';
  trackBtn.onclick = () =>
    root.dispatchEvent(new CustomEvent('viz-tab', { detail: 'tracking' }));
  const regBtn = el('button', `viz-tab${tab === 'registry' ? ' active' : ''}`);
  regBtn.textContent = 'Registry';
  regBtn.onclick = () =>
    root.dispatchEvent(new CustomEvent('viz-tab', { detail: 'registry' }));
  tabs.append(trackBtn, regBtn);
  root.append(tabs);

  const body = el('div', 'viz-body');
  root.append(body);

  if (tab === 'tracking') {
    body.append(renderTracking(world, opts));
    if (opts.goalSteps?.length) {
      body.append(renderGoalPanel(opts.goalSteps, opts.goalDone ?? false));
    }
  } else {
    body.append(renderRegistry(world));
    if (opts.goalSteps?.length) {
      body.append(renderGoalPanel(opts.goalSteps, opts.goalDone ?? false));
    }
  }
}

function renderGoalPanel(steps: string[], allDone: boolean): HTMLElement {
  const panel = el('div', 'panel goal-panel');
  panel.append(el('h3', '', 'Do this now'));
  const list = el('ul', 'goal-list');
  steps.forEach((step, i) => {
    const li = el('li', 'goal-step');
    if (allDone) {
      li.classList.add('done');
    } else if (i === 0) {
      li.classList.add('active-goal');
    }
    li.textContent = step;
    list.append(li);
  });
  panel.append(list);
  return panel;
}

function sparkline(points: { step: number; value: number }[]): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'sparkline');
  svg.setAttribute('viewBox', '0 0 64 18');
  svg.setAttribute('aria-hidden', 'true');
  if (points.length < 2) return svg;
  const xs = points.map((p) => p.step);
  const ys = points.map((p) => p.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const coords = points
    .map((p) => {
      const x = ((p.step - minX) / spanX) * 60 + 2;
      const y = 16 - ((p.value - minY) / spanY) * 14;
      return x.toFixed(1) + ',' + y.toFixed(1);
    })
    .join(' ');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  path.setAttribute('points', coords);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#F59E0B');
  path.setAttribute('stroke-width', '1.5');
  svg.append(path);
  return svg;
}

function renderCompare(world: World): HTMLElement {
  const panel = el('div', 'panel compare-panel');
  panel.append(el('h3', '', 'Compare selected runs'));
  const runs = listRuns(world).filter((r) => r.tags.compare === 'yes');
  if (runs.length < 2) {
    panel.append(
      el(
        'div',
        'empty-note',
        'Tag 2+ runs with `mlflow runs tag compare=yes` to build a comparison table.',
      ),
    );
    return panel;
  }
  const keys = new Set<string>();
  for (const r of runs) {
    Object.keys(r.params).forEach((k) => keys.add('p:' + k));
    Object.keys(r.metrics).forEach((k) => keys.add('m:' + k));
  }
  const table = document.createElement('table');
  table.className = 'compare-table';
  const head = document.createElement('tr');
  head.append(el('th', '', 'field'));
  for (const r of runs) head.append(el('th', '', r.name));
  table.append(head);
  for (const key of [...keys].sort()) {
    const tr = document.createElement('tr');
    tr.append(el('td', 'mono', key));
    for (const r of runs) {
      const [kind, name] = [key.slice(0, 1), key.slice(2)];
      const val =
        kind === 'p'
          ? (r.params[name] ?? '—')
          : formatNum(r.metrics[name] ?? Number.NaN);
      tr.append(el('td', 'mono', val));
    }
    table.append(tr);
  }
  panel.append(table);
  return panel;
}

function renderTracking(world: World, opts: VizOpts): HTMLElement {
  const grid = el('div', 'viz-grid');

  const side = el('div', 'panel');
  side.append(el('h3', '', 'Experiments'));
  if (world.experiments.length === 0) {
    side.append(el('div', 'empty-note', 'No experiments yet'));
  } else {
    for (const e of world.experiments) {
      const row = el(
        'div',
        `exp-item${e.id === world.activeExperimentId ? ' active' : ''}`,
      );
      const name = el(
        'span',
        '',
        (e.id === world.activeExperimentId ? '* ' : '') + e.name,
      );
      const count = el('span', 'count', String(e.runIds.length));
      row.append(name, count);
      row.onclick = () => opts.onSetExperiment?.(e.id);
      side.append(row);
    }
  }
  grid.append(side);

  const main = el('div', 'panel');
  main.append(el('h3', '', 'Runs'));
  const exp = world.experiments.find((e) => e.id === world.activeExperimentId);
  const runs = exp ? listRuns(world, exp.id) : listRuns(world);
  if (runs.length === 0) {
    main.append(
      el('div', 'empty-note', 'No runs. Type `mlflow runs create` to start one.'),
    );
  } else {
    const list = el('div', 'run-list');
    for (const run of [...runs].reverse()) {
      const card = el(
        'div',
        `run-card${run.id === world.activeRunId ? ' active-run' : ''}`,
      );
      const head = el('div', 'run-head');
      head.append(
        el('span', 'run-id', run.id),
        el('span', 'run-name', run.name),
        el('span', `run-status ${run.status}`, run.status),
      );
      card.append(head);

      const badges = el('div', 'badges');
      for (const [k, v] of Object.entries(run.params)) {
        badges.append(el('span', 'badge param', `p ${k}=${v}`));
      }
      for (const [k, v] of Object.entries(run.metrics)) {
        const high = v >= 0.9;
        const badge = el(
          'span',
          `badge metric${high ? ' high' : ''}`,
          `m ${k}=${formatNum(v)}`,
        );
        badges.append(badge);
        const series = run.metricHistory[k];
        if (series && series.length >= 2) {
          const wrap = el('span', 'spark-wrap');
          wrap.append(sparkline(series));
          badges.append(wrap);
        }
      }
      for (const [k, v] of Object.entries(run.tags)) {
        badges.append(el('span', 'badge tag', `t ${k}=${v}`));
      }
      for (const a of run.artifacts) {
        badges.append(el('span', 'badge artifact', `ƒ ${a.path}`));
      }
      if (Object.keys(run.systemMetrics).length) {
        badges.append(
          el(
            'span',
            'badge sys',
            'sys cpu=' +
              formatNum(run.systemMetrics['system.cpu'] ?? 0),
          ),
        );
      }
      if (badges.childElementCount) card.append(badges);
      card.onclick = () => opts.onSetRun?.(run.id);
      list.append(card);
    }
    main.append(list);
  }
  grid.append(main);
  const compare = renderCompare(world);
  const wrap = el('div', 'viz-stack');
  wrap.append(grid, compare);
  return wrap;
}

function renderRegistry(world: World): HTMLElement {
  const wrap = el('div', 'registry');
  const versions = Object.values(world.models).flatMap((m) => m.versions);
  if (versions.length === 0) {
    wrap.append(
      el(
        'div',
        'empty-note',
        'No registered models. Use `mlflow models register -n <name>` after a run.',
      ),
    );
    return wrap;
  }

  for (const stage of STAGES) {
    const col = el('div', 'stage-col');
    col.dataset.stage = stage;
    const h = el('h4');
    h.append(el('span', 'stage-dot'), document.createTextNode(STAGE_LABEL[stage]));
    col.append(h);

    const inStage = versions.filter((v) => v.stage === stage);
    if (inStage.length === 0) {
      col.append(el('div', 'empty-note', '—'));
    } else {
      for (const v of inStage) {
        const card = el('div', 'version-card');
        card.append(
          el('div', 'vtitle', `${v.modelName}  v${v.version}`),
          el(
            'div',
            'vmeta',
            `run ${v.runId} · ${v.flavor}${v.signature ? ' · signed' : ' · unsigned'} · ${v.approval}`,
          ),
        );
        col.append(card);
      }
    }
    wrap.append(col);
  }
  return wrap;
}

function el(tag: string, className = '', text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatNum(n: number): string {
  return Number.isInteger(n)
    ? String(n)
    : n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}
