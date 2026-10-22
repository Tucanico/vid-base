/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */
const fs = require('fs')
const path = require('path')

function printUsage() {
	console.log(
		'Usage: node merge-libraries.js [-o output.json] <library1.json> <library2.json> [...]\n'
	)
	console.log('Example:')
	console.log(
		'  node merge-libraries.js -o merged-library.json D:\\Videos\\library.json E:\\Videos\\library.json'
	)
	console.log('\nDefault output: ./library.json')
}

function readLibrary(filePath) {
	const raw = fs.readFileSync(filePath, 'utf-8')
	const parsed = JSON.parse(raw)
	if (
		!parsed ||
		!Array.isArray(parsed.files) ||
		typeof parsed.categories !== 'object' ||
		parsed.categories === null ||
		!Array.isArray(parsed.tags)
	) {
		throw new Error(`Invalid library format: ${filePath}`)
	}
	return parsed
}

function normalizePath(p) {
	return path.resolve(p)
}

function mergeLibraries(inputFiles) {
	const files = []
	const filesById = new Map()
	const categories = {}
	const tagsSet = new Set()

	for (const filePath of inputFiles) {
		const lib = readLibrary(filePath)

		for (const file of lib.files) {
			if (!file || !file.id) continue
			if (filesById.has(file.id)) {
				const existing = filesById.get(file.id)
				if (existing && existing.filePath !== file.filePath) {
					console.warn(
						`Warning: duplicate id ${file.id} with different paths:\n` +
							`  kept: ${existing.filePath}\n` +
							`  skip: ${file.filePath}`
					)
				}
				continue
			}
			// The relative paths are relative to each input library's own folder, so they would point to
			// the wrong place in the merged library; without them VidBase works from the absolute paths
			const entry = { ...file }
			delete entry.relativePath
			delete entry.relativeThumbnailPath
			filesById.set(file.id, entry)
			files.push(entry)
		}

		for (const [key, values] of Object.entries(lib.categories)) {
			if (!Array.isArray(values)) continue
			if (!categories[key]) categories[key] = new Set()
			for (const value of values) {
				categories[key].add(value)
			}
		}

		for (const tag of lib.tags) {
			tagsSet.add(tag)
		}
	}

	const mergedCategories = {}
	for (const [key, valueSet] of Object.entries(categories)) {
		mergedCategories[key] = Array.from(valueSet).sort()
	}

	return {
		files,
		categories: mergedCategories,
		tags: Array.from(tagsSet).sort()
	}
}

function parseArgs(argv) {
	const args = [...argv]
	let outputPath = null
	const inputs = []

	while (args.length > 0) {
		const arg = args.shift()
		if (arg === '-o' || arg === '--out') {
			outputPath = args.shift() || null
		} else {
			inputs.push(arg)
		}
	}

	return { outputPath, inputs }
}

function main() {
	const { outputPath, inputs } = parseArgs(process.argv.slice(2))
	if (inputs.length < 2) {
		printUsage()
		process.exit(1)
	}

	const normalizedInputs = inputs.map(normalizePath)
	const merged = mergeLibraries(normalizedInputs)

	const outPath = normalizePath(outputPath || 'library.json')
	fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf-8')
	console.log(`Merged ${inputs.length} libraries into ${outPath}`)
	console.log(`Files: ${merged.files.length}`)
	console.log(`Categories: ${Object.keys(merged.categories).length}`)
	console.log(`Tags: ${merged.tags.length}`)
}

main()
