import type { AvroCandidate } from "@/lib/avro-service";
import { cn } from "cn";

interface CandidateListProps {
  candidates: AvroCandidate[];
  selectedIndex: number;
  visible: boolean;
  mobile: boolean;
  rawQuery: string;
  position: { top: number; left: number } | null;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
}

export function CandidateList({
  candidates,
  selectedIndex,
  visible,
  mobile,
  rawQuery,
  position,
  onPick,
  onHover,
}: CandidateListProps) {
  if (!visible || candidates.length === 0) return null;

  const list = (
    <ul
      id="candidate-options"
      role="listbox"
      aria-label="Bangla word suggestions"
      className="candidate-pop pointer-events-auto flex max-h-72 gap-1.5 overflow-x-auto overscroll-x-contain p-2 sm:max-h-none sm:min-w-56 sm:flex-col sm:overflow-visible sm:rounded-xl sm:border sm:bg-popover sm:p-1.5 sm:shadow-xl"
    >
      {candidates.map((candidate, index) => (
        <li
          key={`${candidate.id}-${candidate.name}`}
          id={`candidate-${index}`}
          role="option"
          aria-selected={index === selectedIndex}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(index);
          }}
          onMouseEnter={() => onHover(index)}
          className={cn(
            "flex min-h-11 shrink-0 cursor-pointer items-center rounded-md px-3 text-base font-medium transition-colors duration-100 sm:w-full sm:justify-between sm:text-sm",
            index === selectedIndex
              ? cn(
                  "bg-primary text-primary-foreground",
                  candidate.name === rawQuery ? "sm:text-base" : "sm:text-lg",
                )
              : "bg-muted/60 text-foreground hover:bg-muted",
            candidate.name === rawQuery && "text-muted-foreground",
          )}
        >
          <span className="truncate font-bangla">{candidate.name}</span>
          {candidate.name === rawQuery ? (
            <span className="ml-3 hidden text-xs opacity-70 sm:inline">as typed</span>
          ) : index === selectedIndex ? (
            <span className="ml-3 hidden text-xs opacity-70 sm:inline">Space</span>
          ) : null}
        </li>
      ))}
    </ul>
  );

  if (mobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+var(--keyboard-inset,0px))] pt-2 backdrop-blur">
        {list}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{ top: position?.top ?? 0, left: position?.left ?? 0 }}
    >
      <div className="relative pl-3">
        <span className="absolute left-0.5 top-4 size-3 -skew-y-45 rounded-[2px] border-l border-t border-border bg-popover" />
        {list}
      </div>
    </div>
  );
}
