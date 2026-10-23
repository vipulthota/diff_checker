import { TextWorkspace } from '../features/text-diff/TextWorkspace'

const SAMPLE = {
  left: `function total(items) {
  let sum = 0;
  for (let i = 0; i < items.length; i++) {
    sum += items[i].price;
  }
  return sum;
}

console.log(total([{ price: 4 }, { price: 6 }]));
`,
  right: `function total(items, taxRate = 0) {
  const sum = items.reduce((acc, item) => acc + item.price, 0);
  return sum * (1 + taxRate);
}

// Print the grand total
console.log(total([{ price: 4 }, { price: 6 }], 0.1));
`,
}

export default function CodePage() {
  return (
    <TextWorkspace
      mode="code"
      title="Code Compare"
      subtitle="Syntax-highlighted diffs for 20 languages. Code is only ever displayed as text, never executed."
      sample={SAMPLE}
      fileStem="diffspace-code"
    />
  )
}
