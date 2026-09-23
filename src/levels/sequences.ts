/**
 * Sequence catalog for the level browser.
 */

import type { Sequence } from '../engine/types';

export const sequences: Sequence[] = [
  {
    id: 'intro',
    displayName: 'Introduction Sequence',
    about: 'Experiments, runs, params, metrics — the Tracking basics',
    tab: 'main',
  },
  {
    id: 'registry',
    displayName: 'Model Registry',
    about: 'Register models and move versions across stages',
    tab: 'registry',
  },
];
