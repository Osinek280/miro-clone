import type { DrawObject, Point } from "./types/types";

export class WebGLRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private positionLocation!: number;
  private resolutionLocation!: WebGLUniformLocation;
  private offsetLocation!: WebGLUniformLocation;
  private colorLocation!: WebGLUniformLocation;
  private zoomLocation!: WebGLUniformLocation;
  private pointSizeLocation!: WebGLUniformLocation;
  private buffer!: WebGLBuffer;

  private vertexShaderSource = `
  attribute vec2 a_position;
  uniform vec2 u_resolution;
  uniform vec2 u_offset;
  uniform float u_zoom;
  uniform float u_pointSize;

  void main() {
    vec2 worldPos = a_position;
    vec2 scaledPos = worldPos * u_zoom;
    vec2 translatedPos = scaledPos + u_offset;
    vec2 position = translatedPos / u_resolution * 2.0 - 1.0;

    gl_Position = vec4(position * vec2(1, -1), 0, 1);
    gl_PointSize = u_pointSize * u_zoom;
  }
`;

  private fragmentShaderSource = `
  precision mediump float;
  uniform vec4 u_color;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);

    if (dist > 0.5) {
      discard; // wycina piksele poza okręgiem
    }

    gl_FragColor = u_color;
  }
`;

  private createShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string,
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private createProgram(
    gl: WebGLRenderingContext,
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader,
  ): WebGLProgram | null {
    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program linking error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  private hexToRgba(hex: string): number[] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, 1];
  }

  initialize(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl");

    if (!gl) {
      console.error("WebGL not supported");
      return false;
    }

    this.gl = gl;

    // Create shaders
    const vertexShader = this.createShader(
      gl,
      gl.VERTEX_SHADER,
      this.vertexShaderSource,
    );
    const fragmentShader = this.createShader(
      gl,
      gl.FRAGMENT_SHADER,
      this.fragmentShaderSource,
    );

    if (!vertexShader || !fragmentShader) {
      return false;
    }

    // Create program
    const program = this.createProgram(gl, vertexShader, fragmentShader);
    if (!program) {
      return false;
    }

    this.program = program;
    this.positionLocation = gl.getAttribLocation(program, "a_position")!;
    this.resolutionLocation = gl.getUniformLocation(program, "u_resolution")!;
    this.offsetLocation = gl.getUniformLocation(program, "u_offset")!;
    this.colorLocation = gl.getUniformLocation(program, "u_color")!;
    this.zoomLocation = gl.getUniformLocation(program, "u_zoom")!;
    this.pointSizeLocation = gl.getUniformLocation(program, "u_pointSize")!;

    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

    // Set up viewport
    this.resizeCanvas();

    return true;
  }

  resizeCanvas(): void {
    if (!this.canvas || !this.gl) return;

    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;

    if (
      this.canvas.width !== displayWidth ||
      this.canvas.height !== displayHeight
    ) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      this.gl.viewport(
        0,
        0,
        this.gl.drawingBufferWidth,
        this.gl.drawingBufferHeight,
      );
    }
  }

  render(
    objects: DrawObject[],
    currentPath: Point[],
    zoom: number = 1.0,
    offsetX: number = 0,
    offsetY: number = 0,
  ): void {
    if (!this.gl || !this.program || !this.canvas) return;

    const gl = this.gl;

    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    gl.uniform2f(
      this.resolutionLocation,
      this.canvas.width,
      this.canvas.height,
    );
    gl.uniform1f(this.zoomLocation, zoom);
    gl.uniform2f(this.offsetLocation, offsetX, offsetY);
    gl.uniform1f(this.pointSizeLocation, 15); // średnica okręgu

    const objectsToRender = [
      ...objects,
      ...(currentPath.length > 0
        ? [
            {
              id: "current",
              type: "path" as const,
              points: currentPath,
              color: "#000000",
              selected: false,
            },
          ]
        : []),
    ];

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    objectsToRender.forEach((obj) => {
      if (!obj.points.length) return;

      const color = this.hexToRgba(obj.color);
      gl.uniform4fv(this.colorLocation, color);

      const positions: number[] = [];

      obj.points.forEach((p) => {
        positions.push(p.x, p.y);
      });

      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.DYNAMIC_DRAW,
      );

      gl.drawArrays(gl.POINTS, 0, obj.points.length);
    });
  }

  cleanup(): void {
    // Cleanup if needed
    this.gl = null;
    this.program = null;
    this.canvas = null;
  }
}
