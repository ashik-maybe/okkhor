import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KEYMAP } from "@/lib/keymap";

export type HelpTab = "shortcuts" | "keymap";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: HelpTab;
  onTabChange: (tab: HelpTab) => void;
}

const SHORTCUTS: Array<[string, string]> = [
  ["Space / Tab / Enter", "Commit the selected Bangla word"],
  ["↑ / ↓", "Move between suggestions"],
  ["Esc", "Dismiss suggestions"],
  ["Ctrl+K", "Open the command palette"],
  ["Ctrl+.", "Switch between Bangla and English"],
  ["?", "Show this list"],
];

export function HelpDialog({ open, onOpenChange, tab, onTabChange }: HelpDialogProps) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();

  const copyKey = (keys: string) => {
    void navigator.clipboard?.writeText(keys).catch(() => undefined);
    toast.success(`Copied ${keys}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,720px)] flex-col gap-4 p-5 sm:max-w-3xl sm:p-6">
        <DialogHeader className="text-left">
          <DialogTitle>Help</DialogTitle>
          <DialogDescription>Write Bangla without memorising a keyboard.</DialogDescription>
        </DialogHeader>

        <div
          role="group"
          aria-label="Help sections"
          className="inline-flex w-fit rounded-md border border-border bg-muted/60 p-0.5"
        >
          {(
            [
              ["shortcuts", "Shortcuts"],
              ["keymap", "Avro keymap"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => onTabChange(value)}
              className={`min-h-[44px] rounded-sm px-3 text-sm font-medium transition-colors sm:min-h-9 ${
                tab === value
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "shortcuts" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              {SHORTCUTS.map(([key, description]) => (
                <div key={key} className="contents">
                  <dt>
                    <kbd>{key}</kbd>
                  </dt>
                  <dd className="text-muted-foreground">{description}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
              Type roman letters and press Space to choose a Bangla word. The full Avro key map is
              one tap away in the Avro keymap tab.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <Input
              aria-label="Filter Avro keymap"
              placeholder="Filter by key or letter…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              {KEYMAP.map((group) => {
                const entries = group.entries.filter((entry) =>
                  [
                    entry.keys,
                    entry.glyph,
                    entry.note ?? "",
                    entry.example?.roman ?? "",
                    entry.example?.bangla ?? "",
                  ]
                    .join(" ")
                    .toLowerCase()
                    .includes(needle),
                );
                if (entries.length === 0) return null;
                return (
                  <section key={group.title}>
                    <h3 className="text-caption font-semibold tracking-wide text-muted-foreground">
                      {group.title}
                    </h3>
                    <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {entries.map((entry) => (
                        <button
                          key={`${group.title}-${entry.keys}-${entry.glyph}`}
                          type="button"
                          onClick={() => copyKey(entry.keys)}
                          title={`Copy ${entry.keys}`}
                          className="flex min-h-[44px] items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/30 px-2.5 py-2 text-left transition-colors hover:border-primary hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="font-bangla text-lg leading-none">{entry.glyph}</span>
                          <span className="min-w-0 text-right">
                            <kbd className="whitespace-nowrap">{entry.keys}</kbd>
                            <span className="mt-1 block truncate text-caption text-muted-foreground">
                              {entry.example
                                ? `${entry.example.roman} → ${entry.example.bangla}`
                                : (entry.note ?? "\u00a0")}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
              {needle &&
              !KEYMAP.some((group) =>
                group.entries.some((entry) =>
                  [
                    entry.keys,
                    entry.glyph,
                    entry.note ?? "",
                    entry.example?.roman ?? "",
                    entry.example?.bangla ?? "",
                  ]
                    .join(" ")
                    .toLowerCase()
                    .includes(needle),
                ),
              ) ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No key matches “{filter}”.
                </p>
              ) : null}
            </div>
            <p className="border-t border-border pt-3 text-caption text-muted-foreground">
              Keymap follows Avro Phonetic by OmicronLab ·{" "}
              <a
                href="https://www.omicronlab.com/"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                omicronlab.com
              </a>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
