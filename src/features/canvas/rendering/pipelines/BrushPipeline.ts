import { FPV } from '../geometry/StrokeGeometry';
import { compileShader, linkProgram } from '../gl/glProgram';

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
    vec2 screen = a_pos * u_zoom + u_offset;
    vec2 ndc = screen / u_resolution * 2.0 - 1.0;
    gl_Position  = vec4(ndc.x, -ndc.y, 0.0, 1.0);
    gl_PointSize = a_size * u_zoom;
    v_color = a_color;
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;

  varying vec4 v_color;

  void main() {
    float dist  = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = step(dist, 1.0);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
  }
`;

export class BrushPipeline {
  private program: WebGLProgram;
  private aPos: number;
  private aColor: number;
  private aSize: number;
  private uResolution: WebGLUniformLocation;
  private uOffset: WebGLUniformLocation;
  private uZoom: WebGLUniformLocation;

  private constructor(
    program: WebGLProgram,
    aPos: number,
    aColor: number,
    aSize: number,
    uResolution: WebGLUniformLocation,
    uOffset: WebGLUniformLocation,
    uZoom: WebGLUniformLocation,
  ) {
    this.program = program;
    this.aPos = aPos;
    this.aColor = aColor;
    this.aSize = aSize;
    this.uResolution = uResolution;
    this.uOffset = uOffset;
    this.uZoom = uZoom;
  }

  static create(gl: WebGLRenderingContext): BrushPipeline | null {
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return null;

    const program = linkProgram(gl, vert, frag);
    if (!program) return null;

    return new BrushPipeline(
      program,
      gl.getAttribLocation(program, 'a_pos'),
      gl.getAttribLocation(program, 'a_color'),
      gl.getAttribLocation(program, 'a_size'),
      gl.getUniformLocation(program, 'u_resolution')!,
      gl.getUniformLocation(program, 'u_offset')!,
      gl.getUniformLocation(program, 'u_zoom')!,
    );
  }

  draw(params: {
    gl: WebGLRenderingContext;
    canvas: HTMLCanvasElement;
    vertexBuffer: WebGLBuffer;
    pointCount: number;
    zoom: number;
    offsetX: number;
    offsetY: number;
  }): void {
    const { gl, canvas, vertexBuffer, pointCount, zoom, offsetX, offsetY } = params;
    if (pointCount <= 0) return;

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, canvas.width, canvas.height);
    gl.uniform1f(this.uZoom, zoom);
    gl.uniform2f(this.uOffset, offsetX, offsetY);

    const stride = FPV * 4;
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

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    attr(this.aPos, 2, 0);
    attr(this.aColor, 4, 2);
    attr(this.aSize, 1, 6);
    gl.drawArrays(gl.POINTS, 0, pointCount);
  }

  dispose(gl: WebGLRenderingContext): void {
    gl.deleteProgram(this.program);
  }
}
