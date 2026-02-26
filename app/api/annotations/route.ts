import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { list, put } from "@vercel/blob"

export const dynamic = "force-dynamic"
export const revalidate = 0

const FILE_PATH = path.join(process.cwd(), "public", "data", "head-annotations.json")
const BLOB_PATH = "data/head-annotations.json"
const IS_PRODUCTION = process.env.NODE_ENV === "production"
const EXTERNAL_SYNC_URL = process.env.EXTERNAL_SYNC_URL?.trim() || ""
const EXTERNAL_SYNC_SECRET = process.env.EXTERNAL_SYNC_SECRET?.trim() || ""
const WRITE_TOKEN = process.env.ANNOTATIONS_WRITE_TOKEN?.trim() || ""

type ReadResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "missing" }
  | { status: "invalid" }

function createEmptyProjectData() {
  const now = new Date().toISOString()
  return {
    modelName: "Pythia-1.4B",
    numLayers: 24,
    numHeads: 16,
    annotations: {},
    tags: [],
    createdAt: now,
    updatedAt: now,
  }
}

async function ensureFile() {
  const dir = path.dirname(FILE_PATH)
  await fs.mkdir(dir, { recursive: true })
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

function hasExternalSync() {
  return Boolean(EXTERNAL_SYNC_URL)
}

function getBackendName() {
  if (hasExternalSync()) return "external"
  return hasBlobToken() ? "blob" : "local-file"
}

function getUpdatedAt(data: Record<string, unknown> | null): string | null {
  if (!data) return null
  return typeof data.updatedAt === "string" ? data.updatedAt : null
}

function parseOrigin(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function requireTrustedWriteRequest(req: Request): NextResponse | null {
  const requestOrigin = new URL(req.url).origin
  const origin = parseOrigin(req.headers.get("origin"))

  // Block cross-site writes to reduce CSRF risk for this unauthenticated endpoint.
  if ((IS_PRODUCTION || origin) && origin !== requestOrigin) {
    return NextResponse.json({ error: "forbidden origin" }, { status: 403 })
  }

  // Optional hard auth for write API. If set, clients must send this header.
  if (WRITE_TOKEN) {
    const token = req.headers.get("x-annotations-write-token")?.trim() || ""
    if (token !== WRITE_TOKEN) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  return null
}

function requireWritableBackend(): NextResponse | null {
  if (IS_PRODUCTION && !hasExternalSync() && !hasBlobToken()) {
    return NextResponse.json(
      { error: "EXTERNAL_SYNC_URL or BLOB_READ_WRITE_TOKEN is required in production" },
      { status: 503 },
    )
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isValidProjectData(value: unknown): boolean {
  if (!isRecord(value)) return false
  const { modelName, numLayers, numHeads, annotations, tags, createdAt } = value
  if (typeof modelName !== "string") return false
  if (typeof numLayers !== "number" || typeof numHeads !== "number") return false
  if (!isRecord(annotations)) return false
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) return false
  if (typeof createdAt !== "string") return false
  return true
}

async function readCurrentData(): Promise<ReadResult> {
  if (hasExternalSync()) {
    return readFromExternal()
  }

  const raw = hasBlobToken()
    ? (await readFromBlob()) ?? (!IS_PRODUCTION ? await readFromLocalFile() : null)
    : await readFromLocalFile()

  if (!raw) return { status: "missing" }
  try {
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed)) return { status: "invalid" }
    return { status: "ok", data: parsed }
  } catch {
    return { status: "invalid" }
  }
}

async function readFromLocalFile(): Promise<string | null> {
  try {
    return await fs.readFile(FILE_PATH, "utf8")
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === "ENOENT") return null
    throw err
  }
}

async function writeFileAtomically(filePath: string, content: string) {
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  await fs.writeFile(tempPath, content, "utf8")
  try {
    await fs.rename(tempPath, filePath)
  } catch (err) {
    await fs.unlink(tempPath).catch(() => {})
    throw err
  }
}

async function writeToLocalFile(payload: unknown) {
  await ensureFile()
  await writeFileAtomically(FILE_PATH, `${JSON.stringify(payload, null, 2)}\n`)
}

async function findBlobUrlByPath(pathname: string): Promise<string | null> {
  const { blobs } = await list({ prefix: pathname })
  const exact = blobs.find((blob) => blob.pathname === pathname)
  return exact?.url ?? null
}

async function readFromBlob(): Promise<string | null> {
  const blobUrl = await findBlobUrlByPath(BLOB_PATH)
  if (!blobUrl) return null
  const res = await fetch(blobUrl, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`blob read failed: ${res.status}`)
  }
  return res.text()
}

async function writeToBlob(payload: unknown) {
  const json = `${JSON.stringify(payload, null, 2)}\n`
  await put(BLOB_PATH, json, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  })
}

