import type { DrawObject, Point, SelectionBox } from './types/types';

// ─────────────────────────────────────────────────────────────────────────────
// WebGLRenderer – circle-stamp line renderer
//
// Philosophy (like Miro / Procreate / Excalidraw):
//   Each path point = a filled circle rendered with gl.POINTS.
//   Overlapping circles create a perfectly smooth, continuous line.
//   No miter joint issues, no sharp edges.
//
//   gl_PointSize = size * zoom  →  circles scale with the camera
//   SDF in the fragment shader  →  antialiased circular edge
//
// Performance (10k+ objects):
//   • Single draw call for the entire scene (merged buffer)
//   • Per-object cache – rebuild only when points/color/size change
//   • Interleaved buffer: [x, y, r, g, b, a, pointSize]
//   • Point density controlled by MIN_DIST (~1.5px in world space)
// ─────────────────────────────────────────────────────────────────────────────

// Minimum distance between stored points (world space).
// mouseMove already interpolates every ~2px – this remains as a fallback.
const MIN_DIST = 1.5;

// Floats per vertex in interleaved buffer
// [x, y, r, g, b, a, pointSize]
const FPV = 7;
const CURSOR_SIZE_PX = 24;
const CURSOR_SVG = `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-75 12 12)"><path d="M20.5056 10.7754C21.1225 10.5355 21.431 10.4155 21.5176 10.2459C21.5926 10.099 21.5903 9.92446 21.5115 9.77954C21.4205 9.61226 21.109 9.50044 20.486 9.2768L4.59629 3.5728C4.0866 3.38983 3.83175 3.29835 3.66514 3.35605C3.52029 3.40621 3.40645 3.52004 3.35629 3.6649C3.29859 3.8315 3.39008 4.08635 3.57304 4.59605L9.277 20.4858C9.50064 21.1088 9.61246 21.4203 9.77973 21.5113C9.92465 21.5901 10.0991 21.5924 10.2461 21.5174C10.4157 21.4308 10.5356 21.1223 10.7756 20.5054L13.3724 13.8278C13.4194 13.707 13.4429 13.6466 13.4792 13.5957C13.5114 13.5506 13.5508 13.5112 13.5959 13.479C13.6468 13.4427 13.7072 13.4192 13.828 13.3722L20.5056 10.7754Z" fill="#22c55e" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

// ── Shaders ───────────────────────────────────────────────────────────────────

const VERT_RECT = `
// VERT_RECT
attribute vec2 a_pos;
uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform float u_zoom;

void main() {
  vec2 screen = a_pos * u_zoom + u_offset;
  vec2 ndc = screen / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}
`;

const FRAG_RECT = `
// FRAG_RECT
precision mediump float;
uniform vec4 u_rectColor;

void main() {
  gl_FragColor = u_rectColor;
}`;

const VERT_CURSOR = `
attribute vec2 a_unit;
uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform float u_zoom;
uniform vec2 u_anchor;
uniform float u_sizePx;
varying vec2 v_uv;

void main() {
  vec2 anchorScreen = u_anchor * u_zoom + u_offset;
  vec2 screen = anchorScreen + a_unit * u_sizePx;
  vec2 ndc = screen / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  v_uv = a_unit;
}
`;

const FRAG_CURSOR = `
precision mediump float;
uniform sampler2D u_tex;
varying vec2 v_uv;

void main() {
  vec4 c = texture2D(u_tex, v_uv);
  if (c.a < 0.01) discard;
  gl_FragColor = c;
}
`;

const VERT = /* glsl */ `
  precision highp float;

  attribute vec2  a_pos;
  attribute vec4  a_color;
  attribute float a_size;

  uniform vec2  u_resolution;
  uniform vec2  u_offset;
  uniform float u_zoom;

  varying vec4 v_color;

  void main() {
    // world → screen px
    vec2 screen = a_pos * u_zoom + u_offset;

    // screen → NDC, flip Y
    vec2 ndc = screen / u_resolution * 2.0 - 1.0;
    gl_Position  = vec4(ndc.x, -ndc.y, 0.0, 1.0);

    // Circle size scales with zoom (world-space size)
    gl_PointSize = a_size * u_zoom;

    v_color = a_color;
  }
