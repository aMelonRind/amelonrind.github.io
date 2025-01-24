//! This performs better on small args, but unfortunately it's horribly slow on slightly larger args.
//! the code won't work currently, because i was trying things and it broke.
use wasm_bindgen::JsValue;

use crate::utils::JsResult;

use super::{CountResult, Item, progress_tracker::ProgressTracker};

#[inline(always)]
fn iterate_ones(num: u64) -> impl Iterator<Item = usize> {
    (0..64).filter(move |i| num & (1 << i) != 0)
}

#[derive(Default, Clone, Copy)]
struct Item1 {
    placement: u64,
    keeps: u64,
    keeps2: u64,
    keeps3: u64,
}

#[derive(Default, Clone, Copy)]
struct Item2 {
    placement: u64,
    keeps: u64,
    keeps3: u64,
}

#[derive(Default, Clone, Copy)]
struct Item3 {
    placement: u64,
    keeps: u64,
}

struct ItemAlgoLayer<Item> {
    depth: u8,
    len: usize,
    items: [Item; 64],
    count: [u64; 64],
}

impl<T: Copy> ItemAlgoLayer<T> {
    fn new(depth_source: Option<&Item>, def: T) -> ItemAlgoLayer<T> {
        ItemAlgoLayer {
            depth: depth_source.map_or(0, |item| item.count),
            len: 0,
            items: [def; 64],
            count: [0; 64],
        }
    }
}

const LAST_CACHE_SIZE: usize = 16;

pub struct ItemAlgo {
    board: u64,
    do2x1: bool,
    layer3_single: bool,
    total: u64,
    layer1: ItemAlgoLayer<Item1>,
    layer2: ItemAlgoLayer<Item2>,
    layer3: ItemAlgoLayer<Item3>,
    last_cache: [u64; LAST_CACHE_SIZE],
    last_cache2: [u64; LAST_CACHE_SIZE],
    last_cache_index: usize,
    counts2x1: [u64; 76]
}

const PLACEMENTS2X1: [u64; 76] = {
    let mut res = [0; 76];
    let mut n = 0;
    while n < 45 {
        res[n - n / 9] = (1 << n) | (1 << (n + 1));
        n += 1;
        if n % 9 == 8 {
            n += 1;
        }
    }
    n = 0;
    while n < 36 {
        res[n + 40] = (1 << n) | (1 << (n + 9));
        n += 1;
    }
    n = 0;
    while n < 76 {
        res[n] = !res[n];
        n += 1;
    }
    res
};

