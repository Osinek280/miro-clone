import type { Point } from '../../types/types';
import { compileShader, linkProgram } from '../gl/glProgram';

const VERT_RECT = `
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
precision mediump float;
uniform vec4 u_rectColor;

void main() {
  gl_FragColor = u_rectColor;
}
`;

const VERT_CORNER_DOTS = `
attribute vec2 a_pos;
uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform float u_zoom;
uniform float u_pointSizePx;

void main() {
  vec2 screen = a_pos * u_zoom + u_offset;
  vec2 ndc = screen / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  gl_PointSize = u_pointSizePx;
}
`;

const FRAG_CORNER_DOTS = `
precision mediump float;

void main() {
  float dist = length(gl_PointCoord - 0.5) * 2.0;
  if (dist > 1.0) discard;
  float edge = smoothstep(0.72, 0.88, dist);
  vec3 borderRgb = vec3(0.55, 0.56, 0.58);
  vec3 rgb = mix(vec3(1.0), borderRgb, edge);
  gl_FragColor = vec4(rgb, 1.0);
}
`;

/** Screen-space radius in px (matches handle hit targets in select mode). */
const CORNER_DOT_PX = 5;

export class RectPipeline {
  private program: WebGLProgram;
  private rectBuf: WebGLBuffer;
  /** Reused each draw to avoid per-frame Float32Array allocation. */
  private rectVerts = new Float32Array(8);
  private cornerDotVerts = new Float32Array(8);
  private aPos: number;
  private uResolution: WebGLUniformLocation;
  private uOffset: WebGLUniformLocation;
  private uZoom: WebGLUniformLocation;
  private uRectColor: WebGLUniformLocation;

  private cornerDotProgram: WebGLProgram;
  private cornerDotBuf: WebGLBuffer;
  private cdAPos: number;
  private cdUResolution: WebGLUniformLocation;
  private cdUOffset: WebGLUniformLocation;
  private cdUZoom: WebGLUniformLocation;
  private cdUPointSize: WebGLUniformLocation;

  private constructor(
    program: WebGLProgram,
    rectBuf: WebGLBuffer,
    aPos: number,
    uResolution: WebGLUniformLocation,
    uOffset: WebGLUniformLocation,
    uZoom: WebGLUniformLocation,
    uRectColor: WebGLUniformLocation,
    cornerDotProgram: WebGLProgram,
    cornerDotBuf: WebGLBuffer,
    cdAPos: number,
    cdUResolution: WebGLUniformLocation,
    cdUOffset: WebGLUniformLocation,
    cdUZoom: WebGLUniformLocation,
    cdUPointSize: WebGLUniformLocation,
  ) {
    this.program = program;
    this.rectBuf = rectBuf;
    this.aPos = aPos;
    this.uResolution = uResolution;
    this.uOffset = uOffset;
    this.uZoom = uZoom;
    this.uRectColor = uRectColor;
    this.cornerDotProgram = cornerDotProgram;
    this.cornerDotBuf = cornerDotBuf;
    this.cdAPos = cdAPos;
    this.cdUResolution = cdUResolution;
    this.cdUOffset = cdUOffset;
    this.cdUZoom = cdUZoom;
    this.cdUPointSize = cdUPointSize;
  }

  static create(gl: WebGLRenderingContext): RectPipeline | null {
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_RECT);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_RECT);
    if (!vert || !frag) return null;

    const program = linkProgram(gl, vert, frag);
    if (!program) return null;

    const rectBuf = gl.createBuffer();
    if (!rectBuf) return null;

    const cdVert = compileShader(gl, gl.VERTEX_SHADER, VERT_CORNER_DOTS);
    const cdFrag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_CORNER_DOTS);
    if (!cdVert || !cdFrag) return null;

    const cornerDotProgram = linkProgram(gl, cdVert, cdFrag);
    gl.deleteShader(cdVert);
    gl.deleteShader(cdFrag);
    if (!cornerDotProgram) return null;

    const cornerDotBuf = gl.createBuffer();
    if (!cornerDotBuf) return null;

    return new RectPipeline(
      program,
      rectBuf,
      gl.getAttribLocation(program, 'a_pos'),
      gl.getUniformLocation(program, 'u_resolution')!,
      gl.getUniformLocation(program, 'u_offset')!,
      gl.getUniformLocation(program, 'u_zoom')!,
      gl.getUniformLocation(program, 'u_rectColor')!,
      cornerDotProgram,
      cornerDotBuf,
      gl.getAttribLocation(cornerDotProgram, 'a_pos'),
      gl.getUniformLocation(cornerDotProgram, 'u_resolution')!,
      gl.getUniformLocation(cornerDotProgram, 'u_offset')!,
      gl.getUniformLocation(cornerDotProgram, 'u_zoom')!,
      gl.getUniformLocation(cornerDotProgram, 'u_pointSizePx')!,
    );
  }

  drawRect(params: {
    gl: WebGLRenderingContext;
    canvas: HTMLCanvasElement;
    box: { start: Point; end: Point };
    color: [number, number, number, number];
    zoom: number;
    offsetX: number;
    offsetY: number;
  }): void {
    const { gl, canvas, box, color, zoom, offsetX, offsetY } = params;
    const { start: s, end: e } = box;
    const v = this.rectVerts;
    v[0] = s.x;
    v[1] = s.y;
    v[2] = e.x;
    v[3] = s.y;
    v[4] = e.x;
    v[5] = e.y;
    v[6] = s.x;
    v[7] = e.y;

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, canvas.width, canvas.height);
    gl.uniform1f(this.uZoom, zoom);
    gl.uniform2f(this.uOffset, offsetX, offsetY);
    gl.uniform4fv(this.uRectColor, color);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuf);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINE_LOOP, 0, 4);
  }

  /**
   * Resize handles: four circular dots at box corners (constant screen px size).
   */
  drawCornerDots(params: {
    gl: WebGLRenderingContext;
    canvas: HTMLCanvasElement;
    box: { start: Point; end: Point };
    zoom: number;
    offsetX: number;
    offsetY: number;
  }): void {
    const { gl, canvas, box, zoom, offsetX, offsetY } = params;
    const { start: s, end: e } = box;
    const v = this.cornerDotVerts;
    v[0] = s.x;
    v[1] = s.y;
    v[2] = e.x;
    v[3] = s.y;
    v[4] = e.x;
    v[5] = e.y;
    v[6] = s.x;
    v[7] = e.y;

    gl.useProgram(this.cornerDotProgram);
    gl.uniform2f(this.cdUResolution, canvas.width, canvas.height);
    gl.uniform1f(this.cdUZoom, zoom);
    gl.uniform2f(this.cdUOffset, offsetX, offsetY);
    gl.uniform1f(this.cdUPointSize, CORNER_DOT_PX * 2);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerDotBuf);
    gl.bufferData(gl.ARRAY_BUFFER, v, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.cdAPos);
    gl.vertexAttribPointer(this.cdAPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, 4);
  }

  dispose(gl: WebGLRenderingContext): void {
    gl.deleteBuffer(this.rectBuf);
    gl.deleteBuffer(this.cornerDotBuf);
    gl.deleteProgram(this.program);
    gl.deleteProgram(this.cornerDotProgram);
  }
}
