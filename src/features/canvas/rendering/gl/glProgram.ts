export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[WebGLRenderer] Shader:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function linkProgram(
  gl: WebGLRenderingContext,
  vert: WebGLShader,
  frag: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[WebGLRenderer] Link:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}
