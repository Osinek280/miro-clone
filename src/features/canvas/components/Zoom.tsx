import { ZOOM_MAX, ZOOM_MIN } from '../constants/cameraConstants';
import { Icon } from '../constants/icons';

export function Zoom({
  handleZoomOut,
  handleZoomIn,
  handleZoomReset,
  displayZoom,
}: {
  handleZoomOut: () => void;
  handleZoomIn: () => void;
  handleZoomReset: () => void;
  displayZoom: number;
}) {
  return (
    <div className="absolute bottom-4 right-3.5 flex items-center gap-1 bg-[#f9f6f0]/95 border border-black/10 rounded-md px-2 py-1 shadow-[0_4px_16px_rgba(13,13,13,0.07)] backdrop-blur-xl z-40">
      <button
        onClick={handleZoomOut}
        disabled={displayZoom <= ZOOM_MIN}
        className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/5 text-gray-400 hover:text-black transition-all"
      >
        {Icon.minus}
      </button>
      <span className="text-[0.65rem] text-gray-600 min-w-10 text-center tracking-wide">
        {Math.round(displayZoom * 100)}%
      </span>
      <button
        onClick={handleZoomIn}
        disabled={displayZoom >= ZOOM_MAX}
        className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/5 text-gray-400 hover:text-black transition-all"
      >
        {Icon.plus}
      </button>
      <button
        onClick={handleZoomReset}
        className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/5 text-gray-400 hover:text-black transition-all"
      >
        {Icon.home}
      </button>
    </div>
  );
}
