"use client"

import React from "react"
import { useStore, useExportJson, useImportJson } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, Upload, RotateCcw, Search, X } from "lucide-react"

interface ToolbarProps {
  searchQuery: string
  onSearchQueryChange: (q: string) => void
}

export function Toolbar({ searchQuery, onSearchQueryChange }: ToolbarProps) {
  const { state, dispatch } = useStore()
  const exportJson = useExportJson()
  const importJson = useImportJson()

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-1.5">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold font-mono text-foreground tracking-tight">
          {state.modelName}
        </h1>
        <span className="text-xs text-muted-foreground font-mono">
          {state.numLayers}L x {state.numHeads}H
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search descriptions..."
            className="h-8 pl-8 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchQueryChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={importJson} className="text-xs">
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={exportJson} className="text-xs">
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm("Reset all annotations? This cannot be undone.")) {
              dispatch({ type: "RESET" })
            }
          }}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
