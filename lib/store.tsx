"use client"

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from "react"
import type { ProjectData, StoreAction } from "./types"
import { rebuildTagColorMap } from "./colors"

const NUM_LAYERS = 24
const NUM_HEADS = 16

function createEmptyProject(): ProjectData {
  return {
    modelName: "Pythia-1.4B",
    numLayers: NUM_LAYERS,
    numHeads: NUM_HEADS,
    annotations: {},
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

const STORAGE_KEY = "pythia-head-naming"

function normalizeProjectData(data: ProjectData): ProjectData {
  // Migrate old format: single `description` -> per-tag `descriptions`
  for (const key of Object.keys(data.annotations)) {
    const ann = data.annotations[key] as any
    if (typeof ann.description === "string" && !ann.descriptions) {
      const desc = ann.description
      ann.descriptions = {}
      if (desc && ann.tags.length > 0) {
        ann.descriptions[ann.tags[0]] = desc
      }
      delete ann.description
    }
  }
  rebuildTagColorMap(data.tags)
  return data
}

function loadFromStorage(): ProjectData | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return normalizeProjectData(JSON.parse(raw) as ProjectData)
  } catch {
    return null
  }
}

function hasStoredProject(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}

async function loadDefaultProject(): Promise<ProjectData | null> {
  if (typeof window === "undefined") return null
  try {
    const res = await fetch("/data/head-annotations.json", { cache: "no-store" })
    if (!res.ok) return null
    return normalizeProjectData((await res.json()) as ProjectData)
  } catch {
    return null
  }
}

function saveToStorage(data: ProjectData) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // storage full or unavailable
  }
}

function reducer(state: ProjectData, action: StoreAction): ProjectData {
  const now = new Date().toISOString()
  switch (action.type) {
    case "SET_ANNOTATION": {
      const newAnnotations = { ...state.annotations, [action.key]: action.annotation }
      // Collect any new tags
      const newTags = [...state.tags]
      for (const tag of action.annotation.tags) {
        if (!newTags.includes(tag)) {
          newTags.push(tag)
        }
      }
      return { ...state, annotations: newAnnotations, tags: newTags, updatedAt: now }
    }
    case "DELETE_ANNOTATION": {
      const { [action.key]: _, ...rest } = state.annotations
      return { ...state, annotations: rest, updatedAt: now }
    }
    case "ADD_TAG": {
      if (state.tags.includes(action.tag)) return state
      return { ...state, tags: [...state.tags, action.tag], updatedAt: now }
    }
    case "REMOVE_TAG": {
      return {
        ...state,
        tags: state.tags.filter((t) => t !== action.tag),
        updatedAt: now,
      }
    }
    case "IMPORT_DATA": {
      rebuildTagColorMap(action.data.tags)
      return { ...action.data, updatedAt: now }
    }
    case "RESET": {
      rebuildTagColorMap([])
      return createEmptyProject()
    }
    default:
      return state
  }
}

interface StoreContextValue {
  state: ProjectData
  dispatch: React.Dispatch<StoreAction>
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    return loadFromStorage() || createEmptyProject()
  })

  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const timer = setTimeout(() => saveToStorage(state), 300)
    return () => clearTimeout(timer)
  }, [state])

  useEffect(() => {
    let isCancelled = false
    if (hasStoredProject()) return

    void (async () => {
      const data = await loadDefaultProject()
      if (!isCancelled && data) {
        dispatch({ type: "IMPORT_DATA", data })
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [dispatch])

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}

export function useAnnotationCount() {
  const { state } = useStore()
  return Object.keys(state.annotations).length
}

export function useExportJson() {
  const { state } = useStore()
  return useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${state.modelName.toLowerCase().replace(/\s+/g, "-")}-annotations.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [state])
}

export function useImportJson() {
  const { dispatch } = useStore()
  return useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text) as ProjectData
        if (data.modelName && data.annotations && data.tags) {
          dispatch({ type: "IMPORT_DATA", data })
        }
      } catch {
        // invalid json
      }
    }
    input.click()
  }, [dispatch])
}
