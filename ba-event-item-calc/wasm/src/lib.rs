mod utils;

use wasm_bindgen::prelude::*;
use utils::{div_ceil_u32, JsResult};

// #[wasm_bindgen]
// extern {
//     #[wasm_bindgen(js_namespace = performance)]
//     fn now() -> f64;
//     // #[wasm_bindgen(js_namespace = console)]
//     // fn log(s: &str);
// }

// #[wasm_bindgen]
// pub fn set_panic_hook() {
//     utils::set_panic_hook();
// }

#[allow(dead_code)]
#[wasm_bindgen]
pub struct RawLevel {
    index: usize,
    ap: u32,
    items: Vec<u32>,
    normalized: Vec<f32>,
    bitflag: u8,
    futurebits: u8,
    rcp: Vec<f64>,
}

#[wasm_bindgen]
pub struct RawLevels {
    item_types: usize,
    levels: Vec<RawLevel>,
}

#[wasm_bindgen]
impl RawLevels {
    #[wasm_bindgen(constructor)]
    pub fn new(item_types: usize) -> JsResult<RawLevels> {
        if item_types == 0 {
            jserr!("Item types cannot be 0.");
        }
        if item_types > 8 {
            jserr!("Too many item types! This can only handle up to 8. Received {}.", item_types);
        }
        Ok(RawLevels { item_types, levels: Vec::with_capacity(12) })
    }

    pub fn push(&mut self, index: usize, ap: u32, items: Vec<u32>) -> JsResult<()> {
        if index != self.levels.len() {
            jserr!("Unexpected level index {}! Expecting {}.", index, self.levels.len());
        }
        if ap == 0 {
            jserr!("AP cannot be 0.");
        }
        if items.len() != self.item_types {
            jserr!("Mismatched level items types {}! Should be {}.", items.len(), self.item_types);
        }
        let normalized = items.iter().map(|&v| v as f32 / ap as f32).collect();
        let mut bitflag = 0;
        for i in 0..self.item_types {
            if items[i] > 0 {
                bitflag |= 1 << i;
            }
        }
        let rcp = items.iter().map(|&v| 1.0 / v as f64).collect();
        self.levels.push(RawLevel { index, ap, items, normalized, bitflag, futurebits: 0, rcp });
        Ok(())
    }

    pub fn approach2(&self, req: Vec<u32>) -> JsResult<CalcResult> {
        if req.len() != self.item_types {
            jserr!("Mismatched level items types {}! Should be {}.", req.len(), self.item_types);
        }
        let mut res = CalcResult { count: 0, ap: u32::MAX, amounts: vec![0; self.levels.len()] };
        if self.levels.is_empty() {
            return Ok(res);
        }
        let mut iters = Vec::with_capacity(self.item_types);
        iters.push(self.levels.iter());
        let mut lvset = vec![&self.levels[0]; self.item_types];
        loop {
            // iterate combinations and store them in lvset
            if let Some(iter) = iters.last_mut() {
                if let Some(lv) = iter.next() {
                    let len = iters.len();
                    if lv.items[len - 1] == 0 {
                        continue;
                    }
                    lvset[len - 1] = lv;
                    if len < self.item_types {
                        iters.push(self.levels.iter());
                        continue;
                    }
                } else {
                    iters.pop();
                    continue;
                }
            } else {
                break;
            }
            // check if the set has only one type of level
            let index = lvset[0].index;
            if lvset.iter().all(|v| v.index == index) {
                continue;
            }
            res.count += 1;
            // perform calculation on lvset
            let mut ap = 0u32;
            let mut amounts = vec![0u32; self.item_types];
            let mut items = vec![0u32; self.item_types];
            for i in 0..self.item_types {
                amounts[i] = div_ceil_u32(req[i], lvset[i].items[i]);
                ap += amounts[i] * lvset[i].ap;
                for j in 0..self.item_types {
                    items[j] += lvset[i].items[j] * amounts[i];
                }
            }
            let mut limit: i16 = 1000;
            'outer: loop {
                limit -= 1;
                if limit < 0 {
                    break;
                }
                let mut exceeds = vec![0u32; self.item_types];
                for i in 0..self.item_types {
                    assert!(items[i] >= req[i]);
                    exceeds[i] = items[i] - req[i];
                }
                let mut order: Vec<usize> = (0..self.item_types).collect();
                order.sort_by_key(|&i| exceeds[i]);
                order.reverse();
                'inner: for o in order {
                    if amounts[o] == 0 {
                        continue;
                    }
                    let olv = lvset[o];
                    let mut reduce = div_ceil_u32(exceeds[o], olv.items[o]).max(1).min(amounts[o]);
                    let mut adjust: Vec<u32> = (0..self.item_types).map(|i| {
                        if i == o {
                            0
                        } else {
                            let minus = reduce * olv.items[i];
                            if exceeds[i] >= minus {
                                0
                            } else {
                                div_ceil_u32(minus - exceeds[i], lvset[i].items[i])
                            }
                        }
                    }).collect();
                    let after = items[o] - reduce * olv.items[o]
                        + (0..self.item_types).map(|i| adjust[i] * lvset[i].items[o]).sum::<u32>();
                    if after < req[o] {'fill: {
                        for i in 0..self.item_types {
                            if lvset[i].ap < olv.ap && after + lvset[i].items[o] >= req[o] {
                                adjust[i] += 1;
                                break 'fill;
                            }
                        }
                        reduce -= 1;
                        if reduce == 0 {
                            continue 'inner;
                        }
                    }}
                    let adjusted_ap = ap - reduce * olv.ap
                        + (0..self.item_types).map(|i| adjust[i] * lvset[i].ap).sum::<u32>();
                    if adjusted_ap < ap {
                        ap = adjusted_ap;
                        amounts[o] -= reduce;
                        for i in 0..self.item_types {
                            amounts[i] += adjust[i];
                            items[i] -= reduce * olv.items[i];
                            if adjust[i] > 0 {
                                for j in 0..self.item_types {
                                    items[j] += adjust[i] * lvset[i].items[j];
                                }
                            }
                        }
                        continue 'outer;
                    }
                }
                break
            }
            // collect
            if ap < res.ap {
                res.ap = ap;
                res.amounts.fill(0);
                for i in 0..self.item_types {
                    res.amounts[lvset[i].index] = amounts[i];
                }
            }
        }
        Ok(res)
    }
}



