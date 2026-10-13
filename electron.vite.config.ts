import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Electron's Wayland (Ozone) backend segfaults during window creation against current Mutter
// releases (reproducible on Ubuntu 25.10+ with a stock Electron app), so Linux runs on
// X11/XWayland. The switch has to reach Electron's command line: Ozone picks its backend
// before the main script executes, so `app.commandLine.appendSwitch` is too late, and the
// `ozone-platform-hint` variants do not force the choice. electron-vite forwards
// ELECTRON_CLI_ARGS to the Electron process it spawns.
// Set VIDBASE_OZONE_PLATFORM=wayland to opt back into native Wayland.
if (process.platform === 'linux' && !process.env.ELECTRON_CLI_ARGS) {
	const ozonePlatform = process.env.VIDBASE_OZONE_PLATFORM || 'x11'
	process.env.ELECTRON_CLI_ARGS = JSON.stringify([`--ozone-platform=${ozonePlatform}`])
}

export default defineConfig({
	main: {},
	preload: {},
	renderer: {
		resolve: {
			alias: {
				'@renderer': resolve('src/renderer/src')
			}
		},
		plugins: [react()]
	}
})
