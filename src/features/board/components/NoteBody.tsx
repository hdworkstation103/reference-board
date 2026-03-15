import { memo, useMemo } from 'react'
import { renderMarkdownToHtml } from '../utils'

type NoteBodyProps = {
  noteMarkdown: string
  noteMode: 'editing' | 'viewing'
  onPointerDown: React.PointerEventHandler<HTMLElement>
  onFocusChange: (focused: boolean) => void
  onChange: (value: string) => void
}

function NoteBody({ noteMarkdown, noteMode, onPointerDown, onFocusChange, onChange }: NoteBodyProps) {
  const renderedMarkdown = useMemo(
    () => renderMarkdownToHtml(noteMarkdown),
    [noteMarkdown],
  )

  return (
    <div className="note-body node-body">
      {noteMode === 'editing' ? (
        <textarea
          className="note-editor"
          value={noteMarkdown}
          onPointerDown={onPointerDown}
          onFocus={() => {
            onFocusChange(true)
          }}
          onBlur={() => {
            onFocusChange(false)
          }}
          onChange={(event) => {
            onChange(event.currentTarget.value)
          }}
        />
      ) : (
        <div className="note-markdown" dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />
      )}
    </div>
  )
}

export default memo(NoteBody)
