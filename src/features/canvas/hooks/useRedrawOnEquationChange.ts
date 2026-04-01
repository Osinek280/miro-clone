import { useEffect } from 'react';
import { useEquationStore } from '../../desmos/store/useEquationStore';
import { useCanvasStore } from './useCanvasStore';

/**
 * `renderFrame` builds curves from `useEquationStore.getState().equations`, but
 * equation-store updates do not flow through the canvas store — without this
 * subscription the canvas would not refresh after add/edit/remove. Parent-level
 * subscription (composition) instead of desmos → canvas calls inside store actions.
 */
export function useRedrawOnEquationChange() {
  useEffect(() => {
    return useEquationStore.subscribe((state, prev) => {
      if (state.equations === prev.equations) return;
      useCanvasStore.getState().scheduleRedraw();
    });
  }, []);
}
