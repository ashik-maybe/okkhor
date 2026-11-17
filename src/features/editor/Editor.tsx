import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  commitCandidate,
  extractToken,
  suggestCandidates,
  type AvroCandidate,
} from "@/lib/avro-service";
import type { AvroInstance } from "@/engine";
import { commitSuffix } from "@/lib/typing";
import { CandidateList } from "@/features/candidates/CandidateList";
import { ModeSwitch } from "@/components/mode-switch";
import { hasSeenHints, markHintsSeen } from "@/lib/preferences";

interface EditorProps {
  docId: number;
  content: string;
  banglaMode: boolean;
  engine: AvroInstance | null;
  personalWords: Map<string, number>;
  mobileCandidates: boolean;
  saveState: "saved" | "saving" | "error";
  engineError: boolean;
  onToggleMode: () => void;
  onActivate: () => void;
  onChange: (value: string) => void;
  onRememberWord: (word: string) => void;
}

const MIRROR_PROPERTIES = [
  "box-sizing",
  "width",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "text-align",
  "tab-size",
];

// Reuse one hidden mirror. Creating and removing a DOM node on every keystroke
// forced a full style recalculation and was the most expensive part of typing.
let mirrorNode: HTMLDivElement | null = null;
let markerNode: HTMLSpanElement | null = null;

function caretPosition(textarea: HTMLTextAreaElement, cursor: number) {
  const computed = getComputedStyle(textarea);
  if (!mirrorNode || !markerNode) {
    mirrorNode = document.createElement("div");
    markerNode = document.createElement("span");
    mirrorNode.style.position = "absolute";
    mirrorNode.style.visibility = "hidden";
    mirrorNode.style.whiteSpace = "pre-wrap";
    mirrorNode.style.wordWrap = "break-word";
    mirrorNode.style.overflow = "hidden";
    mirrorNode.style.pointerEvents = "none";
    document.body.appendChild(mirrorNode);
  }
  for (const property of MIRROR_PROPERTIES) {
    mirrorNode.style.setProperty(property, computed.getPropertyValue(property));
  }
  mirrorNode.textContent = textarea.value.slice(0, cursor);
  markerNode.textContent = textarea.value.slice(cursor) || ".";
  mirrorNode.appendChild(markerNode);

  return {
    top: markerNode.offsetTop - textarea.scrollTop + textarea.offsetTop,
    left: markerNode.offsetLeft - textarea.scrollLeft + textarea.offsetLeft,
  };
}

