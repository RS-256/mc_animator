import type { BlockState } from '../types/schema'
import type { ITextureLoader } from './TextureLoader'
import * as THREE from 'three'

// ブロック名 → テクスチャパスのシンプルなマッピング
// 初期実装では full-cube のみ対応
// パスは assets/minecraft/textures/ 以下の相対パス

type FaceTextures = {
  top: string
  bottom: string
  north: string
  south: string
  east: string
  west: string
}

function all(path: string): FaceTextures {
  return { top: path, bottom: path, north: path, south: path, east: path, west: path }
}

function topBottom(top: string, bottom: string, side: string): FaceTextures {
  return { top, bottom, north: side, south: side, east: side, west: side }
}

// ブロック名 → 面テクスチャ解決関数
type FaceResolver = (state: BlockState) => FaceTextures

const BLOCK_TEXTURES: Record<string, FaceResolver> = {
  'minecraft:stone':          () => all('block/stone'),
  'minecraft:grass_block':    () => topBottom('block/grass_block_top', 'block/dirt', 'block/grass_block_side'),
  'minecraft:dirt':           () => all('block/dirt'),
  'minecraft:cobblestone':    () => all('block/cobblestone'),
  'minecraft:oak_planks':     () => all('block/oak_planks'),
  'minecraft:oak_log':        (s) => {
    const axis = s['axis'] ?? 'y'
    if (axis === 'y') return topBottom('block/oak_log_top', 'block/oak_log_top', 'block/oak_log')
    if (axis === 'x') return { top: 'block/oak_log', bottom: 'block/oak_log', north: 'block/oak_log_top', south: 'block/oak_log_top', east: 'block/oak_log', west: 'block/oak_log' }
    return { top: 'block/oak_log_top', bottom: 'block/oak_log_top', north: 'block/oak_log', south: 'block/oak_log', east: 'block/oak_log_top', west: 'block/oak_log_top' }
  },
  'minecraft:sand':           () => all('block/sand'),
  'minecraft:gravel':         () => all('block/gravel'),
  'minecraft:oak_leaves':     () => all('block/oak_leaves'),
  'minecraft:glass':          () => all('block/glass'),
  'minecraft:tnt':            () => topBottom('block/tnt_top', 'block/tnt_bottom', 'block/tnt_side'),
  'minecraft:crafting_table': () => ({
    top:    'block/crafting_table_top',
    bottom: 'block/oak_planks',
    north:  'block/crafting_table_front',
    south:  'block/crafting_table_side',
    east:   'block/crafting_table_front',
    west:   'block/crafting_table_side',
  }),
  'minecraft:furnace': (s) => {
    const facing = s['facing'] ?? 'north'
    const front = s['lit'] === 'true' ? 'block/furnace_front_on' : 'block/furnace_front'
    const faceMap: Record<string, FaceTextures> = {
      north: { top: 'block/furnace_top', bottom: 'block/furnace_top', north: front,               south: 'block/furnace_side', east: 'block/furnace_side', west: 'block/furnace_side' },
      south: { top: 'block/furnace_top', bottom: 'block/furnace_top', north: 'block/furnace_side', south: front,               east: 'block/furnace_side', west: 'block/furnace_side' },
      east:  { top: 'block/furnace_top', bottom: 'block/furnace_top', north: 'block/furnace_side', south: 'block/furnace_side', east: front,               west: 'block/furnace_side' },
      west:  { top: 'block/furnace_top', bottom: 'block/furnace_top', north: 'block/furnace_side', south: 'block/furnace_side', east: 'block/furnace_side', west: front               },
    }
    return faceMap[facing] ?? faceMap['north']
  },
  'minecraft:observer': (s) => {
    const facing = s['facing'] ?? 'north'
    const powered = s['powered'] === 'true'
    const back = powered ? 'block/observer_back_on' : 'block/observer_back'
    const faceMap: Record<string, FaceTextures> = {
      north: { top: 'block/observer_top', bottom: 'block/observer_top', north: 'block/observer_front', south: back,                   east: 'block/observer_side', west: 'block/observer_side' },
      south: { top: 'block/observer_top', bottom: 'block/observer_top', north: back,                   south: 'block/observer_front', east: 'block/observer_side', west: 'block/observer_side' },
      east:  { top: 'block/observer_top', bottom: 'block/observer_top', north: 'block/observer_side',  south: 'block/observer_side',  east: 'block/observer_front', west: back                   },
      west:  { top: 'block/observer_top', bottom: 'block/observer_top', north: 'block/observer_side',  south: 'block/observer_side',  east: back,                   west: 'block/observer_front' },
      up:    { top: 'block/observer_front', bottom: back,                north: 'block/observer_top',  south: 'block/observer_top',   east: 'block/observer_top',   west: 'block/observer_top'   },
      down:  { top: back,                   bottom: 'block/observer_front', north: 'block/observer_top', south: 'block/observer_top', east: 'block/observer_top',   west: 'block/observer_top'   },
    }
    return faceMap[facing] ?? faceMap['north']
  },
  'minecraft:redstone_block': () => all('block/redstone_block'),
  'minecraft:iron_block':     () => all('block/iron_block'),
  'minecraft:gold_block':     () => all('block/gold_block'),
  'minecraft:diamond_block':  () => all('block/diamond_block'),
  'minecraft:emerald_block':  () => all('block/emerald_block'),
  'minecraft:netherrack':     () => all('block/netherrack'),
  'minecraft:soul_sand':      () => all('block/soul_sand'),
  'minecraft:obsidian':       () => all('block/obsidian'),
  'minecraft:bedrock':        () => all('block/bedrock'),
  'minecraft:water':          () => all('block/water_still'),
  'minecraft:lava':           () => all('block/lava_still'),
  'minecraft:glowstone':      () => all('block/glowstone'),
  'minecraft:pumpkin':        (s) => {
    const facing = s['facing'] ?? 'north'
    const faceMap: Record<string, FaceTextures> = {
      north: { top: 'block/pumpkin_top', bottom: 'block/pumpkin_top', north: 'block/pumpkin_front', south: 'block/pumpkin_side', east: 'block/pumpkin_side', west: 'block/pumpkin_side' },
      south: { top: 'block/pumpkin_top', bottom: 'block/pumpkin_top', north: 'block/pumpkin_side',  south: 'block/pumpkin_front', east: 'block/pumpkin_side', west: 'block/pumpkin_side' },
      east:  { top: 'block/pumpkin_top', bottom: 'block/pumpkin_top', north: 'block/pumpkin_side',  south: 'block/pumpkin_side',  east: 'block/pumpkin_front', west: 'block/pumpkin_side' },
      west:  { top: 'block/pumpkin_top', bottom: 'block/pumpkin_top', north: 'block/pumpkin_side',  south: 'block/pumpkin_side',  east: 'block/pumpkin_side',  west: 'block/pumpkin_front' },
    }
    return faceMap[facing] ?? faceMap['north']
  },
}