impl ItemAlgo {
    pub fn prepare(board: u64, items: &mut Vec<Item>) -> JsResult<ItemAlgo> {
        js_assert!(!items.is_empty());
        js_assert!(items.len() <= 3);
        items.reverse();
        macro_rules! get {
            ($index:expr, $constructor:expr) => {
                items.get($index).map_or_else(
                    || Vec::from([$constructor(&0)]),
                    |item| item.placements.iter().filter(|&&p| board & p == 0).map($constructor).collect()
                )
            };
        }
        let mut items1 = get!(2, |&placement| Item1 { placement, keeps: !0, keeps2: !0, keeps3: !0 });
        let mut items2 = get!(1, |&placement| Item2 { placement, keeps: !0, keeps3: !0 });
        let mut items3 = get!(0, |&placement| Item3 { placement, keeps: !0 });
        let mut layer1 = ItemAlgoLayer::new(items.get(2), Item1::default());
        let mut layer2 = ItemAlgoLayer::new(items.get(1), Item2::default());
        let mut layer3 = ItemAlgoLayer::new(items.get(0), Item3::default());
        items.reverse();
        loop {
            let lens = (items1.len(), items2.len(), items3.len());
            macro_rules! remove_dead {
                ($target:ident, $a:ident, $al:ident, $b:ident, $bl:ident) => {
                    $target = $target.into_iter().filter(|v| {
                        $a.iter().filter(|o| o.placement & v.placement == 0).count() >= $al.depth as usize &&
                        $b.iter().filter(|o| o.placement & v.placement == 0).count() >= $bl.depth as usize
                    }).collect();
                };
            }
            remove_dead!(items1, items2, layer2, items3, layer3);
            remove_dead!(items2, items1, layer1, items3, layer3);
            remove_dead!(items3, items1, layer1, items2, layer2);
            if items1.len() == lens.0 && items2.len() == lens.1 && items3.len() == lens.2 {
                layer1.items[0..lens.0].swap_with_slice(&mut items1);
                layer2.items[0..lens.1].swap_with_slice(&mut items2);
                layer3.items[0..lens.2.min(64)].swap_with_slice(&mut items3[0..lens.2.min(64)]);
                layer1.len = lens.0;
                layer2.len = lens.1;
                layer3.len = lens.2;
                break;
            }
        }
        let do2x1 = layer3.len > 64 || layer3.depth > 6;
        macro_rules! get_keeps {
            ($layer:ident, $placement:ident, $dist:ident, $min:expr) => {
                for i in 0..$layer.len {
                    #[allow(unused_comparisons)]
                    if i >= $min && $layer.items[i].placement & $placement == 0 {
                        $dist |= 1 << i;
                    }
                }
            };
        }
        for i in 0..layer1.len {
            let p = layer1.items[i].placement;
            let mut keeps = 0;
            let mut keeps2 = 0;
            let mut keeps3 = 0;
            get_keeps!(layer1, p, keeps, i);
            get_keeps!(layer2, p, keeps2, 0);
            if !do2x1 {
                get_keeps!(layer3, p, keeps3, 0);
            }
            layer1.items[i].keeps = keeps;
            layer1.items[i].keeps2 = keeps2;
            layer1.items[i].keeps3 = keeps3;
        }
        for i in 0..layer2.len {
            let p = layer2.items[i].placement;
            let mut keeps = 0;
            let mut keeps3 = 0;
            get_keeps!(layer2, p, keeps, i);
            if !do2x1 {
                get_keeps!(layer3, p, keeps3, 0);
            }
            layer2.items[i].keeps = keeps;
            layer2.items[i].keeps3 = keeps3;
        }
        if do2x1 {
            let mask = !board & ((1 << 45) - 1);
            for i in 0..layer1.len {
                layer1.items[i].keeps3 = !layer1.items[i].placement & mask;
            }
            for i in 0..layer2.len {
                layer2.items[i].keeps3 = !layer2.items[i].placement & mask;
            }
            for i in 0..64 {
                layer3.items[i].placement = 1 << i;
                layer3.items[i].keeps = !(1 << i) & mask;
            }
            layer3.len = 45;
        } else {
            for i in 0..layer3.len {
                let p = layer3.items[i].placement;
                let mut keeps = 0;
                get_keeps!(layer3, p, keeps, i);
                layer3.items[i].keeps = keeps;
            }
        }
        Ok(ItemAlgo {
            board,
            do2x1,
            layer3_single: layer3.depth == 1,
            total: 0,
            layer1,
            layer2,
            layer3,
            last_cache: [0; LAST_CACHE_SIZE],
            last_cache2: [0; LAST_CACHE_SIZE],
            last_cache_index: 0,
            counts2x1: [0; 76]
        })
    }

