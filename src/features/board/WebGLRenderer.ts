import type { DrawObject, Point, SelectionBox } from './types/types';
import { GeometryCache } from './rendering/cache/GeometryCache';
import { ImageTextureCache } from './rendering/cache/ImageTextureCache';
import { BrushPipeline } from './rendering/pipelines/BrushPipeline';
import { CursorPipeline } from './rendering/pipelines/CursorPipeline';
import { ImagePipeline } from './rendering/pipelines/ImagePipeline';
import { RectPipeline } from './rendering/pipelines/RectPipeline';
import { buildSceneDrawPasses } from './rendering/scene/SceneAssembler';

export class WebGLRenderer {
  private gl: WebGLRenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private vertexBuffer: WebGLBuffer | null = null;

  private cache = new GeometryCache();
  private imageTextures = new ImageTextureCache();

  private brushPipeline: BrushPipeline | null = null;
  private rectPipeline: RectPipeline | null = null;
  private cursorPipeline: CursorPipeline | null = null;
  private imagePipeline: ImagePipeline | null = null;

  setRequestRedraw(cb: () => void): void {
    this.imageTextures.setRequestRedraw(cb);
  }

  initialize(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;

    const gl = canvas.getContext('webgl', {
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    }) as WebGLRenderingContext | null;

    if (!gl) {
      console.error('[WebGLRenderer] WebGL not supported');
      return false;
    }
    this.gl = gl;

    const maxPtSize = gl.getParameter(
      gl.ALIASED_POINT_SIZE_RANGE,
    ) as Float32Array;
    console.info(`[WebGLRenderer] Max point size: ${maxPtSize[1]}px`);

    this.brushPipeline = BrushPipeline.create(gl);
    this.rectPipeline = RectPipeline.create(gl);
    this.cursorPipeline = CursorPipeline.create(gl);
    this.imagePipeline = ImagePipeline.create(gl);

    this.vertexBuffer = gl.createBuffer();
    if (
      !this.vertexBuffer ||
      !this.brushPipeline ||
      !this.rectPipeline ||
      !this.cursorPipeline ||
      !this.imagePipeline
    ) {
      return false;
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.resizeCanvas();
    return true;
  }

  /**
   * Match backing store to CSS size and refresh viewport. Call every frame so
   * viewport stays correct after context quirks; skip when layout not ready (0×0).
   */
  resizeCanvas(): void {
    if (!this.canvas || !this.gl) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const gl = this.gl;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  render(
    objects: DrawObject[],
    currentPath: Point[],
    zoom: number = 1.0,
    offsetX: number = 0,
    offsetY: number = 0,
    currentColor: string,
    currentSize: number,
    selectionBox: SelectionBox,
    selectedBoundingBox: SelectionBox,
    selectionDrag: {
      offset: Point;
      selectedIds: readonly string[];
    } | null = null,
    cursors: Point[],
  ): void {
    const gl = this.gl;
    const canvas = this.canvas;
    const vertexBuffer = this.vertexBuffer;
    if (
      !gl ||
      !canvas ||
      !vertexBuffer ||
      !this.brushPipeline ||
      !this.rectPipeline ||
      !this.cursorPipeline ||
      !this.imagePipeline
    ) {
      return;
    }

    this.resizeCanvas();

    this.cache.sync(objects);
    this.imageTextures.sync(gl, objects);

    console.log('objects', objects);

    const passes = buildSceneDrawPasses({
      objects,
      cache: this.cache,
      currentPath,
      currentColor,
      currentSize,
      selectionDrag,
    });

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    for (const pass of passes) {
      if (pass.kind === 'brush') {
        if (pass.pointCount <= 0) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, pass.vertices, gl.DYNAMIC_DRAW);
        this.brushPipeline.draw({
          gl,
          canvas,
          vertexBuffer,
          pointCount: pass.pointCount,
          zoom,
          offsetX,
          offsetY,
        });
      } else {
        const tex = this.imageTextures.ensure(gl, pass.obj);
        this.imagePipeline.draw({
          gl,
          canvas,
          texture: tex,
          x: pass.drawX,
          y: pass.drawY,
          width: pass.obj.width,
          height: pass.obj.height,
          zoom,
          offsetX,
          offsetY,
        });
      }
    }

    if (selectionBox) {
      this.rectPipeline.drawRect({
        gl,
        canvas,
        box: selectionBox,
        color: [0.23, 0.51, 0.96, 0.6],
        zoom,
        offsetX,
        offsetY,
      });
    }

    if (selectedBoundingBox) {
      let box = selectedBoundingBox;
      if (
        selectionDrag &&
        (selectionDrag.offset.x !== 0 || selectionDrag.offset.y !== 0)
      ) {
        const { x: dx, y: dy } = selectionDrag.offset;
        box = {
          start: {
            x: selectedBoundingBox.start.x + dx,
            y: selectedBoundingBox.start.y + dy,
          },
          end: {
            x: selectedBoundingBox.end.x + dx,
            y: selectedBoundingBox.end.y + dy,
          },
        };
      }

      this.rectPipeline.drawRect({
        gl,
        canvas,
        box,
        color: [0.23, 0.51, 0.96, 1.0],
        zoom,
        offsetX,
        offsetY,
      });
    }

    this.cursorPipeline.draw({
      gl,
      canvas,
      cursors,
      color: currentColor,
      zoom,
      offsetX,
      offsetY,
    });
  }

  cleanup(): void {
    const gl = this.gl;
    if (gl) {
      if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
      this.brushPipeline?.dispose(gl);
      this.rectPipeline?.dispose(gl);
      this.cursorPipeline?.dispose(gl);
      this.imagePipeline?.dispose(gl);
      this.imageTextures.dispose(gl);
    }

    this.gl = null;
    this.canvas = null;
    this.vertexBuffer = null;
    this.brushPipeline = null;
    this.rectPipeline = null;
    this.cursorPipeline = null;
    this.imagePipeline = null;
    this.cache.clear();
  }
}
