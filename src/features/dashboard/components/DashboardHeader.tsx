import { Plus } from "lucide-react";
import { Button } from "../../../components/ui/button";

type Props = {
  email?: string;
  onCreate: () => void;
  onLogout: () => void;
};

export const DashboardHeader = ({ email, onCreate, onLogout }: Props) => {
  return (
    <header className="bg-background border-b sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">Moje Whiteboardy</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nowy whiteboard
          </Button>
          <Button variant="outline" onClick={onLogout}>
            Wyloguj się
          </Button>
        </div>
      </div>
    </header>
  );
};
