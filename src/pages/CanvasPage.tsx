import { useNavigate, useParams } from 'react-router-dom';
import Whiteboard from '../features/canvas/Whiteboard';
import { useEffect } from 'react';

export default function CanvasPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    if (!boardId) {
      navigate(-1); // -1 oznacza "cofnij się o jedną stronę w historii"
    }
  }, [boardId, navigate]);

  if (!boardId) return null; // nic nie renderujemy, póki nie wrócimy
  return (
    <div className="w-screen h-screen">
      <Whiteboard boardId={boardId} />
    </div>
  );
}
