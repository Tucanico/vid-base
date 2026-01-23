import { ipcRenderer } from 'electron'
import { MovieArchive } from '../../shared/types/movie'

export const movieApi = {
	// Invokes the 'movies:load' handler to load movies from an Excel file
	loadMovies: (folderPath: string, moviesFolderPath?: string): Promise<MovieArchive> =>
		ipcRenderer.invoke('movies:load', folderPath, moviesFolderPath)
}
