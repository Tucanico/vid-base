// Packages the app with electron-builder, giving every build its own version: the major.minor of
// package.json and, as the third number, the number of git commits (e.g. 1.0.60). A newer commit
// gives a higher version, so installing a newer .deb upgrades the installed one instead of needing
// `apt install --reinstall`, and the start screen shows which build is running. Without git (a copy
// with no .git folder), the version in package.json is used.
// Usage: node scripts/package.mjs --linux | --win | --mac | --dir (passed on to electron-builder)
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
const [major, minor] = version.split('.')

let buildVersion = version
try {
	const commits = execFileSync('git', ['rev-list', '--count', 'HEAD'], {
		encoding: 'utf-8'
	}).trim()
	if (/^\d+$/.test(commits)) buildVersion = `${major}.${minor}.${commits}`
} catch {
	console.warn('git is not available: using the version in package.json')
}
console.log(`Packaging VidBase ${buildVersion}`)

// electron-builder's own command line, run with this Node (no shell, so it works the same on Windows)
const electronBuilder = createRequire(import.meta.url).resolve('electron-builder/cli.js')
const result = spawnSync(
	process.execPath,
	[electronBuilder, ...process.argv.slice(2), `-c.extraMetadata.version=${buildVersion}`],
	{ stdio: 'inherit' }
)
process.exit(result.status ?? 1)
