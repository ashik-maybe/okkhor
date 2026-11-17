import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Check, Ellipsis, Github, Menu, Moon, Search, Sun } from "lucide-react";
import { cn } from "cn";
import { Button, buttonVariants } from "@/components/ui/button";
import { ModeSwitch } from "@/components/mode-switch";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { HelpDialog, type HelpTab } from "@/features/help/HelpDialog";
import { Library } from "@/features/library/Library";
import type { CommandAction } from "@/features/command/CommandPalette";
import { loadEngine } from "@/lib/avro-service";
import type { AvroInstance } from "@/engine";
import { db, type Doc } from "@/lib/db";
import {
  clearPersonalWords,
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
import { GITHUB_URL } from "@/lib/links";

const BRAND_ICON = `${import.meta.env.BASE_URL}images/logo.svg`;
const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
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
  const [engineError, setEngineError] = useState(false);
  const [personalWords, setPersonalWords] = useState(() => loadPersonalWords());
  const [commandOpen, setCommandOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<HelpTab>("shortcuts");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const saveTimer = useRef<number | null>(null);
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
    void enginePromise.current
      .then((loaded) => {
        setEngine(loaded);
        setEngineError(false);
      })
      .catch(() => {
        setEngineError(true);
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
    const id = activeDoc.id;
    setSaveState("saving");
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void updateDoc(id, { content: value, title: makeTitle(value, id - 1) })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 120);
  };

  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  const remember = (word: string) => setPersonalWords(rememberWord(word));

  const forgetPersonalWords = () => {
    setPersonalWords(clearPersonalWords());
    toast.success("Personal words cleared");
  };

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

  const openHelp = (tab: HelpTab) => {
    setHelpTab(tab);
    setHelpOpen(true);
  };

  const commands: CommandAction[] = [
    {
      id: "lang",
      group: "Writing",
      label: "Toggle Bangla / English",
      hint: "Ctrl+.",
      run: toggleLanguage,
    },
    {
      id: "new",
      group: "Drafts",
      label: "New draft",
      hint: "Ctrl+N",
      run: () => void newDocument(),
    },
    {
      id: "import",
      group: "Drafts",
      label: "Import a file",
      run: () => fileInputRef.current?.click(),
    },
    { id: "txt", group: "Export & share", label: "Export as .txt", run: () => exportAs("txt") },
    { id: "md", group: "Export & share", label: "Export as .md", run: () => exportAs("md") },
    { id: "html", group: "Export & share", label: "Export as .html", run: () => exportAs("html") },
    {
      id: "backup",
      group: "Export & share",
      label: "Download full backup",
      run: () => void exportBackup(),
    },
    { id: "theme-light", group: "Appearance", label: "Theme: light", run: () => setTheme("light") },
    { id: "theme-dark", group: "Appearance", label: "Theme: dark", run: () => setTheme("dark") },
    {
      id: "theme-system",
      group: "Appearance",
      label: "Theme: system",
      run: () => setTheme("system"),
    },
    {
      id: "shortcuts",
      group: "Help",
      label: "Keyboard shortcuts",
      hint: "?",
      run: () => openHelp("shortcuts"),
    },
    {
      id: "keymap",
      group: "Help",
      label: "Avro keymap",
      run: () => openHelp("keymap"),
    },
    {
      id: "github",
      group: "Help",
      label: "View source on GitHub",
      hint: "↗",
      run: () => window.open(GITHUB_URL, "_blank", "noopener,noreferrer"),
    },
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
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName));
      if (event.key === "?" && !typing) {
        event.preventDefault();
        openHelp("shortcuts");
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
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3 py-1.5 sm:gap-2 sm:px-4">
        <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-[44px] lg:hidden sm:size-9"
              aria-label="Open drafts"
            >
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
          className="h-11 min-w-0 max-w-xs flex-1 border-transparent bg-transparent font-medium shadow-none focus-visible:border-input sm:h-9"
        />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ModeSwitch
            banglaMode={banglaMode}
            onToggle={toggleLanguage}
            className="hidden sm:flex"
          />

          <Button
            variant="ghost"
            size="icon"
            className="size-[44px] sm:size-9"
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
                className="size-[44px] sm:size-9"
                aria-label="Document actions"
                title="Document"
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="truncate font-bangla text-base">
                {activeDoc?.title ?? "Untitled draft"}
              </DropdownMenuLabel>
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                {wordCount(activeDoc?.content ?? "")} words · {personalWords.size} personal words
              </DropdownMenuLabel>
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                Updated {new Date(activeDoc?.updatedAt ?? Date.now()).toLocaleString("en-GB")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void newDocument()}>New draft</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAs("txt")}>Export .txt</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAs("md")}>Export .md</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAs("html")}>Export .html</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportBackup()}>
                Download backup
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                Import file
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={forgetPersonalWords}>
                Clear personal words
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-[44px] sm:size-9"
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

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
            title="Source on GitHub"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "hidden size-9 sm:inline-flex",
            )}
          >
            <Github />
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-border bg-card lg:block">
          {library}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Editor
            docId={activeDoc?.id ?? 0}
            content={activeDoc?.content ?? ""}
            banglaMode={banglaMode}
            engine={engine}
            personalWords={personalWords}
            mobileCandidates={mobileCandidates}
            saveState={saveState}
            engineError={engineError}
            onToggleMode={toggleLanguage}
            onOpenKeymap={() => openHelp("keymap")}
            onActivate={activateEngine}
            onChange={changeContent}
            onRememberWord={remember}
          />
        </main>
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
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          actions={commands}
          docs={docs}
          onSelectDraft={(id) => {
            setActiveId(id);
            setLibraryOpen(false);
          }}
        />
      </Suspense>

      <HelpDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        tab={helpTab}
        onTabChange={setHelpTab}
      />

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