const FACE_ORDER: (keyof FaceTextures)[] = ['east', 'west', 'top', 'bottom', 'south', 'north']
// Three.js BoxGeometry の面順: +X, -X, +Y, -Y, +Z, -Z

export async function buildBlockMaterials(
  blockId: string,
  state: BlockState,
  loader: ITextureLoader,
  _mcVersion: string,
): Promise<THREE.MeshLambertMaterial[]> {
  const resolver = BLOCK_TEXTURES[blockId]

  if (!resolver) {
    console.warn(`[BlockTexture] Unknown block: ${blockId}`)
    const missingMat = new THREE.MeshLambertMaterial({ color: 0xff00ff })
    return Array(6).fill(missingMat)
  }

  const faces = resolver(state)

  const materials = await Promise.all(
    FACE_ORDER.map(async (face) => {
      const texPath = faces[face]
      const fullPath = `assets/minecraft/textures/${texPath}.png`
      const tex = await loader.load(fullPath)
      return new THREE.MeshLambertMaterial({
        map: tex,
        transparent: blockId.includes('glass') || blockId.includes('water') || blockId.includes('lava'),
        alphaTest: 0.1,
      })
    }),
  )

  return materials
}

export function isKnownBlock(blockId: string): boolean {
  return blockId in BLOCK_TEXTURES
}
