import { useNavigate, useParams } from 'react-router-dom';
import { useCallback, useEffect } from 'react';
import Whiteboard from '../features/board/Whiteboard';

export default function CanvasPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();

  const onSnapshotError = useCallback(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!boardId) {
      navigate(-1);
    }
  }, [boardId, navigate]);

  if (!boardId) return null;
  return (
    <div className="w-screen h-screen">
      <Whiteboard boardId={boardId} onSnapshotError={onSnapshotError} />
    </div>
  );
}
