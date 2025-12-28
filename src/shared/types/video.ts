import { ParsedTag } from './metadata'

export interface VideoFile {
  id: string
  fileName: string
  filePath: string
  tags: ParsedTag[]
  rawTags: string
}
