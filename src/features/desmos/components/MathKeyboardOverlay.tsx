import { useCallback } from 'react';
import { MathKeyboard } from './MathKeyboard';
import { useEquationStore } from '../store/useEquationStore';

export function MathKeyboardOverlay() {
  const equationInputFocused = useEquationStore((s) => s.equationInputFocused);
  const getTarget = useCallback(
    () => useEquationStore.getState().getMathTarget(),
    [],
  );

  return (
    <MathKeyboard getTarget={getTarget} visible={equationInputFocused} />
  );
}