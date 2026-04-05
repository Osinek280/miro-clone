import { compileShader, linkProgram } from '../gl/glProgram';

const VERT = /* glsl */ `
attribute vec4 a_pos_uv;
uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform float u_zoom;
varying vec2 v_uv;

void main() {
  vec2 screen = a_pos_uv.xy * u_zoom + u_offset;
  vec2 ndc = screen / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  v_uv = a_pos_uv.zw;
}
`;

const FRAG = /* glsl */ `
precision mediump float;
uniform sampler2D u_tex;
varying vec2 v_uv;

void main() {
  vec4 c = texture2D(u_tex, v_uv);
  // Blend handles alpha=0; avoid discard so depth-less quads don’t interact oddly with drivers.
  gl_FragColor = c;
}
`;

export class ImagePipeline {
  private program: WebGLProgram;
  private quadBuf: WebGLBuffer;
  private quadScratch = new Float32Array(24);
  private aPosUv: number;
  private uResolution: WebGLUniformLocation;
  private uOffset: WebGLUniformLocation;
  private uZoom: WebGLUniformLocation;
  private uTex: WebGLUniformLocation;

  private constructor(
    program: WebGLProgram,
    quadBuf: WebGLBuffer,
    aPosUv: number,
    uResolution: WebGLUniformLocation,
    uOffset: WebGLUniformLocation,
    uZoom: WebGLUniformLocation,
    uTex: WebGLUniformLocation,
  ) {
    this.program = program;
    this.quadBuf = quadBuf;
    this.aPosUv = aPosUv;
    this.uResolution = uResolution;
    this.uOffset = uOffset;
    this.uZoom = uZoom;
    this.uTex = uTex;
  }

  static create(gl: WebGLRenderingContext): ImagePipeline | null {
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return null;

    const program = linkProgram(gl, vert, frag);
    if (!program) return null;

    const quadBuf = gl.createBuffer();
    if (!quadBuf) return null;

    return new ImagePipeline(
      program,
      quadBuf,
      gl.getAttribLocation(program, 'a_pos_uv'),
      gl.getUniformLocation(program, 'u_resolution')!,
      gl.getUniformLocation(program, 'u_offset')!,
      gl.getUniformLocation(program, 'u_zoom')!,
      gl.getUniformLocation(program, 'u_tex')!,
    );
  }

  draw(params: {
    gl: WebGLRenderingContext;
    canvas: HTMLCanvasElement;
    texture: WebGLTexture;
    x: number;
    y: number;
    width: number;
    height: number;
    zoom: number;
    offsetX: number;
    offsetY: number;
  }): void {
    const { gl, canvas, texture, x, y, width, height, zoom, offsetX, offsetY } =
      params;

    const q = this.quadScratch;
    const x1 = x;
    const y1 = y;
    const x2 = x + width;
    const y2 = y + height;

    // Two triangles. With UNPACK_FLIP_Y_WEBGL on upload, texture v=0 is bottom of image;
    // world y grows downward, so top of quad (y1) uses v=1 and bottom (y2) uses v=0.
    q[0] = x1;
    q[1] = y1;
    q[2] = 0;
    q[3] = 1;
    q[4] = x2;
    q[5] = y1;
    q[6] = 1;
    q[7] = 1;
    q[8] = x2;
    q[9] = y2;
    q[10] = 1;
    q[11] = 0;
    q[12] = x1;
    q[13] = y1;
    q[14] = 0;
    q[15] = 1;
    q[16] = x2;
    q[17] = y2;
    q[18] = 1;
    q[19] = 0;
    q[20] = x1;
    q[21] = y2;
    q[22] = 0;
    q[23] = 0;

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, canvas.width, canvas.height);
    gl.uniform1f(this.uZoom, zoom);
    gl.uniform2f(this.uOffset, offsetX, offsetY);
    gl.uniform1i(this.uTex, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, q, gl.DYNAMIC_DRAW);
    if (this.aPosUv >= 0) {
      gl.enableVertexAttribArray(this.aPosUv);
      gl.vertexAttribPointer(this.aPosUv, 4, gl.FLOAT, false, 0, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(gl: WebGLRenderingContext): void {
    gl.deleteBuffer(this.quadBuf);
    gl.deleteProgram(this.program);
  }
}
