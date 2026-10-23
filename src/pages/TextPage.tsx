import { TextWorkspace } from '../features/text-diff/TextWorkspace'

const SAMPLE = {
  left: `DiffSpace makes it easy to compare two versions of anything.

Paste your original text on the left.
Paste the modified text on the right.
Differences are highlighted as you type.

Shopping list:
- apples
- bread
- milk
- coffee
`,
  right: `DiffSpace makes it simple to compare two versions of anything.

Paste your original text on the left.
Paste the modified text on the right.
Differences are highlighted automatically.

Shopping list:
- apples
- sourdough bread
- coffee
- oat milk
`,
}

export default function TextPage() {
  return (
    <TextWorkspace
      mode="text"
      title="Text Compare"
      subtitle="Paste, type or drop two texts to see exactly what changed."
      sample={SAMPLE}
      fileStem="diffspace-text"
    />
  )
}
