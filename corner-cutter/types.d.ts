
// it's needed to import twice in order to make intellisense work, bruh
type NBT = typeof import('@/../npm/nbtify/dist/index.js') 
declare namespace NBT {
  import * as NBT from '@/../npm/nbtify/dist/index.js'
  export * from '@/../npm/nbtify/dist/index.js'
  export type Vec3i = { x: NBT.Int32, y: NBT.Int32, z: NBT.Int32 };
  export type Vec3iTuple = NBT.ListTag<NBT.Int32> & [ NBT.Int32, NBT.Int32, NBT.Int32 ];
}

type NbtDataResult = Promise<{ name: string, data: Uint8Array }>;

type PaletteNbt = NBT.ListTag<{
  Name: string, // block id
  Properties?: { [property: string]: string }
}>;

type LitematicNbt = { // .litematic
  rootName: '',
  endian: 'big',
  compression: 'gzip',
  bedrockLevel: false
} & NBT.NBTData<{
  Version: NBT.Int32<6>,
  SubVersion: NBT.Int32<1>,
  MinecraftDataVersion: NBT.Int32<3700>,
  Metadata: {
    Name: string,
    Author: string,
    Description: string,
    RegionCount: NBT.Int32,
    TotalVolume: NBT.Int32,
    TotalBlocks: NBT.Int32,
    TimeCreated: bigint,
    TimeModified: bigint,
    EnclosingSize: NBT.Vec3i,
    /**
     * see WidgetSchematicBrowser.java#L295
     * basically, ARGB array with squared size
     */
    PreviewImageData?: NBT.IntArrayTag
  },
  Regions: { [name: string]: {
    Position: NBT.Vec3i,
    Size: NBT.Vec3i,
    TileEntities: NBT.ListTag<{}>,
    Entities: NBT.ListTag<{}>,
    PendingBlockTicks: NBT.ListTag<{}>,
    PendingFluidTicks: NBT.ListTag<{}>,
    BlockStatePalette: PaletteNbt, // 0 should be air. if it's not air, the palette will be unshifted with air on read
    BlockStates: NBT.LongArrayTag // yzx order
  }}
}>;
