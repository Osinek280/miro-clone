import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { addStyles, EditableMathField, type MathField } from 'react-mathquill';
import { MathKeyboard } from './MathKeyboard';

type EquationRow = {
  id: string;
  latex: string;
};

function newId() {
  return crypto.randomUUID();
}

export default function EquationList() {
  const [rows, setRows] = useState<EquationRow[]>(() => [
    { id: newId(), latex: '' },
  ]);
  const fieldsRef = useRef<Map<string, MathField>>(new Map());
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    addStyles();
  }, []);

  const getTarget = useCallback((): MathField | null => {
    const id = activeIdRef.current;
    if (id) {
      const mf = fieldsRef.current.get(id);
      if (mf) return mf;
    }
    const first = rows[0]?.id;
    return first ? (fieldsRef.current.get(first) ?? null) : null;
  }, [rows]);

  const updateLatex = useCallback((id: string, latex: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, latex } : r)));
  }, []);

  const addRow = useCallback(() => {
    const id = newId();
    setRows((prev) => [...prev, { id, latex: '' }]);
    requestAnimationFrame(() => {
      const mf = fieldsRef.current.get(id);
      mf?.focus();
      activeIdRef.current = id;
    });
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((r) => r.id !== id);
      fieldsRef.current.delete(id);
      if (activeIdRef.current === id) {
        activeIdRef.current = next[0]?.id ?? null;
      }
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex list-none flex-col gap-2 p-0">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="flex items-start gap-2 rounded-md border border-gray-100 bg-gray-50/80 p-2"
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
                className="w-full min-h-[2.5rem] rounded border border-gray-200 bg-white px-2 py-1.5 text-[15px] shadow-inner"
                config={{ spaceBehavesLikeTab: true }}
                onChange={(mf) => updateLatex(row.id, mf.latex())}
                mathquillDidMount={(mf) => {
                  fieldsRef.current.set(row.id, mf);
                }}
                onFocus={() => {
                  activeIdRef.current = row.id;
                }}
              />
            </div>
            <button
              type="button"
              disabled={rows.length <= 1}
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

      <MathKeyboard getTarget={getTarget} />
    </div>
  );
}
