import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { list, put } from "@vercel/blob"

const FILE_PATH = path.join(process.cwd(), "public", "data", "head-annotations.json")
const BLOB_PATH = "data/head-annotations.json"

async function ensureFile() {
  const dir = path.dirname(FILE_PATH)
  await fs.mkdir(dir, { recursive: true })
}

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
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
      ? (await readFromBlob()) ?? (await readFromLocalFile())
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
    const data = await req.json()
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "invalid json body" }, { status: 400 })
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
