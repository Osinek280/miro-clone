import { Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addStyles, EditableMathField } from 'react-mathquill';
import type {
  AddEquationOp,
  EquationItem,
  EquationOperation,
  EquationOpMeta,
  RemoveEquationOp,
  UpdateEquationColorOp,
  UpdateEquationLatexOp,
} from '../types/equation.types';
import { applyEquationOperation } from '../utils/EquationOperations';

const colorOptions = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19'];

const createOpMeta = (): EquationOpMeta => ({
  opId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: Date.now(),
});

export default function EquationList() {
  const [equations, setEquations] = useState<EquationItem[]>([
    { id: 'eq-1', latex: 'a^2 + b^2 = c^2', color: '#c74440' },
    {
      id: 'eq-2',
      latex: 'x = (-b ± √(b^2 - 4ac)) / 2a',
      color: '#2d70b3',
    },
  ]);
  const [openedColorPickerId, setOpenedColorPickerId] = useState<string | null>(
    null,
  );
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const equationFieldRefs = useRef<Record<string, any>>({});
  const draftFieldRef = useRef<any>(null);

  useEffect(() => {
    addStyles();
  }, []);

  useEffect(() => {
    if (!openedColorPickerId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenedColorPickerId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [openedColorPickerId]);

  const dispatchEquationOperation = (operation: EquationOperation) => {
    setEquations((current) => applyEquationOperation(current, operation));
  };

  const addEquationFromDraft = (latex: string) => {
    const trimmedLatex = latex.trim();
    if (!trimmedLatex) {
      return;
    }

    const newEquationId = `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const addOperation: AddEquationOp = {
      ...createOpMeta(),
      type: 'add',
      equation: {
        id: newEquationId,
        latex: trimmedLatex,
        color: colorOptions[equations.length % colorOptions.length],
      },
    };
    dispatchEquationOperation(addOperation);
    setPendingFocusId(newEquationId);
  };

  const focusEquationByIndex = (targetIndex: number) => {
    if (targetIndex < equations.length) {
      const nextEquationId = equations[targetIndex]?.id;
      if (!nextEquationId) {
        return;
      }

      const nextEquationField = equationFieldRefs.current[nextEquationId];
      nextEquationField?.focus?.();
      nextEquationField?.moveToRightEnd?.();
      return;
    }

    draftFieldRef.current?.focus?.();
    draftFieldRef.current?.moveToRightEnd?.();
  };

  useEffect(() => {
    if (!pendingFocusId) {
      return;
    }

    const nextField = equationFieldRefs.current[pendingFocusId];
    if (!nextField) {
      return;
    }

    nextField.focus?.();
    nextField.moveToRightEnd?.();
    setPendingFocusId(null);
  }, [equations, pendingFocusId]);

  return (
    <div
      ref={rootRef}
      className="m-0 p-0"
      onClick={() => setOpenedColorPickerId(null)}
    >
      <ul className="m-0 list-none p-0">
        {equations.map((row, index) => {
          return (
            <li
              key={row.id}
              className="flex min-h-10 items-stretch border-b border-[#E0E0E0]"
              style={{ margin: 0, padding: 0 }}
            >
              <button
                type="button"
                className="relative inline-flex w-10 shrink-0 cursor-pointer items-center justify-center self-stretch bg-[#EEEEEE]"
                aria-label={`Zmień kolor równania ${index + 1}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenedColorPickerId((current) =>
                    current === row.id ? null : row.id,
                  );
                }}
              >
                <div
                  className="h-5 w-5 rounded-full shadow-sm transition-transform duration-150"
                  style={{
                    background: row.color,
                  }}
                />
                <span className="absolute -left-1 top-0 px-1 text-[10px] text-[#666]">
                  {index + 1}
                </span>
                {openedColorPickerId === row.id ? (
                  <div
                    className="absolute left-full top-1/2 z-10 ml-2 flex -translate-y-1/2 gap-1 rounded border border-[#E0E0E0] bg-white p-1 shadow"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="h-4 w-4 rounded-full border border-[#D0D0D0] hover:scale-110"
                        style={{ background: color }}
                        aria-label={`Ustaw kolor ${color}`}
                        onClick={() => {
                          const updateColorOperation: UpdateEquationColorOp = {
                            ...createOpMeta(),
                            type: 'update_color',
                            id: row.id,
                            color,
                          };
                          dispatchEquationOperation(updateColorOperation);
                          setOpenedColorPickerId(null);
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </button>
              <div className="min-w-0 flex flex-1 items-center self-stretch border-l border-[#E0E0E0]">
                <EditableMathField
                  latex={row.latex}
                  className="m-0 block w-full rounded-none bg-white px-2 text-[15px]"
                  config={{ spaceBehavesLikeTab: true }}
                  mathquillDidMount={(mf) => {
                    equationFieldRefs.current[row.id] = mf;
                  }}
                  onChange={(mf) => {
                    const nextLatex = mf.latex();
                    const updateLatexOperation: UpdateEquationLatexOp = {
                      ...createOpMeta(),
                      type: 'update_latex',
                      id: row.id,
                      latex: nextLatex,
                    };
                    dispatchEquationOperation(updateLatexOperation);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      event.stopPropagation();
                      focusEquationByIndex(index + 1);
                      return;
                    }

                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      event.stopPropagation();
                      focusEquationByIndex(Math.max(0, index - 1));
                      return;
                    }

                    if (event.key !== 'Enter') {
                      return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    focusEquationByIndex(index + 1);
                  }}
                  onBlur={() => {
                    if (row.latex.trim()) {
                      return;
                    }

                    const removeOperation: RemoveEquationOp = {
                      ...createOpMeta(),
                      type: 'remove',
                      id: row.id,
                    };
                    dispatchEquationOperation(removeOperation);
                    setOpenedColorPickerId((current) =>
                      current === row.id ? null : current,
                    );
                  }}
                />
              </div>
              <button
                type="button"
                className="shrink-0 cursor-pointer rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Usuń równanie"
                onClick={() => {
                  const removeOperation: RemoveEquationOp = {
                    ...createOpMeta(),
                    type: 'remove',
                    id: row.id,
                  };
                  dispatchEquationOperation(removeOperation);
                  setOpenedColorPickerId((current) =>
                    current === row.id ? null : current,
                  );
                }}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
        <li
          key="equation-draft-row"
          className="flex min-h-10 items-stretch border-[#E0E0E0]"
          style={{ margin: 0, padding: 0 }}
        >
          <span
            className="relative cursor-pointer inline-flex w-10 shrink-0 items-center justify-center self-stretch"
            aria-hidden
          >
            <span className="absolute -left-1 top-0 px-1 text-[10px] text-[#666]">
              {equations.length + 1}
            </span>
          </span>
          <div className="min-w-0 flex flex-1 items-center self-stretch border-l border-[#E0E0E0]">
            <EditableMathField
              latex=""
              className="m-0 block w-full rounded-none bg-white px-2 text-[15px]"
              config={{ spaceBehavesLikeTab: true }}
              mathquillDidMount={(mf) => {
                draftFieldRef.current = mf;
              }}
              onChange={(mf) => {
                const nextLatex = mf.latex();
                if (!nextLatex.trim()) {
                  return;
                }

                addEquationFromDraft(nextLatex);
                mf.latex('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  event.stopPropagation();
                  focusEquationByIndex(Math.max(0, equations.length - 1));
                  return;
                }

                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  event.stopPropagation();
                  draftFieldRef.current?.focus?.();
                  draftFieldRef.current?.moveToRightEnd?.();
                }
              }}
            />
          </div>
        </li>
      </ul>
    </div>
  );
}
