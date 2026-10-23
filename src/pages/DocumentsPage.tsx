import { Info } from 'lucide-react'
import { FORMATTING_NOTE, loadDocument } from '../features/document-diff/DocumentDiffEngine'
import { TextWorkspace } from '../features/text-diff/TextWorkspace'

const SAMPLE = {
  left: `# Service Agreement

1. The supplier delivers the goods within 30 days.
2. Payment is due within 14 days of the invoice date.
3. Either party may terminate with 60 days written notice.
`,
  right: `# Service Agreement

1. The supplier delivers the goods within 45 days.
2. Payment is due within 14 days of the invoice date.
3. Either party may terminate with 30 days written notice.
4. This agreement is governed by local law.
`,
}

export default function DocumentsPage() {
  return (
    <TextWorkspace
      mode="document"
      title="Document Compare"
      subtitle="Compare TXT, Markdown, PDF and DOCX files. Drop a file on either side, or two files at once."
      loadFile={loadDocument}
      accept=".txt,.md,.markdown,.pdf,.docx,text/plain,application/pdf"
      sample={SAMPLE}
      fileStem="diffspace-document"
      banner={
        <div className="flex items-start gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-muted">
          <Info size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>{FORMATTING_NOTE}</span>
        </div>
      }
    />
  )
}