    pub fn count(&mut self) -> JsResult<()> {
        let mut pt = ProgressTracker::new(self.layer1.depth as usize, self.layer1.len)?;

        let mut count1;
        let mut count2;
        let mut count3;
        let mut count4;
        let mut count5;
        let mut pass_1;
        let mut pass_2;
        let mut pass_3;
        let mut pass_4;
        let mut pass_5;
        let mut pass2_1;
        let mut pass2_2;
        let mut pass2_3;
        let mut pass2_4;
        let mut pass2_5;
        let mut pass3_1;
        let mut pass3_2;
        let mut pass3_3;
        let mut pass3_4;
        let mut pass3_5;
        macro_rules! gen {
            ($dim:expr, $func:ident, $count:ident, $pass:ident, $pass2:ident, $pass3:ident,) => {
                for i in iterate_ones($pass) {
                    let item2 = &self.layer1.items[i];
                    let count = self.$func($pass2 & item2.keeps2, $pass3 & item2.keeps3);
                    self.layer1.count[i] += count;
                    $count += count;
                    pt.report(i);
                }
            };
            ($dim:expr, $func:ident, $prev_count:ident, $prev_pass:ident, $prev_pass2:ident, $prev_pass3:ident, $count:ident, $pass:ident, $pass2:ident, $pass3:ident, $($other_count:ident, $other_pass:ident, $other_pass2:ident, $other_pass3:ident,)*) => {
                for i in iterate_ones($prev_pass) {
                    $count = 0;
                    let item = &self.layer1.items[i];
                    $pass = $prev_pass & item.keeps;
                    $pass2 = $prev_pass2 & item.keeps2;
                    $pass3 = $prev_pass3 & item.keeps3;
                    pt.track($dim, i);
                    gen!($dim - 1, $func, $count, $pass, $pass2, $pass3, $($other_count, $other_pass, $other_pass2, $other_pass3, )*);
                    self.layer1.count[i] += $count;
                    $prev_count += $count;
                }
            };
            (top; $dim:expr, $func:ident, $count:ident, $pass:ident, $pass2:ident, $pass3:ident, $($other_count:ident, $other_pass:ident, $other_pass2:ident, $other_pass3:ident,)*) => {
                for i in 0..self.layer1.len {
                    $count = 0;
                    let item = &self.layer1.items[i];
                    $pass = item.keeps;
                    $pass2 = item.keeps2;
                    $pass3 = item.keeps3;
                    pt.track($dim, i);
                    gen!($dim - 1, $func, $count, $pass, $pass2, $pass3, $($other_count, $other_pass, $other_pass2, $other_pass3, )*);
                    self.layer1.count[i] += $count;
                    self.total += $count;
                }
            };
        }
        if !self.do2x1 {
            match self.layer1.depth {
                1 => {
                    for i in 0..self.layer1.len {
                        let item = &self.layer1.items[i];
                        let count = self.count_second_normal(item.keeps2, item.keeps3);
                        self.layer1.count[i] += count;
                        self.total += count;
                        pt.report(i);
                    }
                },
                2 => gen!(top; 2, count_second_normal, count1, pass_1, pass2_1, pass3_1, ),
                3 => gen!(top; 3, count_second_normal, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, ),
                4 => gen!(top; 4, count_second_normal, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, count3, pass_3, pass2_3, pass3_3, ),
                5 => gen!(top; 5, count_second_normal, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, count3, pass_3, pass2_3, pass3_3, count4, pass_4, pass2_4, pass3_4, ),
                6 => gen!(top; 6, count_second_normal, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, count3, pass_3, pass2_3, pass3_3, count4, pass_4, pass2_4, pass3_4, count5, pass_5, pass2_5, pass3_5, ),
                _ => { self.total = self.count_second_normal(self.layer1.items[0].keeps2, self.layer1.items[0].keeps3) }
            }
        } else {
            match self.layer1.depth {
                1 => {
                    for i in 0..self.layer1.len {
                        let item = &self.layer1.items[i];
                        let count = self.count_second_2x1(item.keeps2, item.keeps3);
                        self.layer1.count[i] += count;
                        self.total += count;
                        pt.report(i);
                    }
                },
                2 => gen!(top; 2, count_second_2x1, count1, pass_1, pass2_1, pass3_1, ),
                3 => gen!(top; 3, count_second_2x1, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, ),
                4 => gen!(top; 4, count_second_2x1, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, count3, pass_3, pass2_3, pass3_3, ),
                5 => gen!(top; 5, count_second_2x1, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, count3, pass_3, pass2_3, pass3_3, count4, pass_4, pass2_4, pass3_4, ),
                6 => gen!(top; 6, count_second_2x1, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, count3, pass_3, pass2_3, pass3_3, count4, pass_4, pass2_4, pass3_4, count5, pass_5, pass2_5, pass3_5, ),
                _ => { self.total = self.count_second_2x1(self.layer1.items[0].keeps2, !self.board) }
            }
        }

        if self.last_cache_index > 0 {
            if self.do2x1 {
                for i in 0..44 {
                    let m = 1 << i;
                    let hori_count = self.last_cache[0..self.last_cache_index].iter().filter(|&v| v & m != 0).count() as u64;
                    self.layer3.count[i] += hori_count;
                    self.layer3.count[i + 1] += hori_count;
                    let vert_count = self.last_cache2[0..self.last_cache_index].iter().filter(|&v| v & m != 0).count() as u64;
                    self.layer3.count[i] += vert_count;
                    self.layer3.count[i + 9] += vert_count;
                }
            } else {
                for i in 0..64 {
                    let m = 1 << i;
                    self.layer3.count[i] += self.last_cache[0..self.last_cache_index].iter().filter(|&v| v & m != 0).count() as u64;
                }
            }
            self.last_cache_index = 0;
        }

        if self.do2x1 && self.layer3.depth > 1 {
            for i in 0..76 {
                let count = self.counts2x1[i];
                if count != 0 {
                    if i < 40 {
                        let j = i + (i.max(1) - 1) / 8;
                        self.layer3.count[j] += count;
                        self.layer3.count[j + 1] += count;
                    } else {
                        self.layer3.count[i - 40] += count;
                        self.layer3.count[i - 40 + 9] += count;
                    }
                }
            }
            self.counts2x1 = [0; 76];
        }

        Ok(())
    }
    fn count_second_normal(&mut self, pass: u64, pass3: u64) -> u64 {
        let mut total = 0;
        let mut count1;
        let mut count2;
        let mut count3;
        let mut count4;
        let mut count5;
        let mut pass_1;
        let mut pass_2;
        let mut pass_3;
        let mut pass_4;
        let mut pass_5;
        let mut pass3_1;
        let mut pass3_2;
        let mut pass3_3;
        let mut pass3_4;
        let mut pass3_5;
        macro_rules! gen {
            ($count:ident, $pass:ident, $pass3:ident,) => {
                for i in iterate_ones($pass) {
                    let item = &self.layer2.items[i];
                    let count = self.count_last_normal($pass3 & item.keeps3);
                    self.layer2.count[i] += count;
                    $count += count;
                }
            };
            ($prev_count:ident, $prev_pass:ident, $prev_pass3:ident, $count:ident, $pass:ident, $pass3:ident, $($other_count:ident, $other_pass:ident, $other_pass3:ident,)*) => {
                for i in iterate_ones($prev_pass) {
                    $count = 0;
                    let item = &self.layer2.items[i];
                    $pass = $prev_pass & item.keeps;
                    $pass3 = $prev_pass3 & item.keeps3;
                    gen!($count, $pass, $pass3, $($other_count, $other_pass, $other_pass3, )*);
                    self.layer2.count[i] += $count;
                    $prev_count += $count;
                }
            };
        }
        match self.layer2.depth {
            1 => gen!(total, pass, pass3, ),
            2 => gen!(total, pass, pass3, count1, pass_1, pass3_1, ),
            3 => gen!(total, pass, pass3, count1, pass_1, pass3_1, count2, pass_2, pass3_2, ),
            4 => gen!(total, pass, pass3, count1, pass_1, pass3_1, count2, pass_2, pass3_2, count3, pass_3, pass3_3, ),
            5 => gen!(total, pass, pass3, count1, pass_1, pass3_1, count2, pass_2, pass3_2, count3, pass_3, pass3_3, count4, pass_4, pass3_4, ),
            6 => gen!(total, pass, pass3, count1, pass_1, pass3_1, count2, pass_2, pass3_2, count3, pass_3, pass3_3, count4, pass_4, pass3_4, count5, pass_5, pass3_5, ),
            _ => { return self.count_last_normal(pass3) }
        }
        total
    }
    fn count_second_2x1(&mut self, pass: u64, pass3: u64) -> u64 {
        let mut total = 0;
        let mut count1;
        let mut count2;
        let mut count3;
        let mut count4;
        let mut count5;
        let mut pass_1;
        let mut pass_2;
        let mut pass_3;
        let mut pass_4;
        let mut pass_5;
        let mut pass3_1;
        let mut pass3_2;
        let mut pass3_3;
        let mut pass3_4;
        let mut pass3_5;
        macro_rules! gen {
            ($count:ident, $pass:ident, $pass3:ident,) => {
                for i in iterate_ones($pass) {
                    let item = &self.layer2.items[i];
                    let count = self.count_last_2x1($pass3 & item.keeps3);
                    self.layer2.count[i] += count;
                    $count += count;
                }
            };
            ($prev_count:ident, $prev_pass:ident, $prev_pass3:ident, $count:ident, $pass:ident, $pass3:ident, $($other_count:ident, $other_pass:ident, $other_pass3:ident,)*) => {
                for i in iterate_ones($prev_pass) {
                    $count = 0;
                    let item = &self.layer2.items[i];
                    $pass = $prev_pass & item.keeps;
                    $pass3 = $prev_pass3 & item.keeps3;
                    gen!($count, $pass, $pass3, $($other_count, $other_pass, $other_pass3, )*);
                    self.layer2.count[i] += $count;
                    $prev_count += $count;
                }
            };
        }
        match self.layer2.depth {
            1 => gen!(total, pass, pass3, ),
            2 => gen!(total, pass, pass3, count1, pass_1, pass3_1, ),
            3 => gen!(total, pass, pass3, count1, pass_1, pass3_1, count2, pass_2, pass3_2, ),
            4 => gen!(total, pass, pass3, count1, pass_1, pass3_1, count2, pass_2, pass3_2, count3, pass_3, pass3_3, ),
            5 => gen!(total, pass, pass3, count1, pass_1, pass3_1, count2, pass_2, pass3_2, count3, pass_3, pass3_3, count4, pass_4, pass3_4, ),
            6 => gen!(total, pass, pass3, count1, pass_1, pass3_1, count2, pass_2, pass3_2, count3, pass_3, pass3_3, count4, pass_4, pass3_4, count5, pass_5, pass3_5, ),
            _ => { return self.count_last_2x1(pass3) }
        }
        total
    }
    #[inline]
    fn count_last_normal(&mut self, pass: u64) -> u64 {
        let mut total = 0;
        let mut count1;
        let mut count2;
        let mut count3;
        let mut count4;
        let mut count5;
        let mut pass_1;
        let mut pass_2;
        let mut pass_3;
        let mut pass_4;
        let mut pass_5;
        macro_rules! gen {
            ($count:ident, $pass:ident,) => {
                $count += self.finish_last_normal($pass)
            };
            ($prev_count:ident, $prev_pass:ident, $count:ident, $pass:ident, $($other_count:ident, $other_pass:ident,)*) => {
                for i in iterate_ones($prev_pass) {
                    $count = 0;
                    let item = &self.layer3.items[i];
                    $pass = $prev_pass & item.keeps;
                    gen!($count, $pass, $($other_count, $other_pass, )*);
                    self.layer3.count[i] += $count;
                    $prev_count += $count;
                }
            };
        }
        match self.layer3.depth {
            1 => { return self.finish_last_normal(pass) },
            2 => gen!(total, pass, count1, pass_1, ),
            3 => gen!(total, pass, count1, pass_1, count2, pass_2, ),
            4 => gen!(total, pass, count1, pass_1, count2, pass_2, count3, pass_3, ),
            5 => gen!(total, pass, count1, pass_1, count2, pass_2, count3, pass_3, count4, pass_4, ),
            6 => gen!(total, pass, count1, pass_1, count2, pass_2, count3, pass_3, count4, pass_4, count5, pass_5, ),
            _ => { return 1 }
        }
        total
    }
    #[inline]
    fn count_last_2x1(&mut self, board_neg: u64) -> u64 {
        if self.layer3_single {
            return self.finish_last_2x1(board_neg);
        }
        let mut total;
        let mut count1;
        let mut count2;
        let mut count3;
        let mut count4;
        let mut count5;
        let mut pass_1;
        let mut pass_2;
        let mut pass_3;
        let mut pass_4;
        let mut pass_5;
        let mut arr_1 = [(0usize, 0u64); 76];
        let mut arr_2 = [(0usize, 0u64); 76];
        let mut arr_3 = [(0usize, 0u64); 76];
        let mut arr_4 = [(0usize, 0u64); 76];
        let mut arr_5 = [(0usize, 0u64); 76];
        let mut len_1;
        let mut len_2;
        let mut len_3;
        let mut len_4;
        let mut len_5;
        const TOP_ARR: [(usize, u64); 76] = {
            let mut arr = [(0usize, 0u64); 76];
            let mut n = 0;
            while n < 76 {
                arr[n] = (n, PLACEMENTS2X1[n]);
                n += 1;
            }
            arr
        };
        const TOP_LEN: usize = 76;
        macro_rules! gen {
            ($prev_index:expr, $count:ident, $pass:ident, $arr:ident, $len:ident,) => {
                $count = 0;
                for &(i, plac_neg) in &$arr[$prev_index..$len] {
                    if ($pass | plac_neg) == u64::MAX {
                        self.counts2x1[i] += 1;
                        $count += 1;
                    }
                }
            };
            ($prev_index:expr, $prev_count:ident, $prev_pass:ident, $prev_arr:ident, $prev_len:ident, $count:ident, $pass:ident, $arr:ident, $len:ident, $($other_count:ident, $other_pass:ident, $other_arr:ident, $other_len:ident,)*) => {{
                $prev_count = 0;
                $len = 0;
                for &(i, plac_neg) in &$prev_arr[$prev_index..$prev_len] {
                    if ($prev_pass | plac_neg) == u64::MAX {
                        $arr[$len] = (i, plac_neg);
                        $len += 1;
                    }
                }
                for i in 0..$len {
                    let (j, plac_neg) = $arr[i];
                    $pass = $prev_pass & plac_neg;
                    gen!(i + 1, $count, $pass, $arr, $len, $($other_count, $other_pass, $other_arr, $other_len, )*);
                    self.counts2x1[j] += $count;
                    $prev_count += $count;
                }
            }};
        }
        match self.layer3.depth {
            1 => { return self.finish_last_2x1(board_neg) },
            2 => gen!(0, total, board_neg, TOP_ARR, TOP_LEN, count1, pass_1, arr_1, len_1, ),
            3 => gen!(0, total, board_neg, TOP_ARR, TOP_LEN, count1, pass_1, arr_1, len_1, count2, pass_2, arr_2, len_2, ),
            4 => gen!(0, total, board_neg, TOP_ARR, TOP_LEN, count1, pass_1, arr_1, len_1, count2, pass_2, arr_2, len_2, count3, pass_3, arr_3, len_3, ),
            5 => gen!(0, total, board_neg, TOP_ARR, TOP_LEN, count1, pass_1, arr_1, len_1, count2, pass_2, arr_2, len_2, count3, pass_3, arr_3, len_3, count4, pass_4, arr_4, len_4, ),
            6 => gen!(0, total, board_neg, TOP_ARR, TOP_LEN, count1, pass_1, arr_1, len_1, count2, pass_2, arr_2, len_2, count3, pass_3, arr_3, len_3, count4, pass_4, arr_4, len_4, count5, pass_5, arr_5, len_5, ),
            7..18 => { return 1 }
            _ => { return 1 }
        }
        total
    }
    #[inline]
    fn finish_last_normal(&mut self, pass: u64) -> u64 {
        self.last_cache[self.last_cache_index] = pass;
        self.last_cache_index += 1;
        if self.last_cache_index == LAST_CACHE_SIZE {
            for i in 0..64 {
                let m = 1 << i;
                self.layer3.count[i] += self.last_cache.iter().filter(|&v| v & m != 0).count() as u64;
            }
            self.last_cache_index = 0;
        }
        return pass.count_ones() as u64;
    }
    #[inline]
    fn finish_last_2x1(&mut self, board_neg: u64) -> u64 {
        const HORI_MASK: u64 = 0b11111111011111111011111111011111111011111111;
        let hori = board_neg & (board_neg >> 1) & HORI_MASK;
        let vert = board_neg & (board_neg >> 9);
        self.last_cache[self.last_cache_index] = hori;
        self.last_cache2[self.last_cache_index] = vert;
        self.last_cache_index += 1;
        if self.last_cache_index == LAST_CACHE_SIZE {
            for i in 0..44 {
                let m = 1 << i;
                let hori_count = self.last_cache.iter().filter(|&v| v & m != 0).count() as u64;
                self.layer3.count[i] += hori_count;
                self.layer3.count[i + 1] += hori_count;
                let vert_count = self.last_cache2.iter().filter(|&v| v & m != 0).count() as u64;
                self.layer3.count[i] += vert_count;
                self.layer3.count[i + 9] += vert_count;
            }
            self.last_cache_index = 0;
        }
        return (hori.count_ones() + vert.count_ones()) as u64;
    }
    pub fn result(&self) -> CountResult {
        let mut counts = Vec::new();
        macro_rules! total {
            ($layer:ident) => {
                if self.$layer.depth > 0 {
                    let mut arr = [0u64; 45];
                    for i in 0..self.$layer.len {
                        let count = self.$layer.count[i];
                        let p = self.$layer.items[i].placement;
                        for i in 0..45 {
                            if p & (1 << i) != 0 {
                                arr[i] += count;
                            }
                        }
                    }
                    counts.push(arr);
                }
            };
        }
        total!(layer1);
        total!(layer2);
        total!(layer3);
        CountResult { total: self.total, counts }
    }
}
