import { Icon } from '../constants/icons';
import {
  BOARD_TOOLBAR_LAYOUT,
  boardToolToolbarTitle,
  type BoardToolEntry,
} from '../tools/registry';
import { DrawModeEnum } from '../types/types';

type ToolbarProps = {
  mode: DrawModeEnum;
  setMode: React.Dispatch<React.SetStateAction<DrawModeEnum>>;
  onUndo: () => void;
  onRedo: () => void;
  undoDisabled?: boolean;
  redoDisabled?: boolean;
};

export default function Toolbar({
  mode,
  setMode,
  onUndo,
  onRedo,
  undoDisabled,
  redoDisabled,
}: ToolbarProps) {
  return (
    <nav
      className="absolute left-3.5 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 bg-[#f9f6f0]/95 border border-black/10 rounded-xl px-1.5 py-1.5 shadow-[0_8px_30px_rgba(13,13,13,0.09)] backdrop-blur-xl z-40"
      style={{ pointerEvents: 'none' }}
    >
      {BOARD_TOOLBAR_LAYOUT.map((t, i) =>
        t === null ? (
          <div key={i} className="h-px bg-black/10 my-1" />
        ) : (
          <ToolbarToolButton
            key={t.id}
            entry={t}
            mode={mode}
            setMode={setMode}
          />
        ),
      )}
      <div className="h-px bg-black/10 my-1" />
      <button
        style={{ pointerEvents: 'auto' }}
        onClick={onUndo}
        disabled={undoDisabled}
        title="Undo (Ctrl+Z)"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-black/5 hover:text-black transition-all disabled:opacity-50 disabled:pointer-events-none"
      >
        {Icon.undo}
      </button>
      <button
        style={{ pointerEvents: 'auto' }}
        onClick={onRedo}
        disabled={redoDisabled}
        title="Redo (Ctrl+Y)"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-black/5 hover:text-black transition-all disabled:opacity-50 disabled:pointer-events-none"
      >
        {Icon.redo}
      </button>
    </nav>
  );
}

function ToolbarToolButton({
  entry,
  mode,
  setMode,
}: {
  entry: BoardToolEntry;
  mode: DrawModeEnum;
  setMode: React.Dispatch<React.SetStateAction<DrawModeEnum>>;
}) {
  return (
    <button
      style={{ pointerEvents: 'auto' }}
      title={boardToolToolbarTitle(entry)}
      onClick={() => {
        if (entry.mode) {
          setMode(entry.mode);
        }
      }}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
        ${
          entry.id === mode
            ? 'bg-black text-[#f9f6f0]'
            : 'text-gray-400 hover:bg-black/5 hover:text-black'
        }`}
    >
      {Icon[entry.id]}
    </button>
  );
}
