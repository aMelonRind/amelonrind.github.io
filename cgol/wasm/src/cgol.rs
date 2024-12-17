use wasm_bindgen::prelude::*;
use crate::random::Random;

#[wasm_bindgen]
pub struct Universe {
    width: u32,
    height: u32,
    cells: Vec<u8>,
    random: Random,
    cursor_place_chance: f32,

    line0: Vec<u8>,
    neighbors: [Vec<u8>; 3],
    /// rows\[wrap(y - 1)]
    norths: Vec<usize>,
    /// y * w * 4
    rows: Vec<usize>,
    /// rows\[wrap(y + 1)]
    souths: Vec<usize>,
    /// wrap(x - 1)
    wests: Vec<usize>,
    /// wrap(x + 1)
    easts: Vec<usize>,
}

#[wasm_bindgen]
impl Universe {

    pub fn new(width: u32, height: u32, seed: u64, cursor_place_chance: f32) -> Universe {
        let random = Random::new(seed);
        let mut univ = Universe {
            width,
            height,
            cells: vec![],
            random,
            cursor_place_chance: if cursor_place_chance == 0.0f32 { 0.3 } else { cursor_place_chance },

            line0: vec![],
            neighbors: [vec![], vec![], vec![]],
            norths: vec![],
            rows: vec![],
            souths: vec![],
            wests: vec![],
            easts: vec![],
        };
        univ.resize(width, height);
        univ
    }

    pub fn tick(&mut self) {
        for c in 0..3 {
            // // old algorithm, eats memory and cpu on self.neighbors(x, y)
            // self.states.fill(0);
            // let mut i: usize = 0;
            // let mut ci: usize = c;
            // for y in 0..self.height {
            //     for x in 0..self.width {
            //         if self.cells[ci] == 255 {
            //             self.states[i] |= 0b10000;
            //             for ni in self.neighbors(x, y) {
            //                 self.states[ni] += 1;
            //             }
            //         }
            //         i += 1;
            //         ci += 4;
            //     }
            // }

            // i = 0;
            // ci = c;
            // for _y in 0..self.height {
            //     for _x in 0..self.width {
            //         self.cells[ci] = match self.states[i] {
            //             0b10010 | 0b10011 | 0b11 => 255,
            //             _ => wither(self.cells[ci]),
            //         };
            //         i += 1;
            //         ci += 4;
            //     }
            // }

            self.line0.fill(0);
            self.neighbors[1].fill(0);
            self.neighbors[2].fill(0);
            {
                let line = self.norths[0] + c;
                for x in 0..self.width as usize {
                    if self.cells[line + x * 4] == 255 { // capture last line
                        self.neighbors[1][self.wests[x]] += 1;
                        self.neighbors[1][x] += 1;
                        self.neighbors[1][self.easts[x]] += 1;
                    }
                    if self.cells[c + x * 4] == 255 { // capture first line
                        self.neighbors[2][self.wests[x]] += 1;
                        self.neighbors[2][x] |= 0b10000;
                        self.neighbors[2][self.easts[x]] += 1;
                        self.line0[self.wests[x]] += 1;
                        self.line0[x] += 1;
                        self.line0[self.easts[x]] += 1;
                    }
                }
                for x in 0..self.width as usize {
                    self.neighbors[1][x] += self.line0[x];
                }
            }
            for y in 0..self.height as usize {
                self.neighbors.rotate_left(1);
                // capture next line
                let nl = self.souths[y];
                if nl == 0 {
                    for x in 0..self.width as usize {
                        // only set 0 since the other two are not used anymore
                        self.neighbors[0][x] += self.line0[x];
                    }
                } else {
                    self.neighbors[2].fill(0);
                    let nlc = nl + c;
                    for x in 0..self.width as usize {
                        if self.cells[nlc + x * 4] == 255 {
                            self.neighbors[1][self.wests[x]] += 1;
                            self.neighbors[1][x] |= 0b10000;
                            self.neighbors[1][self.easts[x]] += 1;
                            self.neighbors[2][self.wests[x]] += 1;
                            self.neighbors[2][x] += 1;
                            self.neighbors[2][self.easts[x]] += 1;
                        }
                    }
                    for x in 0..self.width as usize {
                        self.neighbors[0][x] += self.neighbors[2][x];
                    }
                }
                // transform this line
                let l = self.rows[y] + c;
                for x in 0..self.width as usize {
                    let i = l + x * 4;
                    self.cells[i] = match self.neighbors[0][x] {
                        0b10010 | 0b10011 | 0b11 => 255,
                        _ => wither(self.cells[i]),
                    };
                }
            }
        }
    }

