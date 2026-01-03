import * as fs from 'fs/promises'
import { ExifTool } from 'exiftool-vendored'

// Creates a shared, persistent instance of ExifTool
// Using a single instance is more efficient than creating a new one for each operation,
// as it avoids the overhead of starting the exiftool process repeatedly
// taskTimeoutMillis: Sets a long timeout to handle large files or slow operations without failing prematurely
export const ourExiftool = new ExifTool({
	taskTimeoutMillis: 120000 // 2 minutes
})

// Closes the shared exiftool process
// This is crucial to call when the application is quitting to prevent orphaned processes)
export function closeExiftool(): void {
	ourExiftool.end()
}

/** Deletes a file from the filesystem
 *  This is a simple async wrapper around fs.promises.unlink
 *  @param filePath The absolute path to the file to delete
 *  @returns A promise that resolves when the file has been deleted
 */
export async function deleteFile(filePath: string): Promise<void> {
	try {
		await fs.unlink(filePath)
		console.log(`Successfully deleted file: ${filePath}`)
	} catch (error) {
		// We log the error but don't re-throw, as failing to delete a file might not be a critical error
		console.error(`Error deleting file ${filePath}:`, error)
	}
}
