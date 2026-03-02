"use client"

import React, { useState, useCallback, useMemo } from "react"
import { useStore } from "@/lib/store"
import { headKey } from "@/lib/types"
import { HeadCell } from "@/components/head-cell"
import { HeadEditDialog } from "@/components/head-edit-dialog"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { getTagParts } from "@/lib/colors"

interface AttentionGridProps {
  filterTag: string | null
  searchQuery: string
}

export function AttentionGrid({ filterTag, searchQuery }: AttentionGridProps) {
  const { state } = useStore()
  const [editTarget, setEditTarget] = useState<{ layer: number; head: number } | null>(null)
  const [hoverTarget, setHoverTarget] = useState<{ layer: number; head: number } | null>(null)

  const handleCellClick = useCallback((layer: number, head: number) => {
    setEditTarget({ layer, head })
  }, [])

  const handleCellHoverChange = useCallback((layer: number, head: number, active: boolean) => {
    setHoverTarget(active ? { layer, head } : null)
  }, [])

  // Compute which cells match the current filter/search
  const matchingKeys = useMemo(() => {
    if (!filterTag && !searchQuery) return null // null = show all

    const matches = new Set<string>()

    if (filterTag === "__unannotated__") {
      // Show only unannotated cells
      for (let l = 0; l < state.numLayers; l++) {
        for (let h = 0; h < state.numHeads; h++) {
          const key = headKey(l, h)
          if (!state.annotations[key]) {
            matches.add(key)
          }
        }
      }
      return matches
    }

    const majorFilter = filterTag?.startsWith("__major__:") ? filterTag.slice("__major__:".length) : null

    for (const [key, ann] of Object.entries(state.annotations)) {
      const tagMatch =
        !filterTag ||
        (majorFilter
          ? ann.tags.some((tag) => getTagParts(tag).major === majorFilter)
          : ann.tags.includes(filterTag))
      const searchMatch =
        !searchQuery ||
        Object.values(ann.descriptions).some((d) =>
          d.toLowerCase().includes(searchQuery.toLowerCase())
        ) ||
        ann.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      if (tagMatch && searchMatch) {
        matches.add(key)
      }
    }
    return matches
  }, [filterTag, searchQuery, state.annotations, state.numLayers, state.numHeads])

  const layers = Array.from({ length: state.numLayers }, (_, i) => i)
  const heads = Array.from({ length: state.numHeads }, (_, i) => i)
  const forcedDisplayTag =
    filterTag && filterTag !== "__unannotated__"
      ? (filterTag.startsWith("__major__:") ? filterTag.slice("__major__:".length) : filterTag)
      : null

  return (
    <>
      <ScrollArea className="w-full flex-1">
        <div className="px-2 py-1.5">
          {/* Column headers */}
          <div
            className="grid gap-px mb-0.5"
            style={{
              gridTemplateColumns: `36px repeat(${state.numHeads}, minmax(0, 1fr))`,
            }}
          >
            <div />
            {heads.map((h) => (
              <div
                key={h}
                className={`
                  flex items-center justify-center text-[10px] font-mono py-0.5 rounded-sm transition-colors
                  ${hoverTarget?.head === h ? "bg-accent/40 text-foreground" : "text-muted-foreground"}
                `}
              >
                H{h}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          <div className="flex flex-col gap-px">
            {layers.map((l) => (
              <div
                key={l}
                className="grid gap-px"
                style={{
                  gridTemplateColumns: `36px repeat(${state.numHeads}, minmax(0, 1fr))`,
                }}
              >
                {/* Row label */}
                <div className="flex items-center justify-end pr-1.5">
                  <span
                    className={`
                      text-[10px] font-mono rounded-sm px-1 py-[1px] transition-colors
                      ${hoverTarget?.layer === l ? "bg-accent/40 text-foreground" : "text-muted-foreground"}
                    `}
                  >
                    L{l}
                  </span>
                </div>
                {/* Cells */}
                {heads.map((h) => {
                  const key = headKey(l, h)
                  const isHighlighted = matchingKeys !== null && matchingKeys.has(key)
                  const isDimmed =
                    matchingKeys !== null &&
                    !matchingKeys.has(key)
                  return (
                    <div key={h} className="aspect-[2.25/1] min-h-[22px]">
                      <HeadCell
                        layer={l}
                        head={h}
                        isHighlighted={isHighlighted}
                        isDimmed={isDimmed}
                        forcedTagForDisplay={forcedDisplayTag}
                        onClick={handleCellClick}
                        onHoverChange={handleCellHoverChange}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <HeadEditDialog
        layer={editTarget?.layer ?? null}
        head={editTarget?.head ?? null}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
      />
    </>
  )
}
