import { Button } from "../../../components/ui/button";
import { CreateBoardDialog } from "./CreateBoardDialog";

type Props = {
  email?: string;
  onLogout: () => void;
  onCreateBoard: (name: string) => Promise<void>;
  isCreating: boolean;
};

export const DashboardHeader = ({
  email,
  onLogout,
  onCreateBoard,
  isCreating,
}: Props) => {
  return (
    <header className="bg-background border-b sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">Moje Whiteboardy</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>

        <div className="flex gap-2">
          <CreateBoardDialog
            onCreateBoard={onCreateBoard}
            isCreating={isCreating}
          />
          <Button variant="outline" onClick={onLogout}>
            Wyloguj się
          </Button>
        </div>
      </div>
    </header>
  );
};
