//! Main function: Board::count
mod third_try;
mod progress_tracker;

use std::cell::Cell;

use third_try::ItemAlgo;
use wasm_bindgen::prelude::*;
use crate::utils::JsResult;

const W: usize = 9;
const H: usize = 5;

#[wasm_bindgen]
extern {
    #[wasm_bindgen(js_namespace = performance)]
    fn now() -> f64;
    fn sendProgress(prog: usize, max: usize);
}

#[wasm_bindgen]
pub struct Board {
    /// bitfield, 1 means occupied
    board: u64,
    items: Vec<Item>,
}

struct Item {
    // w: usize,
    // h: usize,
    count: u8,
    placements: Vec<u64>,
}

/// more like an iterator element
struct ItemIterable {
    bits: u64,
    count: Cell<u64>,
}

#[wasm_bindgen]
pub struct CountResult {
    total: u64,
    counts: Vec<[u64; 45]>
}

#[wasm_bindgen]
impl Board {
    #[wasm_bindgen(constructor)]
    pub fn new(board: u64) -> JsResult<Board> {
        let bits = 64 - board.leading_zeros();
        js_assert!(bits <= 45, "Too large ({bits})");
        Ok(Board { board, items: Vec::with_capacity(3) })
    }

    pub fn push(&mut self, w: usize, h: usize, count: u8) -> JsResult<()> {
        js_assert!(w > 0, "Too thin ({w})");
        js_assert!(w <= W, "Too wide ({w})");
        js_assert!(h > 0, "Too short ({h})");
        js_assert!(h <= H, "Too high ({h})");
        js_assert!(w * h > 1, "Too small ({})", w * h);
        // js_assert!(count > 0, "No count ({count})");
        let sum = self.items.iter().map(|v| v.count as u16).sum::<u16>() + count as u16;
        js_assert!(sum <= 18, "Too much ({sum})");
        self.items.push(Item::new(w, h, count));
        Ok(())
    }

    pub fn count3(&mut self) -> JsResult<CountResult> {
        let mut algo = ItemAlgo::prepare(self.board, &mut self.items)?;
        unsafe { algo.count()?; }
        Ok(algo.result())
    }

