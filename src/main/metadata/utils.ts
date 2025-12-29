import * as fs from 'fs'
import { exiftool } from 'exiftool-vendored'
import { ExifTool } from 'exiftool-vendored'

export const ourExiftool = new ExifTool({
	taskTimeoutMillis: 120000
})

export function closeOurExiftool(): void {
	ourExiftool.end()
}

export function closeExiftool(): void {
	exiftool.end()
}

export async function deleteFile(filePath: string): Promise<void> {
	try {
		await fs.promises.unlink(filePath)
		console.log(`Successfully deleted file: ${filePath}`)
	} catch (error) {
		console.error(`Error deleting file ${filePath}:`, error)
	}
}
