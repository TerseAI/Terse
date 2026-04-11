import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { NodeApi, type NodeRendererProps, Tree } from "react-arborist"

import Editor, { type Monaco } from "@monaco-editor/react"
import { AlertCircle, ChevronRight, File, Folder, FolderOpen, Loader2, PanelLeft } from "lucide-react"

import { useResolvedAppearance } from "@/hooks/useWorkOsTheme"
import { cn } from "@/lib/utils"

const TERSE_MONACO_LIGHT = "terse-light"
const TERSE_MONACO_DARK = "terse-dark"

/**
 * Monaco theme colors must be `#RRGGBB` or `#RRGGBBAA` (see VS Code color parser).
 * We still resolve arbitrary CSS (e.g. `oklch(...)`) via canvas, then emit hex.
 */
let colorParseCanvas: HTMLCanvasElement | null = null

function cssColorToMonacoColor(cssColor: string): string {
    const trimmed = cssColor.trim()
    if (!trimmed) return "#808080"

    if (!colorParseCanvas) {
        colorParseCanvas = document.createElement("canvas")
        colorParseCanvas.width = 1
        colorParseCanvas.height = 1
    }
    const ctx = colorParseCanvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return "#808080"

    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = trimmed
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    const hr = r.toString(16).padStart(2, "0")
    const hg = g.toString(16).padStart(2, "0")
    const hb = b.toString(16).padStart(2, "0")
    if (a === 255) return `#${hr}${hg}${hb}`
    const ha = a.toString(16).padStart(2, "0")
    return `#${hr}${hg}${hb}${ha}`
}

function readResolvedToken(tailwindClasses: string, property: "backgroundColor" | "color" | "borderTopColor"): string {
    const el = document.createElement("div")
    el.className = tailwindClasses
    el.style.position = "fixed"
    el.style.left = "-9999px"
    el.style.pointerEvents = "none"
    document.body.appendChild(el)
    const value = getComputedStyle(el)[property]
    document.body.removeChild(el)
    return value
}

// Cache resolved colors per appearance to avoid 8 DOM reads on every theme toggle
const monacoColorCache = new Map<string, Record<string, string>>()

function resolveMonacoColors(): Record<string, string> {
    const editorBg = cssColorToMonacoColor(readResolvedToken("bg-background", "backgroundColor"))
    const editorFg = cssColorToMonacoColor(readResolvedToken("text-foreground", "color"))
    const mutedFg = cssColorToMonacoColor(readResolvedToken("text-muted-foreground", "color"))
    const borderCol = cssColorToMonacoColor(readResolvedToken("border border-border", "borderTopColor"))
    const selectionBg = cssColorToMonacoColor(readResolvedToken("bg-accent/35", "backgroundColor"))
    const inactiveSelBg = cssColorToMonacoColor(readResolvedToken("bg-muted/45", "backgroundColor"))
    const widgetBg = cssColorToMonacoColor(readResolvedToken("bg-popover", "backgroundColor"))
    const widgetFg = cssColorToMonacoColor(readResolvedToken("text-popover-foreground", "color"))

    return {
        "editor.background": editorBg,
        "editor.foreground": editorFg,
        "editorLineNumber.foreground": mutedFg,
        "editorLineNumber.activeForeground": editorFg,
        "editorCursor.foreground": editorFg,
        "editor.selectionBackground": selectionBg,
        "editor.inactiveSelectionBackground": inactiveSelBg,
        "editorWidget.background": widgetBg,
        "editorWidget.foreground": widgetFg,
        "editorWidget.border": borderCol,
        "minimap.background": editorBg
    }
}

function defineTerseMonacoThemes(monaco: Monaco, appearance: string) {
    if (!monacoColorCache.has(appearance)) {
        monacoColorCache.set(appearance, resolveMonacoColors())
    }
    const colors = monacoColorCache.get(appearance)!

    monaco.editor.defineTheme(TERSE_MONACO_LIGHT, {
        base: "vs",
        inherit: true,
        rules: [],
        colors
    })
    monaco.editor.defineTheme(TERSE_MONACO_DARK, {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors
    })
}

