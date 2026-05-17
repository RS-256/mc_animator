/**
 * BlockTexture.ts
 *
 * Minecraft のモデルパイプラインに従いブロックのマテリアルを構築する。
 *
 * パイプライン:
 *   1. blockstates/{block}.json を取得 → state に合う variant/model を選択
 *   2. models/{model}.json を再帰的に取得（parent 継承）
 *   3. テクスチャ変数（"#side" 等）を解決して実パスを得る
 *   4. 各面に Three.js マテリアルを割り当てる
 *
 * 初期実装は full-cube（cube / cube_all / cube_column / cube_directional 等）のみ対応。
 */

import * as THREE from 'three'
import type { BlockState } from '../types/schema'
import type { IAssetLoader } from './TextureLoader'
import { MISSING_TEXTURE } from './TextureLoader'

// ── Minecraft JSON 型 ─────────────────────────────────────────────

interface BlockstatesVariant {
  model: string
  x?: number  // 0 | 90 | 180 | 270
  y?: number
  uvlock?: boolean
}

interface BlockstatesJson {
  variants?: Record<string, BlockstatesVariant | BlockstatesVariant[]>
  multipart?: unknown  // 初期実装では未対応
}

interface ModelElement {
  from: [number, number, number]
  to: [number, number, number]
  faces?: Record<string, { texture: string; cullface?: string; uv?: [number, number, number, number]; rotation?: number }>
}

interface ModelJson {
  parent?: string
  textures?: Record<string, string>
  elements?: ModelElement[]
}

// ── Three.js の BoxGeometry 面順 ──────────────────────────────────
// BoxGeometry の materialIndex 順: +X(east), -X(west), +Y(up), -Y(down), +Z(south), -Z(north)
const BOX_FACES = ['east', 'west', 'up', 'down', 'south', 'north'] as const
type BoxFace = (typeof BOX_FACES)[number]

interface FaceTextureInfo {
  texture: string
  uv?: [number, number, number, number]
  rotation?: number
}
// ── モデル JSON の再帰取得（parent 継承） ─────────────────────────

async function fetchModelMerged(
  modelPath: string,
  loader: IAssetLoader,
  depth = 0,
): Promise<ModelJson> {
  if (depth > 8) return {}

  // "minecraft:block/stone" → "assets/minecraft/models/block/stone.json"
  const normalized = modelPath.replace(/^minecraft:/, '')
  const jsonPath = `assets/minecraft/models/${normalized}.json`

  const data = (await loader.loadJson(jsonPath)) as ModelJson | null
  if (!data) return {}

  if (!data.parent) return data

  // parent をマージ（子が優先）
  const parent = await fetchModelMerged(data.parent, loader, depth + 1)
  return {
    elements: data.elements ?? parent.elements,
    textures: { ...(parent.textures ?? {}), ...(data.textures ?? {}) },
  }
}

// ── テクスチャ変数の解決 ──────────────────────────────────────────
// "#particle" や "#side" のような変数を実パスに展開する

function resolveTexVar(val: string, textures: Record<string, string>, depth = 0): string {
  if (!val.startsWith('#') || depth > 8) return val
  const key = val.slice(1)
  const next = textures[key]
  if (!next) return val
  return resolveTexVar(next, textures, depth + 1)
}

// ── blockstates の state 文字列を生成 ────────────────────────────
// e.g. { facing: 'north', powered: 'false' } → "facing=north,powered=false"

function buildStateStr(state: BlockState): string {
  return Object.entries(state)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',')
}

function parseStateKey(key: string): Record<string, string> {
  if (!key) return {}
  return Object.fromEntries(
    key.split(',').map(kv => {
      const [k, v] = kv.split('=')
      return [k, v]
    }),
  )
}

