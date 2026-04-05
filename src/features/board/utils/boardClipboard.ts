import type { DrawObject, ImageDrawObject, PathDrawObject } from '../types/types';
import { roundPoint } from './cameraUtils';
import { calcBoundingBox } from './objectUtils';

/** Klucz w JSON — mało prawdopodobny konflikt z wklejonym „zwykłym” tekstem. */
export const BOARD_CLIP_JSON_KEY = 'miroCloneBoardClipV1' as const;

const MAX_CLIP_OBJECTS = 500;

function isFiniteNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function isPointLike(p: unknown): p is { x: number; y: number } {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return isFiniteNum(o.x) && isFiniteNum(o.y);
}

function normalizePath(o: unknown): PathDrawObject | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  if (x.type !== 'PATH') return null;
  if (!Array.isArray(x.points) || x.points.length === 0) return null;
  const points = x.points.filter(isPointLike).map((p) => roundPoint({ x: p.x, y: p.y }));
  if (points.length === 0) return null;
  if (typeof x.color !== 'string') return null;
  if (!isFiniteNum(x.size)) return null;
  return {
    id: typeof x.id === 'string' ? x.id : '',
    type: 'PATH',
    points,
    color: x.color,
    size: x.size,
    tombstone: false,
    positionTimestamp:
      isFiniteNum(x.positionTimestamp) ? x.positionTimestamp : Date.now(),
  };
}

function normalizeImage(o: unknown): ImageDrawObject | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  if (x.type !== 'IMAGE') return null;
  if (
    !isFiniteNum(x.x) ||
    !isFiniteNum(x.y) ||
    !isFiniteNum(x.width) ||
    !isFiniteNum(x.height)
  ) {
    return null;
  }
  if (typeof x.src !== 'string' || x.src.length === 0) return null;
  return {
    id: typeof x.id === 'string' ? x.id : '',
    type: 'IMAGE',
    x: x.x,
    y: x.y,
    width: Math.max(1, x.width),
    height: Math.max(1, x.height),
    src: x.src,
    tombstone: false,
    positionTimestamp:
      isFiniteNum(x.positionTimestamp) ? x.positionTimestamp : Date.now(),
  };
}

export function encodeBoardClip(objects: DrawObject[]): string {
  return JSON.stringify({
    [BOARD_CLIP_JSON_KEY]: { objects },
  });
}

export function decodeBoardClip(text: string): DrawObject[] | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return null;
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const root = data as Record<string, unknown>;
  const clip = root[BOARD_CLIP_JSON_KEY];
  if (!clip || typeof clip !== 'object') return null;
  const objects = (clip as Record<string, unknown>).objects;
  if (!Array.isArray(objects)) return null;
  const slice = objects.slice(0, MAX_CLIP_OBJECTS);
  const out: DrawObject[] = [];
  for (const item of slice) {
    const p = normalizePath(item);
    if (p) {
      out.push(p);
      continue;
    }
    const im = normalizeImage(item);
    if (im) out.push(im);
  }
  return out.length > 0 ? out : null;
}

export function cloneDrawObjectsForPaste(objs: DrawObject[]): DrawObject[] {
  const ts = Date.now();
  return objs.map((o) => {
    if (o.type === 'IMAGE') {
      return {
        ...o,
        id: crypto.randomUUID(),
        tombstone: false,
        positionTimestamp: ts,
      };
    }
    return {
      ...o,
      id: crypto.randomUUID(),
      points: o.points.map((p) => ({ ...p })),
      tombstone: false,
      positionTimestamp: ts,
    };
  });
}

export function translateDrawObjects(
  objs: DrawObject[],
  dx: number,
  dy: number,
): DrawObject[] {
  return objs.map((o) => {
    if (o.type === 'IMAGE') {
      const p = roundPoint({ x: o.x + dx, y: o.y + dy });
      return { ...o, x: p.x, y: p.y };
    }
    return {
      ...o,
      points: o.points.map((pt) =>
        roundPoint({ x: pt.x + dx, y: pt.y + dy }),
      ),
    };
  });
}

export function bboxCenterWorld(box: {
  start: { x: number; y: number };
  end: { x: number; y: number };
}): { x: number; y: number } | null {
  if (
    !Number.isFinite(box.start.x) ||
    !Number.isFinite(box.end.x) ||
    box.start.x > box.end.x
  ) {
    return null;
  }
  return {
    x: (box.start.x + box.end.x) / 2,
    y: (box.start.y + box.end.y) / 2,
  };
}

export function placeClonesAtViewportCenter(
  clones: DrawObject[],
  centerWorld: { x: number; y: number },
  nudgeWorld: number,
): DrawObject[] {
  const box = calcBoundingBox(clones);
  const bc = bboxCenterWorld(box);
  if (!bc) return clones;
  const dx = centerWorld.x - bc.x + nudgeWorld;
  const dy = centerWorld.y - bc.y + nudgeWorld;
  return translateDrawObjects(clones, dx, dy);
}
