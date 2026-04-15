import { type ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-media-query'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  fullScreenMobile?: boolean
}

export function Modal({ open, onClose, title, children, className, fullScreenMobile = true }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handler = () => onClose()
    dialog.addEventListener('close', handler)
    return () => dialog.removeEventListener('close', handler)
  }, [onClose])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      className={cn(
        'fixed inset-0 z-50 bg-transparent p-0 m-0 max-w-none max-h-none w-full h-full',
        'backdrop:bg-black/40 backdrop:backdrop-blur-sm',
        'open:animate-fade-in',
      )}
    >
      <div
        className={cn(
          'bg-surface text-text animate-scale-in',
          isMobile && fullScreenMobile
            ? 'w-full h-full'
            : 'mx-auto mt-[10vh] w-full max-w-xl rounded-2xl shadow-lg max-h-[80vh] overflow-hidden',
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center hover:bg-surface-3 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className={cn(
          isMobile && fullScreenMobile ? 'h-[calc(100%-56px)] overflow-y-auto' : 'overflow-y-auto max-h-[calc(80vh-56px)]',
        )}>
          {children}
        </div>
      </div>
    </dialog>
  )
}
