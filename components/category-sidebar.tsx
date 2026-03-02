"use client"

import React, { useMemo, useState } from "react"
import { useStore, useAnnotationCount } from "@/lib/store"
import { getTagColor, getTagLabel, getTagParts } from "@/lib/colors"
import { Plus, Trash2, FolderPlus, PlusCircle } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface CategorySidebarProps {
  filterTag: string | null
  onFilterTagChange: (tag: string | null) => void
}

export function CategorySidebar({ filterTag, onFilterTagChange }: CategorySidebarProps) {
  const { state, dispatch } = useStore()
  const [newMajorInput, setNewMajorInput] = useState("")
  const [newSubtopicByMajor, setNewSubtopicByMajor] = useState<Record<string, string>>({})
  const [subtopicEditorMajor, setSubtopicEditorMajor] = useState<string | null>(null)
  const [draggingTag, setDraggingTag] = useState<string | null>(null)
  const [dropTargetMajor, setDropTargetMajor] = useState<string | null>(null)
  const [majorToDelete, setMajorToDelete] = useState<string | null>(null)
  const [subtopicToDelete, setSubtopicToDelete] = useState<string | null>(null)
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
      const { major, minor } = getTagParts(tag)
      if (!groups[major]) groups[major] = []
      if (minor) groups[major].push(tag)
    }
    return Object.entries(groups).map(([major, tags]) => ({
      major,
      tags,
      totalCount: (tagCounts[major] || 0) + tags.reduce((sum, tag) => sum + (tagCounts[tag] || 0), 0),
    }))
  }, [state.tags, tagCounts])

  function normalizeMajor(input: string): string {
    return input.trim().toLowerCase().replace(/\s+/g, "-")
  }

  function createMajor() {
    const major = normalizeMajor(newMajorInput)
    if (!major) return
    dispatch({ type: "ADD_MAJOR", major })
    setNewMajorInput("")
  }

  function deleteMajor(major: string) {
    dispatch({ type: "DELETE_MAJOR", major })
    if (filterTag === `__major__:${major}` || filterTag === major || filterTag?.startsWith(`${major}/`)) {
      onFilterTagChange(null)
    }
  }

  function createSubtopic(major: string) {
    const minor = (newSubtopicByMajor[major] || "").trim()
    if (!minor) return
    dispatch({ type: "ADD_SUBTOPIC", major, minor })
    setNewSubtopicByMajor((prev) => ({ ...prev, [major]: "" }))
  }

  function deleteSubtopic(tag: string) {
    dispatch({ type: "DELETE_SUBTOPIC", tag })
    if (filterTag === tag) onFilterTagChange(null)
  }

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

        <div className="mx-1 mb-2 rounded-lg border border-border/80 bg-muted/30 p-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <FolderPlus className="h-3.5 w-3.5" />
            <span>New Major</span>
          </div>
          <InputGroup className="h-9 bg-background">
            <InputGroupInput
              value={newMajorInput}
              onChange={(e) => setNewMajorInput(e.target.value)}
              placeholder="대주제 이름 입력"
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") createMajor()
              }}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="xs" variant="secondary" onClick={createMajor}>
                <Plus className="h-3.5 w-3.5" />
                추가
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>

        {groupedTags.map(({ major, tags, totalCount }) => {
          const majorFilter = `__major__:${major}`
          const majorColor = getTagColor(major, state.tags)
          const isMajorActive = filterTag === majorFilter
          const isDropTarget = draggingTag !== null && dropTargetMajor === major
          return (
            <div key={major} className="space-y-0.5">
              <div
                onDragOver={(e) => {
                  if (!draggingTag) return
                  e.preventDefault()
                  setDropTargetMajor(major)
                }}
                onDragLeave={() => {
                  if (dropTargetMajor === major) setDropTargetMajor(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (!draggingTag) return
                  dispatch({ type: "MOVE_TAG_TO_MAJOR", tag: draggingTag, nextMajor: major })
                  if (filterTag === draggingTag) {
                    const movedMinor = getTagParts(draggingTag).minor
                    onFilterTagChange(movedMinor ? `${major}/${movedMinor}` : null)
                  }
                  setDraggingTag(null)
                  setDropTargetMajor(null)
                }}
                className={`
                  flex items-center gap-1 rounded-md px-1 py-1 text-sm transition-all
                `}
                style={{
                  backgroundColor: isDropTarget ? `${majorColor.badge}22` : (isMajorActive ? majorColor.bg : undefined),
                  color: isMajorActive ? majorColor.text : undefined,
                }}
              >
                <button
                  onClick={() => onFilterTagChange(isMajorActive ? null : majorFilter)}
                  className={`
                    min-w-0 flex flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-all cursor-pointer
                    ${isMajorActive ? "font-semibold" : "hover:bg-accent/50 font-medium"}
                  `}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: majorColor.badge }}
                  />
                  <span className="min-w-0 truncate flex-1 text-left" title={major}>{major}</span>
                  <span className="shrink-0 text-xs font-mono tabular-nums opacity-70">{totalCount}</span>
                </button>
                <button
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive hover:bg-accent/50"
                  onClick={() => setMajorToDelete(major)}
                  type="button"
                  aria-label={`Delete major ${major}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  onClick={() =>
                    setSubtopicEditorMajor((prev) => (prev === major ? null : major))
                  }
                  type="button"
                  aria-label={`Add subtopic in ${major}`}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  소주제
                </button>
              </div>

              {subtopicEditorMajor === major && (
                <div className="ml-4 w-[calc(100%-1rem)] px-3 py-1">
                  <InputGroup className="h-8 bg-background/90">
                    <InputGroupInput
                      value={newSubtopicByMajor[major] || ""}
                      onChange={(e) =>
                        setNewSubtopicByMajor((prev) => ({ ...prev, [major]: e.target.value }))
                      }
                      placeholder={`${major} / 소주제`}
                      className="text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createSubtopic(major)
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton size="xs" variant="secondary" onClick={() => createSubtopic(major)}>
                        <Plus className="h-3.5 w-3.5" />
                        생성
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              )}

              {tags.map((tag) => {
                const isActive = filterTag === tag
                const color = getTagColor(tag, state.tags)
                const count = tagCounts[tag] || 0
                return (
                  <div key={tag} className="ml-4 flex w-[calc(100%-1rem)] min-w-0 items-center gap-1">
                    <button
                      onClick={() => onFilterTagChange(isActive ? null : tag)}
                      draggable
                      onDragStart={(e) => {
                        setDraggingTag(tag)
                        e.dataTransfer.setData("text/plain", tag)
                        e.dataTransfer.effectAllowed = "move"
                      }}
                      onDragEnd={() => {
                        setDraggingTag(null)
                        setDropTargetMajor(null)
                      }}
                      className={`
                        min-w-0 flex flex-1 items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-all cursor-pointer
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
                      <span className="min-w-0 truncate flex-1 text-left" title={getTagLabel(tag, true)}>
                        {getTagLabel(tag, true)}
                      </span>
                      <span className="shrink-0 text-xs font-mono tabular-nums opacity-70">{count}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubtopicToDelete(tag)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:text-destructive hover:bg-accent/50"
                      aria-label={`Delete subtopic ${getTagLabel(tag)}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
      <AlertDialog open={majorToDelete !== null} onOpenChange={(open) => !open && setMajorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>대주제 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              {majorToDelete
                ? `"${majorToDelete}" 대주제와 모든 소주제/태깅이 함께 삭제됩니다. 이 작업은 되돌리기 어렵습니다.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!majorToDelete) return
                deleteMajor(majorToDelete)
                setMajorToDelete(null)
              }}
            >
              삭제 진행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={subtopicToDelete !== null} onOpenChange={(open) => !open && setSubtopicToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>소주제 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              {subtopicToDelete
                ? `"${getTagLabel(subtopicToDelete)}" 소주제 태깅과 설명이 함께 삭제됩니다. 계속할까요?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!subtopicToDelete) return
                deleteSubtopic(subtopicToDelete)
                setSubtopicToDelete(null)
              }}
            >
              삭제 진행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
