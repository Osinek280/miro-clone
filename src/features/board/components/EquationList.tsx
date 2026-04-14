import { Trash2 } from 'lucide-react';
import { EditableMathField } from 'react-mathquill';
import type {
  RemoveEquationOp,
  UpdateEquationColorOp,
  UpdateEquationLatexOp,
} from '../types/equation.types';
import { equationColorOptions } from '../constants/equationColors';
import { useEquationList } from '../hooks/useEquationList';
import { parseEquation } from '../equation/parser';

export default function EquationList() {
  const {
    equations,
    openedColorPickerId,
    setOpenedColorPickerId,
    rootRef,
    equationFieldRefs,
    draftFieldRef,
    dispatchEquationOperation,
    addEquationFromDraft,
    focusEquationByIndex,
    createOpMeta,
  } = useEquationList();

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
                    background:
                      equationColorOptions[row.colorIndex] ??
                      equationColorOptions[0],
                  }}
                />
                <span className="absolute -left-1 top-0 px-1 text-[10px] text-[#666]">
                  {index + 1}
                </span>
                {openedColorPickerId === row.id ? (
                  <div
                    className="absolute cursor-default left-full top-1/2 z-10 ml-2 flex -translate-y-1/2 gap-1 rounded border border-[#E0E0E0] bg-white p-1 shadow"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {equationColorOptions.map((color, colorIndex) => (
                      <button
                        key={`${color}-${colorIndex}`}
                        type="button"
                        className="h-4 w-4 cursor-pointer rounded-full border border-[#D0D0D0] hover:scale-110"
                        style={{ background: color }}
                        aria-label={`Ustaw kolor ${color}`}
                        onClick={() => {
                          const updateColorOperation: UpdateEquationColorOp = {
                            ...createOpMeta(),
                            type: 'update_color',
                            id: row.id,
                            colorIndex,
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
                    console.log(nextLatex);
                    parseEquation(nextLatex);
                    const updateLatexOperation: UpdateEquationLatexOp = {
                      ...createOpMeta(),
                      type: 'update_latex',
                      id: row.id,
                      latex: nextLatex,
                    };
                    dispatchEquationOperation(updateLatexOperation);
                  }}
                  // onKeyDown={(event) => {
                  //   if (event.key === 'ArrowDown') {
                  //     event.preventDefault();
                  //     event.stopPropagation();
                  //     focusEquationByIndex(index + 1);
                  //     return;
                  //   }

                  //   if (event.key === 'ArrowUp') {
                  //     event.preventDefault();
                  //     event.stopPropagation();
                  //     focusEquationByIndex(Math.max(0, index - 1));
                  //     return;
                  //   }

                  //   if (event.key !== 'Enter') {
                  //     return;
                  //   }

                  //   event.preventDefault();
                  //   event.stopPropagation();
                  //   focusEquationByIndex(index + 1);
                  // }}
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
