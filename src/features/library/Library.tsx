import { FilePlus2, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Doc } from "@/lib/db";
import { cn } from "cn";

const BRAND_ICON = `${import.meta.env.BASE_URL}images/logo.svg`;

interface LibraryProps {
  docs: Doc[];
  activeId: number | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
}

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

export function Library({
  docs,
  activeId,
  search,
  onSearchChange,
  onSelect,
  onNew,
  onDelete,
}: LibraryProps) {
  const query = search.trim().toLowerCase();
  const visible = query
    ? docs.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) || doc.content.toLowerCase().includes(query),
      )
    : docs;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3 lg:hidden">
        <img src={BRAND_ICON} alt="" className="size-6 shrink-0" />
        <span className="font-bangla text-base">অক্ষর</span>
      </div>
      <div className="border-b border-border px-4 pb-4 pt-5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Drafts</p>
          <p className="text-caption tabular-nums text-muted-foreground">
            {docs.length} on this device
          </p>
        </div>
        <Button className="mt-4 w-full justify-start" onClick={onNew}>
          <FilePlus2 />
          New document
        </Button>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search drafts"
            aria-label="Search documents"
            className="bg-input/30 pl-9"
          />
        </div>
      </div>

      <nav aria-label="Documents" className="min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {docs.length === 0 ? "No drafts yet. Start one." : "Nothing matched your search."}
          </p>
        ) : (
          <ul className="space-y-1">
            {visible.map((doc) => (
              <li key={doc.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(doc.id!)}
                  aria-current={doc.id === activeId ? "page" : undefined}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 rounded-md border-l-2 px-3 py-2.5 pr-12 text-left transition-colors sm:pr-10",
                    doc.id === activeId
                      ? "border-primary bg-secondary text-secondary-foreground"
                      : "border-transparent hover:bg-muted/70",
                  )}
                >
                  <span className="line-clamp-1 w-full text-sm font-medium">{doc.title}</span>
                  <span className="line-clamp-1 w-full font-bangla text-xs text-muted-foreground">
                    {doc.content.replace(/\s+/g, " ").trim() || "Empty draft"}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {relativeDate(doc.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${doc.title}`}
                  title="Delete document"
                  onClick={() => onDelete(doc.id!)}
                  className="absolute right-1 top-1 flex size-[44px] items-center justify-center rounded-md text-muted-foreground opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground focus-visible:opacity-100 sm:right-2 sm:top-2 sm:size-8 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="border-t border-border px-4 py-3 text-caption text-muted-foreground">
        On this device
      </div>
    </div>
  );
}