    pub fn count(&self) -> JsResult<CountResult> {
        let mut possible: u64 = 0;
        for item in self.items.iter() {
            for placement in item.placements.iter() {
                if self.board & placement == 0 {
                    possible |= placement;
                }
            }
        }
        js_assert!(possible != 0, "No available placement");
        // let map = bit_mask::to_map(possible);
        // let bits = map.len();
        possible ^= u64::MAX;
        let board = possible;

        // compress data to smaller bits. so the future can be optimized by having u32 and u16 counter
        let iterate_source: Vec<Vec<ItemIterable>> = self.items.iter().map(|item| item.to_iterables(board)).collect();
        let types = self.items.len();

        let mut index_type = 0;
        let mut source_filtered: Vec<Vec<&ItemIterable>> = vec![iterate_source[0].iter().collect(); types];

        let mut index_per = 0;
        let len_per: Vec<usize> = self.items.iter().map(|v| v.count as usize).collect();
        let max_per = len_per.iter().sum();

        if types == 1 && len_per[0] == 1 { // edge case
            let items = &iterate_source[0];
            let mut counts = vec![[0u64; 45]; 1];
            for item in items.iter() {
                for &i in item.to_map().iter() {
                    counts[0][i] += 1;
                }
            }

            return Ok(CountResult { total: items.len() as u64, counts })
        }

        let mut index = 0;
        // i know this name looks wrong, but it was Vec<Iter> before i'm banging my head against borrowing issues
        // i don't know how to name it. deal with it.
        let mut iterators = vec![0usize; max_per];
        let mut current = vec![iterate_source.iter().find_map(|v| v.first()).unwrap(); max_per];

        let mut mask_stack = [board; 23];
        let mut count_stack = [0u64; 23];
        let mut total = 0u64;

        // alias pr = progress report
        let pr_double = len_per[0] > 1 && (types > 1 || len_per[0] > 2);
        let pr_update_index = if pr_double {1} else {2};
        let pr_len = iterate_source[0].len();
        let pr_max = {
            if pr_double {
                ((pr_len + 1) * pr_len) / 2
            } else {
                pr_len
            }
        };
        let mut pr_last = now();
        sendProgress(0, pr_max);

        // iterate stack: [source] -> [filtered] -> [iterators] -> [current]
        // jslog!("{:?}", iterate_source.iter().map(|v| v.len()).collect::<Vec<_>>());
        loop {
            // iterate combinations and store them in current
            if let Some(item) = source_filtered[index_type].get(iterators[index]) {
                iterators[index] += 1;
                // changes [current]
                if mask_stack[index] & item.bits != 0 {
                    continue;
                }
                if index == pr_update_index { // progress report
                    let t = now();
                    if t - pr_last > 50.0 {
                        pr_last = t;
                        if pr_double {
                            let first = iterators[0];
                            sendProgress(((pr_len + pr_len - first + 1) * first) / 2 - (pr_len - iterators[1]), pr_max);
                        } else {
                            sendProgress(iterators[0], pr_max);
                        }
                    }
                }
                let count = count_stack[index];
                if count > 0 {
                    current[index].count(count);
                    if index > 0 {
                        count_stack[index - 1] += count;
                    } else {
                        total += count;
                    }
                }
                count_stack[index] = 0;
                current[index] = item;
                mask_stack[index + 1] = mask_stack[index] | item.bits;
                macro_rules! lastlayer {
                    ($skips:expr) => {
                        if index == max_per - 1 { // last layer, quick filter
                            let mask = mask_stack[index];
                            let count = source_filtered[index_type]
                                .iter()
                                .skip($skips)
                                // .filter(|item| item.bits & mask == 0)
                                .filter(|item| {
                                    if item.bits & mask == 0 {
                                        item.count(1);
                                        true
                                    } else {
                                        false
                                    }
                                })
                                .count() as u64;
                            // count_stack[index] = 0;
                            count_stack[index - 1] += count;
                            iterators[index] = 999;
                        }
                    };
                }
                if index_per < len_per[index_type] - 1 {
                    // changes [iterators]
                    let next_index = iterators[index];
                    index += 1;
                    index_per += 1;
                    iterators[index] = next_index; // skip previous to avoid duplicate and increases performance
                    lastlayer!(next_index);
                    continue;
                } else if index_type < types - 1 {
                    // changes [filtered] and [iterators] afterwards
                    index += 1;
                    index_per = 0;
                    index_type += 1;
                    source_filtered[index_type] = iterate_source[index_type].iter()
                        .filter(|item| mask_stack[index] & item.bits == 0).collect();
                    iterators[index] = 0;
                    lastlayer!(0);
                    continue;
                }
                jserr!("unreachable");
            } else {
                let count = count_stack[index];
                if count > 0 {
                    current[index].count(count);
                    if index > 0 {
                        count_stack[index - 1] += count;
                    } else {
                        total += count;
                    }
                }
                count_stack[index] = 0;
                index -= 1;
                if index_per > 0 {
                    index_per -= 1;
                } else if index_type > 0 {
                    index_type -= 1;
                    index_per = len_per[index_type] - 1;
                } else {
                    // finish
                    break;
                }
            }
        }

        let mut count_typed = vec![[0u64; 45]; types];
        for t in 0..types {
            for item in iterate_source[t].iter() {
                let count = item.count.get();
                if count == 0 {
                    continue;
                }
                for &i in item.to_map().iter() {
                    count_typed[t][i] += count;
                }
            }
        }

        Ok(CountResult { total, counts: count_typed })
    }
}

impl Item {
    fn new(w: usize, h: usize, count: u8) -> Item {
        let mut place_count = (W - w + 1) * (H - h + 1);
        let do_rotate = h <= W && w != h;
        if do_rotate {
            place_count += (W - h + 1) * (H - w + 1);
        }
        let mut placements = Vec::with_capacity(place_count);
        for x in 0..=(W - w) {
            for y in 0..=(H - h) {
                placements.push(bit_mask::rect(x, y, w, h));
            }
        }
        if do_rotate {
            for x in 0..=(W - h) {
                for y in 0..=(H - w) {
                    placements.push(bit_mask::rect(x, y, h, w));
                }
            }
        }
        Item { count, placements }
    }

    fn to_iterables(&self, mask: u64) -> Vec<ItemIterable> {
        self.placements.iter()
            .filter(|&bits| mask & bits == 0)
            .map(|&bits| ItemIterable { bits, count: Cell::new(0) })
            .collect()
    }
}

impl ItemIterable {
    #[inline]
    fn count(&self, amount: u64) {
        self.count.set(self.count.get() + amount);
    }

    fn to_map(&self) -> Vec<usize> {
        bit_mask::to_map(self.bits)
    }
}

#[wasm_bindgen]
impl CountResult {
    #[wasm_bindgen(getter)]
    pub fn total(&self) -> u64 {
        self.total
    }

    #[wasm_bindgen(indexing_getter)]
    pub fn get(&self, index: usize) -> Vec<u64> {
        Vec::from(self.counts[index])
    }
}

mod bit_mask {
    const W: usize = 9;

    pub fn rect(x: usize, y: usize, w: usize, h: usize) -> u64 {
        let mask: u64 = (1 << w) - 1;
        let s = y * W + x;
        let mut v: u64 = 0;
        for i in (0..h).map(|y| s + y * W) {
            v |= mask << i;
        }
        v
    }

    pub fn to_map(value: u64) -> Vec<usize> {
        (0..45.min(64 - value.leading_zeros() as usize)).filter(|i| value & (1 << i) > 0).collect()
    }
}
