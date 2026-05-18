import { computed, ref } from 'vue'

export const LANGUAGE_OPTIONS = [
  { key: 'ja', labelKey: 'language.ja' },
  { key: 'en', labelKey: 'language.en' },
] as const

export type LanguageKey = typeof LANGUAGE_OPTIONS[number]['key']
export type I18nParams = Record<string, string | number>

const language = ref<LanguageKey>('ja')

const messages = {
  ja: {
    'language.label': 'Language',
    'language.ja': '日本語',
    'language.en': 'English',
    'toolbar.loadJson': 'JSON を読み込む',
    'toolbar.resourcePack': 'リソースパック',
    'metadata.title': 'メタデータ',
    'metadata.mcVersion': 'MC バージョン',
    'metadata.resolutionW': '解像度 W',
    'metadata.resolutionH': '解像度 H',
    'metadata.totalTicks': '総 tick 数',
    'metadata.totalFrames': '総フレーム数',
    'metadata.frameLimitExceeded': '上限超過',
    'metadata.backgroundColor': '背景色 (ARGB)',
    'metadata.showGizmo': 'Gizmo を表示',
    'metadata.originX': '起点 X',
    'metadata.originY': '起点 Y',
    'metadata.loadJsonPrompt': 'JSON を読み込んでください',
    'camera.title': 'カメラ',
    'camera.empty': 'カメラが定義されていません',
    'objects.title': 'オブジェクト',
    'objects.empty': 'オブジェクトがありません',
    'preview.placeholder': 'JSON を読み込むとここにプレビューが表示されます',
    'timeline.start': '先頭',
    'timeline.end': '末尾',
    'export.format': '出力形式',
    'export.mode.pngZip': 'PNG ZIP',
    'export.mode.direct': '直接動画',
    'export.mode.local': 'ローカル変換',
    'export.format.pngZip': 'PNG シーケンス + ZIP',
    'export.format.mkv': 'ロスレス MKV / FFV1',
    'export.renderStart': 'レンダリング開始',
    'export.outputMethod': '出力方法',
    'export.downloadVideo': '動画として直接ダウンロード',
    'export.localPackage': 'PNG連番 + ffmpegスクリプト',
    'export.frames': 'フレーム',
    'export.cancel': 'キャンセル',
    'export.failed': 'エクスポートに失敗しました。',
    'validation.rootObject': 'JSONのルートはオブジェクトである必要があります',
    'validation.metadataMissing': 'metadata フィールドがありません',
    'validation.metadataKeyMissing': 'metadata.{key} が見つかりません',
    'validation.resolutionInvalid': 'metadata.resolution は [width, height] の数値配列である必要があります',
    'validation.backgroundColorInvalid': 'background_color は #AARRGGBB 形式で指定してください（例: #FF1A1A2E）',
    'validation.gizmoInvalid': 'metadata.gizmo はオブジェクトで指定してください',
    'validation.gizmoVisibleInvalid': 'metadata.gizmo.visible は true または false で指定してください',
    'validation.gizmoOriginInvalid': 'metadata.gizmo.origin は [x, y] の数値配列で指定してください',
    'validation.frameLimitExceeded': 'フレーム数 {totalFrames} は上限 {maxFrames} を超えています（duration_ticks または fps を下げてください）',
    'validation.objectsArray': 'objects フィールドは配列である必要があります',
    'validation.objectIdMissing': '{prefix}.id が未定義または空文字です',
    'validation.objectIdDuplicate': 'id "{id}" が重複しています',
    'validation.objectTypeInvalid': '"{id}": type は "block" または "camera" である必要があります',
    'validation.keyframesMissing': 'オブジェクト "{id}" にキーフレームがありません',
    'validation.easingInvalid': '"{id}" の keyframes[{index}].easing は {easings} のいずれかで指定してください',
    'validation.multiplierInvalid': '"{id}" の keyframes[{index}].multiplier は 0 以上の数値で指定してください',
    'validation.activeCameraMissing': 'active_camera "{activeCam}" が objects に見つかりません',
    'validation.noCamera': 'カメラオブジェクトが定義されていません。デフォルトカメラを使用します',
    'validation.defaultCameraMissing': 'active_camera が未指定で "{defaultCameraId}" も見つかりません。最初のカメラを使用します',
  },
  en: {
    'language.label': 'Language',
    'language.ja': 'Japanese',
    'language.en': 'English',
    'toolbar.loadJson': 'Load JSON',
    'toolbar.resourcePack': 'Resource pack',
    'metadata.title': 'Metadata',
    'metadata.mcVersion': 'MC version',
    'metadata.resolutionW': 'Resolution W',
    'metadata.resolutionH': 'Resolution H',
    'metadata.totalTicks': 'Total ticks',
    'metadata.totalFrames': 'Total frames',
    'metadata.frameLimitExceeded': 'Limit exceeded',
    'metadata.backgroundColor': 'Background (ARGB)',
    'metadata.showGizmo': 'Show gizmo',
    'metadata.originX': 'Origin X',
    'metadata.originY': 'Origin Y',
    'metadata.loadJsonPrompt': 'Load a JSON file',
    'camera.title': 'Camera',
    'camera.empty': 'No cameras defined',
    'objects.title': 'Objects',
    'objects.empty': 'No objects',
    'preview.placeholder': 'Load a JSON file to show the preview here',
    'timeline.start': 'Start',
    'timeline.end': 'End',
    'export.format': 'Format',
    'export.mode.pngZip': 'PNG ZIP',
    'export.mode.direct': 'Direct video',
    'export.mode.local': 'Local conversion',
    'export.format.pngZip': 'PNG sequence + ZIP',
    'export.format.mkv': 'Lossless MKV / FFV1',
    'export.renderStart': 'Start rendering',
    'export.outputMethod': 'Output method',
    'export.downloadVideo': 'Download video directly',
    'export.localPackage': 'PNG sequence + ffmpeg scripts',
    'export.frames': 'frames',
    'export.cancel': 'Cancel',
    'export.failed': 'Export failed.',
    'validation.rootObject': 'The JSON root must be an object',
    'validation.metadataMissing': 'metadata field is missing',
    'validation.metadataKeyMissing': 'metadata.{key} is missing',
    'validation.resolutionInvalid': 'metadata.resolution must be a numeric [width, height] array',
    'validation.backgroundColorInvalid': 'background_color must use #AARRGGBB format, for example #FF1A1A2E',
    'validation.gizmoInvalid': 'metadata.gizmo must be an object',
    'validation.gizmoVisibleInvalid': 'metadata.gizmo.visible must be true or false',
    'validation.gizmoOriginInvalid': 'metadata.gizmo.origin must be a numeric [x, y] array',
    'validation.frameLimitExceeded': 'Frame count {totalFrames} exceeds the {maxFrames} limit. Lower duration_ticks or fps.',
    'validation.objectsArray': 'objects field must be an array',
    'validation.objectIdMissing': '{prefix}.id is missing or empty',
    'validation.objectIdDuplicate': 'id "{id}" is duplicated',
    'validation.objectTypeInvalid': '"{id}": type must be "block" or "camera"',
    'validation.keyframesMissing': 'Object "{id}" has no keyframes',
    'validation.easingInvalid': '"{id}" keyframes[{index}].easing must be one of: {easings}',
    'validation.multiplierInvalid': '"{id}" keyframes[{index}].multiplier must be a number greater than or equal to 0',
    'validation.activeCameraMissing': 'active_camera "{activeCam}" was not found in objects',
    'validation.noCamera': 'No camera object is defined. The default camera will be used.',
    'validation.defaultCameraMissing': 'active_camera is omitted and "{defaultCameraId}" was not found. The first camera will be used.',
  },
} as const

export type MessageKey = keyof typeof messages.ja

function format(template: string, params?: I18nParams) {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`))
}

export function translate(key: MessageKey, params?: I18nParams, lang: LanguageKey = language.value) {
  return format(messages[lang][key] ?? messages.ja[key] ?? key, params)
}

export function useI18n() {
  const currentLanguage = computed({
    get: () => language.value,
    set: (value: LanguageKey) => {
      language.value = value
    },
  })

  return {
    language: currentLanguage,
    languageOptions: LANGUAGE_OPTIONS,
    t: translate,
  }
}
