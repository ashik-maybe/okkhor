import type { AvroCandidate } from "@/lib/avro-service";
import { cn } from "cn";

interface CandidateListProps {
  candidates: AvroCandidate[];
  selectedIndex: number;
  visible: boolean;
  position: { top: number; left: number } | null;
  onPick: (index: number) => void;
  onHover: (index: number) => void;
}

export function CandidateList({
  candidates,
  selectedIndex,
  visible,
  position,
  onPick,
  onHover,
}: CandidateListProps) {
  if (!visible || candidates.length === 0) return null;

  const renderList = () => (
    <ul
      role="listbox"
      aria-label="Bangla word suggestions"
      aria-activedescendant={`candidate-${selectedIndex}`}
      className="flex max-h-72 gap-1.5 overflow-x-auto overscroll-x-contain p-2 sm:max-h-none sm:min-w-56 sm:flex-col sm:overflow-visible sm:rounded-lg sm:border sm:bg-popover sm:p-1.5 sm:shadow-xl"
    >
      {candidates.map((candidate, index) => (
        <li
          key={`${candidate.id}-${candidate.name}`}
          id={`candidate-${index}`}
          role="option"
          aria-selected={index === selectedIndex}
        >
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(index);
            }}
            onMouseEnter={() => onHover(index)}
            className={cn(
              "flex min-h-11 shrink-0 items-center rounded-md px-3 text-base font-medium transition-colors sm:w-full sm:justify-between sm:text-sm",
              index === selectedIndex
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-foreground hover:bg-muted",
            )}
          >
            <span className="truncate font-bangla">{candidate.name}</span>
            {index === selectedIndex ? (
              <span className="ml-3 hidden text-xs opacity-70 sm:inline">Tab</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <div
        className="pointer-events-none absolute z-30 hidden sm:block"
        style={{
          top: position?.top ?? 0,
          left: position?.left ?? 0,
        }}
      >
        <div className="pointer-events-auto border-l-2 border-primary pl-0.5">{renderList()}</div>
      </div>
      <div className="fixed inset-x-0 z-40 border-t border-border bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+var(--keyboard-inset,0px))] pt-2 backdrop-blur sm:hidden">
        {renderList()}
      </div>
    </>
  );
}
