// The icons of the interface, from Phosphor (Icons): filled for everything of the interface, the
// regular line where the prototypes draw one. Each is imported by name, so the page holds only the
// icons it shows. A new icon of the interface is added here.
import caretDoubleLeftFill from '@phosphor-icons/core/assets/fill/caret-double-left-fill.svg?raw';
import chartBarFill from '@phosphor-icons/core/assets/fill/chart-bar-fill.svg?raw';
import chatCircleTextFill from '@phosphor-icons/core/assets/fill/chat-circle-text-fill.svg?raw';
import graduationCapFill from '@phosphor-icons/core/assets/fill/graduation-cap-fill.svg?raw';
import magnifyingGlassFill from '@phosphor-icons/core/assets/fill/magnifying-glass-fill.svg?raw';
import moonFill from '@phosphor-icons/core/assets/fill/moon-fill.svg?raw';
import stackFill from '@phosphor-icons/core/assets/fill/stack-fill.svg?raw';
import terminalWindowFill from '@phosphor-icons/core/assets/fill/terminal-window-fill.svg?raw';
import usersThreeFill from '@phosphor-icons/core/assets/fill/users-three-fill.svg?raw';
import warningCircleFill from '@phosphor-icons/core/assets/fill/warning-circle-fill.svg?raw';
import googleLogo from '@phosphor-icons/core/assets/regular/google-logo.svg?raw';
import magnifyingGlass from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw';
import monitor from '@phosphor-icons/core/assets/regular/monitor.svg?raw';
import paperPlaneTilt from '@phosphor-icons/core/assets/regular/paper-plane-tilt.svg?raw';
import shuffle from '@phosphor-icons/core/assets/regular/shuffle.svg?raw';
import usersThree from '@phosphor-icons/core/assets/regular/users-three.svg?raw';

export const ICONS = {
  'caret-double-left-fill': caretDoubleLeftFill,
  'chart-bar-fill': chartBarFill,
  'chat-circle-text-fill': chatCircleTextFill,
  'graduation-cap-fill': graduationCapFill,
  'magnifying-glass-fill': magnifyingGlassFill,
  'moon-fill': moonFill,
  'stack-fill': stackFill,
  'terminal-window-fill': terminalWindowFill,
  'users-three-fill': usersThreeFill,
  'warning-circle-fill': warningCircleFill,
  'google-logo': googleLogo,
  'magnifying-glass': magnifyingGlass,
  monitor,
  'paper-plane-tilt': paperPlaneTilt,
  shuffle,
  'users-three': usersThree,
} as const;

export type IconName = keyof typeof ICONS;
