use std::slice::from_raw_parts as raw_slice;
use wasm_bindgen::JsValue;

use crate::utils::JsResult;

use super::{CountResult, Item, progress_tracker::ProgressTracker};

struct ItemAlgoLayer {
    depth: u8,
    len: usize,
    placements: [u64; 76],
    count: [u64; 76],
}

impl ItemAlgoLayer {
    fn new(board: u64, source: Option<&Item>) -> ItemAlgoLayer {
        source.map_or_else(
            || ItemAlgoLayer { depth: 0, len: 0, placements: [0; 76], count: [0; 76] },
            |item| {
                assert!(item.count <= 6);
                assert!(item.placements.len() <= 76);
                let placements_vec: Vec<u64> = item.placements.iter().filter(|&p| board & p == 0).map(|&p| p).collect();
                let mut placements = [0; 76];
                placements[0..placements_vec.len()].copy_from_slice(&placements_vec);
                ItemAlgoLayer {
                    depth: item.count,
                    len: placements_vec.len(),
                    placements,
                    count: [0; 76],
                }
            })
    }
    fn to_pass(&self, board: u64, counts_ptr: &*mut u64) -> Pass {
        let mut arr = [(std::ptr::null_mut(), 0); 76];
        unsafe {
            for i in 0..self.len {
                arr[i] = (counts_ptr.add(i), self.placements[i])
            }
        }
        Pass { arr, len: self.len, board }
    }
}

pub struct ItemAlgo {
    board: u64,
    total: u64,
    layer1: ItemAlgoLayer,
    layer2: ItemAlgoLayer,
    layer3: ItemAlgoLayer,
}

struct Pass {
    arr: [(*mut u64, u64); 76],
    len: usize,
    board: u64
}

impl Pass {
    #[inline(always)]
    const fn new() -> Pass {
        Pass { arr: [(std::ptr::null_mut(), 0); 76], len: 0, board: 0 }
    }
    #[inline(always)]
    fn filter(&mut self, prev: &Pass, board: u64, start: usize) {
        self.len = 0;
        let arr_ptr = self.arr.as_mut_ptr();
        unsafe {
            for &(ptr, plac) in raw_slice(prev.arr.as_ptr().add(start), prev.len - start) {
                if board & plac == 0 {
                    *arr_ptr.add(self.len) = (ptr, plac);
                    self.len += 1;
                }
            }
        }
    }
}

impl ItemAlgo {
    pub fn prepare(board: u64, items: &mut Vec<Item>) -> JsResult<ItemAlgo> {
        js_assert!(!items.is_empty());
        js_assert!(items.len() <= 3);
        items.reverse();
        let mut layer1 = ItemAlgoLayer::new(board, items.get(2));
        let mut layer2 = ItemAlgoLayer::new(board, items.get(1));
        let mut layer3 = ItemAlgoLayer::new(board, items.get(0));
        items.reverse();
        loop {
            let lens = (layer1.len, layer2.len, layer3.len);
            macro_rules! remove_dead {
                ($target:ident, $a:ident, $b:ident) => {
                    let filtered: Vec<u64> = $target.placements[0..$target.len].into_iter().filter(|&&v| {
                        $a.placements.iter().filter(|&&o| o & v == 0).count() >= $a.depth as usize &&
                        $b.placements.iter().filter(|&&o| o & v == 0).count() >= $b.depth as usize
                    }).map(|&p| p).collect();
                    $target.placements = [0; 76];
                    $target.len = filtered.len();
                    $target.placements[0..filtered.len()].copy_from_slice(&filtered);
                };
            }
            remove_dead!(layer1, layer2, layer3);
            remove_dead!(layer2, layer1, layer3);
            remove_dead!(layer3, layer1, layer2);
            if lens == (layer1.len, layer2.len, layer3.len) {
                break;
            }
        }
        Ok(ItemAlgo { board, total: 0, layer1, layer2, layer3 })
    }

