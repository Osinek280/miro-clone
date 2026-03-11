import type { DrawObject, Point, SelectionBox } from './types/types';

// ─────────────────────────────────────────────────────────────────────────────
// WebGLRenderer – circle-stamp line renderer
//
// Filozofia (jak Miro / Procreate / Excalidraw):
//   Każdy punkt ścieżki = wypełnione koło rysowane przez gl.POINTS.
//   Nakładające się koła tworzą idealnie gładką, ciągłą linię.
//   Zero problemów z miter joints, zero ostrych krawędzi.
//
//   gl_PointSize = size * zoom  →  koła skalują się z kamerą
//   SDF w fragment shaderze     →  antyaliasowana, okrągła krawędź
//
// Wydajność (10k+ obiektów):
//   • Jeden draw call na całą scenę (merged buffer)
//   • Per-object cache – rebuild tylko przy zmianie punktów/koloru/size
//   • Interleaved buffer: [x, y, r, g, b, a, pointSize]
//   • Gęstość punktów kontrolowana przez MIN_DIST (co ~1.5px w world-space)
// ─────────────────────────────────────────────────────────────────────────────

// Minimalna odległość między zapisanymi punktami (world-space).
// Twój mouseMove już interpoluje co 2px – to zostawiamy jako backup.
const MIN_DIST = 1.5;

// Floats per vertex w interleaved buforze
// [x, y, r, g, b, a, pointSize]
const FPV = 7;

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

    // screen → NDC, odwróć Y
    vec2 ndc = screen / u_resolution * 2.0 - 1.0;
    gl_Position  = vec4(ndc.x, -ndc.y, 0.0, 1.0);

    // Rozmiar koła skaluje się z zoomem (world-space size)
    gl_PointSize = a_size * u_zoom;

    v_color = a_color;
  }
