import type { DrawObject } from '../../types/types';
import {
  buildStrokeGeometry,
  hexToRgba,
  type CachedGeometry,
} from '../geometry/StrokeGeometry';

export class GeometryCache {
  private geometries = new Map<string, CachedGeometry | null>();
  private keys = new Map<string, string>();

  private stateKey(obj: DrawObject): string {
    const first = obj.points[0];
    const last = obj.points[obj.points.length - 1];
    return `${obj.color || '#000'}|${obj.size}|${obj.points.length}|${first?.x},${first?.y}|${last?.x},${last?.y}`;
  }

  sync(objects: DrawObject[]): void {
    const activeIds = new Set(objects.map((o) => o.id));
    for (const id of this.geometries.keys()) {
      if (!activeIds.has(id)) {
        this.geometries.delete(id);
        this.keys.delete(id);
      }
    }

    for (const obj of objects) {
      const key = this.stateKey(obj);
      if (this.keys.get(obj.id) === key) continue;

      this.geometries.set(
        obj.id,
        buildStrokeGeometry(obj.points, hexToRgba(obj.color || '#000'), obj.size || 15),
      );
      this.keys.set(obj.id, key);
    }
  }

  get(id: string): CachedGeometry | null | undefined {
    return this.geometries.get(id);
  }

  clear(): void {
    this.geometries.clear();
    this.keys.clear();
  }
}