    pub unsafe fn count(&mut self) -> JsResult<()> {
        let mut pt = ProgressTracker::new(self.layer1.depth as usize, self.layer1.len)?;

        let count_ptr = self.layer1.count.as_mut_ptr();
        let count_ptr2 = self.layer2.count.as_mut_ptr();
        let count_ptr3 = self.layer3.count.as_mut_ptr();
        let mut total;
        let mut count1;
        let mut count2;
        let mut count3;
        let mut count4;
        let mut count5;
        let pass_0 = self.layer1.to_pass(self.board, &count_ptr);
        let pass2_0 = self.layer2.to_pass(self.board, &count_ptr2);
        let pass3_0 = self.layer3.to_pass(self.board, &count_ptr3);
        let mut pass_1 = Pass::new();
        let mut pass_2 = Pass::new();
        let mut pass_3 = Pass::new();
        let mut pass_4 = Pass::new();
        let mut pass_5 = Pass::new();
        let mut pass2_1 = Pass::new();
        let mut pass2_2 = Pass::new();
        let mut pass2_3 = Pass::new();
        let mut pass2_4 = Pass::new();
        let mut pass2_5 = Pass::new();
        let mut pass3_1 = Pass::new();
        let mut pass3_2 = Pass::new();
        let mut pass3_3 = Pass::new();
        let mut pass3_4 = Pass::new();
        let mut pass3_5 = Pass::new();
        macro_rules! gen {
            ($dim:expr, $prev_index:expr, $count:ident, $pass:ident, $pass2:ident, $pass3:ident,) => {{
                $count = 0;
                for &(ptr, plac) in &$pass.arr[$prev_index..$pass.len] {
                    if ($pass.board & plac) == 0 {
                        let count = self.count_second($pass.board | plac, &$pass2, &$pass3);
                        *ptr += count;
                        $count += count;
                        pt.report(ptr.offset_from(count_ptr) as usize);
                    }
                }
            }};
            ($dim:expr, $prev_index:expr, $prev_count:ident, $prev_pass:ident, $prev_pass2:ident, $prev_pass3:ident, $count:ident, $pass:ident, $pass2:ident, $pass3:ident, $($other_count:ident, $other_pass:ident, $other_pass2:ident, $other_pass3:ident,)*) => {{
                $prev_count = 0;
                $pass.filter(&$prev_pass, $prev_pass.board, $prev_index);
                for i in 0..$pass.len {
                    let (ptr, plac) = *$pass.arr.as_ptr().add(i);
                    $pass.board = $prev_pass.board | plac;
                    $pass2.filter(&$prev_pass2, $pass.board, 0);
                    $pass3.filter(&$prev_pass3, $pass.board, 0);
                    pt.track($dim, ptr.offset_from(count_ptr) as usize);
                    gen!($dim - 1, i + 1, $count, $pass, $pass2, $pass3, $($other_count, $other_pass, $other_pass2, $other_pass3, )*);
                    *ptr += $count;
                    $prev_count += $count;
                }
            }};
        }
        match self.layer1.depth {
            1 => {
                total = 0;
                for &(ptr, plac) in &pass_0.arr[0..pass_0.len] {
                    let count = self.count_second(pass_0.board | plac, &pass2_0, &pass3_0);
                    *ptr += count;
                    total += count;
                    pt.report(ptr.offset_from(count_ptr) as usize);
                }
            },
            2 => gen!(2, 0, total, pass_0, pass2_0, pass3_0, count1, pass_1, pass2_1, pass3_1, ),
            3 => gen!(3, 0, total, pass_0, pass2_0, pass3_0, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, ),
            4 => gen!(4, 0, total, pass_0, pass2_0, pass3_0, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, count3, pass_3, pass2_3, pass3_3, ),
            5 => gen!(5, 0, total, pass_0, pass2_0, pass3_0, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, count3, pass_3, pass2_3, pass3_3, count4, pass_4, pass2_4, pass3_4, ),
            6 => gen!(6, 0, total, pass_0, pass2_0, pass3_0, count1, pass_1, pass2_1, pass3_1, count2, pass_2, pass2_2, pass3_2, count3, pass_3, pass2_3, pass3_3, count4, pass_4, pass2_4, pass3_4, count5, pass_5, pass2_5, pass3_5, ),
            _ => { total = self.count_second(self.board, &pass2_0, &pass3_0) }
        }
        self.total = total;

        Ok(())
    }
    #[allow(static_mut_refs)]
    unsafe fn count_second(&mut self, board: u64, pass: &Pass, pass3: &Pass) -> u64 {
        let mut total;
        let mut count1;
        let mut count2;
        let mut count3;
        let mut count4;
        let mut count5;
        static mut PASS_0: Pass = Pass::new();
        static mut PASS3_0: Pass = Pass::new();
        PASS_0.filter(pass, board, 0);
        PASS3_0.filter(pass3, board, 0);
        static mut PASS_1: Pass = Pass::new();
        static mut PASS_2: Pass = Pass::new();
        static mut PASS_3: Pass = Pass::new();
        static mut PASS_4: Pass = Pass::new();
        static mut PASS_5: Pass = Pass::new();
        static mut PASS3_1: Pass = Pass::new();
        static mut PASS3_2: Pass = Pass::new();
        static mut PASS3_3: Pass = Pass::new();
        static mut PASS3_4: Pass = Pass::new();
        static mut PASS3_5: Pass = Pass::new();
        macro_rules! gen {
            ($prev_index:expr, $count:ident, $pass:ident, $pass3:ident,) => {{
                $count = 0;
                for &(ptr, plac) in raw_slice($pass.arr.as_ptr().add($prev_index), $pass.len - $prev_index) {
                    if ($pass.board & plac) == 0 {
                        let count = self.count_last($pass.board | plac, &$pass3);
                        *ptr += count;
                        $count += count;
                    }
                }
            }};
            ($prev_index:expr, $prev_count:ident, $prev_pass:ident, $prev_pass3:ident, $count:ident, $pass:ident, $pass3:ident, $($other_count:ident, $other_pass:ident, $other_pass3:ident,)*) => {{
                $prev_count = 0;
                $pass.filter(&$prev_pass, $prev_pass.board, $prev_index);
                for i in 0..$pass.len {
                    let (ptr, plac) = *$pass.arr.as_ptr().add(i);
                    $pass.board = $prev_pass.board | plac;
                    $pass3.filter(&$prev_pass3, $pass.board, 0);
                    gen!(i + 1, $count, $pass, $pass3, $($other_count, $other_pass, $other_pass3, )*);
                    *ptr += $count;
                    $prev_count += $count;
                }
            }};
        }
        match self.layer2.depth {
            1 => {
                total = 0;
                for &(ptr, plac) in &PASS_0.arr[0..PASS_0.len] {
                    let count = self.count_last(PASS_0.board | plac, &PASS3_0);
                    *ptr += count;
                    total += count;
                }
            },
            2 => gen!(0, total, PASS_0, PASS3_0, count1, PASS_1, PASS3_1, ),
            3 => gen!(0, total, PASS_0, PASS3_0, count1, PASS_1, PASS3_1, count2, PASS_2, PASS3_2, ),
            4 => gen!(0, total, PASS_0, PASS3_0, count1, PASS_1, PASS3_1, count2, PASS_2, PASS3_2, count3, PASS_3, PASS3_3, ),
            5 => gen!(0, total, PASS_0, PASS3_0, count1, PASS_1, PASS3_1, count2, PASS_2, PASS3_2, count3, PASS_3, PASS3_3, count4, PASS_4, PASS3_4, ),
            6 => gen!(0, total, PASS_0, PASS3_0, count1, PASS_1, PASS3_1, count2, PASS_2, PASS3_2, count3, PASS_3, PASS3_3, count4, PASS_4, PASS3_4, count5, PASS_5, PASS3_5, ),
            _ => { total = self.count_last(self.board, &PASS3_0) }
        }
        total
    }
    #[inline]
    #[allow(static_mut_refs)]
    unsafe fn count_last(&mut self, board: u64, pass: &Pass) -> u64 {
        macro_rules! final_count {
            ($slice:expr, $board:expr) => {
                $slice.iter().map(|&(ptr, plac)| {
                    if ($board & plac) == 0 {
                        *ptr += 1;
                        1u32
                    } else {
                        0
                    }
                }).sum::<u32>()
            };
        }
        if self.layer3.depth == 1 {
            return final_count!(raw_slice(pass.arr.as_ptr(), pass.len), board) as u64;
        }
        let mut total;
        let mut count1;
        let mut count2;
        let mut count3;
        let mut count4;
        let mut count5;
        static mut PASS_0: Pass = Pass::new();
        PASS_0.filter(pass, board, 0);
        static mut PASS_1: Pass = Pass::new();
        static mut PASS_2: Pass = Pass::new();
        static mut PASS_3: Pass = Pass::new();
        static mut PASS_4: Pass = Pass::new();
        static mut PASS_5: Pass = Pass::new();
        macro_rules! gen {
            ($prev_index:expr, $count:ident, $pass:ident,) => {
                $count = final_count!(raw_slice($pass.arr.as_ptr().add($prev_index), $pass.len - $prev_index), $pass.board) as u64
            };
            ($prev_index:expr, $prev_count:ident, $prev_pass:ident, $count:ident, $pass:ident, $($other_count:ident, $other_pass:ident,)*) => {{
                $prev_count = 0;
                $pass.filter(&$prev_pass, $prev_pass.board, $prev_index);
                for i in 0..$pass.len {
                    let (ptr, plac) = *$pass.arr.as_ptr().add(i);
                    $pass.board = $prev_pass.board | plac;
                    gen!(i + 1, $count, $pass, $($other_count, $other_pass, )*);
                    *ptr += $count;
                    $prev_count += $count;
                }
            }};
        }
        match self.layer3.depth {
            1 => gen!(0, total, PASS_0, ),
            2 => gen!(0, total, PASS_0, count1, PASS_1, ),
            3 => gen!(0, total, PASS_0, count1, PASS_1, count2, PASS_2, ),
            4 => gen!(0, total, PASS_0, count1, PASS_1, count2, PASS_2, count3, PASS_3, ),
            5 => gen!(0, total, PASS_0, count1, PASS_1, count2, PASS_2, count3, PASS_3, count4, PASS_4, ),
            6 => gen!(0, total, PASS_0, count1, PASS_1, count2, PASS_2, count3, PASS_3, count4, PASS_4, count5, PASS_5, ),
            _ => { return 1 }
        }
        total
    }
    pub fn result(&self) -> CountResult {
        let mut counts = Vec::new();
        macro_rules! total {
            ($layer:ident) => {
                if self.$layer.depth > 0 {
                    let mut arr = [0u64; 45];
                    for i in 0..self.$layer.len {
                        let count = self.$layer.count[i];
                        let p = self.$layer.placements[i];
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
