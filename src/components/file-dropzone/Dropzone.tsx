import { useRef, useState, type ReactNode } from 'react'
import { UploadCloud } from 'lucide-react'
import { Button } from '../ui/Button'

interface DropzoneProps {
  onFiles: (files: File[]) => void
  children: ReactNode
  label?: string
  className?: string
  multiple?: boolean
}

/** Wraps content and shows a highlighted overlay while files are dragged over it. */
export function Dropzone({
  onFiles,
  children,
  label = 'Drop file here',
  className = '',
  multiple = true,
}: DropzoneProps) {
  const [over, setOver] = useState(false)
  const depth = useRef(0)

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

  return (
    <div
      className={`relative ${className}`}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        depth.current++
        setOver(true)
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setOver(false)
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        depth.current = 0
        setOver(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length) onFiles(multiple ? files : files.slice(0, 1))
      }}
    >
      {children}
      {over && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent bg-accent-soft/90 text-accent"
          style={{ animation: 'drop-pulse 1.2s ease-in-out infinite' }}
        >
          <UploadCloud size={34} />
          <span className="text-sm font-semibold">{label}</span>
        </div>
      )}
    </div>
  )
}

interface PickerProps {
  onFiles: (files: File[]) => void
  accept?: string
  label?: string
  multiple?: boolean
  variant?: 'secondary' | 'primary' | 'ghost'
  size?: 'sm' | 'md'
  icon?: ReactNode
  className?: string
}

/** Button that opens the native file picker. Files are read locally only. */
export function FilePicker({
  onFiles,
  accept,
  label = 'Upload',
  multiple = false,
  variant = 'secondary',
  size = 'sm',
  icon,
  className,
}: PickerProps) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
        tabIndex={-1}
        aria-hidden
      />
      <Button
        variant={variant}
        size={size}
        className={className}
        icon={icon}
        onClick={() => ref.current?.click()}
      >
        {label}
      </Button>
    </>
  )
}
