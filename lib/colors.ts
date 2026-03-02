type BaseColor = {
  text: string
  badge: string
  rgb: [number, number, number]
}

export type TagColor = {
  bg: string
  text: string
  badge: string
  badgeText: string
}

const TAG_PALETTE: BaseColor[] = [
  { text: "#3b82f6", badge: "#3b82f6", rgb: [59, 130, 246] },    // blue
  { text: "#ef4444", badge: "#ef4444", rgb: [239, 68, 68] },      // red
  { text: "#22c55e", badge: "#22c55e", rgb: [34, 197, 94] },      // green
  { text: "#f97316", badge: "#f97316", rgb: [249, 115, 22] },     // orange
  { text: "#a855f7", badge: "#a855f7", rgb: [168, 85, 247] },     // purple
  { text: "#ec4899", badge: "#ec4899", rgb: [236, 72, 153] },     // pink
  { text: "#14b8a6", badge: "#14b8a6", rgb: [20, 184, 166] },     // teal
  { text: "#ca8a04", badge: "#ca8a04", rgb: [202, 138, 4] },      // yellow
  { text: "#6366f1", badge: "#6366f1", rgb: [99, 102, 241] },     // indigo
  { text: "#06b6d4", badge: "#06b6d4", rgb: [6, 182, 212] },       // cyan
]

const SUBTOPIC_VARIANTS = [
  { tone: "light", amount: 0.46, bgAlpha: 0.11 },
  { tone: "light", amount: 0.34, bgAlpha: 0.14 },
  { tone: "light", amount: 0.22, bgAlpha: 0.17 },
  { tone: "light", amount: 0.12, bgAlpha: 0.2 },
  { tone: "dark", amount: 0.08, bgAlpha: 0.22 },
  { tone: "dark", amount: 0.16, bgAlpha: 0.25 },
] as const

interface ParsedTag {
  major: string
  minor: string | null
}

function parseTag(tag: string): ParsedTag {
  const [majorRaw, ...minorParts] = tag.split("/")
  const major = majorRaw.trim()
  const minorRaw = minorParts.join("/").trim()
  return {
    major,
    minor: minorRaw.length > 0 ? minorRaw : null,
  }
}

function mixTowardWhite(rgb: [number, number, number], amount: number): string {
  const [r, g, b] = rgb
  const nr = Math.round(r + (255 - r) * amount)
  const ng = Math.round(g + (255 - g) * amount)
  const nb = Math.round(b + (255 - b) * amount)
  const toHex = (n: number) => n.toString(16).padStart(2, "0")
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`
}

function mixTowardBlack(rgb: [number, number, number], amount: number): string {
  const [r, g, b] = rgb
  const nr = Math.round(r * (1 - amount))
  const ng = Math.round(g * (1 - amount))
  const nb = Math.round(b * (1 - amount))
  const toHex = (n: number) => n.toString(16).padStart(2, "0")
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`
}

function pickReadableText(hexColor: string): "#fff" | "#111827" {
  const hex = hexColor.replace("#", "")
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? "#111827" : "#fff"
}

function toBg(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
}

function buildMajorOrder(allTags: string[]): string[] {
  const majors: string[] = []
  for (const tag of allTags) {
    const { major } = parseTag(tag)
    if (major && !majors.includes(major)) {
      majors.push(major)
    }
  }
  return majors
}

function findMinorIndexWithinMajor(tag: string, allTags: string[]): number {
  const current = parseTag(tag)
  if (!current.minor) return -1
  let idx = 0
  for (const candidate of allTags) {
    const parsed = parseTag(candidate)
    if (parsed.major !== current.major || !parsed.minor) continue
    if (candidate === tag) return idx
    idx += 1
  }
  return 0
}

export function getTagParts(tag: string): ParsedTag {
  return parseTag(tag)
}

export function getTagLabel(tag: string, preferMinor = false): string {
  const parts = parseTag(tag)
  if (preferMinor && parts.minor) return parts.minor
  return parts.minor ? `${parts.major} / ${parts.minor}` : parts.major
}

export function getTagColor(tag: string, allTags: string[]): TagColor {
  const parts = parseTag(tag)
  const majorOrder = buildMajorOrder(allTags.length > 0 ? allTags : [tag])
  const majorIdx = majorOrder.indexOf(parts.major)
  const base = TAG_PALETTE[(majorIdx >= 0 ? majorIdx : 0) % TAG_PALETTE.length]

  if (!parts.minor) {
    return {
      bg: toBg(base.rgb, 0.18),
      text: base.text,
      badge: base.badge,
      badgeText: "#fff",
    }
  }

  const minorIdx = findMinorIndexWithinMajor(tag, allTags)
  const variant = SUBTOPIC_VARIANTS[minorIdx % SUBTOPIC_VARIANTS.length]
  const badge =
    variant.tone === "light"
      ? mixTowardWhite(base.rgb, variant.amount)
      : mixTowardBlack(base.rgb, variant.amount)

  return {
    bg: toBg(base.rgb, variant.bgAlpha),
    text: base.text,
    badge,
    badgeText: pickReadableText(badge),
  }
}

export function rebuildTagColorMap(_tags: string[]) {
  // Kept for store compatibility; colors are now computed by hierarchy.
}

export { TAG_PALETTE }
