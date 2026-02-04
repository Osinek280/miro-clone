import { Grid3x3, Plus } from "lucide-react";
import { Button } from "../../../components/ui/button";

type Props = {
  searching: boolean;
  onCreate: () => void;
};

export const EmptyState = ({ searching, onCreate }: Props) => {
  return (
    <div className="text-center py-12">
      <Grid3x3 size={48} className="mx-auto mb-4 text-muted-foreground" />

      <h3 className="text-lg font-medium mb-2">
        {searching ? "Nie znaleziono" : "Brak whiteboardów"}
      </h3>

      {!searching && (
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Utwórz
        </Button>
      )}
    </div>
  );
};
