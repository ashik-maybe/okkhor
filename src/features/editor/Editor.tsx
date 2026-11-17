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

interface EditorProps {
  docId: number;
  content: string;
  banglaMode: boolean;
  engine: AvroInstance | null;
  personalWords: Map<string, number>;
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

function caretPosition(textarea: HTMLTextAreaElement, cursor: number) {
  const computed = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  for (const property of MIRROR_PROPERTIES) {
    mirror.style.setProperty(property, computed.getPropertyValue(property));
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";
  mirror.textContent = textarea.value.slice(0, cursor);

  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(cursor) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const result = {
    top: marker.offsetTop - textarea.scrollTop + textarea.offsetTop,
    left: marker.offsetLeft - textarea.scrollLeft + textarea.offsetLeft,
  };
  mirror.remove();
  return result;
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
  onChange,
  onRememberWord,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const [candidates, setCandidates] = useState<AvroCandidate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

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
      if (tokenMatch && engine) commitCandidate(engine, tokenMatch[1], candidate.name);
      hide();
      resize();
      textarea.focus();
    },
    [candidates, engine, hide, onChange, onRememberWord, resize],
  );

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
      <div className="mx-auto flex w-full max-w-[76ch] flex-1 flex-col px-4 pb-28 pt-6 sm:px-8 sm:pb-10 sm:pt-10">
        <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-border pb-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground">
              {banglaMode ? "Bangla phonetic" : "English input"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Type roman letters, then press <kbd>Space</kbd> to choose a word.
            </p>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
            {countWords(content)} words
          </p>
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
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          placeholder={banglaMode ? "এখানে লিখুন…" : "Start writing…"}
          className="min-h-[50vh] w-full flex-1 resize-none bg-transparent font-editor text-xl leading-[1.9] text-foreground outline-none placeholder:text-muted-foreground/60 sm:text-2xl"
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
          onKeyDown={handleKeyDown}
          onClick={refreshCandidates}
          onKeyUp={(event) => {
            if (event.key === "Ctrl" || event.key === "Meta" || event.key.startsWith("Arrow"))
              return;
            refreshCandidates();
          }}
          onBlur={() => window.setTimeout(hide, 120)}
        />
      </div>

      <CandidateList
        candidates={candidates}
        selectedIndex={selectedIndex}
        visible={visible}
        position={position}
        onPick={pick}
        onHover={setSelectedIndex}
      />
    </section>
  );
}
