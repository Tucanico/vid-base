// src/shared/types.ts

export interface ParsedTag {
  type: 'simple' | 'kv'
  key?: string // es: "categoria"
  value: string // es: "vintage"
  original: string // es: "categoria:vintage"
}

export interface VideoFile {
  id: string
  fileName: string
  filePath: string
  tags: ParsedTag[]
  // rawTags è la stringa grezza letta da Windows (es: "mare; voto:5")
  rawTags: string
}
