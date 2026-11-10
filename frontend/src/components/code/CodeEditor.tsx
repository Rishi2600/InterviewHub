import { useEffect, useRef } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderText,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import type { CodeLanguage } from '@/lib/sandbox/types'
import { cn } from '@/lib/utils'

const LANGUAGE: Record<CodeLanguage, () => Extension> = {
  python: () => python(),
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
}

// Colours come from the app's tokens, so the editor follows light and dark.
const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--foreground)', fontSize: '13px' },
  // No ligatures: code should show exactly the characters typed.
  '.cm-scroller': { fontFamily: 'var(--font-mono, ui-monospace, monospace)', lineHeight: '1.6', fontVariantLigatures: 'none' },
  '.cm-content': { caretColor: 'var(--primary)', padding: '8px 0' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--muted-foreground)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklab, var(--primary) 7%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--foreground)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--primary)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in oklab, var(--primary) 25%, transparent) !important',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in oklab, var(--primary) 20%, transparent)' },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
})

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword], color: 'var(--brand-text)', fontWeight: '500' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--code-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--muted-foreground)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--foreground)', fontWeight: '500' },
  { tag: [tags.typeName, tags.className], color: 'var(--code-number)' },
  { tag: tags.invalid, color: 'var(--destructive)' },
])

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: CodeLanguage
  /** Ctrl/Cmd+Enter. */
  onRun?: () => void
  readOnly?: boolean
  placeholder?: string
  className?: string
  ariaLabel?: string
}

/**
 * A CodeMirror 6 editor. Only the person typing sees it: rooms share code
 * by screen share, not by syncing the editor.
 */
export default function CodeEditor({
  value,
  onChange,
  language,
  onRun,
  readOnly = false,
  placeholder,
  className,
  ariaLabel = 'Code editor',
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const languageSlot = useRef(new Compartment())
  const readOnlySlot = useRef(new Compartment())
  // The latest callbacks, without rebuilding the editor when they change.
  const handlers = useRef({ onChange, onRun })
  useEffect(() => {
    handlers.current = { onChange, onRun }
  })

  useEffect(() => {
    if (!host.current) return
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          history(),
          indentOnInput(),
          bracketMatching(),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                handlers.current.onRun?.()
                return true
              },
            },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          languageSlot.current.of(LANGUAGE[language]()),
          readOnlySlot.current.of(EditorState.readOnly.of(readOnly)),
          placeholder ? placeholderText(placeholder) : [],
          theme,
          syntaxHighlighting(highlight),
          EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) handlers.current.onChange(update.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
    // Built once; the effects below keep it in step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    view.current?.dispatch({ effects: languageSlot.current.reconfigure(LANGUAGE[language]()) })
  }, [language])

  useEffect(() => {
    view.current?.dispatch({ effects: readOnlySlot.current.reconfigure(EditorState.readOnly.of(readOnly)) })
  }, [readOnly])

  // Replace the text when it changes from outside (reset, another language).
  useEffect(() => {
    const editor = view.current
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
    }
  }, [value])

  return <div ref={host} className={cn('min-h-0 overflow-hidden', className)} />
}
