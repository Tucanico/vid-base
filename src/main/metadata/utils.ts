import { exiftool } from 'exiftool-vendored'
import { ExifTool } from 'exiftool-vendored'

export const ourExiftool = new ExifTool({
  taskTimeoutMillis: 120000
})

export function closeExiftool(): void {
  exiftool.end()
}
