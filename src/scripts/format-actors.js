const ExcelJS = require('exceljs')
const path = require('path')

function normalizeActorName(raw) {
	const trimmed = String(raw || '').trim()
	if (!trimmed) return ''
	if (!trimmed.includes(',')) return trimmed
	const parts = trimmed.split(',')
	if (parts.length < 2) return trimmed
	const lastName = parts[0].trim()
	const firstName = parts.slice(1).join(',').trim()
	if (!lastName || !firstName) return trimmed
	return `${firstName} ${lastName}`.trim()
}

function normalizeActorsCell(value) {
	const raw = String(value || '').trim()
	if (!raw) return ''

	// Split on "/" or ";" (keep commas for "Surname, Name")
	const segments = raw
		.split(/[;/]/)
		.map((segment) => segment.trim())
		.filter(Boolean)

	const normalized = segments.map((segment) => normalizeActorName(segment)).filter(Boolean)
	return normalized.join(', ')
}

async function formatActorsColumn(filePath) {
	const workbook = new ExcelJS.Workbook()
	await workbook.xlsx.readFile(filePath)
	const worksheet = workbook.worksheets[0]

	if (!worksheet) {
		throw new Error('No worksheet found in Excel file')
	}

	// Find header row (supports optional title row)
	let headerRowNumber = -1
	const maxHeaderSearch = Math.min(10, worksheet.rowCount)
	for (let i = 1; i <= maxHeaderSearch; i++) {
		const rowValues = worksheet.getRow(i).values || []
		const rowStrings = rowValues.map((v) =>
			String(v ?? '')
				.trim()
				.toUpperCase()
		)
		if (rowStrings.includes('TITOLO') && rowStrings.includes('REGISTA')) {
			headerRowNumber = i
			break
		}
	}

	if (headerRowNumber === -1) {
		throw new Error('Could not find header row (TITOLO/REGISTA) in Excel file')
	}

	const headerRow = worksheet.getRow(headerRowNumber)
	const headerValues = headerRow.values || []
	let actorsCol = -1
	for (let i = 1; i < headerValues.length; i++) {
		const key = String(headerValues[i] ?? '')
			.trim()
			.toUpperCase()
		if (key === 'ATTORI RILEVANTI' || key === 'ATTORI') {
			actorsCol = i
			break
		}
	}

	if (actorsCol === -1) {
		throw new Error('Could not find ATTORI RILEVANTI (or ATTORI) column')
	}

	let updatedCount = 0
	for (let i = headerRowNumber + 1; i <= worksheet.rowCount; i++) {
		const row = worksheet.getRow(i)
		const cell = row.getCell(actorsCol)
		const original = String(cell.value ?? '').trim()
		if (!original) continue

		const normalized = normalizeActorsCell(original)
		if (normalized && normalized !== original) {
			cell.value = normalized
			updatedCount += 1
		}
	}

	await workbook.xlsx.writeFile(filePath)
	return updatedCount
}

async function main() {
	const fileArg = process.argv[2]
	if (!fileArg) {
		console.error('Usage: node src/scripts/format-actors.js "path\\to\\file.xlsx"')
		process.exit(1)
	}

	const filePath = path.resolve(fileArg)
	try {
		const updatedCount = await formatActorsColumn(filePath)
		console.log(`Updated ${updatedCount} row(s) in ATTORI RILEVANTI.`)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error(`Error formatting ATTORI RILEVANTI: ${message}`)
		process.exit(1)
	}
}

main()
