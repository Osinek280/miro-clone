import { MATH_UNIT_WORLD_SCALE } from '../../constants/mathViewConstants';
import { ShaderProgramCache } from '../cache/ShaderProgramCache';
import { type ImplicitEquation } from '../equations/hardcodedImplicitEquations';
import { compileShader, linkProgram } from '../gl/glProgram';

const MAX_EQUATIONS = 16;
const S = `${MATH_UNIT_WORLD_SCALE}.0`;

const VERT = `
attribute vec2 a_unit;
varying vec2 v_unit;

void main() {
  v_unit = a_unit;
  gl_Position = vec4(a_unit * 2.0 - 1.0, 0.0, 1.0);
}
`;

function buildFragmentShader(
  exprCount: number,
  exprs: readonly string[],
): string {
  const evalFns = exprs
    .map(
      (expr, i) => `
float evalExpr_${i}(float x, float y) {
  return ${expr};
}`,
    )
    .join('\n');

  const dispatchCases =
    exprCount > 0
      ? exprs
          .map(
            (_, i) => `
  if (eqIndex == ${i}) return evalExpr_${i}(x, y);`,
          )
          .join('')
      : '\n  return 1.0;';

  return `
precision highp float;

const int MAX_EQUATIONS = ${MAX_EQUATIONS};

varying vec2 v_unit;

uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform float u_zoom;
uniform int u_equationCount;
uniform vec4 u_colors[MAX_EQUATIONS];
uniform float u_thickness[MAX_EQUATIONS];

${evalFns}

float evalEquation(int eqIndex, float x, float y) {${dispatchCases}
  return 1.0;
}

void main() {
  // Align with canvas/world coordinates used by other pipelines:
  // x grows right, y grows down (origin at top-left).
  vec2 screen = vec2(v_unit.x * u_resolution.x, (1.0 - v_unit.y) * u_resolution.y);
  float zoom = max(u_zoom, 0.0001);
  vec2 world = (screen - u_offset) / zoom;
  float worldPerPixel = 1.0 / zoom;
  float mathY = -world.y;
  float mx = world.x / ${S};
  float my = mathY / ${S};

  float bestAlpha = 0.0;
  vec4 bestColor = vec4(0.0);

  for (int i = 0; i < MAX_EQUATIONS; i++) {
    if (i >= u_equationCount) break;
    float f = evalEquation(i, mx, my);
    // Central differences for |∇f| (more stable than one-sided when one axis barely changes).
    float fxp = evalEquation(i, mx + worldPerPixel / ${S}, my);
    float fxm = evalEquation(i, mx - worldPerPixel / ${S}, my);
    float fyp = evalEquation(i, mx, my + worldPerPixel / ${S});
    float fym = evalEquation(i, mx, my - worldPerPixel / ${S});
    vec2 dfd = vec2(
      (fxp - fxm) / (2.0 * worldPerPixel),
      (fyp - fym) / (2.0 * worldPerPixel)
    );
    // |∇f| * worldPerPixel — same scale as forward length(fx - f, fy - f).
    float gradStep = length(dfd) * worldPerPixel;
    // Floor scales with zoom so a fixed 1e-4 in world units cannot dominate when worldPerPixel is tiny.
    float edgeDistPx = abs(f) / max(gradStep, worldPerPixel * 1e-8);
    float contour = 1.0 - smoothstep(0.0, u_thickness[i], edgeDistPx);
    if (contour > bestAlpha) {
      bestAlpha = contour * u_colors[i].a;
      bestColor = vec4(u_colors[i].rgb, bestAlpha);
    }
  }

  if (bestAlpha <= 0.001) {
    discard;
  }

  gl_FragColor = bestColor;
}
`;
}

function compileImplicitEquationProgram(
  gl: WebGLRenderingContext,
  equations: readonly ImplicitEquation[],
): WebGLProgram | null {
  const fragSrc = buildFragmentShader(
    equations.length,
    equations.map((eq) => eq.expr),
  );
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;
  return linkProgram(gl, vert, frag);
}

export class ImplicitEquationPipeline {
  private shaderCache: ShaderProgramCache;
  private program: WebGLProgram;
  private quadBuffer: WebGLBuffer;
  private aUnit: number;
  private uResolution: WebGLUniformLocation;
  private uOffset: WebGLUniformLocation;
  private uZoom: WebGLUniformLocation;
  private uEquationCount: WebGLUniformLocation;
  private uColors: WebGLUniformLocation;
  private uThickness: WebGLUniformLocation;
  private equationCount: number;
  private equationSignature: string;

  // Reused typed arrays: no per-frame allocations.
  private colors = new Float32Array(MAX_EQUATIONS * 4);
  private thickness = new Float32Array(MAX_EQUATIONS);