// blockstates の variants キーはサブセットでもマッチする場合がある
// 例: "facing=north" が "facing=north,powered=false" にマッチ
function findVariant(
  variants: Record<string, BlockstatesVariant | BlockstatesVariant[]>,
  state: BlockState,
): BlockstatesVariant | null {
  const fullStr = buildStateStr(state)

  // 完全一致
  if (variants[fullStr]) {
    const v = variants[fullStr]
    return Array.isArray(v) ? v[0] : v
  }

  // "" キー（全状態共通）
  if (variants['']) {
    const v = variants['']
    return Array.isArray(v) ? v[0] : v
  }

  // 部分一致: variants のキーが state のサブセットであればマッチ
  for (const [key, variant] of Object.entries(variants)) {
    if (key === '') continue
    const variantState = parseStateKey(key)
    const matches = Object.entries(variantState).every(([k, v]) => state[k] === v)
    if (matches) {
      return Array.isArray(variant) ? variant[0] : variant
    }
  }

  // 互換一致: state 側で指定された値が variant と矛盾しない候補から、
  // 最も多くの指定値に一致する variant を選ぶ。
  // 例: piston は extended が未指定でも facing=east の候補を選びたい。
  let bestVariant: BlockstatesVariant | BlockstatesVariant[] | null = null
  let bestScore = 0
  for (const [key, variant] of Object.entries(variants)) {
    if (key === '') continue
    const variantState = parseStateKey(key)
    let score = 0
    let compatible = true

    for (const [k, v] of Object.entries(state)) {
      if (variantState[k] === undefined) continue
      if (variantState[k] !== v) {
        compatible = false
        break
      }
      score++
    }

    if (compatible && score > bestScore) {
      bestVariant = variant
      bestScore = score
    }
  }
  if (bestVariant) {
    return Array.isArray(bestVariant) ? bestVariant[0] : bestVariant
  }

  // state に対応するキーが見つからない場合は最初のエントリを使う
  const first = Object.values(variants)[0]
  if (first) return Array.isArray(first) ? first[0] : first

  return null
}

// ── cube 系モデルの面テクスチャ解決 ──────────────────────────────
// モデルの elements.faces から各方向のテクスチャ変数を取り出す。
// この時点では回転は適用しない（後段の rotateFaceMap で行う）。

// Minecraft の面名 → BoxFace の対応（up/down はそのまま、top/bottom は変換）
const MC_FACE_TO_BOX: Record<string, BoxFace> = {
  north: 'north',
  south: 'south',
  east: 'east',
  west: 'west',
  up: 'up',
  down: 'down',
}

function buildFaceMapFromModel(
  model: ModelJson,
): Partial<Record<BoxFace, FaceTextureInfo>> | null {
  const textures = model.textures ?? {}

  // elements ベースの解決
  if (model.elements && model.elements.length > 0) {
    const result: Partial<Record<BoxFace, FaceTextureInfo>> = {}
    for (const el of model.elements) {
      if (!el.faces) continue
      for (const [face, faceData] of Object.entries(el.faces)) {
        const boxFace = MC_FACE_TO_BOX[face]
        if (boxFace && !result[boxFace]) {
          result[boxFace] = {
            texture: resolveTexVar(faceData.texture, textures),
            uv: faceData.uv,
            rotation: faceData.rotation,
          }
        }
      }
    }
    // 全6面が揃っていなくてもそのまま返す
    if (Object.keys(result).length > 0) return result
  }

  // elements なし: textures の慣習的なキーから推定
  const all    = textures['all']      ? resolveTexVar(textures['all'],      textures) : null
  const top    = textures['top']      ? resolveTexVar(textures['top'],      textures) : null
  const bottom = textures['bottom']   ? resolveTexVar(textures['bottom'],   textures) : null
  const side   = textures['side']     ? resolveTexVar(textures['side'],     textures) : null
  const end    = textures['end']      ? resolveTexVar(textures['end'],      textures) : null
  const particle = textures['particle'] ? resolveTexVar(textures['particle'], textures) : null

  if (all) {
    return {
      up: { texture: all },
      down: { texture: all },
      north: { texture: all },
      south: { texture: all },
      east: { texture: all },
      west: { texture: all },
    }
  }
  if (top || side || bottom || end) {
    const t = top ?? end ?? particle ?? null
    const b = bottom ?? end ?? particle ?? null
    const s = side ?? particle ?? null
    if (t && b && s) {
      return {
        up: { texture: t },
        down: { texture: b },
        north: { texture: s },
        south: { texture: s },
        east: { texture: s },
        west: { texture: s },
      }
    }
    // side だけある場合など、取れた面だけ返す
    const partial: Partial<Record<BoxFace, FaceTextureInfo>> = {}
    if (t) { partial.up = { texture: t } }
    if (b) { partial.down = { texture: b } }
    if (s) {
      partial.north = { texture: s }
      partial.south = { texture: s }
      partial.east = { texture: s }
      partial.west = { texture: s }
    }
    if (Object.keys(partial).length > 0) return partial
  }

  return null
}

