import React, { useState } from 'react'
import ModeSelection from './components/ModeSelection'
import VideoModeView from './components/VideoMode/VideoModeView'
import MovieModeView from './components/MovieMode/MovieModeView'

/** --- MAIN APP COMPONENT ---
 *  The root component of the application. It shows the mode selection screen, then the chosen
 *  mode's view, which owns that mode's state and its interactions with the main process
 */
function App(): React.ReactElement {
	// The mode and folder picked on the mode selection screen (fixed for the rest of the session)
	const [selection, setSelection] = useState<{
		mode: 'videos' | 'movies'
		folder: string
	} | null>(null)

	// Show mode selection screen if no mode is selected
	if (!selection) {
		return <ModeSelection onModeSelected={(mode, folder) => setSelection({ mode, folder })} />
	}

	return selection.mode === 'videos' ? (
		<VideoModeView initialFolder={selection.folder} />
	) : (
		<MovieModeView initialFolder={selection.folder} />
	)
}

export default App
