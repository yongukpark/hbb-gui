"use client"

import React, { useMemo } from "react"
import { useStore, useAnnotationCount } from "@/lib/store"
import { getTagColor, getTagLabel, getTagParts } from "@/lib/colors"

interface CategorySidebarProps {
  filterTag: string | null
  onFilterTagChange: (tag: string | null) => void
}

export function CategorySidebar({ filterTag, onFilterTagChange }: CategorySidebarProps) {
  const { state } = useStore()
  const annotationCount = useAnnotationCount()
  const totalHeads = state.numLayers * state.numHeads
  const percent = totalHeads > 0 ? Math.round((annotationCount / totalHeads) * 100) : 0

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ann of Object.values(state.annotations)) {
      for (const tag of ann.tags) {
        counts[tag] = (counts[tag] || 0) + 1
      }
    }
    return counts
  }, [state.annotations])

  const groupedTags = useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const tag of state.tags) {
      const { major } = getTagParts(tag)
      if (!groups[major]) groups[major] = []
      groups[major].push(tag)
    }
    return Object.entries(groups).map(([major, tags]) => ({
      major,
      tags,
      totalCount: tags.reduce((sum, tag) => sum + (tagCounts[tag] || 0), 0),
    }))
  }, [state.tags, tagCounts])

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Progress section */}
      <div className="flex flex-col gap-2 px-4 pt-4 pb-3 border-b border-border">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Progress
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-foreground tabular-nums">
            {percent}%
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {annotationCount}/{totalHeads}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/70 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-1 px-2 py-3 flex-1 overflow-y-auto">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground px-2 pb-1">
          Categories
        </span>

        {/* All (clear filter) */}
        <button
          onClick={() => onFilterTagChange(null)}
          className={`
            flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors cursor-pointer
            ${filterTag === null
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }
          `}
        >
          <span>All</span>
          <span className="text-xs font-mono tabular-nums opacity-70">{totalHeads}</span>
        </button>

        {/* Unannotated */}
        <button
          onClick={() => onFilterTagChange("__unannotated__")}
          className={`
            flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors cursor-pointer
            ${filterTag === "__unannotated__"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }
          `}
        >
          <span>Unannotated</span>
          <span className="text-xs font-mono tabular-nums opacity-70">{totalHeads - annotationCount}</span>
        </button>

        {/* Divider */}
        {state.tags.length > 0 && <div className="h-px bg-border mx-2 my-1" />}

        {groupedTags.map(({ major, tags, totalCount }) => {
          const majorFilter = `__major__:${major}`
          const majorColor = getTagColor(major, state.tags)
          const isMajorActive = filterTag === majorFilter
          return (
            <div key={major} className="space-y-0.5">
              <button
                onClick={() => onFilterTagChange(isMajorActive ? null : majorFilter)}
                className={`
                  flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all cursor-pointer
                  ${isMajorActive ? "font-semibold" : "hover:bg-accent/50 font-medium"}
                `}
                style={{
                  backgroundColor: isMajorActive ? majorColor.bg : undefined,
                  color: isMajorActive ? majorColor.text : undefined,
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: majorColor.badge }}
                />
                <span className="truncate flex-1 text-left">{major}</span>
                <span className="text-xs font-mono tabular-nums opacity-70">{totalCount}</span>
              </button>

              {tags.map((tag) => {
                const isActive = filterTag === tag
                const color = getTagColor(tag, state.tags)
                const count = tagCounts[tag] || 0
                return (
                  <button
                    key={tag}
                    onClick={() => onFilterTagChange(isActive ? null : tag)}
                    className={`
                      ml-4 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-all cursor-pointer
                      ${isActive ? "font-medium" : "hover:bg-accent/40"}
                    `}
                    style={{
                      backgroundColor: isActive ? color.bg : undefined,
                      color: isActive ? color.text : undefined,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color.badge }}
                    />
                    <span className="truncate flex-1 text-left">{getTagLabel(tag, true)}</span>
                    <span className="text-xs font-mono tabular-nums opacity-70">{count}</span>
                  </button>
                )
              })}
            </div>
          )
        })}

        {state.tags.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-4 leading-relaxed">
            No categories yet. Click any cell in the grid to start annotating.
          </p>
        )}
      </div>
    </div>
  )
}
