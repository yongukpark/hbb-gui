"use client"

import React, { memo } from "react"
import { getTagColor, getTagLabel } from "@/lib/colors"
import { useStore } from "@/lib/store"
import { headKey } from "@/lib/types"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface HeadCellProps {
  layer: number
  head: number
  isHighlighted: boolean
  isDimmed: boolean
  forcedTagForDisplay?: string | null
  onClick: (layer: number, head: number) => void
  onHoverChange?: (layer: number, head: number, active: boolean) => void
}

export const HeadCell = memo(function HeadCell({
  layer,
  head,
  isHighlighted,
  isDimmed,
  forcedTagForDisplay = null,
  onClick,
  onHoverChange,
}: HeadCellProps) {
  const { state } = useStore()
  const key = headKey(layer, head)
  const annotation = state.annotations[key]
  const hasAnnotation = !!annotation && (annotation.tags.length > 0 || Object.keys(annotation.descriptions).length > 0)

  const primaryTag = annotation?.tags?.[0]
  const displayTag = forcedTagForDisplay && isHighlighted ? forcedTagForDisplay : primaryTag
  const color = displayTag ? getTagColor(displayTag, state.tags) : null

  const cellContent = (
    <button
      onClick={() => onClick(layer, head)}
      onMouseEnter={() => onHoverChange?.(layer, head, true)}
      onMouseLeave={() => onHoverChange?.(layer, head, false)}
      onFocus={() => onHoverChange?.(layer, head, true)}
      onBlur={() => onHoverChange?.(layer, head, false)}
      className={`
        relative flex items-center justify-center rounded-sm w-full h-full
        transition-all duration-150 cursor-pointer
        border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
        ${hasAnnotation
          ? "border-transparent"
          : "border-dashed border-border/50 hover:border-border"
        }
        ${isDimmed ? "opacity-[0.08]" : "opacity-100"}
        ${isHighlighted ? "ring-1 ring-ring/60" : ""}
      `}
      style={{
        backgroundColor: color?.bg ?? "transparent",
      }}
      aria-label={`Layer ${layer}, Head ${head}${hasAnnotation ? `, tagged: ${annotation.tags.join(", ")}` : ", empty"}`}
    >
      {hasAnnotation && displayTag && (
        <span
          className="text-[10px] font-semibold leading-tight truncate px-0.5 text-center"
          style={{ color: color?.text ?? "currentColor" }}
        >
          {getTagLabel(displayTag, true)}
        </span>
      )}
    </button>
  )

  if (!hasAnnotation) return cellContent

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-popover text-popover-foreground border max-w-64 p-2"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono text-muted-foreground">
            L{layer}H{head}
          </span>
          <div className="flex flex-col gap-1">
            {annotation.tags.map((tag) => {
              const tc = getTagColor(tag, state.tags)
              const desc = annotation.descriptions[tag]
              return (
                <div key={tag} className="flex flex-col gap-0.5">
                  <span
                    className="inline-flex items-center self-start rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: tc.badge, color: tc.badgeText }}
                  >
                    {getTagLabel(tag)}
                  </span>
                  {desc && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 pl-0.5">
                      {desc}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
})
