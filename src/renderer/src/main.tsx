// Import the main stylesheet for the application
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// This is the main entry point for the React application in the renderer process

// Get the root DOM element where the React app will be mounted
const rootElement = document.getElementById('root')!

// Create a root for the React 18 concurrent renderer
const root = createRoot(rootElement)

// Render the main App component into the root
// StrictMode is a React tool for highlighting potential problems in an application
// It activates additional checks and warnings for its descendants
root.render(
	<StrictMode>
		<App />
	</StrictMode>
)
