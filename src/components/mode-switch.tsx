import { cn } from "cn";

interface ModeSwitchProps {
  banglaMode: boolean;
  onToggle: () => void;
  className?: string;
}

/** One control, shown in the header on wider screens and beside the editor on phones. */
export function ModeSwitch({ banglaMode, onToggle, className }: ModeSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={banglaMode}
      aria-label="Toggle Bangla and English input"
      title={banglaMode ? "Bangla phonetic input" : "English input"}
      onClick={onToggle}
      className={cn(
        "relative h-[44px] w-[80px] shrink-0 overflow-hidden rounded-full border border-border bg-muted/60 sm:h-9",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-2.5 text-caption font-bold text-muted-foreground">
        <span>বাং</span>
        <span>EN</span>
      </span>
      <span
        className={cn(
          "absolute left-0.5 top-0.5 flex size-8 items-center justify-center rounded-full bg-primary text-caption font-bold text-primary-foreground shadow-sm transition-transform duration-normal ease-out active:scale-95 sm:size-7",
          banglaMode ? "translate-x-0" : "translate-x-10 sm:translate-x-11",
        )}
      >
        {banglaMode ? "বাং" : "EN"}
      </span>
    </button>
  );
}
