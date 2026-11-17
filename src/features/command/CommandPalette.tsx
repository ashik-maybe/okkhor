import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CommandAction[];
}

export function CommandPalette({ open, onOpenChange, actions }: CommandPaletteProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette">
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        <CommandGroup heading="Actions">
          {actions.map((action) => (
            <CommandItem
              key={action.id}
              value={action.label}
              onSelect={() => {
                action.run();
                onOpenChange(false);
              }}
            >
              <span>{action.label}</span>
              {action.hint ? (
                <span className="ml-auto text-xs text-muted-foreground">{action.hint}</span>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
