import type nl from './nl.js';

// The sentences of the shared components, in English: the same keys as in Dutch.
export default {
  'rail.label': 'Main navigation',
  'rail.theme': 'Light or dark',
  'rail.themeSwitch': 'Switch light or dark',
  'rail.myPage': 'My page',
  'rail.unread': '{label}, {count} unread',
  'panel.collapse': 'Collapse panel',
  'background.random': 'Random',
  'background.randomMeta': 'Another one each time',
  'background.gradient': 'Gradient',
  'background.flow': 'Flowing gradient',
  'background.flowMeta': 'Moves slowly',
  'background.lightsMeta': 'Flowing lights',
  'background.label': 'Background',
} as const satisfies Record<keyof typeof nl, string>;
