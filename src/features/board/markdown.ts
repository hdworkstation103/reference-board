const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const renderInlineMarkdown = (value: string) => {
  let html = escapeHtml(value)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  return html
}

export const renderMarkdownToHtml = (markdown: string) => {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n')
  const output: string[] = []
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') {
      if (inList) {
        output.push('</ul>')
        inList = false
      }
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      if (inList) {
        output.push('</ul>')
        inList = false
      }
      const level = heading[1].length
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    const listItem = trimmed.match(/^-\s+(.*)$/)
    if (listItem) {
      if (!inList) {
        output.push('<ul>')
        inList = true
      }
      output.push(`<li>${renderInlineMarkdown(listItem[1])}</li>`)
      continue
    }

    if (inList) {
      output.push('</ul>')
      inList = false
    }

    output.push(`<p>${renderInlineMarkdown(trimmed)}</p>`)
  }

  if (inList) {
    output.push('</ul>')
  }

  return output.join('')
}
