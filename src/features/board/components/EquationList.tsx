import { Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addStyles, EditableMathField } from 'react-mathquill';

type EquationItem = {
  id: string;
  latex: string;
  color: string;
};

const colorOptions = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19'];

const initialEquations: EquationItem[] = [
  { id: 'eq-1', latex: 'a^2 + b^2 = c^2', color: '#c74440' },
  {
    id: 'eq-2',
    latex: 'x = (-b ± √(b^2 - 4ac)) / 2a',
    color: '#2d70b3',
  },
  { id: 'eq-3', latex: 'e^(iπ) + 1 = 0', color: '#388c46' },
];

export default function EquationList() {
  const [equations, setEquations] = useState<EquationItem[]>(initialEquations);
  const [openedColorPickerId, setOpenedColorPickerId] = useState<string | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);

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

  if (equations.length === 0) {
    return (
      <div className="flex h-full flex-col gap-2 p-2">
        <div className="text-sm text-gray-500">No equations yet.</div>
      </div>
    );
  }

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
                          setEquations((current) =>
                            current.map((equation) =>
                              equation.id === row.id
                                ? { ...equation, color }
                                : equation,
                            ),
                          );
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
                  // onChange={(mf) => updateLatex(row.id, mf.latex())}
                  // mathquillDidMount={(mf) => {
                  //   useEquationStore.getState().registerMathField(row.id, mf);
                  // }}
                  // onFocus={() => {
                  //   useEquationStore.getState().setActiveEquationId(row.id);
                  //   setEquationInputFocused(true);
                  // }}
                  // onBlur={() => {
                  //   setEquationInputFocused(false);

                  //   const equation = useEquationStore
                  //     .getState()
                  //     .equations.find((e) => e.id === row.id);

                  //   if (equation) {
                  //     pushSyncedEquation(equation, 'upsert');
                  //   }
                  // }}
                />
                {/* {glslError ? (
                  <p
                    className="mt-1 px-0.5 text-xs leading-snug text-red-600"
                    role="alert"
                  >
                    {glslError}
                  </p>
                ) : null} */}
              </div>
              <button
                type="button"
                // disabled={equations.length <= 1}
                className="shrink-0 cursor-pointer rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Usuń równanie"
                // onClick={() => removeRow(row.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
        <li
          className="flex min-h-10 items-stretch border-[#E0E0E0]"
          style={{ margin: 0, padding: 0 }}
        >
          <span
            className="relative cursor-pointer inline-flex w-10 shrink-0 items-center justify-center self-stretch"
            aria-hidden
          >
            <div
              className="h-5 w-5 rounded-full shadow-sm transition-transform duration-150"
              style={{
                background: colorOptions[0],
              }}
            />
            <span className="absolute -left-1 top-0 px-1 text-[10px] text-[#666]">
              {equations.length + 1}
            </span>
          </span>
          <div className="min-w-0 flex flex-1 items-center self-stretch border-l border-[#E0E0E0]">
            <EditableMathField
              latex=""
              className="m-0 block w-full rounded-none bg-white px-2 text-[15px]"
              config={{ spaceBehavesLikeTab: true }}
              // onChange={(mf) => updateLatex(row.id, mf.latex())}
              // mathquillDidMount={(mf) => {
              //   useEquationStore.getState().registerMathField(row.id, mf);
              // }}
              // onFocus={() => {
              //   useEquationStore.getState().setActiveEquationId(row.id);
              //   setEquationInputFocused(true);
              // }}
              // onBlur={() => {
              //   setEquationInputFocused(false);

              //   const equation = useEquationStore
              //     .getState()
              //     .equations.find((e) => e.id === row.id);

              //   if (equation) {
              //     pushSyncedEquation(equation, 'upsert');
              //   }
              // }}
            />
            {/* {glslError ? (
                  <p
                    className="mt-1 px-0.5 text-xs leading-snug text-red-600"
                    role="alert"
                  >
                    {glslError}
                  </p>
                ) : null} */}
          </div>
        </li>
      </ul>
    </div>
  );
}