/** Snippets have no node_modules / tsconfig — TS worker import checks flash false errors. */
function configureMonacoFileViewer(monaco: Monaco) {
    const opts = { noSemanticValidation: true, noSuggestionDiagnostics: true }
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(opts)
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(opts)
}

const languageByExtension: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    json: "json",
    html: "html",
    css: "css",
    md: "markdown"
}

export type FileExplorerProps = {
    files: FileNode[]
    selectedFile: FileNode | null
    onSelectFile: (file: FileNode) => void
    editorValue: string
    editorStatus: "idle" | "loading" | "ready" | "error"
    editorErrorMessage?: string
    /** Full path in archive (used as Monaco model path) */
    editorPath?: string | null
}

export type FileNode = {
    id: string
    name: string
    content?: string
    children?: FileNode[]
}

function FileTreeNode({ style, node, dragHandle }: NodeRendererProps<FileNode>) {
    const isFolder = !node.isLeaf
    const isOpen = node.isOpen
    const selected = node.isSelected

    return (
        <div
            ref={dragHandle}
            style={style}
            role="treeitem"
            aria-selected={selected}
            aria-expanded={isFolder ? isOpen : undefined}
            className={cn(
                "box-border flex h-full min-h-0 w-full min-w-0 max-w-full cursor-pointer items-center gap-1.5 px-2.5 text-sm transition-colors duration-100",
                selected ? "bg-primary/12 font-medium text-foreground" : "text-muted-foreground hover:bg-muted/55 hover:text-foreground"
            )}
        >
            {node.isLeaf ? (
                <File className={cn("h-3.5 w-3.5 shrink-0", selected ? "text-primary" : "opacity-80")} strokeWidth={1.5} aria-hidden />
            ) : isOpen ? (
                <FolderOpen className={cn("h-3.5 w-3.5 shrink-0", selected ? "text-primary" : "opacity-80")} strokeWidth={1.5} aria-hidden />
            ) : (
                <Folder className={cn("h-3.5 w-3.5 shrink-0", selected ? "text-primary" : "opacity-80")} strokeWidth={1.5} aria-hidden />
            )}
            <span className={cn("min-w-0 flex-1 truncate", selected && "text-foreground")}>{node.data.name}</span>
            {isFolder ? (
                <button
                    type="button"
                    className="text-muted-foreground/70 hover:text-foreground -mr-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm transition-colors"
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Collapse folder" : "Expand folder"}
                    onClick={e => {
                        e.stopPropagation()
                        node.toggle()
                    }}
                >
                    <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-150 ease-out", isOpen && "rotate-90")} strokeWidth={1.5} aria-hidden />
                </button>
            ) : null}
        </div>
    )
}

