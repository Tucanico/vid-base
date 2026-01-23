declare module 'fluent-ffmpeg' {
	import { EventEmitter } from 'events'

	export interface FfprobeData {
		format?: {
			duration?: number
			[key: string]: unknown
		}
		[key: string]: unknown
	}

	export interface FfmpegCommand extends EventEmitter {
		seekInput(time: number | string): FfmpegCommand
		frames(count: number): FfmpegCommand
		outputOptions(options: string[]): FfmpegCommand
		output(path: string): FfmpegCommand
		on(event: 'end', callback: () => void): FfmpegCommand
		on(event: 'error', callback: (err: Error) => void): FfmpegCommand
		run(): void
		ffprobe(file: string, callback: (err: Error, metadata: FfprobeData) => void): void
	}

	export interface Ffmpeg {
		(file?: string): FfmpegCommand
		setFfmpegPath(path: string): void
		setFfprobePath(path: string): void
		ffprobe(file: string, callback: (err: Error, metadata: FfprobeData) => void): void
	}

	export namespace ffmpeg {
		export type FfprobeData = FfprobeData
	}

	const ffmpeg: Ffmpeg
	export default ffmpeg
}

