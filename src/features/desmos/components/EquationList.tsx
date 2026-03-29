import { useCallback, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { addStyles, EditableMathField } from 'react-mathquill';
import { useEquationStore } from '../store/useEquationStore';
import { newEquationId } from '../utils/equationMath';

export default function EquationList() {
  const equations = useEquationStore((s) => s.equations);
  const updateEquation = useEquationStore((s) => s.updateEquation);
  const setEquationInputFocused = useEquationStore(
    (s) => s.setEquationInputFocused,
  );

  useEffect(() => {
    addStyles();
  }, []);

  useEffect(() => {
    return () => useEquationStore.getState().setEquationInputFocused(false);
  }, []);

  const updateLatex = useCallback(
    (id: string, latex: string) => {
      updateEquation({ id, latex });
    },
    [updateEquation],
  );

  const addRow = useCallback(() => {
    const {
      equations: rows,
      addEquation: add,
      setActiveEquationId,
      getMathField,
    } = useEquationStore.getState();
    const last = rows[rows.length - 1];
    if (!last || last.latex.trim() === '') return;
    const id = newEquationId();
    add({ id, latex: '' });
    requestAnimationFrame(() => {
      setActiveEquationId(id);
      const mf = getMathField(id);
      mf?.focus();
    });
  }, []);

  const removeRow = useCallback((id: string) => {
    const {
      equations: rows,
      removeEquation: remove,
      registerMathField,
      activeEquationId,
      setActiveEquationId,
    } = useEquationStore.getState();
    if (rows.length <= 1) return;
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    remove(row);
    registerMathField(id, null);
    if (activeEquationId === id) {
      const next = rows.filter((r) => r.id !== id);
      setActiveEquationId(next[0]?.id ?? null);
    }
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex list-none flex-col gap-2 p-0">
        {equations.map((row, index) => (
          <li
            key={row.id}
            className="flex items-start gap-2 border border-gray-100 bg-gray-50/80"
          >
            <span
              className="mt-2 w-5 shrink-0 text-right text-xs tabular-nums text-gray-400"
              aria-hidden
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <EditableMathField
                latex={row.latex}
                className="w-full min-h-[2.5rem] rounded-none border border-gray-200 bg-white px-2 py-1.5 text-[15px] shadow-inner"
                config={{ spaceBehavesLikeTab: true }}
                onChange={(mf) => updateLatex(row.id, mf.latex())}
                mathquillDidMount={(mf) => {
                  useEquationStore.getState().registerMathField(row.id, mf);
                }}
                onFocus={() => {
                  useEquationStore.getState().setActiveEquationId(row.id);
                  setEquationInputFocused(true);
                }}
                onBlur={() => setEquationInputFocused(false)}
              />
            </div>
            <button
              type="button"
              disabled={equations.length <= 1}
              className="mt-1.5 shrink-0 rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Usuń równanie"
              onClick={() => removeRow(row.id)}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addRow}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 bg-white py-2 text-sm font-medium text-gray-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Plus className="size-4" aria-hidden />
        Dodaj równanie
      </button>
    </div>
  );
}
