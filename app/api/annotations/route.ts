import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"
import { list, put } from "@vercel/blob"

const FILE_PATH = path.join(process.cwd(), "public", "data", "head-annotations.json")
const BLOB_PATH = "data/head-annotations.json"
const IS_PRODUCTION = process.env.NODE_ENV === "production"

async function ensureFile() {
  const dir = path.dirname(FILE_PATH)
  await fs.mkdir(dir, { recursive: true })
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

function constantTimeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return crypto.timingSafeEqual(aBuf, bBuf)
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

function getIfMatch(req: Request): string | null {
  const raw = req.headers.get("if-match")
  if (!raw) return null
  return raw.replaceAll('"', "").trim() || null
}

async function readCurrentData(): Promise<Record<string, unknown> | null> {
  const raw = hasBlobToken()
    ? (await readFromBlob()) ?? (!IS_PRODUCTION ? await readFromLocalFile() : null)
    : await readFromLocalFile()

  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function validateWriteToken(req: Request): NextResponse | null {
  const requiredToken = process.env.ANNOTATIONS_WRITE_TOKEN
  if (!requiredToken) {
    if (IS_PRODUCTION) {
      return NextResponse.json(
        { error: "server write token is not configured" },
        { status: 503 },
      )
    }
    return null
  }

  const clientToken = req.headers.get("x-annotations-token")
  if (!clientToken || !constantTimeEqual(clientToken, requiredToken)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  return null
}

async function readFromLocalFile(): Promise<string | null> {
  try {
    return await fs.readFile(FILE_PATH, "utf8")
  } catch {
    return null
  }
}

async function writeToLocalFile(payload: unknown) {
  await ensureFile()
  await fs.writeFile(FILE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
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
  if (!res.ok) return null
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

export async function GET() {
  try {
    const raw = hasBlobToken()
      ? (await readFromBlob()) ?? (!IS_PRODUCTION ? await readFromLocalFile() : null)
      : await readFromLocalFile()
    if (!raw) {
      return NextResponse.json({ error: "annotations file not found" }, { status: 404 })
    }
    return new NextResponse(raw, {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    })
  } catch {
    return NextResponse.json({ error: "annotations file not found" }, { status: 404 })
  }
}

export async function PUT(req: Request) {
  try {
    const writeTokenError = validateWriteToken(req)
    if (writeTokenError) return writeTokenError

    const data = await req.json()
    if (!isValidProjectData(data)) {
      return NextResponse.json({ error: "invalid json body" }, { status: 400 })
    }

    const current = await readCurrentData()
    const ifMatch = getIfMatch(req)
    if (ifMatch) {
      const currentUpdatedAt =
        current && typeof current.updatedAt === "string" ? current.updatedAt : null
      if (currentUpdatedAt && currentUpdatedAt !== ifMatch) {
        return NextResponse.json(
          { error: "conflict", currentUpdatedAt },
          { status: 409 },
        )
      }
    }

    const now = new Date().toISOString()
    const payload = {
      ...data,
      updatedAt: now,
      createdAt: typeof data.createdAt === "string" ? data.createdAt : now,
    }

    if (hasBlobToken()) {
      await writeToBlob(payload)
    } else {
      await writeToLocalFile(payload)
    }

    return NextResponse.json(payload, { status: 200 })
  } catch {
    return NextResponse.json({ error: "failed to write annotations file" }, { status: 500 })
  }
}
