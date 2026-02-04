import { Search, Grid3x3, List } from "lucide-react";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";

type Props = {
  search: string;
  onSearch: (v: string) => void;
  viewMode: "grid" | "list";
  setViewMode: (m: "grid" | "list") => void;
};

export const DashboardToolbar = ({
  search,
  onSearch,
  viewMode,
  setViewMode,
}: Props) => {
  return (
    <div className="flex gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Szukaj..."
          className="pl-9"
        />
      </div>

      <div className="inline-flex">
        <Button
          variant={viewMode === "grid" ? "default" : "outline"}
          size="icon"
          onClick={() => setViewMode("grid")}
        >
          <Grid3x3 />
        </Button>

        <Button
          variant={viewMode === "list" ? "default" : "outline"}
          size="icon"
          onClick={() => setViewMode("list")}
        >
          <List />
        </Button>
      </div>
    </div>
  );
};
