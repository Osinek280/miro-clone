import type { Point } from '../../types/types';
import { compileShader, linkProgram } from '../gl/glProgram';

const CURSOR_SIZE_PX = 24;
const CURSOR_SVG = `<svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-75 12 12)"><path d="M20.5056 10.7754C21.1225 10.5355 21.431 10.4155 21.5176 10.2459C21.5926 10.099 21.5903 9.92446 21.5115 9.77954C21.4205 9.61226 21.109 9.50044 20.486 9.2768L4.59629 3.5728C4.0866 3.38983 3.83175 3.29835 3.66514 3.35605C3.52029 3.40621 3.40645 3.52004 3.35629 3.6649C3.29859 3.8315 3.39008 4.08635 3.57304 4.59605L9.277 20.4858C9.50064 21.1088 9.61246 21.4203 9.77973 21.5113C9.92465 21.5901 10.0991 21.5924 10.2461 21.5174C10.4157 21.4308 10.5356 21.1223 10.7756 20.5054L13.3724 13.8278C13.4194 13.707 13.4429 13.6466 13.4792 13.5957C13.5114 13.5506 13.5508 13.5112 13.5959 13.479C13.6468 13.4427 13.7072 13.4192 13.828 13.3722L20.5056 10.7754Z" fill="#22c55e" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

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
    );

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
      gl.bindTexture(gl.TEXTURE_2D, this.cursorTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(CURSOR_SVG)}`;
  }

  draw(params: {
    gl: WebGLRenderingContext;
    canvas: HTMLCanvasElement;
    cursors: Point[];
    zoom: number;
    offsetX: number;
    offsetY: number;
  }): void {
    const { gl, canvas, cursors, zoom, offsetX, offsetY } = params;
    if (cursors.length === 0) return;

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, canvas.width, canvas.height);
    gl.uniform1f(this.uZoom, zoom);
    gl.uniform2f(this.uOffset, offsetX, offsetY);
    gl.uniform1f(this.uSize, CURSOR_SIZE_PX);
    gl.uniform1i(this.uTex, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cursorTexture);

    const quad = new Float32Array([0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cursorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);

    for (const c of cursors) {
      gl.uniform2f(this.uAnchor, c.x, c.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  dispose(gl: WebGLRenderingContext): void {
    gl.deleteBuffer(this.cursorBuf);
    gl.deleteTexture(this.cursorTexture);
    gl.deleteProgram(this.program);
  }
}