`;

/**
 * Fragment shader – SDF circle with antialiasing.
 *
 * gl_PointCoord: (0,0) top-left, (1,1) bottom-right
 * dist from center = length(gl_PointCoord - 0.5) * 2  →  0=center, 1=edge
 * smoothstep gives ~1px soft edge independent of circle size.
 */
const FRAG = /* glsl */ `
  precision mediump float;

  varying vec4 v_color;

  void main() {
    // Distance from point center: 0 = center, 1 = edge
    float dist  = length(gl_PointCoord - 0.5) * 2.0;

    // ~1px antialiasing on circle edge
    float alpha = step(dist, 1.0);
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
  }
`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CachedGeometry {
  buffer: Float32Array; // interleaved [x,y, r,g,b,a, size] per point
  pointCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string): [number, number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6) return [0, 0, 0, 1];
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
    1,
  ];
}

/**
 * Fragment shader – SDF circle with antialiasing.
 *
 * gl_PointCoord: (0,0) top-left corner, (1,1) bottom-right
 * Distance from the center = length(gl_PointCoord - 0.5) * 2  →  0 = center, 1 = edge
 * smoothstep produces a ~1px soft edge independent of the circle size.
 */
function buildPointBuffer(
  points: Point[],
  color: [number, number, number, number],
  size: number,
): CachedGeometry | null {
  if (points.length === 0) return null;

  const [r, g, b, a] = color;
  const buf: number[] = [];

  let lastX = NaN,
    lastY = NaN;

  for (const p of points) {
    const dx = p.x - lastX,
      dy = p.y - lastY;
    if (dx * dx + dy * dy < MIN_DIST * MIN_DIST && buf.length > 0) continue;

    buf.push(p.x, p.y, r, g, b, a, size);
    lastX = p.x;
    lastY = p.y;
  }

  // Always add the last point so the path ends exactly there
  const last = points[points.length - 1];
  if (last.x !== lastX || last.y !== lastY) {
    buf.push(last.x, last.y, r, g, b, a, size);
  }

  const pointCount = buf.length / FPV;
  return { buffer: new Float32Array(buf), pointCount };
}

/** Copy cached interleaved vertices into `all` at `byteOffset` floats, adding (ox, oy) to x,y. */
function writeCachedGeometryWithOffset(
  g: CachedGeometry,
  all: Float32Array,
  floatOffset: number,
  ox: number,
  oy: number,
): void {
  const buf = g.buffer;
  const pc = g.pointCount;
  if (ox === 0 && oy === 0) {
    all.set(buf, floatOffset);
    return;
  }
  let w = floatOffset;
  for (let i = 0; i < pc; i++) {
    const si = i * FPV;
    all[w] = buf[si] + ox;
    all[w + 1] = buf[si + 1] + oy;
    all[w + 2] = buf[si + 2];
    all[w + 3] = buf[si + 3];
    all[w + 4] = buf[si + 4];
    all[w + 5] = buf[si + 5];
    all[w + 6] = buf[si + 6];
    w += FPV;
  }
}

// ── WebGLRenderer ─────────────────────────────────────────────────────────────

export class WebGLRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private canvas: HTMLCanvasElement | null = null;

  private rectProgram: WebGLProgram | null = null;
  private rectBuf!: WebGLBuffer;
  private rectAPos: number = -1;
  private uRectResolution!: WebGLUniformLocation;
  private uRectOffset!: WebGLUniformLocation;
  private uRectZoom!: WebGLUniformLocation;
  private uRectColor!: WebGLUniformLocation;
  private cursorProgram: WebGLProgram | null = null;
  private cursorAPos: number = -1;
  private uCursorResolution!: WebGLUniformLocation;
  private uCursorOffset!: WebGLUniformLocation;
  private uCursorZoom!: WebGLUniformLocation;
  private uCursorAnchor!: WebGLUniformLocation;
  private uCursorSize!: WebGLUniformLocation;
  private uCursorTex!: WebGLUniformLocation;
  private cursorTexture: WebGLTexture | null = null;

  // Attribute / uniform locations
  private aPos: number = -1;
  private aColor: number = -1;
  private aSize: number = -1;

  private uResolution!: WebGLUniformLocation;
  private uOffset!: WebGLUniformLocation;
  private uZoom!: WebGLUniformLocation;

  // Single GPU vertex buffer (interleaved, entire scene)
  private bufVertex!: WebGLBuffer;
  private cursorBuf!: WebGLBuffer;

  // Per-object geometry cache
  private geoCache = new Map<string, CachedGeometry | null>();
  private cacheKeys = new Map<string, string>();

  // ── Private ─────────────────────────────────────────────────────────────────

  private createShader(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[WebGLRenderer] Shader:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  private createProgram(
    vert: WebGLShader,
    frag: WebGLShader,
  ): WebGLProgram | null {
    const gl = this.gl!;
    const p = gl.createProgram();
    if (!p) return null;
    gl.attachShader(p, vert);
    gl.attachShader(p, frag);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[WebGLRenderer] Link:', gl.getProgramInfoLog(p));
      gl.deleteProgram(p);
      return null;
    }
    return p;
  }

  private initializeCursorTexture(): void {
    const gl = this.gl!;
    if (!this.cursorTexture) return;

    gl.bindTexture(gl.TEXTURE_2D, this.cursorTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    // Transparent 1x1 fallback until SVG image is loaded.
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
    img.onload = () => {
      if (!this.gl || !this.cursorTexture) return;
      const gl2 = this.gl;
      gl2.bindTexture(gl2.TEXTURE_2D, this.cursorTexture);
      gl2.texImage2D(
        gl2.TEXTURE_2D,
        0,
        gl2.RGBA,
        gl2.RGBA,
        gl2.UNSIGNED_BYTE,
        img,
      );
    };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(CURSOR_SVG)}`;
  }

  /** Fingerprint for cache invalidation */
  private stateKey(obj: DrawObject): string {
    const f = obj.points[0],
      l = obj.points[obj.points.length - 1];
    return `${obj.color || '#000'}|${obj.size}|${obj.points.length}|${f?.x},${f?.y}|${l?.x},${l?.y}`;
  }

  /**
   * Merges geometry of all objects + currentPath into one Float32Array
   * and uploads to GPU with a single gl.bufferData.
   * Returns the number of points to draw.
   */
  private mergeAndUpload(
    objects: DrawObject[],
    currentPath: Point[],
    currentColor: string,
    currentSize: number,
    selectionDrag: { offset: Point; selectedIds: readonly string[] } | null,
  ): number {
    const gl = this.gl!;

    // Remove deleted objects from cache
    const activeIds = new Set(objects.map((o) => o.id));
    for (const id of this.geoCache.keys()) {
      if (!activeIds.has(id)) {
        this.geoCache.delete(id);
        this.cacheKeys.delete(id);
      }
    }

    // Rebuild only changed objects
    for (const obj of objects) {
      const key = this.stateKey(obj);
      if (this.cacheKeys.get(obj.id) !== key) {
        this.geoCache.set(
          obj.id,
          buildPointBuffer(
            obj.points,
            hexToRgba(obj.color || '#000'),
            obj.size || 15,
          ),
        );
        this.cacheKeys.set(obj.id, key);
      }
    }

    // Live path – not cached (drawn every frame)
    let liveGeo: CachedGeometry | null = null;
    if (currentPath.length > 0) {
      liveGeo = buildPointBuffer(
        currentPath,
        hexToRgba(currentColor),
        currentSize,
      );
    }

    // Count total size
    let totalPoints = 0;
    for (const obj of objects) {
      const g = this.geoCache.get(obj.id);
      if (g) totalPoints += g.pointCount;
    }
    if (liveGeo) totalPoints += liveGeo.pointCount;

    if (totalPoints === 0) return 0;

    const dragSet =
      selectionDrag &&
      selectionDrag.selectedIds.length > 0 &&
      (selectionDrag.offset.x !== 0 || selectionDrag.offset.y !== 0)
        ? new Set(selectionDrag.selectedIds)
        : null;
    const ox = selectionDrag?.offset.x ?? 0;
    const oy = selectionDrag?.offset.y ?? 0;

    // Single allocation for merged buffer
    const all = new Float32Array(totalPoints * FPV);
    let offset = 0;

    const append = (g: CachedGeometry) => {
      all.set(g.buffer, offset);
      offset += g.buffer.length;
    };

    for (const obj of objects) {
      const g = this.geoCache.get(obj.id);
      if (!g) continue;
      if (dragSet?.has(obj.id)) {
        writeCachedGeometryWithOffset(g, all, offset, ox, oy);
        offset += g.buffer.length;
      } else {
        append(g);
      }
    }
    if (liveGeo) append(liveGeo); // live path on top

    // Upload – single gl.bufferData
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufVertex);
    gl.bufferData(gl.ARRAY_BUFFER, all, gl.DYNAMIC_DRAW);

    return totalPoints;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

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

    // Check max point size (must support large brushes)
    const maxPtSize = gl.getParameter(
      gl.ALIASED_POINT_SIZE_RANGE,
    ) as Float32Array;
    console.info(`[WebGLRenderer] Max point size: ${maxPtSize[1]}px`);

    const vert = this.createShader(gl.VERTEX_SHADER, VERT);
    const frag = this.createShader(gl.FRAGMENT_SHADER, FRAG);
    const vertR = this.createShader(gl.VERTEX_SHADER, VERT_RECT);
    const fragR = this.createShader(gl.FRAGMENT_SHADER, FRAG_RECT);
    const vertC = this.createShader(gl.VERTEX_SHADER, VERT_CURSOR);
    const fragC = this.createShader(gl.FRAGMENT_SHADER, FRAG_CURSOR);
    if (vertR && fragR) {
      const rp = this.createProgram(vertR, fragR);
      if (rp) {
        this.rectProgram = rp;
        this.rectAPos = gl.getAttribLocation(rp, 'a_pos');
        this.uRectResolution = gl.getUniformLocation(rp, 'u_resolution')!;
        this.uRectOffset = gl.getUniformLocation(rp, 'u_offset')!;
        this.uRectZoom = gl.getUniformLocation(rp, 'u_zoom')!;
        this.uRectColor = gl.getUniformLocation(rp, 'u_rectColor')!;
      }
    }
    if (!vert || !frag) return false;
    if (!vertC || !fragC) return false;

    const prog = this.createProgram(vert, frag);
    if (!prog) return false;
    this.program = prog;
    const cursorProg = this.createProgram(vertC, fragC);
    if (!cursorProg) return false;
    this.cursorProgram = cursorProg;

    this.aPos = gl.getAttribLocation(prog, 'a_pos');
    this.aColor = gl.getAttribLocation(prog, 'a_color');
    this.aSize = gl.getAttribLocation(prog, 'a_size');

    this.uResolution = gl.getUniformLocation(prog, 'u_resolution')!;
    this.uOffset = gl.getUniformLocation(prog, 'u_offset')!;
    this.uZoom = gl.getUniformLocation(prog, 'u_zoom')!;

    this.cursorAPos = gl.getAttribLocation(cursorProg, 'a_unit');
    this.uCursorResolution = gl.getUniformLocation(cursorProg, 'u_resolution')!;
    this.uCursorOffset = gl.getUniformLocation(cursorProg, 'u_offset')!;
    this.uCursorZoom = gl.getUniformLocation(cursorProg, 'u_zoom')!;
    this.uCursorAnchor = gl.getUniformLocation(cursorProg, 'u_anchor')!;
    this.uCursorSize = gl.getUniformLocation(cursorProg, 'u_sizePx')!;
    this.uCursorTex = gl.getUniformLocation(cursorProg, 'u_tex')!;

    this.bufVertex = gl.createBuffer()!;
    this.cursorBuf = gl.createBuffer()!;
    this.rectBuf = gl.createBuffer()!;
    this.cursorTexture = gl.createTexture();
    this.initializeCursorTexture();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this.resizeCanvas();
    return true;
  }

  resizeCanvas(): void {
    if (!this.canvas || !this.gl) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(
        0,
        0,
        this.gl.drawingBufferWidth,
        this.gl.drawingBufferHeight,
      );
    }
  }

  private drawRect(
    box: { start: Point; end: Point },
    color: [number, number, number, number],
    zoom: number,
    offsetX: number,
    offsetY: number,
  ): void {
    const gl = this.gl!;
    if (!this.rectProgram || !this.canvas) return;

    const { start: s, end: e } = box;
    // 4 rectangle vertices (LINE_LOOP)
    const verts = new Float32Array([s.x, s.y, e.x, s.y, e.x, e.y, s.x, e.y]);

    gl.useProgram(this.rectProgram);
    gl.uniform2f(this.uRectResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uRectZoom, zoom);
    gl.uniform2f(this.uRectOffset, offsetX, offsetY);
    gl.uniform4fv(this.uRectColor, color);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.rectAPos);
    gl.vertexAttribPointer(this.rectAPos, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.LINE_LOOP, 0, 4);
  }

  private drawCursors(
    cursors: Point[],
    zoom: number,
    offsetX: number,
    offsetY: number,
  ): void {
    const gl = this.gl!;
    if (
      cursors.length === 0 ||
      !this.canvas ||
      !this.cursorProgram ||
      !this.cursorTexture
    ) {
      return;
    }

    gl.useProgram(this.cursorProgram);
    gl.uniform2f(this.uCursorResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uCursorZoom, zoom);
    gl.uniform2f(this.uCursorOffset, offsetX, offsetY);
    gl.uniform1f(this.uCursorSize, CURSOR_SIZE_PX);
    gl.uniform1i(this.uCursorTex, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cursorTexture);

    // Quad in UV space [0..1] x [0..1], two triangles.
    const quad = new Float32Array([0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cursorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.cursorAPos);
    gl.vertexAttribPointer(this.cursorAPos, 2, gl.FLOAT, false, 0, 0);

    for (const c of cursors) {
      gl.uniform2f(this.uCursorAnchor, c.x, c.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
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
    if (!gl || !this.program || !this.canvas) return;

    this.resizeCanvas();

    const pointCount = this.mergeAndUpload(
      objects,
      currentPath,
      currentColor,
      currentSize,
      selectionDrag,
    );

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uZoom, zoom);
    gl.uniform2f(this.uOffset, offsetX, offsetY);

    const stride = FPV * 4; // 7 floats * 4 bytes

    const attr = (loc: number, size: number, offsetFloats: number) => {
      if (loc < 0) return;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(
        loc,
        size,
        gl.FLOAT,
        false,
        stride,
        offsetFloats * 4,
      );
    };

    if (pointCount > 0) {
      // Single bind + attribute setup via stride
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufVertex);
      attr(this.aPos, 2, 0); // [x, y]
      attr(this.aColor, 4, 2); // [r, g, b, a]
      attr(this.aSize, 1, 6); // [size]

      // Single draw call for the entire scene
      gl.drawArrays(gl.POINTS, 0, pointCount);
    }

    // Draw rectangles after points (they switch program and buffer)
    if (selectionBox) {
      this.drawRect(
        selectionBox,
        [0.23, 0.51, 0.96, 0.6],
        zoom,
        offsetX,
        offsetY,
      );
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
      this.drawRect(box, [0.23, 0.51, 0.96, 1.0], zoom, offsetX, offsetY);
    }

    this.drawCursors(cursors, zoom, offsetX, offsetY);
  }

  cleanup(): void {
    const gl = this.gl;
    if (gl) {
      gl.deleteBuffer(this.bufVertex);
      gl.deleteBuffer(this.cursorBuf);
      gl.deleteBuffer(this.rectBuf);
      if (this.program) gl.deleteProgram(this.program);
      if (this.rectProgram) gl.deleteProgram(this.rectProgram);
      if (this.cursorProgram) gl.deleteProgram(this.cursorProgram);
      if (this.cursorTexture) gl.deleteTexture(this.cursorTexture);
    }
    this.gl = null;
    this.program = null;
    this.cursorProgram = null;
    this.cursorTexture = null;
    this.canvas = null;
    this.geoCache.clear();
    this.cacheKeys.clear();
  }
}
