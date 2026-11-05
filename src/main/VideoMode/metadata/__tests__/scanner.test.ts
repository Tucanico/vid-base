import { describe, expect, it, vi } from 'vitest'
import { ExiftoolTags } from '../../../../shared/types/metadata'
import { parseTags, parseTagsWithFavorite, tagsFromMetadata } from '../scanner'

// The tag parsers need neither FFmpeg nor ExifTool; mocking them avoids loading the binaries
vi.mock('../thumbnails', () => ({ generateThumbnail: vi.fn() }))
vi.mock('../../../metadata/utils', () => ({ ourExiftool: {} }))

// The format updateTags.ts writes into the files' metadata, and the scanner reads back
describe('parseTagsWithFavorite', () => {
	it('parses simple and key:value tags', () => {
		expect(parseTagsWithFavorite('holidays; category:nature')).toEqual({
			tags: [
				{ type: 'simple', value: 'holidays', original: 'holidays' },
				{ type: 'kv', key: 'category', value: 'nature', original: 'category:nature' }
			],
			favourited: false
		})
	})

	it('reads the fav tag as the favourite flag, not as a tag', () => {
		const { tags, favourited } = parseTagsWithFavorite('holidays; FAV')
		expect(favourited).toBe(true)
		expect(tags.map((t) => t.value)).toEqual(['holidays'])
	})

	it('lowercases keys but keeps values as written', () => {
		const [tag] = parseTagsWithFavorite('Channel:My Channel').tags
		expect(tag).toMatchObject({ type: 'kv', key: 'channel', value: 'My Channel' })
	})

	it('keeps colons after the first one in the value', () => {
		const [tag] = parseTagsWithFavorite('production:Studio: Part 2').tags
		expect(tag).toMatchObject({ key: 'production', value: 'Studio: Part 2' })
	})

	it('splits on commas as well as semicolons and skips empty segments', () => {
		expect(parseTags('a, b;; c ;').map((t) => t.value)).toEqual(['a', 'b', 'c'])
	})

	it('returns no tags for an empty string', () => {
		expect(parseTagsWithFavorite('')).toEqual({ tags: [], favourited: false })
	})
})

// Where a new file's tags are read from: XMP dc:subject first, then the fields older versions wrote
describe('tagsFromMetadata', () => {
	const values = (meta: ExiftoolTags): string[] =>
		tagsFromMetadata(meta).tags.map((t) => t.original)

	it('reads each Subject item as a tag and "fav" as the favourite flag', () => {
		expect(tagsFromMetadata({ Subject: ['model:Anna Rossi', 'holiday', 'fav'] })).toEqual({
			rawTags: 'model:Anna Rossi; holiday; fav',
			tags: [
				{ type: 'kv', key: 'model', value: 'Anna Rossi', original: 'model:Anna Rossi' },
				{ type: 'simple', value: 'holiday', original: 'holiday' }
			],
			favourited: true
		})
	})

	it('drops the duplicates older versions wrote into Subject', () => {
		expect(values({ Subject: ['a', 'category:b', 'fav', 'a', 'category:b', 'fav'] })).toEqual([
			'a',
			'category:b'
		])
	})

	it('keeps a comma inside a Subject item in the tag', () => {
		expect(values({ Subject: ['production:Studio, Inc', 'beach'] })).toEqual([
			'production:Studio, Inc',
			'beach'
		])
	})

	it('reads a single item given as a plain value, and numbers', () => {
		expect(values({ Subject: 'holiday' })).toEqual(['holiday'])
		expect(values({ Subject: [2023, 'beach'] as unknown as string[] })).toEqual(['2023', 'beach'])
	})

	it('prefers Subject to the old fields', () => {
		expect(values({ Subject: ['a'], Category: 'b; c' })).toEqual(['a'])
	})

	it('falls back to the first old field with a value when Subject is empty', () => {
		expect(
			tagsFromMetadata({ Subject: [], Category: 'category:nature, fav', Keywords: ['x'] })
		).toEqual({
			rawTags: 'category:nature, fav',
			tags: [{ type: 'kv', key: 'category', value: 'nature', original: 'category:nature' }],
			favourited: true
		})
		expect(values({ Category: ' ', XPKeywords: 'a; b' })).toEqual(['a', 'b'])
		expect(values({ Keywords: ['x', 'y'], Description: 'z' })).toEqual(['x', 'y'])
		expect(values({ Description: 'a, b' })).toEqual(['a', 'b'])
	})

	it('returns no tags when no field has any', () => {
		expect(tagsFromMetadata({})).toEqual({ rawTags: '', tags: [], favourited: false })
	})
})
