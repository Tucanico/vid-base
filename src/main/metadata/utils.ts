import { exiftool } from 'exiftool-vendored'

export function closeExiftool(): void {
  exiftool.end()
}
