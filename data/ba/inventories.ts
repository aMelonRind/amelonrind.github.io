
export type ItemId = 0 | 1 | 2;
export type Item = readonly [w: number, h: number, count: number];
export type ItemSet = [Item, Item, Item];
export type Tuple<Len extends number, T = number, _P extends any[] = []> =
  -1 extends Len ? T[] : (_P extends { length: Len } ? _P : Tuple<Len, T, [T, ..._P]>);

interface Definition {
  readonly event: string;
  /**
   * a date string `yyyy-mm-dd`.  
   * futures predicted by https://forum.gamer.com.tw/C.php?bsn=38898&snA=11953&tnum=5
   */
  readonly start: string;
  readonly ended?: true;
  readonly default?: true;
  readonly items: ItemSet[];
}

interface ItemDef {
  readonly itemName: string;
  readonly img: string;
  readonly width: number;
  readonly height: number;
  (amount: number): Item;
}

function defItem(width: number, height: number, name: string, img: string): ItemDef {
  const res: any = (amount: number) => [width, height, amount] as Item
  res.itemName = name
  res.img = img
  res.width = width
  res.height = height
  return res as ItemDef
}

// https://bluearchive.wiki/wiki/Events
// https://bluearchive.wiki/wiki/Events/Mini_Event/SCHALE_Settlement_Task_with_General_Student_Council#Rewards
const baWikitide = (hash: string, path: string) =>
  `https://static.wikitide.net/bluearchivewiki/thumb/${hash[0]}/${hash}/${path}`
const etAsset = (id: string, hash: string, px: number) =>
  baWikitide(hash, `Event_Treasure_${id}.png/${px}px-Event_Treasure_${id}.png`)
export const Items = {
  // SCHALE Settlement Task with General Student Council
  LFPen_2x1:     defItem(2, 1, 'Luxury Fountain Pen',        etAsset('60000_02', 'be', 200)),
  Receipt_1x3:   defItem(1, 3, 'Receipt',                    etAsset('60000_03', 'bc', 33)),
  Umbrella_1x4:  defItem(1, 4, 'Umbrella',                   etAsset('60000_04', 'b1', 25)),
  PRFSnack_2x2:  defItem(2, 2, 'Pollack Roe Flavored Snack', etAsset('60000_05', '55', 100)),
  SBag_3x2:      defItem(3, 2, 'Shopping Bag',               etAsset('60000_06', '40', 150)),
  TBox_4x2:      defItem(4, 2, 'Toy Box',                    etAsset('60000_07', '02', 200)),
  GMagazine_3x3: defItem(3, 3, 'Gaming Magazine',            etAsset('60000_08', 'd8', 100)),
  // Descent of the Five Senses
  Mooncake_2x1: defItem(2, 1, 'Mooncake',             etAsset('840_01', '34', 200)),
  Ludagun_3x1:  defItem(3, 1, 'Lüdagun',              etAsset('840_02', '19', 300)),
  Tanghulu_1x4: defItem(1, 4, 'Tanghulu',             etAsset('840_03', '69', 25)),
  ATofu_2x2:    defItem(2, 2, 'Almond Tofu',          etAsset('840_04', 'ff', 100)),
  DBCandy_3x2:  defItem(3, 2, "Dragon's Beard Candy", etAsset('840_05', '8e', 150)),
  Mahua_4x2:    defItem(4, 2, 'Mahua',                etAsset('840_06', 'a7', 200)),
  Banji_3x3:    defItem(3, 3, 'Banji',                etAsset('840_07', '1c', 100)),
  // Secret Midnight Party ~ Oni Holds a Bell ~
  PScarf_2x1:      defItem(2, 1, 'Purple Scarf',          etAsset('842_01', 'ee', 200)),
  CToothbrush_3x1: defItem(3, 1, 'Character Toothbrush',  etAsset('842_02', '98', 300)),
  Dakimakura_1x4:  defItem(1, 4, 'Dakimakura',            etAsset('842_03', 'c1', 25)),
  Hairband_2x2:    defItem(2, 2, 'Hairband',              etAsset('842_04', '0e', 100)),
  Slippers_3x2:    defItem(3, 2, 'Slippers',              etAsset('842_05', '12', 150)),
  BgKivopoly_4x2:  defItem(4, 2, 'Board game "KIVOPOLY"', etAsset('842_06', 'cf', 200)),
  CCushion_3x3:    defItem(3, 3, 'Character Cushion',     etAsset('842_07', 'd0', 100)),
  // A Flower Blooms Among The Hundred ～ Honorable Sea Showdown ～
  Sunscreen_1x2: defItem(1, 2, 'Sunscreen',                  etAsset('847_01', '37', 50)),
  WSCase_3x1:    defItem(3, 1, 'Waterproof Smartphone Case', etAsset('847_02', '0e', 300)),
  Parasol_1x4:   defItem(1, 4, 'Parasol',                    etAsset('847_03', '1d', 25)),
  Bandana_2x2:   defItem(2, 2, 'Bandana',                    etAsset('847_04', '66', 100)),
  RWGun_3x2:     defItem(3, 2, 'Rifle Water Gun',            etAsset('847_05', '02', 150)),
  Surfboard_4x2: defItem(4, 2, 'Surfboard',                  etAsset('847_06', '81', 200)),
  STube_3x3:     defItem(3, 3, 'Swimming Tube',              etAsset('847_07', 'd9', 100)),
} as const satisfies Record<`${string}_${number}x${number}`, ItemDef>;
// we could probably assume that each event has 7 items:
// 2x1, 3x1, 4x1, 2x2, 3x2, 4x2, 3x3