    pub fn cross(&mut self, x: u32, y: u32) {
        if y < self.height {
            for xx in 0..self.width {
                self.cursor_place(xx, y);
            }
        }
        if x < self.width {
            for yy in 0..self.height {
                self.cursor_place(x, yy);
            }
        }
    }

    pub fn cursor_place(&mut self, x: u32, y: u32) {
        let i = self.get_index(x, y) * 4;
        if i < self.cells.len() {
            for n in 0..3 {
                if self.random.next_float() < self.cursor_place_chance {
                    self.cells[i + n] = 255;
                }
            }
        }
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn cells(&self) -> *const u8 {
        self.cells.as_ptr()
    }

    pub fn size(&self) -> usize {
        self.cells.len()
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        if width == 0 || height == 0 {
            panic!("width and height cannot be 0!")
        }
        let pw = self.width as i32;
        let ph = self.height as i32;
        if pw == width as i32 && ph == height as i32 {
            return
        }
        let prev = &self.cells;
        self.width = width;
        self.height = height;
        let prev_getter = {
            let dx = (pw - width as i32) / 2;
            let dy = (ph - height as i32) / 2;
            let w = width as i32;
            move |i: u32| {
                let index = (i / 4) as i32;
                let channel = i % 4;
                let x = index % w + dx;
                let y = index / w + dy;
                if x >= 0 && x < pw && y >= 0 && y < ph {
                    let ii = ((y * pw + x) as u32 * 4 + channel) as usize;
                    if ii < prev.len() {
                        prev[ii]
                    } else {
                        0u8
                    }
                } else {
                    0u8
                }
            }
        };
        self.cells = (0..width * height * 4)
            .map(|i| {
                if i % 4 == 3 {
                    255u8
                } else {
                    prev_getter(i)
                }
            })
            .collect();
        self.line0 = vec![0u8; self.width as usize];
        self.neighbors = [
            vec![0u8; self.width as usize],
            vec![0u8; self.width as usize],
            vec![0u8; self.width as usize],
        ];
        self.rows = vec![0usize; self.height as usize];
        let w4 = self.width as usize * 4;
        for y in 0..self.height as usize {
            self.rows[y] = y * w4;
        }
        self.norths = self.rows.clone();
        self.souths = self.rows.clone();
        self.norths.rotate_left(1);
        self.norths.rotate_right(1);
        self.wests = vec![0usize; self.width as usize];
        for x in 0..self.width as usize {
            self.wests[x] = if x == 0 {
                self.width as usize - 1
            } else {
                x - 1
            };
        }
        self.easts = self.wests.clone();
        self.easts.rotate_right(2);
    }

    pub fn fill_random(&mut self) {
        for i in 0..self.cells.len() {
            if i % 4 < 3 && self.random.next_float() < 0.4 {
                self.cells[i] = 255;
            }
        }
    }

    pub fn clear(&mut self) {
        for i in 0..self.cells.len() {
            self.cells[i] = if i % 4 == 3 {
                255
            } else {
                0
            };
        }
    }

    fn get_index(&self, x: u32, y: u32) -> usize {
        (y * self.width + x) as usize
    }

    // fn neighbors(&self, x: u32, y: u32) -> [usize; 8] {
    //     let n = if y == 0 {
    //         (self.height - 1) * self.width
    //     } else {
    //         (y - 1) * self.width
    //     };
    
    //     let s = if y == self.height - 1 {
    //         0
    //     } else {
    //         (y + 1) * self.width
    //     };
    
    //     let w = if x == 0 {
    //         self.width - 1
    //     } else {
    //         x - 1
    //     };
    
    //     let e = if x == self.width - 1 {
    //         0
    //     } else {
    //         x + 1
    //     };

    //     let yw = y * self.width;

    //     [
    //         (w + n) as usize,
    //         (x + n) as usize,
    //         (e + n) as usize,
    //         (w + yw) as usize,
    //         (e + yw) as usize,
    //         (w + s) as usize,
    //         (x + s) as usize,
    //         (e + s) as usize,
    //     ]
    // }
}

fn wither(n: u8) -> u8 {
    const CACHE: [u8; 256] = {
        let decrement = 8;
        let mut cache = [0u8; 256];
        let mut i = 0;
        loop {
            cache[i as usize] = if i > decrement {
                let v = i - decrement;
                if v < 128 {
                    v
                } else {
                    128
                }
            } else {
                0
            };
            if i == 255 {
                break;
            }
            i += 1;
        }
        cache
    };
    CACHE[n as usize]
}
