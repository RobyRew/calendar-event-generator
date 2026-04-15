import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  icon?: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  activeTab?: string
  onChange?: (id: string) => void
  children: (activeTab: string) => ReactNode
  className?: string
}

export function Tabs({ tabs, activeTab: controlledTab, onChange, children, className }: TabsProps) {
  const [internalTab, setInternalTab] = useState(tabs[0]?.id ?? '')
  const activeTab = controlledTab ?? internalTab

  const handleChange = (id: string) => {
    onChange?.(id)
    if (!controlledTab) setInternalTab(id)
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex gap-1 p-1 bg-surface-2 rounded-lg overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleChange(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-surface text-text shadow-xs'
                : 'text-text-3 hover:text-text-2',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-3 animate-fade-in" role="tabpanel">
        {children(activeTab)}
      </div>
    </div>
  )
}
