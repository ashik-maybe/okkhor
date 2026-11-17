import { useState } from "react";
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
  group: string;
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

const GROUPS = ["Writing", "Drafts", "Export & share", "Appearance", "Help"];

function relativeDate(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-GB");
}

function draftDetail(doc: Doc, query: string): string {
  const needle = query.trim().toLowerCase();
  if (needle) {
    const text = doc.content.replace(/\s+/g, " ").trim();
    const index = text.toLowerCase().indexOf(needle);
    if (index >= 0) {
      const start = Math.max(0, index - 24);
      const end = Math.min(text.length, index + needle.length + 40);
      return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
    }
  }
  return relativeDate(doc.updatedAt);
}

export function CommandPalette({
  open,
  onOpenChange,
  actions,
  docs,
  onSelectDraft,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      onSearchChange={setQuery}
      title="Command palette"
    >
      <CommandList>
        <CommandEmpty>
          {query ? `Nothing matches “${query}”.` : "No drafts or commands yet."}
        </CommandEmpty>
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
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{doc.title}</span>
                  <span className="truncate text-caption text-muted-foreground">
                    {draftDetail(doc, query)}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {GROUPS.map((group) => {
          const items = actions.filter((action) => action.group === group);
          if (items.length === 0) return null;
          return (
            <CommandGroup key={group} heading={group}>
              {items.map((action) => (
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
                    <span className="ml-auto text-caption text-muted-foreground">
                      {action.hint}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
