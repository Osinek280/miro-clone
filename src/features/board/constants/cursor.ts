const CURSOR_VIEW_W = 12.3;
const CURSOR_VIEW_H = 17.7;
/** Sprite height in CSS px; width follows viewBox aspect (no square stretch). */
export const CURSOR_H_PX = 24;
export const CURSOR_W_PX = CURSOR_H_PX * (CURSOR_VIEW_W / CURSOR_VIEW_H);
/** Integer raster size for Image() decode — must keep VIEW_W:VIEW_H ratio (not 100% / square bitmap). */
const CURSOR_RASTER_W = 123;
const CURSOR_RASTER_H = 177;

/** Same path as Whiteboard overlay: fill only (no stroke). White = alpha mask, tinted in shader. */
export const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_RASTER_W}" height="${CURSOR_RASTER_H}" viewBox="0 0 ${CURSOR_VIEW_W} ${CURSOR_VIEW_H}" fill="none"><path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z" fill="#ffffff"/></svg>`;