`;

/**
 * Fragment shader – SDF circle z antyaliasingiem.
 *
 * gl_PointCoord: (0,0) lewy-górny róg, (1,1) prawy-dolny
 * dist od środka = length(gl_PointCoord - 0.5) * 2  →  0=środek, 1=krawędź
 * smoothstep daje ~1px miękką krawędź niezależnie od rozmiaru koła.
 */
const FRAG = /* glsl */ `
  precision mediump float;

  varying vec4 v_color;

  void main() {
    // Odległość od środka punktu: 0 = centrum, 1 = krawędź
    float dist  = length(gl_PointCoord - 0.5) * 2.0;

    // ~1px antyaliasing na krawędzi koła
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
 * Buduje interleaved buffer dla jednej polyline.
 *
 * Filtruje punkty bliżej niż MIN_DIST od poprzedniego
 * (defensive – twój mouseMove już interpoluje).
 * Kolor i size są stałe per-obiekt, wpisane do każdego werteksa.
 */
function buildPointBuffer(
  points: Point[],
  color: [number, number, number, number],
  size: number
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

  // Zawsze dodaj ostatni punkt (żeby ścieżka kończyła się dokładnie)
  const last = points[points.length - 1];
  if (last.x !== lastX || last.y !== lastY) {
    buf.push(last.x, last.y, r, g, b, a, size);
  }

  const pointCount = buf.length / FPV;
  return { buffer: new Float32Array(buf), pointCount };
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

  // Attribute / uniform locations
  private aPos: number = -1;
  private aColor: number = -1;
  private aSize: number = -1;

  private uResolution!: WebGLUniformLocation;
  private uOffset!: WebGLUniformLocation;
  private uZoom!: WebGLUniformLocation;

  // Jeden GPU vertex buffer (interleaved, cała scena)
  private bufVertex!: WebGLBuffer;

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
    frag: WebGLShader
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

  /** Fingerprint do inwalidacji cache */
  private stateKey(obj: DrawObject): string {
    const f = obj.points[0],
      l = obj.points[obj.points.length - 1];
    return `${obj.color || '#000'}|${obj.size}|${obj.points.length}|${f?.x},${f?.y}|${l?.x},${l?.y}`;
  }

  /**
   * Scala geometry wszystkich obiektów + currentPath w jeden Float32Array
   * i wgrywa na GPU jednym gl.bufferData.
   * Zwraca liczbę punktów do narysowania.
   */
  private mergeAndUpload(
    objects: DrawObject[],
    currentPath: Point[],
    currentColor: string,
    currentSize: number
  ): number {
    const gl = this.gl!;

    // Usuń z cache usunięte obiekty
    const activeIds = new Set(objects.map((o) => o.id));
    for (const id of this.geoCache.keys()) {
      if (!activeIds.has(id)) {
        this.geoCache.delete(id);
        this.cacheKeys.delete(id);
      }
    }

    // Rebuild tylko zmienionych obiektów
    for (const obj of objects) {
      const key = this.stateKey(obj);
      if (this.cacheKeys.get(obj.id) !== key) {
        this.geoCache.set(
          obj.id,
          buildPointBuffer(
            obj.points,
            hexToRgba(obj.color || '#000'),
            obj.size || 15
          )
        );
        this.cacheKeys.set(obj.id, key);
      }
    }

    // Live path – nie cache'owana (rysowana w każdej klatce)
    let liveGeo: CachedGeometry | null = null;
    if (currentPath.length > 0) {
      liveGeo = buildPointBuffer(
        currentPath,
        hexToRgba(currentColor),
        currentSize
      );
    }

    // Policz sumaryczny rozmiar
    let totalPoints = 0;
    for (const obj of objects) {
      const g = this.geoCache.get(obj.id);
      if (g) totalPoints += g.pointCount;
    }
    if (liveGeo) totalPoints += liveGeo.pointCount;

    if (totalPoints === 0) return 0;

    // Jednorazowa alokacja merged buffer
    const all = new Float32Array(totalPoints * FPV);
    let offset = 0;

    const append = (g: CachedGeometry) => {
      all.set(g.buffer, offset);
      offset += g.buffer.length;
    };

    for (const obj of objects) {
      const g = this.geoCache.get(obj.id);
      if (g) append(g);
    }
    if (liveGeo) append(liveGeo); // live path na wierzchu

    // Upload – jeden gl.bufferData
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

    // Sprawdź max point size (musi obsługiwać duże pędzle)
    const maxPtSize = gl.getParameter(
      gl.ALIASED_POINT_SIZE_RANGE
    ) as Float32Array;
    console.info(`[WebGLRenderer] Max point size: ${maxPtSize[1]}px`);

    const vert = this.createShader(gl.VERTEX_SHADER, VERT);
    const frag = this.createShader(gl.FRAGMENT_SHADER, FRAG);
    const vertR = this.createShader(gl.VERTEX_SHADER, VERT_RECT);
    const fragR = this.createShader(gl.FRAGMENT_SHADER, FRAG_RECT);
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

    const prog = this.createProgram(vert, frag);
    if (!prog) return false;
    this.program = prog;

    this.aPos = gl.getAttribLocation(prog, 'a_pos');
    this.aColor = gl.getAttribLocation(prog, 'a_color');
    this.aSize = gl.getAttribLocation(prog, 'a_size');

    this.uResolution = gl.getUniformLocation(prog, 'u_resolution')!;
    this.uOffset = gl.getUniformLocation(prog, 'u_offset')!;
    this.uZoom = gl.getUniformLocation(prog, 'u_zoom')!;

    this.bufVertex = gl.createBuffer()!;
    this.rectBuf = gl.createBuffer()!;

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
        this.gl.drawingBufferHeight
      );
    }
  }

  private drawRect(
    box: { start: Point; end: Point },
    color: [number, number, number, number],
    zoom: number,
    offsetX: number,
    offsetY: number
  ): void {
    const gl = this.gl!;
    if (!this.rectProgram || !this.canvas) return;

    const { start: s, end: e } = box;
    // 4 wierzchołki prostokąta (LINE_LOOP)
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

  render(
    objects: DrawObject[],
    currentPath: Point[],
    zoom: number = 1.0,
    offsetX: number = 0,
    offsetY: number = 0,
    currentColor: string,
    currentSize: number,
    selectionBox: SelectionBox,
    selectedBoundingBox: SelectionBox
  ): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.canvas) return;

    this.resizeCanvas();

    const pointCount = this.mergeAndUpload(
      objects,
      currentPath,
      currentColor,
      currentSize
    );

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (pointCount === 0) return;

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uZoom, zoom);
    gl.uniform2f(this.uOffset, offsetX, offsetY);

    // Jeden bind + setup atrybutów przez stride
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufVertex);
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
        offsetFloats * 4
      );
    };

    attr(this.aPos, 2, 0); // [x, y]
    attr(this.aColor, 4, 2); // [r, g, b, a]
    attr(this.aSize, 1, 6); // [size]

    // Jeden draw call dla całej sceny
    gl.drawArrays(gl.POINTS, 0, pointCount);

    // Rysuj prostokąty po punktach (zmieniają program i buffer)
    if (selectionBox) {
      this.drawRect(
        selectionBox,
        [0.23, 0.51, 0.96, 0.6],
        zoom,
        offsetX,
        offsetY
      );
    }
    if (selectedBoundingBox) {
      this.drawRect(
        selectedBoundingBox,
        [0.23, 0.51, 0.96, 1.0],
        zoom,
        offsetX,
        offsetY
      );
    }
  }

  cleanup(): void {
    const gl = this.gl;
    if (gl) {
      gl.deleteBuffer(this.bufVertex);
      gl.deleteBuffer(this.rectBuf);
      if (this.program) gl.deleteProgram(this.program);
      if (this.rectProgram) gl.deleteProgram(this.rectProgram);
    }
    this.gl = null;
    this.program = null;
    this.canvas = null;
    this.geoCache.clear();
    this.cacheKeys.clear();
  }
}