  private constructor(
    shaderCache: ShaderProgramCache,
    program: WebGLProgram,
    quadBuffer: WebGLBuffer,
    aUnit: number,
    uResolution: WebGLUniformLocation,
    uOffset: WebGLUniformLocation,
    uZoom: WebGLUniformLocation,
    uEquationCount: WebGLUniformLocation,
    uColors: WebGLUniformLocation,
    uThickness: WebGLUniformLocation,
    equationCount: number,
    equationSignature: string,
  ) {
    this.shaderCache = shaderCache;
    this.program = program;
    this.quadBuffer = quadBuffer;
    this.aUnit = aUnit;
    this.uResolution = uResolution;
    this.uOffset = uOffset;
    this.uZoom = uZoom;
    this.uEquationCount = uEquationCount;
    this.uColors = uColors;
    this.uThickness = uThickness;
    this.equationCount = equationCount;
    this.equationSignature = equationSignature;
  }

  private rebuildProgramForEquations(
    gl: WebGLRenderingContext,
    equations: readonly ImplicitEquation[],
    signature: string,
  ): boolean {
    const program = this.shaderCache.getOrCreate(gl, signature, () =>
      compileImplicitEquationProgram(gl, equations),
    );
    if (!program) return false;

    this.program = program;
    this.equationSignature = signature;

    this.uResolution = gl.getUniformLocation(program, 'u_resolution')!;
    this.uOffset = gl.getUniformLocation(program, 'u_offset')!;
    this.uZoom = gl.getUniformLocation(program, 'u_zoom')!;
    this.uEquationCount = gl.getUniformLocation(program, 'u_equationCount')!;
    this.uColors = gl.getUniformLocation(program, 'u_colors[0]')!;
    this.uThickness = gl.getUniformLocation(program, 'u_thickness[0]')!;
    this.aUnit = gl.getAttribLocation(program, 'a_unit');

    return true;
  }

  private updateEquations(
    gl: WebGLRenderingContext,
    implicitEquations: readonly ImplicitEquation[],
  ): boolean {
    const equations = implicitEquations.slice(0, MAX_EQUATIONS);
    const signature = equations.map((eq) => eq.expr).join('\u0000');

    if (
      signature !== this.equationSignature &&
      !this.rebuildProgramForEquations(gl, equations, signature)
    ) {
      return false;
    }

    this.equationCount = equations.length;
    for (let i = 0; i < this.equationCount; i++) {
      const eq = equations[i];
      this.thickness[i] = eq.thickness;
      const base = i * 4;
      this.colors[base] = eq.color[0];
      this.colors[base + 1] = eq.color[1];
      this.colors[base + 2] = eq.color[2];
      this.colors[base + 3] = eq.color[3];
    }

    return true;
  }

  static create(
    gl: WebGLRenderingContext,
    shaderCache: ShaderProgramCache,
  ): ImplicitEquationPipeline | null {
    const equations: ImplicitEquation[] = [];
    const signature = equations.map((eq) => eq.expr).join('\u0000');
    const program = shaderCache.getOrCreate(gl, signature, () =>
      compileImplicitEquationProgram(gl, equations),
    );
    if (!program) return null;

    const quadBuffer = gl.createBuffer();
    if (!quadBuffer) return null;

    const pipeline = new ImplicitEquationPipeline(
      shaderCache,
      program,
      quadBuffer,
      gl.getAttribLocation(program, 'a_unit'),
      gl.getUniformLocation(program, 'u_resolution')!,
      gl.getUniformLocation(program, 'u_offset')!,
      gl.getUniformLocation(program, 'u_zoom')!,
      gl.getUniformLocation(program, 'u_equationCount')!,
      gl.getUniformLocation(program, 'u_colors[0]')!,
      gl.getUniformLocation(program, 'u_thickness[0]')!,
      equations.length,
      equations.map((eq) => eq.expr).join('\u0000'),
    );

    for (let i = 0; i < equations.length; i++) {
      const eq = equations[i];
      pipeline.thickness[i] = eq.thickness;
      const base = i * 4;
      pipeline.colors[base] = eq.color[0];
      pipeline.colors[base + 1] = eq.color[1];
      pipeline.colors[base + 2] = eq.color[2];
      pipeline.colors[base + 3] = eq.color[3];
    }

    const quad = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    return pipeline;
  }

  draw(params: {
    gl: WebGLRenderingContext;
    canvas: HTMLCanvasElement;
    zoom: number;
    offsetX: number;
    offsetY: number;
    implicitEquations?: ImplicitEquation[];
  }): void {
    const { gl, canvas, zoom, offsetX, offsetY, implicitEquations } = params;

    if (implicitEquations && !this.updateEquations(gl, implicitEquations)) {
      return;
    }

    if (this.equationCount <= 0) return;

    gl.useProgram(this.program);
    gl.uniform2f(this.uResolution, canvas.width, canvas.height);
    gl.uniform2f(this.uOffset, offsetX, offsetY);
    gl.uniform1f(this.uZoom, zoom);
    gl.uniform1i(this.uEquationCount, this.equationCount);
    gl.uniform4fv(this.uColors, this.colors);
    gl.uniform1fv(this.uThickness, this.thickness);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.aUnit);
    gl.vertexAttribPointer(this.aUnit, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose(gl: WebGLRenderingContext): void {
    gl.deleteBuffer(this.quadBuffer);
  }
}
