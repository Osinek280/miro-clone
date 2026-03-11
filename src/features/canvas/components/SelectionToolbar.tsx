import { useEffect, useState } from 'react';
import type { Camera, SelectionBox } from '../types/types';
import { worldToScreen } from '../utils/cameraUtils';
import type { RefObject } from 'react';
import { PALETTE_COLORS } from '../constants/paletteColors';
import { Icon } from '../constants/icons';

type SelectionToolbarProps = {
  selectedBoundingBox: SelectionBox;
  cameraRef: RefObject<Camera>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onDelete?: () => void;
};

export default function SelectionToolbar({
  selectedBoundingBox,
  cameraRef,
  canvasRef,
  onDelete,
}: SelectionToolbarProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );

  useEffect(() => {
    // Update position on camera changes (zoom/pan) using requestAnimationFrame
    let rafId: number | null = null;
    const animate = () => {
      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera || !selectedBoundingBox) {
        setPosition(null);
        return;
      }

      const rect = canvas.getBoundingClientRect();

      // Convert bounding box center to screen coordinates
      const centerX =
        (selectedBoundingBox.start.x + selectedBoundingBox.end.x) / 2;
      const centerY =
        (selectedBoundingBox.start.y + selectedBoundingBox.end.y) / 2;

      const screenPos = worldToScreen(centerX, centerY, canvasRef, camera);

      // Calculate bounding box height in screen space
      const boxHeight =
        Math.abs(selectedBoundingBox.end.y - selectedBoundingBox.start.y) *
        camera.zoom;

      // Position toolbar above the selection with some padding
      const toolbarHeight = 48; // Approximate toolbar height
      const padding = 12;
      let x = screenPos.x;
      let y = screenPos.y - boxHeight / 2 - toolbarHeight - padding;

      // Ensure toolbar stays within viewport bounds
      const toolbarWidth = 400; // Approximate toolbar width (updated for new elements)
      const minX = rect.left + 10;
      const maxX = rect.left + rect.width - toolbarWidth - 10;
      const minY = rect.top + 10;
      const maxY = rect.top + rect.height - toolbarHeight - 10;

      x = Math.max(minX, Math.min(maxX, x - toolbarWidth / 2));
      y = Math.max(minY, Math.min(maxY, y));

      setPosition({ x, y });
      rafId = requestAnimationFrame(animate);
    };

    // Start animation loop
    rafId = requestAnimationFrame(animate);

    // Also update on window resize
    const handleResize = () => {
      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera || !selectedBoundingBox) {
        setPosition(null);
        return;
      }

      const rect = canvas.getBoundingClientRect();

      const centerX =
        (selectedBoundingBox.start.x + selectedBoundingBox.end.x) / 2;
      const centerY =
        (selectedBoundingBox.start.y + selectedBoundingBox.end.y) / 2;

      const screenPos = worldToScreen(centerX, centerY, canvasRef, camera);

      const boxHeight =
        Math.abs(selectedBoundingBox.end.y - selectedBoundingBox.start.y) *
        camera.zoom;

      const toolbarHeight = 48;
      const padding = 12;
      let x = screenPos.x;
      let y = screenPos.y - boxHeight / 2 - toolbarHeight - padding;

      const toolbarWidth = 400; // Updated for new elements
      const minX = rect.left + 10;
      const maxX = rect.left + rect.width - toolbarWidth - 10;
      const minY = rect.top + 10;
      const maxY = rect.top + rect.height - toolbarHeight - 10;

      x = Math.max(minX, Math.min(maxX, x - toolbarWidth / 2));
      y = Math.max(minY, Math.min(maxY, y));

      setPosition({ x, y });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedBoundingBox, cameraRef, canvasRef]);

  if (!selectedBoundingBox || !position) {
    return null;
  }

  return (
    <div
      className="absolute flex items-center gap-2 bg-[#f9f6f0]/95 border border-black/10 rounded-xl px-3 py-2 shadow-[0_8px_30px_rgba(13,13,13,0.09)] backdrop-blur-xl z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* COLORS */}
      <div className="flex items-center gap-1.5">
        {PALETTE_COLORS.map((hex) => (
          <div
            key={hex}
            title={hex}
            // onClick={() => setColor(hex)}
            className={`w-5 h-5 rounded-full cursor-pointer transition-all
              ${'#0d0d0d' === hex ? 'ring-2 ring-black scale-110' : 'hover:scale-125'}
            `}
            style={{ background: hex }}
          />
        ))}
      </div>

      <div className="w-px h-5 bg-black/10" />

      {/* SIZE */}
      <div className="flex items-center gap-2 text-[0.6rem] uppercase tracking-wider text-gray-400">
        <span>Size</span>

        <input
          type="range"
          min={1}
          max={150}
          // value={size}
          // onChange={(e) => setSize(+e.target.value)}
          className="w-20 h-1 accent-black"
        />

        <span className="text-gray-500 min-w-6 text-center">10</span>
      </div>

      <div className="w-px h-5 bg-black/10" />

      {/* FLIP */}
      <button
        // onClick={onFlipH}
        title="Flip Horizontal"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-black/5 hover:text-black transition-all"
      >
        {Icon.flipH}
      </button>

      <button
        // onClick={onFlipV}
        title="Flip Vertical"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-black/5 hover:text-black transition-all"
      >
        {Icon.flipV}
      </button>

      <div className="w-px h-5 bg-black/10" />

      {/* DELETE */}
      <button
        onClick={onDelete}
        title="Delete (Del)"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 transition-all"
      >
        {Icon.trash}
      </button>
    </div>
  );
}
