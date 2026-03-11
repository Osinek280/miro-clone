import { useEffect, useState } from 'react';
import type { Camera, SelectionBox } from '../types/types';
import { worldToScreen } from '../utils/cameraUtils';
import type { RefObject } from 'react';
import { PALETTE_COLORS } from '../constants/paletteColors';
import { Icon } from '../constants/icons';

const TOOLBAR_WIDTH = 400;
const TOOLBAR_HEIGHT = 48;
const GAP = 12;
const VIEWPORT_PADDING = 10;

function getExclusionZones() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  return [
    { left: 0, right: 80, top: 0, bottom: H },
    { left: W / 2 - 200, right: W / 2 + 200, top: H - 56, bottom: H },
    { left: W - 160, right: W, top: H - 56, bottom: H },
  ];
}

function rectsOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number }
) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function clampToolbarToViewport(x: number, y: number) {
  return {
    x: Math.max(VIEWPORT_PADDING, Math.min(window.innerWidth - TOOLBAR_WIDTH - VIEWPORT_PADDING, x)),
    y: Math.max(VIEWPORT_PADDING, Math.min(window.innerHeight - TOOLBAR_HEIGHT - VIEWPORT_PADDING, y)),
  };
}

/** Default: above selection. Use another side only if above would overlap UI zones or stick out of viewport. */
function getToolbarPosition(
  selLeft: number,
  selRight: number,
  selTop: number,
  selBottom: number
): { x: number; y: number } {
  const centerX = (selLeft + selRight) / 2;
  const centerY = (selTop + selBottom) / 2;
  const vpCenterX = window.innerWidth / 2;
  const vpCenterY = window.innerHeight / 2;
  const zones = getExclusionZones();

  const isClampedRectValid = (x: number, y: number) => {
    const rect = { left: x, right: x + TOOLBAR_WIDTH, top: y, bottom: y + TOOLBAR_HEIGHT };
    return !zones.some((z) => rectsOverlap(rect, z));
  };

  const candidates: { x: number; y: number; score: number }[] = [];

  // Above selection (default – highest score)
  let x = centerX - TOOLBAR_WIDTH / 2;
  let y = selTop - TOOLBAR_HEIGHT - GAP;
  const aboveClamped = clampToolbarToViewport(x, y);
  if (isClampedRectValid(aboveClamped.x, aboveClamped.y)) {
    candidates.push({ ...aboveClamped, score: 2 });
  }

  // Below selection
  y = selBottom + GAP;
  const belowClamped = clampToolbarToViewport(x, y);
  if (isClampedRectValid(belowClamped.x, belowClamped.y)) {
    candidates.push({ ...belowClamped, score: centerY < vpCenterY ? 1 : 0 });
  }

  // Left of selection
  x = selLeft - TOOLBAR_WIDTH - GAP;
  y = centerY - TOOLBAR_HEIGHT / 2;
  const leftClamped = clampToolbarToViewport(x, y);
  if (isClampedRectValid(leftClamped.x, leftClamped.y)) {
    candidates.push({ ...leftClamped, score: centerX > vpCenterX ? 1 : 0 });
  }

  // Right of selection
  x = selRight + GAP;
  const rightClamped = clampToolbarToViewport(x, y);
  if (isClampedRectValid(rightClamped.x, rightClamped.y)) {
    candidates.push({ ...rightClamped, score: centerX < vpCenterX ? 1 : 0 });
  }

  if (candidates.length === 0) {
    return clampToolbarToViewport(centerX - TOOLBAR_WIDTH / 2, selTop - TOOLBAR_HEIGHT - GAP);
  }

  const best = candidates.reduce((a, b) => (a.score >= b.score ? a : b));
  return { x: best.x, y: best.y };
}

type SelectionToolbarProps = {
  selectedBoundingBox: SelectionBox;
  cameraRef: RefObject<Camera>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isMoving?: boolean;
  onDelete?: () => void;
};

export default function SelectionToolbar({
  selectedBoundingBox,
  cameraRef,
  canvasRef,
  isMoving = false,
  onDelete,
}: SelectionToolbarProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null
  );

  useEffect(() => {
    let rafId: number | null = null;
    const animate = () => {
      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera || !selectedBoundingBox) {
        setPosition(null);
        return;
      }

      const minX = Math.min(selectedBoundingBox.start.x, selectedBoundingBox.end.x);
      const maxX = Math.max(selectedBoundingBox.start.x, selectedBoundingBox.end.x);
      const minY = Math.min(selectedBoundingBox.start.y, selectedBoundingBox.end.y);
      const maxY = Math.max(selectedBoundingBox.start.y, selectedBoundingBox.end.y);

      const topLeft = worldToScreen(minX, minY, canvasRef, camera);
      const bottomRight = worldToScreen(maxX, maxY, canvasRef, camera);
      const selLeft = Math.min(topLeft.x, bottomRight.x);
      const selRight = Math.max(topLeft.x, bottomRight.x);
      const selTop = Math.min(topLeft.y, bottomRight.y);
      const selBottom = Math.max(topLeft.y, bottomRight.y);

      const pos = getToolbarPosition(selLeft, selRight, selTop, selBottom);
      setPosition(pos);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    const handleResize = () => {
      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera || !selectedBoundingBox) {
        setPosition(null);
        return;
      }

      const minX = Math.min(selectedBoundingBox.start.x, selectedBoundingBox.end.x);
      const maxX = Math.max(selectedBoundingBox.start.x, selectedBoundingBox.end.x);
      const minY = Math.min(selectedBoundingBox.start.y, selectedBoundingBox.end.y);
      const maxY = Math.max(selectedBoundingBox.start.y, selectedBoundingBox.end.y);

      const topLeft = worldToScreen(minX, minY, canvasRef, camera);
      const bottomRight = worldToScreen(maxX, maxY, canvasRef, camera);
      const selLeft = Math.min(topLeft.x, bottomRight.x);
      const selRight = Math.max(topLeft.x, bottomRight.x);
      const selTop = Math.min(topLeft.y, bottomRight.y);
      const selBottom = Math.max(topLeft.y, bottomRight.y);

      const pos = getToolbarPosition(selLeft, selRight, selTop, selBottom);
      setPosition(pos);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [selectedBoundingBox, cameraRef, canvasRef]);

  if (!selectedBoundingBox || !position) {
    return null;
  }

  return (
    <div
      className="fixed flex items-center gap-2 bg-[#f9f6f0]/95 border border-black/10 rounded-xl px-3 py-2 shadow-[0_8px_30px_rgba(13,13,13,0.09)] backdrop-blur-xl z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        pointerEvents: isMoving ? 'none' : 'auto',
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
