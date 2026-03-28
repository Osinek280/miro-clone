import { CURSOR_SVG, CURSOR_W_PX, CURSOR_H_PX } from '../../constants/cursor';
import type { Point } from '../../types/types';
import { hexToRgba } from '../geometry/StrokeGeometry';
import { compileShader, linkProgram } from '../gl/glProgram';

const VERT_CURSOR = `
attribute vec2 a_unit;
uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform float u_zoom;
uniform vec2 u_anchor;
uniform vec2 u_sizePx;
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
uniform vec4 u_color;
varying vec2 v_uv;

void main() {
  vec2 st = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 t = texture2D(u_tex, st);
  if (t.a < 0.01) discard;
  gl_FragColor = t * u_color;
}
`;

export class CursorPipeline {
  private program: WebGLProgram;
  private cursorBuf: WebGLBuffer;
  private cursorTexture: WebGLTexture;
  private aPos: number;
  private uResolution: WebGLUniformLocation;
  private uOffset: WebGLUniformLocation;
  private uZoom: WebGLUniformLocation;
  private uAnchor: WebGLUniformLocation;
  private uSize: WebGLUniformLocation;
  private uTex: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;
  private disposed = false;

  private constructor(
    program: WebGLProgram,
    cursorBuf: WebGLBuffer,
    cursorTexture: WebGLTexture,
    aPos: number,
    uResolution: WebGLUniformLocation,
    uOffset: WebGLUniformLocation,
    uZoom: WebGLUniformLocation,
    uAnchor: WebGLUniformLocation,
    uSize: WebGLUniformLocation,
    uTex: WebGLUniformLocation,
    uColor: WebGLUniformLocation,
  ) {
    this.program = program;
    this.cursorBuf = cursorBuf;
    this.cursorTexture = cursorTexture;
    this.aPos = aPos;
    this.uResolution = uResolution;
    this.uOffset = uOffset;
    this.uZoom = uZoom;
    this.uAnchor = uAnchor;
    this.uSize = uSize;
    this.uTex = uTex;
    this.uColor = uColor;
  }

  static create(gl: WebGLRenderingContext): CursorPipeline | null {
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_CURSOR);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_CURSOR);
    if (!vert || !frag) return null;

    const program = linkProgram(gl, vert, frag);
    if (!program) return null;

    const cursorBuf = gl.createBuffer();
    const cursorTexture = gl.createTexture();
    if (!cursorBuf || !cursorTexture) return null;

    const pipeline = new CursorPipeline(
      program,
      cursorBuf,
      cursorTexture,
      gl.getAttribLocation(program, 'a_unit'),
      gl.getUniformLocation(program, 'u_resolution')!,
      gl.getUniformLocation(program, 'u_offset')!,
      gl.getUniformLocation(program, 'u_zoom')!,
      gl.getUniformLocation(program, 'u_anchor')!,
      gl.getUniformLocation(program, 'u_sizePx')!,
      gl.getUniformLocation(program, 'u_tex')!,
      gl.getUniformLocation(program, 'u_color')!,
    );

    const quad = new Float32Array([0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, cursorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    pipeline.initializeTexture(gl);
    return pipeline;
  }

  private initializeTexture(gl: WebGLRenderingContext): void {
    gl.bindTexture(gl.TEXTURE_2D, this.cursorTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
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
    img.onload = () => {
      if (this.disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, this.cursorTexture);
      const prevPremult = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, prevPremult);
    };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(CURSOR_SVG)}`;
  }

  draw(params: {
    gl: WebGLRenderingContext;
    canvas: HTMLCanvasElement;
    cursors: Point[];
    color: string;
    zoom: number;
    offsetX: number;
    offsetY: number;
  }): void {
    const { gl, canvas, cursors, color, zoom, offsetX, offsetY } = params;
    if (cursors.length === 0) return;

    const [r, g, b, a] = hexToRgba(color);

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, canvas.width, canvas.height);
    gl.uniform1f(this.uZoom, zoom);
    gl.uniform2f(this.uOffset, offsetX, offsetY);
    gl.uniform2f(this.uSize, CURSOR_W_PX, CURSOR_H_PX);
    gl.uniform4f(this.uColor, r, g, b, a);
    gl.uniform1i(this.uTex, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cursorTexture);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.cursorBuf);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);

    for (const c of cursors) {
      gl.uniform2f(this.uAnchor, c.x, c.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  dispose(gl: WebGLRenderingContext): void {
    this.disposed = true;
    gl.deleteBuffer(this.cursorBuf);
    gl.deleteTexture(this.cursorTexture);
    gl.deleteProgram(this.program);
  }
}
