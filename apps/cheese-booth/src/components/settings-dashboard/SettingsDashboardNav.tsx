import {
  Camera,
  Download,
  HardDrive,
  LayoutDashboard,
  Monitor,
  RotateCw,
  type LucideIcon,
} from 'lucide-react'

import type { SectionId } from './settingsDashboardUtils'

const SECTION_LINKS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'capture', label: 'Chế độ chụp', icon: Camera },
  { id: 'camera', label: 'Camera', icon: Monitor },
  { id: 'output', label: 'Cloud share', icon: HardDrive },
  { id: 'transform', label: 'Xoay / Lật', icon: RotateCw },
  { id: 'download', label: 'Desktop app', icon: Download },
]

interface SettingsDashboardNavProps {
  activeSection: SectionId
  onSelectSection: (sectionId: SectionId) => void
}

export function SettingsDashboardNav({
  activeSection,
  onSelectSection,
}: SettingsDashboardNavProps) {
  return (
    <nav className="sd-rail-nav" aria-label="Settings">
      {SECTION_LINKS.map((section) => {
        const Icon = section.icon

        return (
          <button
            key={section.id}
            className={`sd-rail-item ${activeSection === section.id ? 'active' : ''}`}
            type="button"
            onClick={() => onSelectSection(section.id)}
            title={section.label}
          >
            <Icon size={20} />
            <span>{section.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
