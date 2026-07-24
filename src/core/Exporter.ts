import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"
import coreURL from "@ffmpeg/core?url"
import wasmURL from "@ffmpeg/core/wasm?url"
import JSZip from "jszip"
import { ArrayBufferTarget, Muxer } from "mp4-muxer"
import type { LogEvent } from "@ffmpeg/ffmpeg"
import type { AnimationSchema } from "../types/schema"
import type { SceneRenderer } from "./Renderer"

export type ExportFormat = "png_zip" | "mkv_ffv1" | "mp4_h264" | "mp4_h265" | "mp4_av1"
export type ExportMode = "direct" | "local_package"

export interface ExportOptions {
  format: ExportFormat
  mode?: ExportMode
  sourceFileName?: string
  onProgress?: ( current: number, total: number ) => void
  onCancel?: () => boolean
}

interface ExportPreset {
  label: string
  downloadName: string
  localPackageName?: string
  framePath: ( frameNum: string ) => string
  video?: {
    outputName: string
    mimeType: string
    ffmpegArgs: ( fps: number, inputPattern: string, outputName: string ) => string[]
    fallbackArgs?: ( fps: number, inputPattern: string, outputName: string ) => string[]
  }
  readme?: ( fps: number ) => string
  windowsScript?: ( fps: number ) => string
  unixScript?: ( fps: number ) => string
}

const VIDEO_INPUT_WINDOWS = "frames\\frame_%%04d.png"
const VIDEO_INPUT_UNIX = "frames/frame_%04d.png"
let ffmpegInstance: FFmpeg | null = null

