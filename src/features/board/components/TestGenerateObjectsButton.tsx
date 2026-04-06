import type { DrawObject, HistoryOperation } from '../types/types';

type TestGenerateObjectsButtonProps = {
  boardReady: boolean;
  objects: DrawObject[];
  setObjects: (action: DrawObject[] | ((prev: DrawObject[]) => DrawObject[])) => void;
  pushSyncedOperation: (op: HistoryOperation) => void;
};

/**
 * Test-only helper used for stress checks.
 * Not part of the production toolbar/tooling flow.
 */
export default function TestGenerateObjectsButton({
  boardReady,
  objects,
  setObjects,
  pushSyncedOperation,
}: TestGenerateObjectsButtonProps) {
  const generateObjects = () => {
    const prev = objects;
    const arr: DrawObject[] = [];

    for (let i = 0; i < 10000; i++) {
      const x = Math.random() * 5000 - 2500;
      const y = Math.random() * 5000 - 2500;

      arr.push({
        id: crypto.randomUUID(),
        points: [
          { x, y },
          { x: x + Math.random() * 50, y: y + Math.random() * 50 },
        ],
        type: 'PATH',
        color: '#0d0d0d',
        tombstone: false,
        positionTimestamp: Date.now(),
        size: 15,
      });
    }

    pushSyncedOperation({
      opId: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'batch',
      operations: [
        {
          opId: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'remove',
          ids: prev.map((o) => o.id),
        },
        {
          opId: crypto.randomUUID(),
          timestamp: Date.now(),
          type: 'add',
          objects: arr,
        },
      ],
    });
    setObjects(arr);
  };

  return (
    <div className="absolute top-4 left-4 flex gap-2 flex-wrap z-40">
      <button
        type="button"
        disabled={!boardReady}
        onClick={generateObjects}
        title="Test-only component: generates 10k sample objects"
        className="px-4 py-2 rounded bg-amber-500 text-white cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
      >
        [TEST] Generate 10k objects
      </button>
    </div>
  );
}
