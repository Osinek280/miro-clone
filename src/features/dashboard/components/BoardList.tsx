import { MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { ScrollArea } from "../../../components/ui/scroll-area";
import type { Whiteboard } from "../api/dashboard.types";
import {
  formatDate,
  getRoleIcon,
  getRoleLabel,
  getGradient,
} from "../utils/board.utils";
type Props = {
  boards: Whiteboard[];
  onOpen: (id: string) => void;
};

export const BoardsList = ({ boards, onOpen }: Props) => {
  return (
    <Card className="p-0 h-125">
      <ScrollArea className="h-full">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="text-left p-4">Nazwa</th>
              <th className="text-left p-4">Rola</th>
              <th className="text-left p-4">Ostatnie otwarcie</th>
              <th className="p-4 w-12"></th>
            </tr>
          </thead>

          <tbody>
            {boards.map((board) => (
              <tr
                key={board.id}
                onClick={() => onOpen(board.id)}
                className="border-b cursor-pointer hover:bg-muted/40 transition"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded"
                      style={{ background: getGradient(board.id) }}
                    />
                    <span className="font-medium">{board.name}</span>
                  </div>
                </td>

                <td className="p-4">
                  <Badge>
                    {getRoleIcon(board.role)}
                    <span className="ml-1">{getRoleLabel(board.role)}</span>
                  </Badge>
                </td>

                <td className="p-4 text-muted-foreground">
                  {formatDate(board.lastOpenedAt)}
                </td>
                <td
                  className="p-4 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => console.log("rename", board.id)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Zmień nazwę
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => console.log("share", board.id)}
                      >
                        <Share2 className="mr-2 h-4 w-4" />
                        Udostępnij dostęp
                      </DropdownMenuItem>

                      {board.role === "OWNER" && (
                        <>
                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => console.log("delete", board.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Usuń
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </Card>
  );
};
