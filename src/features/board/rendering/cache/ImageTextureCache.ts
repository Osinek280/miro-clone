import type { DrawObject, ImageDrawObject } from '../../types/types';
import { useCanvasStore } from '../../store/useCanvasStore';

type Entry = {
  texture: WebGLTexture;
  stateKey: string;
};

/**
 * One GL texture per image object id. Bitmap identity is `src` only (position changes reuse texture).
 * Sync-decoded images upload inside the current `render()`; async loads trigger one `renderFrame` when ready.
 */
export class ImageTextureCache {
  private entries = new Map<string, Entry>();

  sync(gl: WebGLRenderingContext, objects: DrawObject[]): void {
    const keep = new Set(
      objects
        .filter((o): o is ImageDrawObject => o.type === 'IMAGE')
        .map((o) => o.id),
    );
    for (const id of this.entries.keys()) {
      if (!keep.has(id)) {
        gl.deleteTexture(this.entries.get(id)!.texture);
        this.entries.delete(id);
      }
    }
  }

  /**
   * Returns texture for drawing (may be 1×1 transparent placeholder until `Image` loads).
   */
  ensure(gl: WebGLRenderingContext, obj: ImageDrawObject): WebGLTexture {
    const stateKey = obj.src;
    const existing = this.entries.get(obj.id);
    if (existing && existing.stateKey === stateKey) {
      return existing.texture;
    }

    if (existing) {
      gl.deleteTexture(existing.texture);
      this.entries.delete(obj.id);
    }

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('[ImageTextureCache] createTexture failed');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );

    const img = new Image();
    if (!obj.src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    let uploaded = false;
    const applyBitmap = (): void => {
      const cur = this.entries.get(obj.id);
      if (!cur || cur.texture !== texture || cur.stateKey !== stateKey) return;
      if (uploaded) return;
      if (!img.complete || img.naturalWidth === 0) return;
      uploaded = true;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };

    let allowAsyncRedraw = false;
    img.onload = () => {
      applyBitmap();
      if (allowAsyncRedraw) {
        useCanvasStore.getState().renderFrame();
      }
    };

    img.onerror = () => {
      // Keep placeholder; no redraw spam
    };

    img.src = obj.src;
    allowAsyncRedraw = true;
    applyBitmap();

    this.entries.set(obj.id, { texture, stateKey });
    return texture;
  }

  dispose(gl: WebGLRenderingContext): void {
    for (const { texture } of this.entries.values()) {
      gl.deleteTexture(texture);
    }
    this.entries.clear();
  }
}