#[wasm_bindgen]
pub struct LevelSet {
    amounts: Vec<u32>,
    ap: u32,
    items: Vec<u32>,
    bitflag: u8,
}

#[wasm_bindgen]
impl LevelSet {
    #[wasm_bindgen(constructor)]
    pub fn new(amounts: &[u32], ap: u32, items: &[u32], bitflag: u8) -> LevelSet {
        LevelSet {
            amounts: Vec::from(amounts),
            ap,
            items: Vec::from(items),
            bitflag,
        }
    }
}

#[wasm_bindgen]
pub struct CalcResult {
    count: u64,
    ap: u32,
    amounts: Vec<u32>,
}

#[wasm_bindgen]
pub fn calc(levels: Vec<LevelSet>, requires: &[u32], ap_ceil: u32) -> JsResult<CalcResult> {
    let levellen = if let Some(v) = levels.get(0) {
        v.amounts.len()
    } else {
        return Ok(CalcResult{ count: 0, ap: 0, amounts: Vec::new() });
    };
    let itemlen = requires.len();
    let mask = 255 ^ ((1 << itemlen) - 1);
    if levellen == 0 {
        jserr!("no levels");
    }
    if itemlen == 0 {
        jserr!("no items");
    }

    for l in &levels {
        if l.amounts.len() != levellen {
            jserr!("level length doesn't match");
        }
        if l.items.len() != itemlen {
            jserr!("item length doesn't match");
        }
        if l.bitflag & mask != 0 {
            jserr!("bitflag out of bounds");
        }
    }
    let mut ctx = CalcContext {
        requires: Vec::from(requires),
        used_ap: 0,
        route: Vec::new(),
        itemlen,
        levellen,
        res: CalcResult { count: 0, ap: ap_ceil + 1, amounts: vec![0u32; levellen] },
        clones: vec![0u32; itemlen * itemlen],
    };
    ctx.calc(&levels, 0);
    Ok(ctx.res())
}

struct CalcContext<'a> {
    requires: Vec<u32>,
    used_ap: u32,
    route: Vec<(&'a Vec<u32>, u32)>,
    itemlen: usize,
    levellen: usize,
    res: CalcResult,
    clones: Vec<u32>,
}

impl<'a> CalcContext<'a> {
    fn calc(&mut self, levels: &'a Vec<LevelSet>, depth: usize) {
        let mut reqbits: u8 = 0;
        for i in 0..self.itemlen {
            if self.requires[i] > 0 {
                reqbits |= 1 << i;
            }
        }
        if reqbits == 0 {
            self.collect();
            return;
        }
        let lreq = reqbits.trailing_zeros() as usize;
        let rreq = 8 - reqbits.leading_zeros() as usize;

        let orig_ap = self.used_ap;
        self.clones[depth..depth + self.itemlen].clone_from_slice(&self.requires[..]);
        for LevelSet{ bitflag, ap, items, amounts } in levels.iter() {
            let obits = reqbits & *bitflag;
            for j in obits.trailing_zeros() as usize..8 - obits.leading_zeros() as usize {
                if (obits & (1 << j)) == 0 {
                    continue;
                }
                let u = items[j];
                let amount = div_ceil_u32(self.clones[depth + j], u);
                self.used_ap = orig_ap + amount * *ap;
                if self.used_ap > self.res.ap {
                    self.res.count += 1;
                    continue;
                }
                for k in lreq..rreq {
                    let v = self.clones[depth + k];
                    self.requires[k] = if v == 0 {
                        0
                    } else if (obits & (1 << k)) == 0 {
                        v
                    } else {
                        v.saturating_sub(amount * items[k])
                    };
                }
                self.route.push((amounts, amount));
                self.calc(levels, depth + self.itemlen);
                self.route.pop();
            }
        }
        self.used_ap = orig_ap;
        self.requires.clone_from_slice(&self.clones[depth..depth + self.itemlen]);
    }

    #[inline(always)]
    fn collect(&mut self) {
        self.res.count += 1;
        if self.used_ap < self.res.ap {
            self.res.ap = self.used_ap;
            self.res.amounts.fill(0);
            for (amounts, multiplier) in &self.route {
                for i in 0..self.levellen {
                    if amounts[i] > 0 {
                        self.res.amounts[i] += amounts[i] * multiplier;
                    }
                }
            }
        }
    }

    fn res(self) -> CalcResult {
        self.res
    }
}

#[wasm_bindgen]
impl CalcResult {
    #[wasm_bindgen(getter)]
    pub fn count(&self) -> u64 {
        self.count
    }

    #[wasm_bindgen(getter)]
    pub fn ap(&self) -> u32 {
        self.ap
    }

    #[wasm_bindgen(getter)]
    pub fn amounts(&self) -> Vec<u32> {
        Vec::from(&self.amounts[..])
    }
}
