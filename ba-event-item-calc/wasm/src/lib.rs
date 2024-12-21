
use wasm_bindgen::prelude::*;

pub type JsResult<T> = Result<T, JsValue>;

pub fn jserr<T>(msg: &str) -> JsResult<T> {
    Err(JsValue::from_str(msg))
}

mod utils;
#[wasm_bindgen]
pub fn set_panic_hook() {
    utils::set_panic_hook();
}

#[wasm_bindgen]
extern {
    #[wasm_bindgen(js_namespace = performance)]
    fn now() -> f64;
    // #[wasm_bindgen(js_namespace = console)]
    // fn log(s: &str);
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
pub fn calc(levels: Vec<LevelSet>, requires: &[u32]) -> JsResult<CalcResult> {
    let levellen = if let Some(v) = levels.get(0) {
        v.amounts.len()
    } else {
        return Ok(CalcResult{ count: 0, ap: 0, amounts: Vec::new() });
    };
    let itemlen = requires.len();
    let mask = 255 ^ ((1 << itemlen) - 1);
    if levellen == 0 {
        return jserr("no levels");
    }
    if itemlen == 0 {
        return jserr("no items");
    }

    for l in &levels {
        if l.amounts.len() != levellen {
            return jserr("level length doesn't match");
        }
        if l.items.len() != itemlen {
            return jserr("item length doesn't match");
        }
        if l.bitflag & mask != 0 {
            return jserr("bitflag out of bounds");
        }
    }
    let mut ctx = CalcContext {
        requires: Vec::from(requires),
        used_ap: 0,
        route: Vec::new(),
        itemlen,
        levellen,
        res: CalcResult { count: 0, ap: u32::MAX, amounts: vec![0u32; levellen] },
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
                let amount = (self.clones[depth + j] + u - 1) / u;
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
    pub fn count(&self) -> u64 {
        self.count
    }

    pub fn ap(&self) -> u32 {
        self.ap
    }

    pub fn amounts(&self) -> Vec<u32> {
        Vec::from(&self.amounts[..])
    }
}
