/**
 * LRU cache for WebGL programs keyed by caller-defined strings (e.g. equation signatures).
 * Evicts least-recently-used programs when over capacity; call {@link clear} on teardown.
 */
export class ShaderProgramCache {
  private readonly maxEntries: number;
  private readonly programs = new Map<string, WebGLProgram>();

  constructor(maxEntries = 32) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  getOrCreate(
    gl: WebGLRenderingContext,
    key: string,
    create: () => WebGLProgram | null,
  ): WebGLProgram | null {
    const hit = this.programs.get(key);
    if (hit) {
      this.programs.delete(key);
      this.programs.set(key, hit);
      return hit;
    }

    const program = create();
    if (!program) return null;

    while (this.programs.size >= this.maxEntries) {
      const firstKey = this.programs.keys().next().value as string | undefined;
      if (firstKey === undefined) break;
      const evicted = this.programs.get(firstKey);
      if (evicted) gl.deleteProgram(evicted);
      this.programs.delete(firstKey);
    }

    this.programs.set(key, program);
    return program;
  }

  clear(gl: WebGLRenderingContext): void {
    for (const program of this.programs.values()) {
      gl.deleteProgram(program);
    }
    this.programs.clear();
  }
}
