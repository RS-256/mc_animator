import * as THREE from "three"
import JSZip from "jszip"

// ── Missing Texture（マゼンタ/黒チェッカー） ─────────────────────────

function createMissingTexture(): THREE.Texture {
  const size = 16
  const data = new Uint8Array( size * size * 4 )
  for ( let y = 0; y < size; y++ ) {
    for ( let x = 0; x < size; x++ ) {
      const idx = ( y * size + x ) * 4
      const isMagenta = x < size / 2 !== y < size / 2
      data[ idx + 0 ] = isMagenta ? 255 : 0
      data[ idx + 1 ] = 0
      data[ idx + 2 ] = isMagenta ? 255 : 0
      data[ idx + 3 ] = 255
    }
  }
  const tex = new THREE.DataTexture( data, size, size, THREE.RGBAFormat )
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return tex
}

export const MISSING_TEXTURE = createMissingTexture()

// ── インターフェース ───────────────────────────────────────────────

export interface IAssetLoader {
  /** PNG テクスチャを取得する */
  loadTexture( path: string ): Promise< THREE.Texture >
  /** JSON アセット（blockstates / models）を取得する */
  loadJson( path: string ): Promise< unknown >
}

// ── CDN アセットローダー（jsDelivr + minecraft-assets） ────────────

const CDN_BASE = "https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets"

export class CdnTextureLoader implements IAssetLoader {
  private version: string
  private texCache = new Map< string, THREE.Texture >()
  private jsonCache = new Map< string, unknown >()
  private threeLoader = new THREE.TextureLoader()

  constructor( version: string ) {
    this.version = version
  }

  setVersion( version: string ) {
    if ( this.version === version ) return
    this.version = version
    this.texCache.clear()
    this.jsonCache.clear()
  }

  async loadTexture( path: string ): Promise< THREE.Texture > {
    if ( this.texCache.has( path ) ) return this.texCache.get( path )!
    const url = `${ CDN_BASE }@${ this.version }/${ path }`
    try {
      const tex = await new Promise< THREE.Texture >( ( resolve, reject ) => {
        this.threeLoader.load( url, resolve, undefined, reject )
      } )
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.NearestFilter
      this.texCache.set( path, tex )
      return tex
    } catch {
      console.warn( `[CDN] texture not found: ${ url }` )
      return MISSING_TEXTURE
    }
  }

  async loadJson( path: string ): Promise< unknown > {
    if ( this.jsonCache.has( path ) ) return this.jsonCache.get( path )!
    const url = `${ CDN_BASE }@${ this.version }/${ path }`
    try {
      const res = await fetch( url )
      if ( ! res.ok ) throw new Error( `HTTP ${ res.status }` )
      const data = await res.json()
      this.jsonCache.set( path, data )
      return data
    } catch {
      console.warn( `[CDN] json not found: ${ url }` )
      return null
    }
  }
}

// ── ZIP アセットローダー（ユーザー提供リソースパック + CDN フォールバック） ──

export class ZipTextureLoader implements IAssetLoader {
  private fallback: CdnTextureLoader
  private zipTextures = new Map< string, Blob >()
  private zipJsons = new Map< string, unknown >()
  private texCache = new Map< string, THREE.Texture >()

  constructor( fallback: CdnTextureLoader ) {
    this.fallback = fallback
  }

  async setResourcePack( file: File ): Promise< void > {
    this.zipTextures.clear()
    this.zipJsons.clear()
    this.texCache.clear()

    const zip = await JSZip.loadAsync( file )
    const tasks: Promise< void >[] = []

    zip.forEach( ( relativePath, entry ) => {
      if ( entry.dir ) return

      // assets/minecraft/ 配下のみ対象
      const match = relativePath.match( /^assets\/minecraft\/(.+)$/ )
      if ( ! match ) return
      const key = match[ 1 ] // 例: "textures/block/stone.png"

      if ( relativePath.endsWith( ".png" ) ) {
        tasks.push(
          entry.async( "blob" ).then( ( blob ) => {
            this.zipTextures.set( key, blob )
          } )
        )
      } else if ( relativePath.endsWith( ".json" ) ) {
        tasks.push(
          entry.async( "string" ).then( ( text ) => {
            try {
              this.zipJsons.set( key, JSON.parse( text ) )
            } catch {
              /* ignore */
            }
          } )
        )
      }
    } )

    await Promise.all( tasks )
    console.log( `[ZipLoader] loaded ${ this.zipTextures.size } textures, ${ this.zipJsons.size } jsons` )
  }

  async loadTexture( path: string ): Promise< THREE.Texture > {
    if ( this.texCache.has( path ) ) return this.texCache.get( path )!

    // path は "assets/minecraft/textures/block/stone.png" 形式
    const key = path.replace( /^assets\/minecraft\//, "" )
    const blob = this.zipTextures.get( key )

    if ( ! blob ) return this.fallback.loadTexture( path )

    const url = URL.createObjectURL( blob )
    try {
      const loader = new THREE.TextureLoader()
      const tex = await new Promise< THREE.Texture >( ( resolve, reject ) => {
        loader.load( url, resolve, undefined, reject )
      } )
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.NearestFilter
      URL.revokeObjectURL( url )
      this.texCache.set( path, tex )
      return tex
    } catch {
      URL.revokeObjectURL( url )
      return this.fallback.loadTexture( path )
    }
  }

  async loadJson( path: string ): Promise< unknown > {
    // path は "assets/minecraft/blockstates/stone.json" 形式
    const key = path.replace( /^assets\/minecraft\//, "" )
    if ( this.zipJsons.has( key ) ) return this.zipJsons.get( key )!
    return this.fallback.loadJson( path )
  }
}
