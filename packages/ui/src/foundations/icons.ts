// The icons of the interface, from Phosphor (Icons): filled for everything of the interface, the
// regular line where the prototypes draw one. Each is imported by name, so the page holds only the
// icons it shows. A new icon of the interface is added here.
import calendarBlankFill from '@phosphor-icons/core/assets/fill/calendar-blank-fill.svg?raw';
import caretDoubleLeftFill from '@phosphor-icons/core/assets/fill/caret-double-left-fill.svg?raw';
import chartBarFill from '@phosphor-icons/core/assets/fill/chart-bar-fill.svg?raw';
import chatCircleTextFill from '@phosphor-icons/core/assets/fill/chat-circle-text-fill.svg?raw';
import checkFill from '@phosphor-icons/core/assets/fill/check-fill.svg?raw';
import copyFill from '@phosphor-icons/core/assets/fill/copy-fill.svg?raw';
import eyeSlashFill from '@phosphor-icons/core/assets/fill/eye-slash-fill.svg?raw';
import globeSimpleFill from '@phosphor-icons/core/assets/fill/globe-simple-fill.svg?raw';
import graduationCapFill from '@phosphor-icons/core/assets/fill/graduation-cap-fill.svg?raw';
import infoFill from '@phosphor-icons/core/assets/fill/info-fill.svg?raw';
import lockSimpleFill from '@phosphor-icons/core/assets/fill/lock-simple-fill.svg?raw';
import magnifyingGlassFill from '@phosphor-icons/core/assets/fill/magnifying-glass-fill.svg?raw';
import moonFill from '@phosphor-icons/core/assets/fill/moon-fill.svg?raw';
import pencilSimpleFill from '@phosphor-icons/core/assets/fill/pencil-simple-fill.svg?raw';
import plusCircleFill from '@phosphor-icons/core/assets/fill/plus-circle-fill.svg?raw';
import stackFill from '@phosphor-icons/core/assets/fill/stack-fill.svg?raw';
import terminalWindowFill from '@phosphor-icons/core/assets/fill/terminal-window-fill.svg?raw';
import trashFill from '@phosphor-icons/core/assets/fill/trash-fill.svg?raw';
import trayFill from '@phosphor-icons/core/assets/fill/tray-fill.svg?raw';
import usersThreeFill from '@phosphor-icons/core/assets/fill/users-three-fill.svg?raw';
import warningCircleFill from '@phosphor-icons/core/assets/fill/warning-circle-fill.svg?raw';
import xCircleFill from '@phosphor-icons/core/assets/fill/x-circle-fill.svg?raw';
import caretDown from '@phosphor-icons/core/assets/regular/caret-down.svg?raw';
import googleLogo from '@phosphor-icons/core/assets/regular/google-logo.svg?raw';
import magnifyingGlass from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw';
import minusCircle from '@phosphor-icons/core/assets/regular/minus-circle.svg?raw';
import monitor from '@phosphor-icons/core/assets/regular/monitor.svg?raw';
import paperPlaneTilt from '@phosphor-icons/core/assets/regular/paper-plane-tilt.svg?raw';
import shuffle from '@phosphor-icons/core/assets/regular/shuffle.svg?raw';
import table from '@phosphor-icons/core/assets/regular/table.svg?raw';
import tray from '@phosphor-icons/core/assets/regular/tray.svg?raw';
import usersThree from '@phosphor-icons/core/assets/regular/users-three.svg?raw';
import x from '@phosphor-icons/core/assets/regular/x.svg?raw';

export const ICONS = {
  'calendar-blank-fill': calendarBlankFill,
  'caret-double-left-fill': caretDoubleLeftFill,
  'chart-bar-fill': chartBarFill,
  'chat-circle-text-fill': chatCircleTextFill,
  'check-fill': checkFill,
  'copy-fill': copyFill,
  'eye-slash-fill': eyeSlashFill,
  'globe-simple-fill': globeSimpleFill,
  'graduation-cap-fill': graduationCapFill,
  'info-fill': infoFill,
  'lock-simple-fill': lockSimpleFill,
  'magnifying-glass-fill': magnifyingGlassFill,
  'moon-fill': moonFill,
  'pencil-simple-fill': pencilSimpleFill,
  'plus-circle-fill': plusCircleFill,
  'stack-fill': stackFill,
  'terminal-window-fill': terminalWindowFill,
  'trash-fill': trashFill,
  'tray-fill': trayFill,
  'users-three-fill': usersThreeFill,
  'warning-circle-fill': warningCircleFill,
  'x-circle-fill': xCircleFill,
  'caret-down': caretDown,
  'google-logo': googleLogo,
  'magnifying-glass': magnifyingGlass,
  'minus-circle': minusCircle,
  monitor,
  'paper-plane-tilt': paperPlaneTilt,
  shuffle,
  table,
  tray,
  'users-three': usersThree,
  x,
} as const;

export type IconName = keyof typeof ICONS;