// ── マテリアル構築 ────────────────────────────────────────────────

async function texPathToMaterial(
  texVar: string,
  loader: IAssetLoader,
  transparent: boolean,
): Promise<THREE.MeshLambertMaterial> {
  if (!texVar || texVar.startsWith('#')) {
    // 未解決の変数
    return new THREE.MeshLambertMaterial({ map: MISSING_TEXTURE })
  }

  // "minecraft:block/stone" → "assets/minecraft/textures/block/stone.png"
  const normalized = texVar.replace(/^minecraft:/, '')
  const fullPath = `assets/minecraft/textures/${normalized}.png`
  const tex = await loader.loadTexture(fullPath)

  return new THREE.MeshLambertMaterial({
    map: tex,
    transparent,
    alphaTest: transparent ? 0.1 : 0,
  })
}

function rotateUvCorners(
  corners: [number, number][],
  rotation: number,
): [number, number][] {
  const steps = ((rotation / 90) % 4 + 4) % 4
  if (steps === 1) return [corners[2], corners[0], corners[3], corners[1]]
  if (steps === 2) return [corners[3], corners[2], corners[1], corners[0]]
  if (steps === 3) return [corners[1], corners[3], corners[0], corners[2]]
  return corners
}

function applyFaceUvs(
  geometry: THREE.BoxGeometry,
  faceMap: Partial<Record<BoxFace, FaceTextureInfo>>,
) {
  const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute

  for (const [faceIndex, face] of BOX_FACES.entries()) {
    const uv = faceMap[face]?.uv ?? [0, 0, 16, 16]
    const rotation = faceMap[face]?.rotation ?? 0
    const u1 = uv[0] / 16
    const v1 = 1 - uv[1] / 16
    const u2 = uv[2] / 16
    const v2 = 1 - uv[3] / 16
    const corners = rotateUvCorners([
      [u1, v1],
      [u2, v1],
      [u1, v2],
      [u2, v2],
    ], rotation)
    const vertexOffset = faceIndex * 4

    for (let i = 0; i < corners.length; i++) {
      uvAttr.setXY(vertexOffset + i, corners[i][0], corners[i][1])
    }
  }

  uvAttr.needsUpdate = true
}

export interface BlockMeshData {
  object: THREE.Object3D
  rotation: [number, number, number]
}

// ── air / transparent 判定 ────────────────────────────────────────

const TRANSPARENT_BLOCKS = new Set([
  'minecraft:air',
  'minecraft:cave_air',
  'minecraft:void_air',
  'minecraft:glass',
  'minecraft:glass_pane',
  'minecraft:ice',
  'minecraft:water',
  'minecraft:lava',
])

function isTransparent(blockId: string): boolean {
  return TRANSPARENT_BLOCKS.has(blockId) || blockId.includes('glass') || blockId.includes('leaves')
}

function createHiddenMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
}

async function buildObjectFromElements(
  elements: ModelElement[],
  model: ModelJson,
  loader: IAssetLoader,
  transparent: boolean,
): Promise<THREE.Object3D | null> {
  const group = new THREE.Group()
  const textures = model.textures ?? {}

  for (const el of elements) {
    const width = (el.to[0] - el.from[0]) / 16
    const height = (el.to[1] - el.from[1]) / 16
    const depth = (el.to[2] - el.from[2]) / 16
    if (width <= 0 || height <= 0 || depth <= 0) continue

    const geometry = new THREE.BoxGeometry(width, height, depth)
    const faceMap: Partial<Record<BoxFace, FaceTextureInfo>> = {}

    for (const [face, faceData] of Object.entries(el.faces ?? {})) {
      const boxFace = MC_FACE_TO_BOX[face]
      if (!boxFace) continue
      faceMap[boxFace] = {
        texture: resolveTexVar(faceData.texture, textures),
        uv: faceData.uv,
        rotation: faceData.rotation,
      }
    }

    applyFaceUvs(geometry, faceMap)

    const materials = await Promise.all(BOX_FACES.map(async face => {
      const texVar = faceMap[face]?.texture
      if (!texVar) return createHiddenMaterial()
      const resolved = resolveTexVar(texVar, textures)
      return texPathToMaterial(resolved, loader, transparent)
    }))

    const mesh = new THREE.Mesh(geometry, materials)
    mesh.position.set(
      ((el.from[0] + el.to[0]) / 2 - 8) / 16,
      ((el.from[1] + el.to[1]) / 2 - 8) / 16,
      ((el.from[2] + el.to[2]) / 2 - 8) / 16,
    )
    group.add(mesh)
  }

  return group.children.length > 0 ? group : null
}

