"use client"

import { getTagColor, getTagLabel } from "@/lib/colors"
import { useStore } from "@/lib/store"

interface TagBadgeProps {
  tag: string
  size?: "sm" | "md"
  removable?: boolean
  onRemove?: () => void
}

export function TagBadge({ tag, size = "sm", removable = false, onRemove }: TagBadgeProps) {
  const { state } = useStore()
  const color = getTagColor(tag, state.tags)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      }`}
      style={{ backgroundColor: color.badge, color: color.badgeText }}
    >
      {getTagLabel(tag)}
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 opacity-70 hover:opacity-100"
          aria-label={`Remove tag ${getTagLabel(tag)}`}
        >
          x
        </button>
      )}
    </span>
  )
}