export function FileExplorer({ files, selectedFile, onSelectFile, editorValue, editorStatus, editorErrorMessage, editorPath }: FileExplorerProps) {
    const appearance = useResolvedAppearance()
    const monacoRef = useRef<Monaco | null>(null)
    const treeBoxRef = useRef<HTMLDivElement>(null)
    const [treeSize, setTreeSize] = useState({ width: 224, height: 320 })
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const liveRegionRef = useRef<HTMLDivElement>(null)

    const handleMonacoBeforeMount = (monaco: Monaco) => {
        monacoRef.current = monaco
        defineTerseMonacoThemes(monaco, appearance)
        configureMonacoFileViewer(monaco)
    }

    useEffect(() => {
        const monaco = monacoRef.current
        if (!monaco) return
        // Invalidate cache for the incoming appearance — CSS variables just changed
        monacoColorCache.delete(appearance)
        defineTerseMonacoThemes(monaco, appearance)
        monaco.editor.setTheme(appearance === "dark" ? TERSE_MONACO_DARK : TERSE_MONACO_LIGHT)
    }, [appearance])

    // Announce file loading transitions to screen readers
    useEffect(() => {
        const el = liveRegionRef.current
        if (!el) return
        if (editorStatus === "loading") {
            el.textContent = `Loading ${selectedFile?.name ?? "file"}…`
        } else if (editorStatus === "ready") {
            el.textContent = `${selectedFile?.name ?? "File"} ready`
        } else if (editorStatus === "error") {
            el.textContent = `Failed to load ${selectedFile?.name ?? "file"}`
        }
    }, [editorStatus, selectedFile?.name])

    const monacoTheme = appearance === "dark" ? TERSE_MONACO_DARK : TERSE_MONACO_LIGHT

    const pathForLanguage = editorPath ?? selectedFile?.name ?? ""
    const selectedFileExtension = pathForLanguage.split(".").pop()?.toLowerCase() ?? ""
    const selectedFileLanguage = languageByExtension[selectedFileExtension] ?? "plaintext"

    useLayoutEffect(() => {
        const el = treeBoxRef.current
        if (!el) return

        const update = () => {
            const { width, height } = el.getBoundingClientRect()
            const w = Math.max(0, Math.floor(width))
            const h = Math.max(0, Math.floor(height))
            if (w > 0 && h > 0) setTreeSize({ width: w, height: h })
        }

        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const handleSelectFile = (nodes: NodeApi<FileNode>[]) => {
        const node = nodes[0]
        if (!node || !node.isLeaf) return

        onSelectFile(node.data)
    }

    const displayPath = editorPath ?? selectedFile?.name ?? null
    const monacoPath = editorPath ?? selectedFile?.name ?? "untitled"
    const showEditorChrome = editorStatus === "ready" || editorStatus === "loading"
    const showOverlay = editorStatus === "loading"
    const editorReadOnly = editorStatus !== "ready"

    return (
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {/* Visually hidden live region for screen reader announcements */}
            <div ref={liveRegionRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />

            <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
                <aside className={cn("border-border flex min-h-0 shrink-0 flex-col border-r transition-all duration-200", sidebarOpen ? "w-56" : "w-0 overflow-hidden border-r-0")}>
                    <div ref={treeBoxRef} className="min-h-0 min-w-0 flex-1 overflow-hidden px-3.5 pt-3 pb-2">
                        <Tree
                            data={files}
                            rowHeight={36}
                            indent={16}
                            width={treeSize.width}
                            height={treeSize.height}
                            selection={selectedFile?.id}
                            onSelect={handleSelectFile}
                            disableEdit
                            disableDrag
                            disableDrop
                        >
                            {FileTreeNode}
                        </Tree>
                    </div>
                </aside>

                <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                    {/* Header: sidebar toggle + current file breadcrumb */}
                    <div className="border-border bg-muted/20 flex h-8 shrink-0 items-center gap-1.5 border-b px-2">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(v => !v)}
                            className="text-muted-foreground hover:text-foreground hover:bg-accent/40 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm transition-colors"
                            aria-label={sidebarOpen ? "Hide file tree" : "Show file tree"}
                            aria-pressed={sidebarOpen}
                        >
                            <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                        </button>
                        {displayPath ? (
                            <>
                                <div className="bg-border h-3.5 w-px shrink-0" aria-hidden />
                                <File className="text-muted-foreground/70 h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden />
                                <span className="text-muted-foreground min-w-0 truncate text-xs">{displayPath}</span>
                            </>
                        ) : null}
                    </div>

                    {editorStatus === "idle" && (
                        <div className="text-muted-foreground flex h-full min-h-0 items-center justify-center px-4 text-center text-sm">Select a file in the tree to view its contents.</div>
                    )}
                    {showEditorChrome && (
                        <div className="min-h-0 flex-1">
                            <Editor
                                width="100%"
                                height="100%"
                                path={monacoPath}
                                language={selectedFileLanguage}
                                value={editorValue}
                                theme={monacoTheme}
                                beforeMount={handleMonacoBeforeMount}
                                options={{
                                    readOnly: editorReadOnly,
                                    minimap: { enabled: false },
                                    scrollBeyondLastLine: false,
                                    fontSize: 13,
                                    padding: { top: 8 }
                                }}
                            />
                        </div>
                    )}
                    {editorStatus === "error" && (
                        <div className="text-destructive flex h-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center text-sm" role="alert">
                            <AlertCircle className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
                            <div className="flex flex-col gap-1">
                                <span className="font-medium">Could not show this file</span>
                                {editorErrorMessage ? <span className="text-muted-foreground max-w-md">{editorErrorMessage}</span> : null}
                            </div>
                        </div>
                    )}
                    {showOverlay && (
                        <div className="bg-background/70 pointer-events-none absolute inset-0 flex items-center justify-center">
                            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" aria-hidden />
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
