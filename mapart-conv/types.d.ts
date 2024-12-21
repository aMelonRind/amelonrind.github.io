
declare const JSZip: import('jszip');

// it's needed to import twice in order to make intellisense work, bruh
type NBT = typeof import('@/../npm/nbtify/dist/index.js') 
declare namespace NBT {
  import * as NBT from '@/../npm/nbtify/dist/index.js'
  export * from '@/../npm/nbtify/dist/index.js'
  export type Vec3i = { x: NBT.Int32, y: NBT.Int32, z: NBT.Int32 };
  export type Vec3iTuple = NBT.ListTag<NBT.Int32> & [ NBT.Int32, NBT.Int32, NBT.Int32 ];
}

type RGBAImage = import('./src/RGBAImage').default;
type BlockImage = import('./src/BlockImage').default;

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

type SchematicNbt = { // .schematic
  rootName: 'Schematic',
  endian: 'big',
  compression: 'gzip',
  bedrockLevel: false
} & NBT.NBTData<{
  Blocks: Int8Array,
  Data: Int8Array,
  Width: NBT.Int16,
  Height: NBT.Int16,
  Length: NBT.Int16,
  Materials: 'Alpha',
  Entities: NBT.ListTag<{}>,
  TileEntities: NBT.ListTag<{}>,
  WEOffsetX: NBT.Int32,
  WEOffsetY: NBT.Int32,
  WEOffsetZ: NBT.Int32,
  WEOriginX: NBT.Int32,
  WEOriginY: NBT.Int32,
  WEOriginZ: NBT.Int32
}>;

type StructureNbt = { // .nbt
  rootName: '',
  endian: 'big',
  compression: 'gzip',
  bedrockLevel: false
} & NBT.NBTData<{
  blocks: NBT.ListTag<{
    pos: NBT.Vec3iTuple,
    state: NBT.Int32
  }>,
  entities: NBT.ListTag<{}>,
  palette: PaletteNbt,
  size: NBT.Vec3iTuple,
  author: string,
  DataVersion: NBT.Int32<3464> // 3953 for 1.21, 3463 for 1.20
}>;

// fuck schem, never used it anyways
// https://github.dev/sakura-ryoko/litematica/blob/4583a40849f0c8492094766f336dddab96d68ce0/src/main/java/fi/dy/masa/litematica/schematic/LitematicaSchematic.java#L1591
// type SchemNbt = { // .schem
//   rootName: '',
//   endian: 'big',
//   compression: 'gzip',
//   bedrockLevel: false
// } & NBT.NBTData<{
//   Version: NBT.Int32
// }>

type MapDatNbt = { // .dat
  rootName: '',
  endian: 'big',
  compression: 'gzip',
  bedrockLevel: false
} & NBT.NBTData<{
  DataVersion: NBT.Int32<2975>,
  data: {
    banners: NBT.ListTag<{}>,
    colors: Int8Array, // length 16384
    dimension: string, // dim id
    frames: NBT.ListTag<{}>,
    locked: NBT.Int8,
    scale: NBT.Int8,
    trackingPosition: NBT.Int8,
    unlimitedTracking: NBT.Int8,
    xCenter: NBT.Int32,
    zCenter: NBT.Int32
  }
}>;

type FormQuery = Record<string, FormItem>;
type TypeFromFormItem<T extends FormItem> = T extends IFormItem<infer R> ? FormItemTypes[R] : never;
type FormResult<T extends FormQuery> = { [K in keyof T]: TypeFromFormItem<T[K]> };
type Validator<T> = (value: T) => string | undefined | null;

type FormItem =
| IFormItem<'string'>
| IFormItemTextarea
| IFormItem<'number'>
| IFormItem<'xy'>
| IFormItem<'wh'>
| IFormItem<'boolean'>
| IFormItemSelect;

type FormItemTypes = {
  string: string,
  textarea: string,
  number: number,
  xy: { x: number, y: number },
  wh: { w: number, h: number },
  boolean: boolean,
  select: string
};

interface IFormItem<T extends keyof FormItemTypes> {
  type: T;
  storeLast?: boolean;
  default: FormItemTypes[T];
  label: string;
  title?: string;
  placeholder?: string;
  validator?: Validator<FormItemTypes[T]>;
}

interface IFormItemSelect extends IFormItem<'select'> {
  options: string[];
}

interface IFormItemTextarea extends IFormItem<'textarea'> {
  rows?: number
}
