use wasm_bindgen::JsValue;
use crate::utils::JsResult;
use crate::counter::{now, sendProgress};

/// `arr[dim][n]`
const SIMPLEX_SUMS: [[u32; 79]; 7] = {
    let mut res = [[0; 79]; 7];
    let mut n = 1;
    while n <= 78 {
        res[0][n] = 1;
        let mut d = 1;
        while d <= 6 {
            res[d][n] = res[d - 1][n] + res[d][n - 1];
            d += 1;
        }
        n += 1;
    }
    res
};

pub struct ProgressTracker {
    n: usize,
    dimension: usize,
    progresses: [usize; 7],
    divider: u32,
    max: u32,
    last_report: f64
}

impl ProgressTracker {
    pub fn new(dimension: usize, n: usize) -> JsResult<ProgressTracker> {
        js_assert!(dimension <= 6);
        js_assert!(n <= 78);

        let real_max = SIMPLEX_SUMS[dimension][n];
        let divider = real_max.div_ceil(99999).max(1);
        let max = real_max / divider;
        sendProgress(0, max as usize);
        Ok(ProgressTracker { n, dimension, progresses: [n; 7], divider, max, last_report: now() })
    }
    #[inline]
    pub fn track(&mut self, dimension: usize, n: usize) {
        // dimension: 2..=6, 1 goes to the report method
        // n: 0..78
        self.progresses[dimension] = self.n - n;
    }
    #[inline]
    pub fn report(&mut self, n: usize) {
        let t = now();
        if t - self.last_report > 50.0 {
            self.last_report = t;

            let mut prog = 0;
            let mut last_n = self.n;
            let mut dim = self.dimension;
            while dim > 1 {
                let arr = &SIMPLEX_SUMS[dim];
                let n = self.progresses[dim];
                prog += arr[last_n] - arr[n];
                last_n = n;
                dim -= 1;
            }
            prog += (n - (self.n - last_n)) as u32;
            sendProgress((prog / self.divider) as usize, self.max as usize);
        }
    }
}
