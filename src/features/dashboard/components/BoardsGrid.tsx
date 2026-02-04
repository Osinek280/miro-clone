import type { Whiteboard } from "../api/dashboard.types";
import { BoardCard } from "./BoardCard";

type Props = {
  boards: Whiteboard[];
  onOpen: (id: string) => void;
};

export const BoardsGrid = ({ boards, onOpen }: Props) => {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {boards.map((b) => (
        <BoardCard key={b.id} board={b} onOpen={onOpen} />
      ))}
    </div>
  );
};
