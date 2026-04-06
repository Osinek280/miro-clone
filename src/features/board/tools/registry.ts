import { DrawModeEnum } from '../types/types';

export type BoardToolId =
  | 'draw'
  | 'select'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'eraser'
  | 'grab';

export type BoardToolEntry = {
  id: BoardToolId;
  label: string;
  shortcut: string;
  mode?: DrawModeEnum;
};

/** Order and grouping: `null` renders a separator. */
export const BOARD_TOOLBAR_LAYOUT: ReadonlyArray<BoardToolEntry | null> = [
  {
    id: 'draw',
    label: 'Pen',
    shortcut: 'P',
    mode: DrawModeEnum.Draw,
  },
  {
    id: 'select',
    label: 'Marker',
    shortcut: 'M',
    mode: DrawModeEnum.Select,
  },
  null,
  { id: 'line', label: 'Line', shortcut: 'L' },
  { id: 'rect', label: 'Rectangle', shortcut: 'R' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'E' },
  { id: 'arrow', label: 'Arrow', shortcut: 'A' },
  null,
  { id: 'eraser', label: 'Eraser', shortcut: 'X' },
  {
    id: 'grab',
    label: 'Pan',
    shortcut: 'V',
    mode: DrawModeEnum.Grab,
  },
];

export function boardToolToolbarTitle(entry: BoardToolEntry): string {
  if (entry.id === 'draw') {
    return `${entry.label} (${entry.shortcut}) • Shift = straight lines`;
  }
  return `${entry.label} (${entry.shortcut})`;
}
