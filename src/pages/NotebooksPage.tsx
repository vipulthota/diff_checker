import { TextWorkspace } from '../features/text-diff/TextWorkspace'
import { loadNotebook } from '../features/notebook-diff/notebook'

const SAMPLE = {
  left: `# Databricks notebook source
df = spark.read.table("sales.orders")

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT region, SUM(amount) FROM sales.orders GROUP BY region

# COMMAND ----------

display(df)
`,
  right: `# Databricks notebook source
df = spark.read.table("sales.orders").filter("amount > 0")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Totals by region

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT region, SUM(amount) AS total FROM sales.orders GROUP BY region

# COMMAND ----------

display(df)
`,
}

export default function NotebooksPage() {
  return (
    <TextWorkspace
      mode="notebook"
      title="Databricks Notebook Compare"
      subtitle="Cell-aware diffs for Databricks notebook source files (.py, .sql, .scala, .r) and .ipynb exports."
      loadFile={loadNotebook}
      accept=".py,.sql,.scala,.r,.ipynb,text/plain"
      sample={SAMPLE}
      fileStem="diffspace-notebook"
    />
  )
}