function countWords(text: string): number {
  if ("Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("bn", { granularity: "word" });
    let count = 0;
    for (const part of segmenter.segment(text)) {
      if (part.isWordLike) count += 1;
    }
    return count;
  }
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function Editor({
  docId,
  content,
  banglaMode,
  engine,
  personalWords,
  mobileCandidates,
  saveState,
  engineError,
  onToggleMode,
  onActivate,
  onChange,
  onRememberWord,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const [candidates, setCandidates] = useState<AvroCandidate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [query, setQuery] = useState("");
  const [introDismissed, setIntroDismissed] = useState(hasSeenHints);

  const resize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, window.innerHeight * 0.7)}px`;
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.value = content;
    setVisible(false);
    resize();
    // The value is synced only when switching documents so typing stays smooth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, resize]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    setCandidates([]);
    setQuery("");
  }, []);

  const refreshCandidates = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea || !engine || !banglaMode || composingRef.current) {
      hide();
      return;
    }
    const before = textarea.value.slice(0, textarea.selectionStart);
    const token = extractToken(before, banglaMode);
    if (!token) {
      hide();
      return;
    }
    const result = suggestCandidates(engine, token, personalWords);
    setQuery(token);
    setCandidates(result.candidates);
    setSelectedIndex(0);
    setVisible(true);
    setPosition(caretPosition(textarea, textarea.selectionStart));
  }, [banglaMode, engine, hide, personalWords]);

  // The engine loads after the editor mounts. Refresh when it arrives so a
  // token typed before load still gets suggestions without another keystroke.
  useEffect(() => {
    refreshCandidates();
  }, [engine, banglaMode, refreshCandidates]);

  const pick = useCallback(
    (index: number, suffix = " ") => {
      const candidate = candidates[index];
      const textarea = textareaRef.current;
      if (!candidate || !textarea) return;

      const cursor = textarea.selectionStart;
      const before = textarea.value.slice(0, cursor);
      const tokenMatch = /\s?([^\s]+)$/.exec(before);
      const start = tokenMatch ? cursor - tokenMatch[1].length : cursor;
      const next = `${textarea.value.slice(0, start)}${candidate.name}${suffix}${textarea.value.slice(cursor)}`;
      textarea.value = next;
      const nextCursor = start + candidate.name.length + suffix.length;
      textarea.setSelectionRange(nextCursor, nextCursor);

      onChange(next);
      onRememberWord(candidate.name);
      setAnnouncement(`Committed ${candidate.name}`);
      setIntroDismissed(true);
      markHintsSeen();
      if (tokenMatch && engine) commitCandidate(engine, tokenMatch[1], candidate.name);
      hide();
      resize();
      textarea.focus();
    },
    [candidates, engine, hide, onChange, onRememberWord, resize],
  );

  const insertExample = (roman: string, bangla: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const next = `${bangla} `;
    textarea.value = next;
    textarea.setSelectionRange(next.length, next.length);
    onChange(next);
    onRememberWord(bangla);
    if (engine) commitCandidate(engine, roman, bangla);
    setAnnouncement(`Committed ${bangla}`);
    setIntroDismissed(true);
    markHintsSeen();
    hide();
    resize();
    textarea.focus();
  };

  const showIntro = !introDismissed && banglaMode && content.trim() === "";

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (composingRef.current || event.nativeEvent.isComposing) return;
    const candidatesVisible = visible && candidates.length > 0;
    const suffix = commitSuffix(event.key, candidatesVisible);
    if (suffix !== null) {
      event.preventDefault();
      pick(selectedIndex, suffix);
      return;
    }
    if (!candidatesVisible) return;
    const key = event.key.toLowerCase();

    if (event.key === "ArrowDown" || (event.ctrlKey && key === "n")) {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % candidates.length);
      return;
    }
    if (event.key === "ArrowUp" || (event.ctrlKey && key === "p")) {
      event.preventDefault();
      setSelectedIndex((current) => (current - 1 + candidates.length) % candidates.length);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
    }
  };

  return (
    <section className="relative flex min-h-0 flex-1 flex-col" aria-label="Writing surface">
      <div className="mx-auto flex w-full max-w-[66ch] flex-1 flex-col px-3 pb-28 pt-4 sm:px-8 sm:pb-10 sm:pt-8">
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/70 bg-card/70 px-5 py-5 shadow-sm sm:px-10 sm:py-8">
          <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                  {banglaMode ? "বাংলা" : "English"}
                </p>
                <ModeSwitch banglaMode={banglaMode} onToggle={onToggleMode} className="sm:hidden" />
              </div>
              <p id="editor-hint" className="mt-1 text-sm text-muted-foreground">
                {showIntro
                  ? "Type roman letters. Press Space to choose a Bangla word."
                  : banglaMode
                    ? "Space commits · ↑ ↓ to choose"
                    : "Write freely in English."}
              </p>
              {banglaMode && engineError ? (
                <p className="mt-1 text-caption text-destructive">
                  Dictionary unavailable — plain text still works.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{countWords(content)} words</span>
              <span className="hidden sm:inline">·</span>
              <span>
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "error"
                    ? "Not saved"
                    : "Saved locally"}
              </span>
            </div>
          </div>

          <label className="sr-only" htmlFor="editor">
            {banglaMode ? "Write in Bangla" : "Write in English"}
          </label>
          <textarea
            id="editor"
            ref={textareaRef}
            defaultValue={content}
            lang={banglaMode ? "bn" : "en"}
            dir="ltr"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={visible && candidates.length > 0}
            aria-controls="candidate-options"
            aria-activedescendant={
              visible && candidates.length > 0 ? `candidate-${selectedIndex}` : undefined
            }
            aria-describedby="editor-hint"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            placeholder={banglaMode ? "এখানে লিখুন…" : "Start writing…"}
            className="editor-input min-h-[45vh] w-full flex-1 resize-none break-words bg-transparent font-editor text-[1.4rem] leading-[1.9] text-pretty text-foreground caret-primary outline-none placeholder:text-muted-foreground sm:text-editor"
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
              refreshCandidates();
            }}
            onInput={(event) => {
              const value = event.currentTarget.value;
              onChange(value);
              resize();
              refreshCandidates();
            }}
            onFocus={onActivate}
            onKeyDown={handleKeyDown}
            onClick={refreshCandidates}
            onBlur={() => window.setTimeout(hide, 120)}
          />
          {showIntro ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">Try:</span>
              {[
                ["ami", "আমি"],
                ["bhalo", "ভালো"],
              ].map(([roman, bangla]) => (
                <button
                  key={roman}
                  type="button"
                  onClick={() => insertExample(roman, bangla)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
                >
                  <span className="font-bangla font-medium">{bangla}</span>
                  <span className="text-xs text-muted-foreground">← {roman}</span>
                </button>
              ))}
            </div>
          ) : null}
          <p className="sr-only" role="status" aria-live="polite">
            {announcement}
          </p>
        </div>
      </div>

      <CandidateList
        candidates={candidates}
        selectedIndex={selectedIndex}
        visible={visible}
        mobile={mobileCandidates}
        rawQuery={query}
        position={position}
        onPick={pick}
        onHover={setSelectedIndex}
      />
    </section>
  );
}
