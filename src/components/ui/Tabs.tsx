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
      {/* .rw-seg with no thumb element: the selected segment paints its own
          capsule, which is what suits a scrolling, variable-width strip. */}
      <div className="rw-seg !grid-flow-col !auto-cols-auto overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleChange(tab.id)}
            className="rw-seg__item gap-1.5 px-3 whitespace-nowrap"
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