export const inventories: readonly Definition[] = [
  {
    event: "SCHALE Settlement Task with General Student Council Season 7",
    start: '2024-10-08',
    ended: true,
    items: repeatWithLast([
      [Items.SBag_3x2(1), Items.Receipt_1x3(3), Items.LFPen_2x1(5)],
      [Items.TBox_4x2(1), Items.PRFSnack_2x2(2), Items.Receipt_1x3(3)],
      [Items.GMagazine_3x3(1), Items.Umbrella_1x4(2), Items.LFPen_2x1(4)]
    ], 2, [Items.PRFSnack_2x2(2), Items.Receipt_1x3(3), Items.LFPen_2x1(6)])
  }, {
    event: "SCHALE Settlement Task with General Student Council Season 8",
    start: '2024-12-03',
    ended: true,
    items: repeatWithLast([
      [Items.TBox_4x2(1), Items.SBag_3x2(2), Items.PRFSnack_2x2(2)],
      [Items.GMagazine_3x3(1), Items.SBag_3x2(2), Items.Receipt_1x3(2)],
      [Items.Umbrella_1x4(2), Items.Receipt_1x3(3), Items.LFPen_2x1(5)]
    ], 2, [Items.GMagazine_3x3(1), Items.TBox_4x2(1), Items.SBag_3x2(2)])
  }, {
    event: "SCHALE Settlement Task with General Student Council Season 12",
    start: '2025-08-12',
    ended: true,
    items: repeatWithLast([
      [Items.TBox_4x2(1), Items.SBag_3x2(2), Items.PRFSnack_2x2(3)],
      [Items.GMagazine_3x3(1), Items.SBag_3x2(3), Items.Receipt_1x3(2)],
      [Items.Umbrella_1x4(2), Items.Receipt_1x3(4), Items.LFPen_2x1(6)]
    ], 2, [Items.GMagazine_3x3(1), Items.TBox_4x2(1), Items.SBag_3x2(2)])
  }, {
    event: "SCHALE Settlement Task with General Student Council Season 15",
    start: '2026-03-03',
    ended: true,
    items: repeatWithLast([
      [Items.TBox_4x2(1), Items.SBag_3x2(2), Items.PRFSnack_2x2(3)],
      [Items.Umbrella_1x4(2), Items.Receipt_1x3(3), Items.LFPen_2x1(7)]
    ], 2, [Items.GMagazine_3x3(1), Items.TBox_4x2(1), Items.SBag_3x2(2)])
  },

  {
    event: "Descent of the Five Senses",
    start: '2026-05-12',
    ended: true,
    items: repeatWithLast([
      [Items.DBCandy_3x2(1), Items.Ludagun_3x1(5), Items.Mooncake_2x1(2)],
      [Items.Mahua_4x2(1), Items.ATofu_2x2(2), Items.Ludagun_3x1(3)],
      [Items.Banji_3x3(1), Items.Tanghulu_1x4(3), Items.Mooncake_2x1(2)]
    ], 2, [Items.ATofu_2x2(2), Items.Ludagun_3x1(3), Items.Mooncake_2x1(6)])
  },

  {
    event: "Secret Midnight Party ~ Oni Holds a Bell ~",
    start: '2026-07-14',
    default: true,
    items: repeatWithLast([
      [Items.Slippers_3x2(2), Items.CToothbrush_3x1(5), Items.PScarf_2x1(2)],
      [Items.BgKivopoly_4x2(1), Items.Dakimakura_1x4(2), Items.CToothbrush_3x1(5)],
      [Items.CCushion_3x3(1), Items.Hairband_2x2(4), Items.PScarf_2x1(3)]
    ], 2, [Items.BgKivopoly_4x2(2), Items.CToothbrush_3x1(3), Items.PScarf_2x1(6)])
  }, {
    event: "SCHALE Settlement Task with General Student Council Season 18",
    start: '2026-09-15', // predicted
    items: repeatWithLast([
      [Items.TBox_4x2(1), Items.SBag_3x2(2), Items.PRFSnack_2x2(3)],
      [Items.Umbrella_1x4(2), Items.Receipt_1x3(3), Items.LFPen_2x1(7)]
    ], 2, [Items.GMagazine_3x3(1), Items.TBox_4x2(1), Items.SBag_3x2(2)])
  }, {
    event: "A Flower Blooms Among The Hundred ～ Honorable Sea Showdown ～",
    start: '2026-10-06', // predicted
    items: repeatWithLast([
      [Items.RWGun_3x2(2), Items.WSCase_3x1(5), Items.Sunscreen_1x2(2)],
      [Items.Surfboard_4x2(1), Items.Parasol_1x4(2), Items.WSCase_3x1(5)],
      [Items.STube_3x3(1), Items.Bandana_2x2(4), Items.Sunscreen_1x2(3)]
    ], 2, [Items.Surfboard_4x2(2), Items.WSCase_3x1(3), Items.Sunscreen_1x2(6)])
  }
  // last check ended at season 19 and 59th event: Clear Skies After the Storm
  // 未來視 2026/07/20
]

function repeatWithLast(subset: ItemSet[], times: number = 2, last: ItemSet): ItemSet[] {
  const res = new Array<ItemSet[]>(times).fill(subset).flat()
  res.push(last)
  return res
}

export const current = inventories.findLast(v => v.default) ?? inventories[inventories.length - 1]
