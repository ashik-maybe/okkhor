import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Check, Download, Languages, Menu, Moon, Search, Sun, Upload } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTheme } from "@/components/theme-provider";
import { Editor } from "@/features/editor/Editor";
import { Library } from "@/features/library/Library";
import type { CommandAction } from "@/features/command/CommandPalette";
import { loadEngine } from "@/lib/avro-service";
import type { AvroInstance } from "@/engine";
import { db, type Doc } from "@/lib/db";
import {
  createDoc,
  deleteDoc,
  listDocs,
  loadPersonalWords,
  makeTitle,
  migrateLegacyDrafts,
  rememberWord,
  updateDoc,
} from "@/lib/documents";
import { loadBanglaMode, saveBanglaMode } from "@/lib/preferences";
import { downloadText, safeFilename, toHtml } from "@/lib/export";

const BRAND_ICON = `${import.meta.env.BASE_URL}images/logo.svg`;
const CommandPalette = lazy(async () => {
  const module = await import("@/features/command/CommandPalette");
  return { default: module.CommandPalette };
});

export function App() {
  const docs = useLiveQuery(() => listDocs(), [], [] as Doc[]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [banglaMode, setBanglaMode] = useState(loadBanglaMode);
  const [engine, setEngine] = useState<AvroInstance | null>(null);
  const [personalWords, setPersonalWords] = useState(() => loadPersonalWords());
  const [commandOpen, setCommandOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const enginePromise = useRef<Promise<AvroInstance> | null>(null);
  const engineFailed = useRef(false);
  const [mobileCandidates, setMobileCandidates] = useState(
    () => window.matchMedia("(max-width: 639px)").matches,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, resolvedTheme, setTheme } = useTheme();

  const activeDoc = useMemo(
    () => docs.find((doc) => doc.id === activeId) ?? docs[0],
    [docs, activeId],
  );

  useEffect(() => {
    let ignored = false;
    async function start() {
      await migrateLegacyDrafts();
      const existing = await listDocs();
      if (existing.length === 0) await createDoc();
      if (!ignored) setReady(true);
    }
    void start();
    return () => {
      ignored = true;
    };
  }, []);

  const activateEngine = useCallback(() => {
    enginePromise.current ??= loadEngine();
    void enginePromise.current.then(setEngine).catch(() => {
      if (engineFailed.current) return;
      engineFailed.current = true;
      toast.error("The phonetic engine could not load. Plain typing still works.");
    });
  }, []);

  useEffect(() => {
    // The 3.9 MB dictionary is a classic script, so parsing it on first paint
    // dominates main-thread time. Warm it after paint, or sooner on focus.
    const timer = window.setTimeout(activateEngine, 1200);
    return () => window.clearTimeout(timer);
  }, [activateEngine]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setMobileCandidates(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (activeId === null || !docs.some((doc) => doc.id === activeId)) {
      setActiveId(docs[0]?.id ?? null);
    }
  }, [docs, activeId, ready]);

  const toggleLanguage = () => {
    setBanglaMode((current) => {
      saveBanglaMode(!current);
      return !current;
    });
  };

  const newDocument = async () => {
    const id = await createDoc();
    setActiveId(id);
    setLibraryOpen(false);
    toast.success("New draft created");
  };

  const confirmDelete = async () => {
    if (deleteId === null) return;
    const title = docs.find((doc) => doc.id === deleteId)?.title ?? "Untitled draft";
    await deleteDoc(deleteId);
    if (activeId === deleteId) setActiveId(null);
    setDeleteId(null);
    toast.success(`Deleted “${title}”`);
  };

  const changeContent = (value: string) => {
    if (!activeDoc?.id) return;
    void updateDoc(activeDoc.id, { content: value, title: makeTitle(value, activeDoc.id - 1) });
  };

  const remember = (word: string) => setPersonalWords(rememberWord(word));

  const exportAs = (format: "txt" | "md" | "html") => {
    if (!activeDoc) return;
    const name = safeFilename(activeDoc.title);
    if (format === "html") {
      downloadText(`${name}.html`, toHtml(activeDoc.title, activeDoc.content), "text/html");
    } else if (format === "md") {
      downloadText(`${name}.md`, `# ${activeDoc.title}\n\n${activeDoc.content}`, "text/markdown");
    } else {
      downloadText(`${name}.txt`, activeDoc.content, "text/plain;charset=utf-8");
    }
    toast.success(`Exported ${format.toUpperCase()}`);
  };

  const exportBackup = async () => {
    const all = await db.docs.toArray();
    downloadText(
      "okkhor-backup.json",
      JSON.stringify({ version: 1, docs: all }, null, 2),
      "application/json",
    );
    toast.success("Backup downloaded");
  };

  const importFile = async (file: File) => {
    const value = await file.text();
    if (file.name.endsWith(".json")) {
      try {
        const parsed: unknown = JSON.parse(value);
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { docs?: unknown }).docs)
        ) {
          const incoming = (parsed as { docs: Doc[] }).docs;
          for (const doc of incoming) {
            await db.docs.add({
              title: doc.title || "Imported draft",
              content: doc.content || "",
              createdAt: doc.createdAt || Date.now(),
              updatedAt: doc.updatedAt || Date.now(),
            });
          }
          toast.success(`Imported ${incoming.length} drafts`);
          return;
        }
      } catch {
        toast.error("That backup could not be read.");
        return;
      }
    }
    const id = await createDoc(value);
    setActiveId(id);
    toast.success("Draft imported");
  };

  const commands: CommandAction[] = [
    { id: "new", label: "New draft", hint: "Ctrl+N", run: () => void newDocument() },
    { id: "lang", label: "Toggle Bangla / English", hint: "Ctrl+.", run: toggleLanguage },
    { id: "txt", label: "Export as .txt", run: () => exportAs("txt") },
    { id: "md", label: "Export as .md", run: () => exportAs("md") },
    { id: "html", label: "Export as .html", run: () => exportAs("html") },
    { id: "backup", label: "Download full backup", run: () => void exportBackup() },
    { id: "import", label: "Import a file", run: () => fileInputRef.current?.click() },
    { id: "theme-light", label: "Theme: light", run: () => setTheme("light") },
    { id: "theme-dark", label: "Theme: dark", run: () => setTheme("dark") },
    { id: "theme-system", label: "Theme: system", run: () => setTheme("system") },
  ];

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === ".") {
        event.preventDefault();
        toggleLanguage();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const library = (
    <Library
      docs={docs}
      activeId={activeDoc?.id ?? null}
      search={search}
      onSearchChange={setSearch}
      onSelect={(id) => {
        setActiveId(id);
        setLibraryOpen(false);
      }}
      onNew={() => void newDocument()}
      onDelete={setDeleteId}
    />
  );

  return (
    <div className="flex h-dvh min-h-[480px] flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
        <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open drafts">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            {library}
          </SheetContent>
        </Sheet>

        <div className="hidden items-center gap-2.5 md:flex">
          <img src={BRAND_ICON} alt="" className="size-7 shrink-0" />
          <span className="font-bangla text-xl">অক্ষর</span>
        </div>

        <Input
          aria-label="Draft title"
          value={activeDoc?.title ?? ""}
          onChange={(event) => {
            if (activeDoc?.id) void updateDoc(activeDoc.id, { title: event.target.value });
          }}
          placeholder="Untitled draft"
          className="h-9 min-w-0 max-w-xs flex-1 border-transparent bg-transparent font-medium shadow-none focus-visible:border-input"
        />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={banglaMode}
            aria-label="Toggle Bangla and English input"
            title={banglaMode ? "Bangla phonetic input" : "English input"}
            onClick={toggleLanguage}
            className="relative h-9 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted/60"
          >
            <span
              className={cn(
                "absolute inset-0 flex items-center text-xs font-bold text-muted-foreground",
                banglaMode ? "justify-end pr-3" : "justify-start pl-3",
              )}
            >
              {banglaMode ? "EN" : "বাং"}
            </span>
            <span
              className={cn(
                "absolute left-0.5 top-0.5 flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-sm transition-transform duration-normal ease-out",
                banglaMode ? "translate-x-0" : "translate-x-11",
              )}
            >
              {banglaMode ? "বাং" : "EN"}
            </span>
          </button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Open command palette"
            title="Command palette (Ctrl+K)"
            onClick={() => setCommandOpen(true)}
          >
            <Search />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Change theme"
                title={`Theme: ${theme}`}
              >
                {resolvedTheme === "dark" ? <Moon /> : <Sun />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["light", "dark", "system"] as const).map((option) => (
                <DropdownMenuItem key={option} onClick={() => setTheme(option)}>
                  <Check className={cn("size-4", theme === option ? "opacity-100" : "opacity-0")} />
                  {option[0].toUpperCase() + option.slice(1)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-border bg-card md:block">
          {library}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <Editor
            docId={activeDoc?.id ?? 0}
            content={activeDoc?.content ?? ""}
            banglaMode={banglaMode}
            engine={engine}
            personalWords={personalWords}
            mobileCandidates={mobileCandidates}
            onActivate={activateEngine}
            onChange={changeContent}
            onRememberWord={remember}
          />
        </main>

        <aside className="hidden w-64 shrink-0 border-l border-border bg-card p-4 lg:block">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">Tools</p>
          <div className="mt-3 space-y-1">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => exportAs("txt")}
            >
              <Download /> Export text
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => exportAs("html")}
            >
              <Download /> Export HTML
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => void exportBackup()}
            >
              <Download /> Backup JSON
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload /> Import file
            </Button>
          </div>
          <div className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <Languages className="size-4" /> {banglaMode ? "Bangla phonetic" : "English input"}
            </p>
            <p className="mt-2">{personalWords.size} personal words</p>
          </div>
        </aside>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.json,text/plain,text/markdown,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.target.value = "";
        }}
      />

      <Suspense fallback={null}>
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} actions={commands} />
      </Suspense>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{docs.find((doc) => doc.id === deleteId)?.title ?? "Untitled draft"}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The draft will be removed from this device. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Delete draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
