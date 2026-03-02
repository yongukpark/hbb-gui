"use client"

import React, { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import { headKey, type HeadAnnotation } from "@/lib/types"
import { TagBadge } from "@/components/tag-badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getTagColor, getTagLabel, getTagParts } from "@/lib/colors"

interface HeadEditDialogProps {
  layer: number | null
  head: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HeadEditDialog({ layer, head, open, onOpenChange }: HeadEditDialogProps) {
  const { state, dispatch } = useStore()
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [descriptions, setDescriptions] = useState<Record<string, string>>({})
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)
  const [newTagInput, setNewTagInput] = useState("")

  const key = layer !== null && head !== null ? headKey(layer, head) : null
  const existing = key ? state.annotations[key] : null
  const groupedTags = React.useMemo(() => {
    const groups: Record<string, string[]> = {}
    for (const tag of state.tags) {
      const { major } = getTagParts(tag)
      if (!groups[major]) groups[major] = []
      groups[major].push(tag)
    }
    return Object.entries(groups)
  }, [state.tags])

  useEffect(() => {
    if (open && key) {
      if (existing) {
        setSelectedTags([...existing.tags])
        setDescriptions({ ...existing.descriptions })
      } else {
        setSelectedTags([])
        setDescriptions({})
      }
      setNewTagInput("")
    }
  }, [open, key, existing])

  if (layer === null || head === null) return null

  function handleSave() {
    if (!key) return
    // Only keep descriptions for tags that are selected
    const cleanDescriptions: Record<string, string> = {}
    for (const tag of selectedTags) {
      const desc = descriptions[tag]?.trim()
      if (desc) {
        cleanDescriptions[tag] = desc
      }
    }
    const annotation: HeadAnnotation = {
      layer: layer!,
      head: head!,
      tags: selectedTags,
      descriptions: cleanDescriptions,
    }
    dispatch({ type: "SET_ANNOTATION", key, annotation })
    onOpenChange(false)
  }

  function handleDelete() {
    if (!key) return
    dispatch({ type: "DELETE_ANNOTATION", key })
    onOpenChange(false)
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function normalizeTagInput(input: string): string {
    return input
      .split("/")
      .map((part) => part.trim().toLowerCase().replace(/\s+/g, "-"))
      .filter(Boolean)
      .join("/")
  }

  function handleCreateTag() {
    const tag = normalizeTagInput(newTagInput)
    if (!tag) return
    if (!state.tags.includes(tag)) {
      dispatch({ type: "ADD_TAG", tag })
    }
    if (!selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag])
    }
    setNewTagInput("")
  }

  function updateDescription(tag: string, value: string) {
    setDescriptions((prev) => ({ ...prev, [tag]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-mono">
            Layer {layer}, Head {head}
          </DialogTitle>
          <DialogDescription>
            Assign tags and describe each tag for this attention head.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-y-auto pr-1">
          {/* Tag selector */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Tags</label>
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={tagPopoverOpen}
                  className="justify-between text-sm font-normal"
                >
                  Select or create tags...
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search or type major/subtopic..."
                    value={newTagInput}
                    onValueChange={setNewTagInput}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {newTagInput.trim() ? (
                        <button
                          className="w-full cursor-pointer px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm"
                          onClick={handleCreateTag}
                        >
                          Create &quot;{normalizeTagInput(newTagInput)}&quot;
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Type a major/subtopic tag (example: reasoning/causal)
                        </span>
                      )}
                    </CommandEmpty>
                    {groupedTags.map(([major, tags]) => (
                      <CommandGroup key={major} heading={major}>
                        {tags.map((tag) => (
                          <CommandItem
                            key={tag}
                            value={tag}
                            onSelect={() => toggleTag(tag)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTags.includes(tag) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <TagBadge tag={tag} size="md" />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
                {newTagInput.trim() && !state.tags.includes(normalizeTagInput(newTagInput)) && (
                  <div className="border-t px-2 py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full justify-start text-sm"
                      onClick={handleCreateTag}
                    >
                      + Create &quot;{normalizeTagInput(newTagInput)}&quot;
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Per-tag descriptions */}
          {selectedTags.length > 0 && (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-foreground">Descriptions</label>
              {selectedTags.map((tag) => {
                const color = getTagColor(tag, state.tags)
                return (
                  <div key={tag} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <TagBadge tag={tag} size="md" />
                      <button
                        onClick={() => toggleTag(tag)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Textarea
                      value={descriptions[tag] || ""}
                      onChange={(e) => updateDescription(tag, e.target.value)}
                      placeholder={`Describe the "${getTagLabel(tag)}" behavior for this head...`}
                      className="min-h-16 resize-none text-sm"
                      style={{
                        borderColor: `${color.badge}40`,
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between pt-3 border-t border-border">
          <div>
            {existing && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={selectedTags.length === 0}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