// ── メインエクスポート ─────────────────────────────────────────────

export const AIR_BLOCKS = new Set([
  'minecraft:air',
  'minecraft:cave_air',
  'minecraft:void_air',
])

/**
 * ブロック ID + state からジオメトリ、6 面分の MeshLambertMaterial、モデル回転を返す。
 * air 系は null を返す（メッシュを生成しない）。
 */
export async function buildBlockMeshData(
  blockId: string,
  state: BlockState,
  loader: IAssetLoader,
  _mcVersion: string,
): Promise<BlockMeshData | null> {
  // air は描画しない
  if (AIR_BLOCKS.has(blockId)) return null

  const transparent = isTransparent(blockId)

  // 1. blockstates JSON を取得
  const blockName = blockId.replace(/^minecraft:/, '')
  const bsPath = `assets/minecraft/blockstates/${blockName}.json`
  const bsData = (await loader.loadJson(bsPath)) as BlockstatesJson | null

  let modelName: string | null = null
  let rotX = 0
  let rotY = 0

  if (bsData?.variants) {
    const variant = findVariant(bsData.variants, state)
    if (variant) {
      modelName = variant.model
      rotX = variant.x ?? 0
      rotY = variant.y ?? 0
    }
  } else if (!bsData) {
    // blockstates JSON が取得できない場合はフォールバック
    console.warn(`[BlockTexture] blockstates not found for: ${blockId}`)
  }

  // 2. model JSON を再帰取得
  const model = modelName
    ? await fetchModelMerged(modelName, loader)
    : { textures: { all: `block/${blockName}` } }

  // 3. 面テクスチャマップを構築
  const faceTexMap = buildFaceMapFromModel(model)

  if (!faceTexMap) {
    console.warn(`[BlockTexture] Could not resolve faces for: ${blockId}`)
    const missingMat = new THREE.MeshLambertMaterial({ map: MISSING_TEXTURE })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), Array(6).fill(missingMat))
    return {
      object: mesh,
      rotation: [THREE.MathUtils.degToRad(-rotX), THREE.MathUtils.degToRad(-rotY), 0],
    }
  }

  const object = model.elements && model.elements.length > 0
    ? await buildObjectFromElements(model.elements, model, loader, transparent)
    : null

  if (object) {
    return {
      object,
      rotation: [THREE.MathUtils.degToRad(-rotX), THREE.MathUtils.degToRad(-rotY), 0],
    }
  }

  // 4. テクスチャ変数を解決してマテリアルを生成
  const textures = model.textures ?? {}
  const materialsByFace: Partial<Record<BoxFace, THREE.MeshLambertMaterial>> = {}
  for (const face of BOX_FACES) {
    const raw = faceTexMap[face]?.texture
    const resolved = raw ? resolveTexVar(raw, textures) : null
    materialsByFace[face] = resolved
      ? await texPathToMaterial(resolved, loader, transparent)
      : new THREE.MeshLambertMaterial({ map: MISSING_TEXTURE })
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  applyFaceUvs(geometry, faceTexMap)

  return {
    object: new THREE.Mesh(
      geometry,
      // BoxGeometry の面順: +X(east), -X(west), +Y(up), -Y(down), +Z(south), -Z(north)
      BOX_FACES.map(face => materialsByFace[face] ?? new THREE.MeshLambertMaterial({ map: MISSING_TEXTURE })),
    ),
    rotation: [THREE.MathUtils.degToRad(-rotX), THREE.MathUtils.degToRad(-rotY), 0],
  }
}
