
pub struct Random {
    seed: u64
}

impl Random {
    const MASK: u64 = 0xffff_ffff_ffffu64;
    const MULTIPLIER: u64 = 0x5deece66du64;

    pub fn new(seed: u64) -> Random {
        let mut r = Random { seed };
        r.set_seed(seed);
        r
    }

    pub fn set_seed(&mut self, seed: u64) {
        self.seed = (seed ^ Self::MULTIPLIER) & Self::MASK;
    }

    pub fn next(&mut self, bits: u8) -> u32 {
        let r = self.seed * Self::MULTIPLIER + 11 & Self::MASK;
        self.seed = r;
        (r >> (48 - bits)) as u32
    }

    pub fn next_float(&mut self) -> f32 {
        self.next(24) as f32 * 5.9604645e-8f32
    }

}
