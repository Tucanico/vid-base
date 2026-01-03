import { useState } from 'react'

// This is a simple diagnostic component that displays the version numbers
// of the core technologies running the Electron app: Electron, Chromium, and Node.js
function Versions(): React.JSX.Element {
	// The 'window.electron.process.versions' object is exposed by the preload script
	// We use useState to get this information once and store it in the component's state
	const [versions] = useState(window.electron.process.versions)

	return (
		<ul className="versions">
			<li className="electron-version">Electron v{versions.electron}</li>
			<li className="chrome-version">Chromium v{versions.chrome}</li>
			<li className="node-version">Node v{versions.node}</li>
		</ul>
	)
}

export default Versions
