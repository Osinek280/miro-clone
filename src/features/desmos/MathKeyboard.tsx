import { useCallback } from 'react';
import { type MathField } from 'react-mathquill';

type MathKeyboardProps = {
  getTarget: () => MathField | null;
};

export function MathKeyboard({ getTarget }: MathKeyboardProps) {
  const run = useCallback(
    (fn: (mf: MathField) => void) => {
      const mf = getTarget();
      if (!mf) return;
      fn(mf);
      mf.focus();
    },
    [getTarget],
  );

  const onKeyMouseDown = (e: React.MouseEvent, fn: (mf: MathField) => void) => {
    e.preventDefault();
    run(fn);
  };

  const rows: { label: string; fn: (mf: MathField) => void }[][] = [
    [
      { label: '+', fn: (mf) => mf.typedText('+') },
      { label: '−', fn: (mf) => mf.typedText('-') },
      { label: '×', fn: (mf) => mf.cmd('\\cdot') },
      { label: '÷', fn: (mf) => mf.cmd('\\div') },
      { label: '=', fn: (mf) => mf.typedText('=') },
    ],
    [
      { label: 'π', fn: (mf) => mf.cmd('\\pi') },
      { label: '∞', fn: (mf) => mf.cmd('\\infty') },
      { label: '√', fn: (mf) => mf.cmd('\\sqrt') },
      { label: 'a/b', fn: (mf) => mf.cmd('\\frac') },
      { label: '^', fn: (mf) => mf.cmd('^') },
    ],
    [
      { label: '(', fn: (mf) => mf.typedText('(') },
      { label: ')', fn: (mf) => mf.typedText(')') },
      { label: '[', fn: (mf) => mf.typedText('[') },
      { label: ']', fn: (mf) => mf.typedText(']') },
      { label: '|', fn: (mf) => mf.typedText('|') },
    ],
    [
      { label: 'sin', fn: (mf) => mf.cmd('\\sin') },
      { label: 'cos', fn: (mf) => mf.cmd('\\cos') },
      { label: 'tan', fn: (mf) => mf.cmd('\\tan') },
      { label: 'ln', fn: (mf) => mf.cmd('\\ln') },
      { label: 'log', fn: (mf) => mf.cmd('\\log') },
    ],
    [
      { label: '∫', fn: (mf) => mf.cmd('\\int') },
      { label: '∑', fn: (mf) => mf.cmd('\\sum') },
      { label: 'lim', fn: (mf) => mf.cmd('\\lim') },
      { label: '→', fn: (mf) => mf.cmd('\\to') },
      { label: '⌫', fn: (mf) => mf.keystroke('Backspace') },
    ],
  ];

  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        Keyboard
      </p>
      <div className="flex flex-col gap-1.5">
        {rows.map((row, ri) => (
          <div key={ri} className="flex flex-wrap gap-1">
            {row.map((key) => (
              <button
                key={key.label}
                type="button"
                className="min-w-[2rem] flex-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-1.5 text-center text-xs font-medium text-gray-800 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                onMouseDown={(e) => onKeyMouseDown(e, key.fn)}
              >
                {key.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
