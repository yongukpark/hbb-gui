"use client"

import React, { useState, useCallback, useMemo } from "react"
import { useStore } from "@/lib/store"
import { headKey } from "@/lib/types"
import { HeadCell } from "@/components/head-cell"
import { HeadEditDialog } from "@/components/head-edit-dialog"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface AttentionGridProps {
  filterTag: string | null
  searchQuery: string
}

export function AttentionGrid({ filterTag, searchQuery }: AttentionGridProps) {
  const { state } = useStore()
  const [editTarget, setEditTarget] = useState<{ layer: number; head: number } | null>(null)

  const handleCellClick = useCallback((layer: number, head: number) => {
    setEditTarget({ layer, head })
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

    for (const [key, ann] of Object.entries(state.annotations)) {
      const tagMatch = !filterTag || ann.tags.includes(filterTag)
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

  return (
    <>
      <ScrollArea className="w-full flex-1">
        <div className="p-3">
          {/* Column headers */}
          <div
            className="grid gap-px mb-1"
            style={{
              gridTemplateColumns: `36px repeat(${state.numHeads}, minmax(0, 1fr))`,
            }}
          >
            <div />
            {heads.map((h) => (
              <div
                key={h}
                className="flex items-center justify-center text-[10px] font-mono text-muted-foreground py-1"
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
                  <span className="text-[10px] font-mono text-muted-foreground">L{l}</span>
                </div>
                {/* Cells */}
                {heads.map((h) => {
                  const key = headKey(l, h)
                  const isHighlighted = matchingKeys !== null && matchingKeys.has(key)
                  const isDimmed =
                    matchingKeys !== null &&
                    !matchingKeys.has(key)
                  return (
                    <div key={h} className="aspect-[2.2/1] min-h-[28px]">
                      <HeadCell
                        layer={l}
                        head={h}
                        isHighlighted={isHighlighted}
                        isDimmed={isDimmed}
                        onClick={handleCellClick}
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
