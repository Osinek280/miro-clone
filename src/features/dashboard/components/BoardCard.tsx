import { Badge } from "lucide-react";
import { Card, CardContent } from "../../../components/ui/card";
import type { Whiteboard } from "../api/dashboard.types";
import {
  getGradient,
  getRoleIcon,
  getRoleLabel,
  formatDate,
} from "../utils/board.utils";

type Props = {
  board: Whiteboard;
  onOpen: (id: string) => void;
};

export const BoardCard = ({ board, onOpen }: Props) => {
  return (
    <Card
      onClick={() => onOpen(board.id)}
      className="cursor-pointer overflow-hidden hover:shadow-lg p-0"
    >
      <div className="h-40" style={{ background: getGradient(board.id) }} />
      <CardContent className="pb-2 space-y-2">
        <h3 className="font-semibold">{board.name}</h3>

        <p className="text-sm text-muted-foreground">
          {formatDate(board.lastOpenedAt)}
        </p>

        <Badge>
          {getRoleIcon(board.role)}
          <span className="ml-1">{getRoleLabel(board.role)}</span>
        </Badge>
      </CardContent>
    </Card>
  );
};
