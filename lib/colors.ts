// 10-color palette for tag categories
// Each color has bg (cell background), text (text on bg), badge (badge bg), badgeText
const TAG_PALETTE = [
  { bg: "rgba(59,130,246,0.18)", text: "#3b82f6", badge: "#3b82f6", badgeText: "#fff" },       // blue
  { bg: "rgba(239,68,68,0.18)", text: "#ef4444", badge: "#ef4444", badgeText: "#fff" },         // red
  { bg: "rgba(34,197,94,0.18)", text: "#22c55e", badge: "#22c55e", badgeText: "#fff" },         // green
  { bg: "rgba(249,115,22,0.18)", text: "#f97316", badge: "#f97316", badgeText: "#fff" },        // orange
  { bg: "rgba(168,85,247,0.18)", text: "#a855f7", badge: "#a855f7", badgeText: "#fff" },        // purple
  { bg: "rgba(236,72,153,0.18)", text: "#ec4899", badge: "#ec4899", badgeText: "#fff" },        // pink
  { bg: "rgba(20,184,166,0.18)", text: "#14b8a6", badge: "#14b8a6", badgeText: "#fff" },        // teal
  { bg: "rgba(234,179,8,0.18)", text: "#eab308", badge: "#ca8a04", badgeText: "#fff" },         // yellow
  { bg: "rgba(99,102,241,0.18)", text: "#6366f1", badge: "#6366f1", badgeText: "#fff" },        // indigo
  { bg: "rgba(6,182,212,0.18)", text: "#06b6d4", badge: "#06b6d4", badgeText: "#fff" },         // cyan
] as const

export type TagColor = (typeof TAG_PALETTE)[number]

// Map tag name -> color, assigned in order of creation
const tagColorMap = new Map<string, TagColor>()

export function getTagColor(tag: string, allTags: string[]): TagColor {
  if (tagColorMap.has(tag)) {
    return tagColorMap.get(tag)!
  }
  const idx = allTags.indexOf(tag)
  const color = TAG_PALETTE[idx >= 0 ? idx % TAG_PALETTE.length : tagColorMap.size % TAG_PALETTE.length]
  tagColorMap.set(tag, color)
  return color
}

export function rebuildTagColorMap(tags: string[]) {
  tagColorMap.clear()
  tags.forEach((tag, idx) => {
    tagColorMap.set(tag, TAG_PALETTE[idx % TAG_PALETTE.length])
  })
}

export { TAG_PALETTE }
