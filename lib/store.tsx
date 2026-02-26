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
const SYNC_INTERVAL_MS = 1000

function toMillis(iso: string | null | undefined): number {
  if (!iso) return 0
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

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
    const res = await fetch("/api/annotations", { cache: "no-store" })
    if (!res.ok) {
      console.warn("Failed to load annotations:", res.status)
      return null
    }
    return normalizeProjectData((await res.json()) as ProjectData)
  } catch {
    return null
  }
}

async function saveToServer(
  data: ProjectData,
  expectedServerUpdatedAt?: string | null,
): Promise<ProjectData | null> {
  if (typeof window === "undefined") return null
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    }
    const ifMatchValue = expectedServerUpdatedAt ?? data.updatedAt
    if (ifMatchValue) {
      headers["if-match"] = ifMatchValue
    }

    const res = await fetch("/api/annotations", {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    })
    if (res.status === 409) {
      console.warn("Failed to save annotations: conflict (409)")
      return null
    }
    if (!res.ok) {
      console.warn("Failed to save annotations:", res.status)
      return null
    }
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
      return { ...action.data, updatedAt: action.data.updatedAt || now }
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
  const isSyncingFromServer = useRef(false)
  const lastServerUpdateAt = useRef<string | null>(null)

  const applyRemoteData = useCallback((data: ProjectData) => {
    isSyncingFromServer.current = true
    dispatch({ type: "IMPORT_DATA", data })
    window.setTimeout(() => {
      isSyncingFromServer.current = false
    }, 0)
  }, [dispatch])

  const syncFromServer = useCallback(async () => {
    const remote = await loadDefaultProject()
    if (!remote) return

    const remoteUpdated = toMillis(remote.updatedAt)
    const lastSeenRemote = toMillis(lastServerUpdateAt.current)

    if (remoteUpdated > lastSeenRemote) {
      applyRemoteData(remote)
    }

    lastServerUpdateAt.current = remote.updatedAt
  }, [applyRemoteData])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const timer = setTimeout(() => saveToStorage(state), 300)
    return () => clearTimeout(timer)
  }, [state])

  useEffect(() => {
    if (isInitialMount.current || isSyncingFromServer.current) return
    const timer = setTimeout(() => {
      void (async () => {
        const saved = await saveToServer(
          state,
          lastServerUpdateAt.current ?? state.updatedAt,
        )
        if (saved) {
          applyRemoteData(saved)
          lastServerUpdateAt.current = saved.updatedAt
        }
      })()
    }, 500)
    return () => clearTimeout(timer)
  }, [applyRemoteData, state])

  useEffect(() => {
    let isCancelled = false

    void (async () => {
      const localData = loadFromStorage()
      const data = await loadDefaultProject()
      if (!isCancelled && data) {
        // Server is the shared source of truth when available.
        applyRemoteData(data)
        lastServerUpdateAt.current = data.updatedAt
      } else if (!isCancelled && !data && !hasStoredProject()) {
        // no server file yet: seed it from current local state
        const saved = await saveToServer(localData || createEmptyProject())
        if (saved) {
          lastServerUpdateAt.current = saved.updatedAt
        }
      } else if (!isCancelled && localData) {
        // no server response: keep local as source of truth for now
        lastServerUpdateAt.current = localData.updatedAt
      }
    })()

    return () => {
      isCancelled = true
    }
  }, [applyRemoteData])

  useEffect(() => {
    let isCancelled = false
    const id = window.setInterval(() => {
      void (async () => {
        if (isCancelled) return
        await syncFromServer()
      })()
    }, SYNC_INTERVAL_MS)

    return () => {
      isCancelled = true
      window.clearInterval(id)
    }
  }, [syncFromServer])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return
      void (async () => {
        await syncFromServer()
      })()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [syncFromServer])

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
