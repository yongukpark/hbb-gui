export interface HeadAnnotation {
  layer: number
  head: number
  tags: string[]
  /** Per-tag description: key = tag name, value = description text */
  descriptions: Record<string, string>
}

export interface ProjectData {
  modelName: string
  numLayers: number
  numHeads: number
  annotations: Record<string, HeadAnnotation>
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type StoreAction =
  | { type: "SET_ANNOTATION"; key: string; annotation: HeadAnnotation }
  | { type: "DELETE_ANNOTATION"; key: string }
  | { type: "ADD_TAG"; tag: string }
  | { type: "ADD_SUBTOPIC"; major: string; minor: string }
  | { type: "DELETE_SUBTOPIC"; tag: string }
  | { type: "REMOVE_TAG"; tag: string }
  | { type: "ADD_MAJOR"; major: string }
  | { type: "DELETE_MAJOR"; major: string }
  | { type: "MOVE_TAG_TO_MAJOR"; tag: string; nextMajor: string }
  | { type: "IMPORT_DATA"; data: ProjectData }
  | { type: "IMPORT_LOCAL_DATA"; data: ProjectData }
  | { type: "RESET" }

export function headKey(layer: number, head: number): string {
  return `L${layer}H${head}`
}
