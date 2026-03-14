import { useEffect, useState } from 'react';
import { DrawModeEnum, type ToolState } from '../types/types';

export function usePalette(
  tsRef: React.RefObject<ToolState>,
  mode: DrawModeEnum,
  setMode: React.Dispatch<React.SetStateAction<DrawModeEnum>>
) {
  const [color, setColor] = useState('#000');
  const [size, setSize] = useState(10);

  useEffect(() => {
    if (!tsRef.current) return;

    if (mode !== DrawModeEnum.Draw) setMode(DrawModeEnum.Draw);

    tsRef.current.color = color;
    tsRef.current.size = size;
  }, [color, size, tsRef]);

  return { color, size, setColor, setSize };
}