function sanitizeFileBaseName( fileName: string | undefined ): string {
  const fallback = "animation"
  const withoutExtension = ( fileName ?? fallback ).replace( /\.[^./\\]+$/, "" )
  const sanitized = withoutExtension
    .replace( /[<>:"/\\|?*\u0000-\u001F]+/g, "_" )
    .replace( /\s+/g, "_" )
    .replace( /^_+|_+$/g, "" )

  return sanitized || fallback
}

function buildPreset( format: ExportFormat, sourceFileName?: string ): ExportPreset {
  const baseName = sanitizeFileBaseName( sourceFileName )

  switch ( format ) {
    case "mkv_ffv1":
      return {
        label: "Lossless MKV / FFV1",
        downloadName: `${ baseName }_mkv_ffv1.mkv`,
        localPackageName: `${ baseName }_mkv_ffv1_package.zip`,
        framePath: ( frameNum ) => `frames/frame_${ frameNum }.png`,
        video: {
          outputName: `${ baseName }_mkv_ffv1.mkv`,
          mimeType: "video/x-matroska",
          ffmpegArgs: ( fps, inputPattern, outputName ) => [
            "-framerate",
            String( fps ),
            "-start_number",
            "1",
            "-i",
            inputPattern,
            "-c:v",
            "ffv1",
            "-level",
            "3",
            "-pix_fmt",
            "rgba",
            outputName
          ]
        },
        readme: ( fps ) => videoReadme( "Lossless MKV / FFV1", fps, `${ baseName }_mkv_ffv1.mkv` ),
        windowsScript: ( fps ) =>
          [
            "@echo off",
            "setlocal",
            `ffmpeg -framerate ${ fps } -i "${ VIDEO_INPUT_WINDOWS }" -c:v ffv1 -level 3 -pix_fmt rgba "${ baseName }_mkv_ffv1.mkv"`,
            "pause"
          ].join( "\r\n" ),
        unixScript: ( fps ) =>
          [
            "#!/usr/bin/env sh",
            "set -eu",
            `ffmpeg -framerate ${ fps } -i "${ VIDEO_INPUT_UNIX }" -c:v ffv1 -level 3 -pix_fmt rgba "${ baseName }_mkv_ffv1.mkv"`
          ].join( "\n" )
      }
    case "mp4_h264":
      return {
        label: "MP4 / H.264",
        downloadName: `${ baseName }_mp4_h264.mp4`,
        localPackageName: `${ baseName }_mp4_h264_package.zip`,
        framePath: ( frameNum ) => `frames/frame_${ frameNum }.png`,
        video: {
          outputName: `${ baseName }_mp4_h264.mp4`,
          mimeType: "video/mp4",
          ffmpegArgs: ( fps, inputPattern, outputName ) => [
            "-framerate",
            String( fps ),
            "-start_number",
            "1",
            "-i",
            inputPattern,
            "-vf",
            "pad=ceil(iw/2)*2:ceil(ih/2)*2",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            outputName
          ],
          fallbackArgs: ( fps, inputPattern, outputName ) => [
            "-framerate",
            String( fps ),
            "-start_number",
            "1",
            "-i",
            inputPattern,
            "-vf",
            "pad=ceil(iw/2)*2:ceil(ih/2)*2",
            "-c:v",
            "mpeg4",
            "-q:v",
            "2",
            "-pix_fmt",
            "yuv420p",
            outputName
          ]
        },
        readme: ( fps ) => videoReadme( "MP4 / H.264", fps, `${ baseName }_mp4_h264.mp4` ),
        windowsScript: ( fps ) =>
          [
            "@echo off",
            "setlocal",
            `ffmpeg -framerate ${ fps } -i "${ VIDEO_INPUT_WINDOWS }" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "${ baseName }_mp4_h264.mp4"`,
            "pause"
          ].join( "\r\n" ),
        unixScript: ( fps ) =>
          [
            "#!/usr/bin/env sh",
            "set -eu",
            `ffmpeg -framerate ${ fps } -i "${ VIDEO_INPUT_UNIX }" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "${ baseName }_mp4_h264.mp4"`
          ].join( "\n" )
      }
    case "mp4_h265":
      return {
        label: "MP4 / H.265",
        downloadName: `${ baseName }_mp4_h265.mp4`,
        localPackageName: `${ baseName }_mp4_h265_package.zip`,
        framePath: ( frameNum ) => `frames/frame_${ frameNum }.png`,
        video: {
          outputName: `${ baseName }_mp4_h265.mp4`,
          mimeType: "video/mp4",
          ffmpegArgs: ( fps, inputPattern, outputName ) => [
            "-framerate",
            String( fps ),
            "-start_number",
            "1",
            "-i",
            inputPattern,
            "-vf",
            "pad=ceil(iw/2)*2:ceil(ih/2)*2",
            "-c:v",
            "libx265",
            "-preset",
            "ultrafast",
            "-crf",
            "20",
            "-tag:v",
            "hvc1",
            "-pix_fmt",
            "yuv420p",
            outputName
          ]
        },
        readme: ( fps ) => videoReadme( "MP4 / H.265", fps, `${ baseName }_mp4_h265.mp4` ),
        windowsScript: ( fps ) =>
          [
            "@echo off",
            "setlocal",
            `ffmpeg -framerate ${ fps } -i "${ VIDEO_INPUT_WINDOWS }" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx265 -preset slow -crf 20 -tag:v hvc1 -pix_fmt yuv420p "${ baseName }_mp4_h265.mp4"`,
            "pause"
          ].join( "\r\n" ),
        unixScript: ( fps ) =>
          [
            "#!/usr/bin/env sh",
            "set -eu",
            `ffmpeg -framerate ${ fps } -i "${ VIDEO_INPUT_UNIX }" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx265 -preset slow -crf 20 -tag:v hvc1 -pix_fmt yuv420p "${ baseName }_mp4_h265.mp4"`
          ].join( "\n" )
      }
    case "mp4_av1":
      return {
        label: "MP4 / AV1",
        downloadName: `${ baseName }_mp4_av1.mp4`,
        localPackageName: `${ baseName }_mp4_av1_package.zip`,
        framePath: ( frameNum ) => `frames/frame_${ frameNum }.png`,
        video: {
          outputName: `${ baseName }_mp4_av1.mp4`,
          mimeType: "video/mp4",
          ffmpegArgs: ( fps, inputPattern, outputName ) => [
            "-framerate",
            String( fps ),
            "-start_number",
            "1",
            "-i",
            inputPattern,
            "-vf",
            "pad=ceil(iw/2)*2:ceil(ih/2)*2",
            "-c:v",
            "libaom-av1",
            "-crf",
            "30",
            "-b:v",
            "0",
            "-cpu-used",
            "4",
            "-pix_fmt",
            "yuv420p",
            outputName
          ]
        },
        readme: ( fps ) => videoReadme( "MP4 / AV1", fps, `${ baseName }_mp4_av1.mp4` ),
        windowsScript: ( fps ) =>
          [
            "@echo off",
            "setlocal",
            `ffmpeg -framerate ${ fps } -i "${ VIDEO_INPUT_WINDOWS }" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libaom-av1 -crf 30 -b:v 0 -cpu-used 4 -pix_fmt yuv420p "${ baseName }_mp4_av1.mp4"`,
            "pause"
          ].join( "\r\n" ),
        unixScript: ( fps ) =>
          [
            "#!/usr/bin/env sh",
            "set -eu",
            `ffmpeg -framerate ${ fps } -i "${ VIDEO_INPUT_UNIX }" -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libaom-av1 -crf 30 -b:v 0 -cpu-used 4 -pix_fmt yuv420p "${ baseName }_mp4_av1.mp4"`
          ].join( "\n" )
      }
    case "png_zip":
    default:
      return {
        label: "PNG sequence",
        downloadName: `${ baseName }_png_sequence.zip`,
        framePath: ( frameNum ) => `frame_${ frameNum }.png`
      }
  }
}

function videoReadme( label: string, fps: number, outputName: string ): string {
  return [
    `# ${ label }`,
    "",
    "This package contains a PNG frame sequence rendered by mc_animator.",
    "Video encoding can be heavy in a browser, so this package keeps the source frames and provides local ffmpeg scripts.",
    "",
    "## Requirements",
    "",
    "- Install ffmpeg and make sure the `ffmpeg` command is available in your terminal.",
    "",
    "## Encode locally",
    "",
    "- Windows: run `encode_windows.bat`.",
    "- macOS / Linux: run `sh encode_unix.sh`.",
    "",
    "Equivalent command:",
    "",
    `ffmpeg -framerate ${ fps } -i "frames/frame_%04d.png" ${ ffmpegArgsForReadme( label ) } "${ outputName }"`,
    "",
    "## Notes",
    "",
    "- The PNG frames are the lossless source. Keep them if you may re-encode later.",
    "- FFV1/MKV is intended for lossless archival output.",
    "- H.264/H.265/AV1 MP4 outputs are practical delivery formats and do not preserve alpha transparency.",
    "- AV1 local encoding requires an ffmpeg build with an AV1 encoder such as libaom-av1."
  ].join( "\n" )
}

function ffmpegArgsForReadme( label: string ): string {
  if ( label.includes( "FFV1" ) ) return "-c:v ffv1 -level 3 -pix_fmt rgba"
  if ( label.includes( "AV1" ) ) {
    return '-vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libaom-av1 -crf 30 -b:v 0 -cpu-used 4 -pix_fmt yuv420p'
  }
  if ( label.includes( "H.265" ) ) {
    return '-vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx265 -preset slow -crf 20 -tag:v hvc1 -pix_fmt yuv420p'
  }
  return '-vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p'
}

async function getFFmpeg(): Promise< FFmpeg > {
  if ( ! ffmpegInstance ) ffmpegInstance = new FFmpeg()
  if ( ! ffmpegInstance.loaded ) {
    await ffmpegInstance.load( {
      coreURL,
      wasmURL
    } )
  }
  return ffmpegInstance
}

function downloadBlob( blob: Blob, downloadName: string ): void {
  const url = URL.createObjectURL( blob )
  const a = document.createElement( "a" )
  a.href = url
  a.download = downloadName
  a.click()
  URL.revokeObjectURL( url )
}

async function cleanupFFmpegDir( ffmpeg: FFmpeg, dir: string ): Promise< void > {
  try {
    const frames = await ffmpeg.listDir( `${ dir }/frames` )
    await Promise.all(
      frames
        .filter( ( entry ) => ! entry.isDir )
        .map( ( entry ) => ffmpeg.deleteFile( `${ dir }/frames/${ entry.name }` ) )
    )
    await ffmpeg.deleteDir( `${ dir }/frames` )
  } catch {
    // Best-effort cleanup only. The next export uses a unique directory.
  }

  try {
    const entries = await ffmpeg.listDir( dir )
    await Promise.all(
      entries.filter( ( entry ) => ! entry.isDir ).map( ( entry ) => ffmpeg.deleteFile( `${ dir }/${ entry.name }` ) )
    )
    await ffmpeg.deleteDir( dir )
  } catch {
    // Best-effort cleanup only.
  }
}

async function execWithLogs( ffmpeg: FFmpeg, args: string[], label: string ): Promise< void > {
  const logs: string[] = []
  const onLog = ( event: LogEvent ) => {
    logs.push( event.message )
    if ( logs.length > 20 ) logs.shift()
  }

  ffmpeg.on( "log", onLog )
  try {
    const exitCode = await ffmpeg.exec( args, 0 )
    if ( exitCode !== 0 ) {
      const detail = logs.length > 0 ? `\n\nffmpeg log:\n${ logs.join( "\n" ) }` : ""
      throw new Error( `${ label } encoding failed with ffmpeg exit code ${ exitCode }.${ detail }` )
    }
  } finally {
    ffmpeg.off( "log", onLog )
  }
}

export async function exportAnimation(
  schema: AnimationSchema,
  renderer: SceneRenderer,
  options: ExportOptions
): Promise< void > {
  const { fps, ticks_per_second, duration_ticks } = schema.metadata
  const totalFrames = Math.ceil( ( duration_ticks * fps ) / ticks_per_second )
  const ticksPerFrame = ticks_per_second / fps

  const zip = new JSZip()
  const preset = buildPreset( options.format, options.sourceFileName )
  const useLocalPackage = options.mode === "local_package" && preset.video

  if ( preset.video && ! useLocalPackage ) {
    if ( options.format === "mp4_h264" ) {
      await exportH264Mp4WithWebCodecs( schema, renderer, preset, totalFrames, ticksPerFrame, options )
      return
    }
    if ( options.format === "mp4_h265" ) {
      await exportH265Mp4WithWebCodecs( schema, renderer, preset, totalFrames, ticksPerFrame, options )
      return
    }
    if ( options.format === "mp4_av1" ) {
      await exportAV1Mp4WithWebCodecs( schema, renderer, preset, totalFrames, ticksPerFrame, options )
      return
    }
    await exportEncodedVideo( schema, renderer, preset, totalFrames, ticksPerFrame, options )
    return
  }

  for ( let frame = 0; frame < totalFrames; frame++ ) {
    if ( options.onCancel?.() ) return

    const tick = frame * ticksPerFrame
    const blob = await renderer.renderFrameBlob( tick )

    const frameNum = String( frame + 1 ).padStart( 4, "0" )
    zip.file( preset.framePath( frameNum ), blob )

    options.onProgress?.( frame + 1, totalFrames )
  }

  if ( preset.readme ) zip.file( "README.txt", preset.readme( fps ) )
  if ( preset.windowsScript ) zip.file( "encode_windows.bat", preset.windowsScript( fps ) )
  if ( preset.unixScript ) zip.file( "encode_unix.sh", preset.unixScript( fps ) )

  const zipBlob = await zip.generateAsync( { type: "blob" } )
  downloadBlob( zipBlob, useLocalPackage ? ( preset.localPackageName ?? preset.downloadName ) : preset.downloadName )
}

async function exportH264Mp4WithWebCodecs(
  schema: AnimationSchema,
  renderer: SceneRenderer,
  preset: ExportPreset,
  totalFrames: number,
  ticksPerFrame: number,
  options: ExportOptions
): Promise< void > {
  if ( ! ( "VideoEncoder" in window ) || ! ( "VideoFrame" in window ) ) {
    throw new Error( "このブラウザは WebCodecs に対応していないため、H.264 MP4 を直接エンコードできません。" )
  }

  const { fps, resolution } = schema.metadata
  const [ width, height ] = resolution
  const bitrate = Math.max( 1_000_000, Math.round( width * height * fps * 0.07 ) )
  const support = await findSupportedH264Config( width, height, fps, bitrate )
  if ( ! support ) {
    throw new Error( "このブラウザは現在の設定で H.264 WebCodecs エンコードに対応していません。" )
  }

  await exportMp4WithWebCodecs( {
    codec: "avc",
    mimeType: "video/mp4",
    downloadName: preset.downloadName,
    renderer,
    totalFrames,
    ticksPerFrame,
    options,
    width,
    height,
    fps,
    config: support.config
  } )
}

async function exportH265Mp4WithWebCodecs(
  schema: AnimationSchema,
  renderer: SceneRenderer,
  preset: ExportPreset,
  totalFrames: number,
  ticksPerFrame: number,
  options: ExportOptions
): Promise< void > {
  if ( ! ( "VideoEncoder" in window ) || ! ( "VideoFrame" in window ) ) {
    throw new Error( "このブラウザは WebCodecs に対応していないため、H.265 MP4 を直接エンコードできません。" )
  }

  const { fps, resolution } = schema.metadata
  const [ width, height ] = resolution
  const bitrate = Math.max( 800_000, Math.round( width * height * fps * 0.045 ) )
  const support = await findSupportedH265Config( width, height, fps, bitrate )
  if ( ! support ) {
    throw new Error(
      "このブラウザは現在の設定で H.265 WebCodecs エンコードに対応していません。H.265 は環境依存が強いため、PNGシーケンスからローカル ffmpeg で変換してください。"
    )
  }

  await exportMp4WithWebCodecs( {
    codec: "hevc",
    mimeType: "video/mp4",
    downloadName: preset.downloadName,
    renderer,
    totalFrames,
    ticksPerFrame,
    options,
    width,
    height,
    fps,
    config: support.config
  } )
}

async function exportAV1Mp4WithWebCodecs(
  schema: AnimationSchema,
  renderer: SceneRenderer,
  preset: ExportPreset,
  totalFrames: number,
  ticksPerFrame: number,
  options: ExportOptions
): Promise< void > {
  if ( ! ( "VideoEncoder" in window ) || ! ( "VideoFrame" in window ) ) {
    throw new Error( "このブラウザは WebCodecs に対応していないため、AV1 MP4 を直接エンコードできません。" )
  }

  const { fps, resolution } = schema.metadata
  const [ width, height ] = resolution
  const bitrate = Math.max( 600_000, Math.round( width * height * fps * 0.035 ) )
  const support = await findSupportedAV1Config( width, height, fps, bitrate )
  if ( ! support ) {
    throw new Error(
      "このブラウザは現在の設定で AV1 WebCodecs エンコードに対応していません。PNGシーケンスからローカル ffmpeg で変換してください。"
    )
  }

  await exportMp4WithWebCodecs( {
    codec: "av1",
    mimeType: "video/mp4",
    downloadName: preset.downloadName,
    renderer,
    totalFrames,
    ticksPerFrame,
    options,
    width,
    height,
    fps,
    config: support.config
  } )
}

interface WebCodecsMp4ExportOptions {
  codec: "avc" | "hevc" | "av1"
  mimeType: string
  downloadName: string
  renderer: SceneRenderer
  totalFrames: number
  ticksPerFrame: number
  options: ExportOptions
  width: number
  height: number
  fps: number
  config: VideoEncoderConfig
}

async function exportMp4WithWebCodecs( params: WebCodecsMp4ExportOptions ): Promise< void > {
  const target = new ArrayBufferTarget()
  const muxer = new Muxer( {
    target,
    video: {
      codec: params.codec,
      width: params.width,
      height: params.height,
      frameRate: params.fps
    },
    fastStart: "in-memory"
  } )

  let rejectEncoderError: ( error: Error ) => void = () => {}
  const encoderError = new Promise< never >( ( _, reject ) => {
    rejectEncoderError = reject
  } )
  const encoder = new VideoEncoder( {
    output: ( chunk, meta ) => muxer.addVideoChunk( chunk, meta ),
    error: ( error ) => {
      rejectEncoderError( error instanceof Error ? error : new Error( String( error ) ) )
    }
  } )

  encoder.configure( params.config )

  try {
    const frameDuration = Math.round( 1_000_000 / params.fps )
    const keyFrameInterval = Math.max( 1, Math.round( params.fps ) )

    for ( let frame = 0; frame < params.totalFrames; frame++ ) {
      if ( params.options.onCancel?.() ) return

      const tick = frame * params.ticksPerFrame
      await params.renderer.renderFrameBlob( tick )

      const videoFrame = new VideoFrame( params.renderer.renderer.domElement, {
        timestamp: frame * frameDuration,
        duration: frameDuration
      } )

      encoder.encode( videoFrame, { keyFrame: frame % keyFrameInterval === 0 } )
      videoFrame.close()

      params.options.onProgress?.( frame + 1, params.totalFrames )
    }

    await Promise.race( [ encoder.flush(), encoderError ] )
    muxer.finalize()

    downloadBlob( new Blob( [ target.buffer ], { type: params.mimeType } ), params.downloadName )
  } finally {
    encoder.close()
  }
}

interface SupportedH264Config {
  config: VideoEncoderConfig
}

async function findSupportedH264Config(
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise< SupportedH264Config | null > {
  const codecCandidates = [
    "avc1.64002A", // High Profile, Level 4.2: suitable for 1080p60.
    "avc1.640028", // High Profile, Level 4.0.
    "avc1.4D402A", // Main Profile, Level 4.2.
    "avc1.4D4028", // Main Profile, Level 4.0.
    "avc1.42E02A", // Baseline Profile, Level 4.2.
    "avc1.42E01E" // Baseline Profile, Level 3.0.
  ]

  for ( const codec of codecCandidates ) {
    const support = await VideoEncoder.isConfigSupported( {
      codec,
      width,
      height,
      framerate: fps,
      bitrate,
      hardwareAcceleration: "prefer-hardware",
      avc: { format: "avc" }
    } )

    if ( support.supported && support.config ) return { config: support.config }
  }

  return null
}

async function findSupportedH265Config(
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise< SupportedH264Config | null > {
  const codecCandidates = [
    "hvc1.1.6.L153.B0", // Main Profile, Level 5.1.
    "hvc1.1.6.L150.B0", // Main Profile, Level 5.0.
    "hvc1.1.6.L123.B0", // Main Profile, Level 4.1.
    "hvc1.1.6.L120.B0", // Main Profile, Level 4.0.
    "hev1.1.6.L153.B0",
    "hev1.1.6.L150.B0",
    "hev1.1.6.L123.B0",
    "hev1.1.6.L120.B0"
  ]

  for ( const codec of codecCandidates ) {
    const support = await VideoEncoder.isConfigSupported( {
      codec,
      width,
      height,
      framerate: fps,
      bitrate,
      hardwareAcceleration: "prefer-hardware"
    } )

    if ( support.supported && support.config ) return { config: support.config }
  }

  return null
}

async function findSupportedAV1Config(
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise< SupportedH264Config | null > {
  const codecCandidates = [ "av01.0.13M.08", "av01.0.12M.08", "av01.0.09M.08", "av01.0.08M.08", "av01.0.05M.08" ]

  for ( const codec of codecCandidates ) {
    const support = await VideoEncoder.isConfigSupported( {
      codec,
      width,
      height,
      framerate: fps,
      bitrate,
      hardwareAcceleration: "prefer-hardware"
    } )

    if ( support.supported && support.config ) return { config: support.config }
  }

  return null
}

async function exportEncodedVideo(
  schema: AnimationSchema,
  renderer: SceneRenderer,
  preset: ExportPreset,
  totalFrames: number,
  ticksPerFrame: number,
  options: ExportOptions
): Promise< void > {
  if ( ! preset.video ) return

  const { fps } = schema.metadata
  const ffmpeg = await getFFmpeg()
  const workDir = `export_${ Date.now() }_${ Math.round( Math.random() * 100000 ) }`
  const framesDir = `${ workDir }/frames`
  const outputPath = `${ workDir }/${ preset.video.outputName }`

  await ffmpeg.createDir( workDir )
  await ffmpeg.createDir( framesDir )

  try {
    for ( let frame = 0; frame < totalFrames; frame++ ) {
      if ( options.onCancel?.() ) return

      const tick = frame * ticksPerFrame
      const blob = await renderer.renderFrameBlob( tick )
      const frameNum = String( frame + 1 ).padStart( 4, "0" )
      await ffmpeg.writeFile( `${ framesDir }/frame_${ frameNum }.png`, await fetchFile( blob ) )

      options.onProgress?.( frame + 1, totalFrames )
    }

    if ( options.onCancel?.() ) return

    const inputPattern = `${ framesDir }/frame_%04d.png`
    try {
      await execWithLogs( ffmpeg, preset.video.ffmpegArgs( fps, inputPattern, outputPath ), preset.label )
    } catch ( error ) {
      if ( ! preset.video.fallbackArgs ) throw error
      console.warn( error )
      await execWithLogs(
        ffmpeg,
        preset.video.fallbackArgs( fps, inputPattern, outputPath ),
        `${ preset.label } fallback`
      )
    }

    const data = await ffmpeg.readFile( outputPath )
    if ( typeof data === "string" ) {
      throw new Error( `${ preset.label } encoding returned unexpected text output.` )
    }

    const bytes = new Uint8Array( data.byteLength )
    bytes.set( data )
    downloadBlob( new Blob( [ bytes.buffer ], { type: preset.video.mimeType } ), preset.downloadName )
  } finally {
    await cleanupFFmpegDir( ffmpeg, workDir )
  }
}
