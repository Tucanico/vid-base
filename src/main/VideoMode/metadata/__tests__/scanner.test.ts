import { describe, expect, it, vi } from 'vitest'
import { parseTags, parseTagsWithFavorite } from '../scanner'

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
