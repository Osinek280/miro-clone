import { Icon } from '../constants/icons';
import { DrawModeEnum } from '../types/types';

type Tool =
  | 'draw'
  | 'select'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'eraser'
  | 'grab';

const TOOL_LIST: Array<{
  id: Tool;
  label: string;
  key: string;
  mode?: DrawModeEnum;
} | null> = [
    { id: 'draw', label: 'Pen', key: 'P', mode: DrawModeEnum.Draw },
    { id: 'select', label: 'Marker', key: 'M', mode: DrawModeEnum.Select },
    null,
    { id: 'line', label: 'Line', key: 'L' },
    { id: 'rect', label: 'Rectangle', key: 'R' },
    { id: 'ellipse', label: 'Ellipse', key: 'E' },
    { id: 'arrow', label: 'Arrow', key: 'A' },
    null,
    { id: 'eraser', label: 'Eraser', key: 'X' },
    { id: 'grab', label: 'Pan', key: 'V', mode: DrawModeEnum.Grab },
  ];

type ToolbarProps = {
  mode: DrawModeEnum;
  setMode: React.Dispatch<React.SetStateAction<DrawModeEnum>>;
};

export default function Toolbar({ mode, setMode }: ToolbarProps) {
  return (
    <nav
      className="absolute left-3.5 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 bg-[#f9f6f0]/95 border border-black/10 rounded-xl px-1.5 py-1.5 shadow-[0_8px_30px_rgba(13,13,13,0.09)] backdrop-blur-xl z-40"
      style={{ pointerEvents: 'none' }}
    >
      {TOOL_LIST.map((t, i) =>
        t === null ? (
          <div key={i} className="h-px bg-black/10 my-1" />
        ) : (
          <button
            style={{ pointerEvents: 'auto' }}
            key={t.id}
            title={`${t.label} (${t.key})`}
            onClick={() => {
              if (t.mode) {
                console.log('ju');
                console.log(mode);
                setMode(t.mode);
              }
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
                      ${t.id === mode
                ? 'bg-black text-[#f9f6f0]'
                : 'text-gray-400 hover:bg-black/5 hover:text-black'
              }`}
          >
            {Icon[t.id]}
          </button>
        )
      )}
      <div className="h-px bg-black/10 my-1" />
      <button
        style={{ pointerEvents: 'auto' }}
        // onClick={undo}
        title="Undo (Ctrl+Z)"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-black/5 hover:text-black transition-all"
      >
        {Icon.undo}
      </button>
      <button
        style={{ pointerEvents: 'auto' }}
        // onClick={redo}
        title="Redo (Ctrl+Y)"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-black/5 hover:text-black transition-all"
      >
        {Icon.redo}
      </button>
    </nav>
  );
}
