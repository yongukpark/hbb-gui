"use client"

import React, { useState } from "react"
import { StoreProvider } from "@/lib/store"
import { Toolbar } from "@/components/toolbar"
import { AttentionGrid } from "@/components/attention-grid"
import { CategorySidebar } from "@/components/category-sidebar"

function AppContent() {
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="flex flex-col h-screen bg-background">
      <Toolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar - category list */}
        <aside className="w-56 flex-shrink-0 min-h-0">
          <CategorySidebar
            filterTag={filterTag}
            onFilterTagChange={setFilterTag}
          />
        </aside>
        {/* Right - grid matrix */}
        <main className="flex-1 min-w-0 min-h-0">
          <AttentionGrid filterTag={filterTag} searchQuery={searchQuery} />
        </main>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  )
}
