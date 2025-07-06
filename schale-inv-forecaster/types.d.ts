
type MainGUI = typeof import('./src/MainGUI.js').mainGUI;
type Elem = import('./src/gui/Element.js').Element;
type ItemId = 0 | 1 | 2;
type Item = [w: number, h: number, count: number];
type ItemSet = [Item, Item, Item];
type Tuple<Len extends number, T = number, _P = []> = -1 extends Len ? T[] : (_P extends { length: Len } ? _P : Tuple<Len, T, [T, ..._P]>);

interface CounterResult {
  readonly total: bigint;
  readonly count: readonly [BigUint64Array, BigUint64Array, BigUint64Array];
  readonly time: string;
}

type WorkerPacket = {
  type: 'loaded'
} | {
  type: 'start',
  key: string,
  items: ItemSet,
  board: bigint
} | {
  type: 'error',
  msg: string
} | {
  type: 'progress',
  progress: string
} | {
  type: 'result',
  key: string,
  total: bigint,
  count: [BigUint64Array | null, BigUint64Array | null, BigUint64Array | null],
  time: string
};

type NavigateType =
| 'prev' // shift + tab
| 'next' // tab
| 'up' // arrow up
| 'down' // arrow down
| 'left' // arrow left
| 'right' // arrow right
| 'activate' // spacebar || enter

interface I18n {
  readonly name: string;
  readonly empty: string;
  readonly siteMainDescription: string;
  readonly siteDescription: string;
  readonly preset: string;
  readonly defaultPreset(stage: number, last: boolean): string;
  readonly hoverToSee: string;
  readonly clickToPlaceItem(id: ItemId, rotate: boolean): string;
  readonly placementOOB: string;
  readonly placementOccupied: string;
  readonly clickToRemoveItem: string;
  readonly somethingWrongInInv: string;
  readonly clickToMark(index: number, open: boolean): string;
  readonly slotStat(counts: bigint[], sum: bigint, partialVisible: boolean, visible: bigint, perc: number): string;
  readonly invalid1x1: string;
  readonly setItemSize(id: ItemId, w: number, h: number): string;
  readonly setItemCount(id: ItemId, count: number): string;
  readonly setItemVisibility(id: ItemId, value: boolean): string;
  readonly addItemPlacement(id: ItemId, rotate: boolean): string;
  readonly itemPlacementFull(id: ItemId, count: number): string;
  readonly running: string;
  readonly runningCanRestart: string;
  readonly runningElapsed(elapsedMs: number): string;
  readonly clickToStart: string;
  readonly totalPossibilities(total: bigint, time: string): string;
  readonly totalPossibilities1: string;
}

interface Theme {
  readonly background: string;
  readonly generic: string;
  readonly gray: string;
  readonly hover: string;
  readonly item0outline: string;
  readonly item0fill: string;
  readonly item1outline: string;
  readonly item1fill: string;
  readonly item2outline: string;
  readonly item2fill: string;
}
