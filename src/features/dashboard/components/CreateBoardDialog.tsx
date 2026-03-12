import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';

interface CreateBoardDialogProps {
  onCreateBoard: (name: string) => Promise<void>;
  isCreating?: boolean;
}

export const CreateBoardDialog = ({
  onCreateBoard,
  isCreating = false,
}: CreateBoardDialogProps) => {
  const [open, setOpen] = useState(false);
  const [boardName, setBoardName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!boardName.trim()) return;

    try {
      await onCreateBoard(boardName.trim());
      setBoardName('');
      setOpen(false);
    } catch (error) {
      console.error('Failed to create board:', error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setBoardName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New whiteboard
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-106.25">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create new whiteboard</DialogTitle>
            <DialogDescription>
              Enter a name for the new board. You can change it later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="board-name">Nazwa tablicy</Label>
              <Input
                id="board-name"
                placeholder="e.g. Marketing project"
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                autoFocus
                disabled={isCreating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isCreating}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={!boardName.trim() || isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