async function readFromExternal(): Promise<ReadResult> {
  const url = new URL(EXTERNAL_SYNC_URL)
  url.searchParams.set("action", "get")
  if (EXTERNAL_SYNC_SECRET) {
    url.searchParams.set("secret", EXTERNAL_SYNC_SECRET)
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  })

  if (res.status === 404 || res.status === 204) return { status: "missing" }
  if (!res.ok) {
    throw new Error(`external read failed: ${res.status}`)
  }

  const data = await res.json()
  if (!isRecord(data)) return { status: "invalid" }
  if (typeof data.error === "string") {
    throw new Error(`external read error: ${data.error}`)
  }

  // Support both direct payload and wrapped `{ data }` payloads.
  const maybeData = isRecord(data.data) ? data.data : data
  if (!isValidProjectData(maybeData)) return { status: "invalid" }
  return { status: "ok", data: maybeData }
}

async function writeToExternal(
  payload: Record<string, unknown>,
  expectedUpdatedAt: string | null,
): Promise<{ ok: true } | { ok: false; status: 409; currentUpdatedAt: string | null }> {
  const res = await fetch(EXTERNAL_SYNC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "put",
      secret: EXTERNAL_SYNC_SECRET || undefined,
      ifMatchUpdatedAt: expectedUpdatedAt || undefined,
      data: payload,
    }),
    cache: "no-store",
  })

  if (res.status === 409) {
    const body = await res.json().catch(() => null)
    const currentUpdatedAt =
      body && isRecord(body) && typeof body.currentUpdatedAt === "string"
        ? body.currentUpdatedAt
        : null
    return { ok: false, status: 409, currentUpdatedAt }
  }

  if (!res.ok) {
    throw new Error(`external write failed: ${res.status}`)
  }

  const body = await res.json().catch(() => null)
  if (body && isRecord(body) && body.error === "conflict") {
    const currentUpdatedAt = typeof body.currentUpdatedAt === "string" ? body.currentUpdatedAt : null
    return { ok: false, status: 409, currentUpdatedAt }
  }
  if (body && isRecord(body) && typeof body.error === "string") {
    throw new Error(`external write error: ${body.error}`)
  }

  return { ok: true }
}

export async function GET() {
  try {
    const backendError = requireWritableBackend()
    if (backendError) return backendError

    const result = await readCurrentData()
    if (result.status === "missing") {
      return NextResponse.json(createEmptyProjectData(), {
        status: 200,
        headers: {
          "cache-control": "no-store, no-cache, must-revalidate",
          "x-storage-backend": getBackendName(),
        },
      })
    }
    if (result.status === "invalid") {
      return NextResponse.json({ error: "stored annotations are invalid" }, { status: 500 })
    }
    return NextResponse.json(result.data, {
      status: 200,
      headers: {
        "cache-control": "no-store, no-cache, must-revalidate",
        "x-storage-backend": getBackendName(),
      },
    })
  } catch {
    return NextResponse.json({ error: "failed to read annotations file" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const backendError = requireWritableBackend()
    if (backendError) return backendError

    const trustError = requireTrustedWriteRequest(req)
    if (trustError) return trustError

    const data = await req.json()
    if (!isValidProjectData(data)) {
      return NextResponse.json({ error: "invalid json body" }, { status: 400 })
    }

    const readResult = await readCurrentData()
    if (readResult.status === "invalid") {
      return NextResponse.json({ error: "stored annotations are invalid" }, { status: 500 })
    }

    const expectedUpdatedAt = req.headers.get("if-match-updated-at")?.trim() || null
    const currentUpdatedAt = getUpdatedAt(readResult.status === "ok" ? readResult.data : null)
    if (currentUpdatedAt && !expectedUpdatedAt) {
      return NextResponse.json(
        { error: "precondition-required", currentUpdatedAt },
        { status: 428 },
      )
    }
    if (currentUpdatedAt && expectedUpdatedAt !== currentUpdatedAt) {
      return NextResponse.json(
        { error: "conflict", currentUpdatedAt },
        { status: 409 },
      )
    }

    const now = new Date().toISOString()
    const payload = {
      ...data,
      updatedAt: now,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : now,
    }

    if (hasExternalSync()) {
      const result = await writeToExternal(payload, expectedUpdatedAt)
      if (!result.ok) {
        return NextResponse.json(
          { error: "conflict", currentUpdatedAt: result.currentUpdatedAt },
          { status: 409 },
        )
      }
    } else if (hasBlobToken()) {
      await writeToBlob(payload)
    } else {
      await writeToLocalFile(payload)
    }

    return NextResponse.json(payload, { status: 200 })
  } catch {
    return NextResponse.json({ error: "failed to write annotations file" }, { status: 500 })
  }
}
