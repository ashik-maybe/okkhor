import type { Doc } from "@/lib/db";
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
  docs: Doc[];
  onSelectDraft: (id: number) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  actions,
  docs,
  onSelectDraft,
}: CommandPaletteProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette">
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        {docs.length > 0 ? (
          <CommandGroup heading="Jump to draft">
            {docs.map((doc) => (
              <CommandItem
                key={doc.id}
                value={`${doc.title} ${doc.content}`}
                onSelect={() => {
                  onSelectDraft(doc.id!);
                  onOpenChange(false);
                }}
              >
                <span className="truncate">{doc.title}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">
                  {new Date(doc.updatedAt).toLocaleDateString("en-GB")}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
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
