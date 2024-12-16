mod random;
use std::iter::once;
use wasm_bindgen::prelude::*;
use random::Random;

#[wasm_bindgen]
pub struct Universe {
    width: u32,
    height: u32,
    cells: Vec<u8>,
    swap: Vec<u8>,
    activity: Vec<u8>,
    swap_activity: Vec<u8>,
    random: Random,
    cursor_place_chance: f32,
}

#[wasm_bindgen]
impl Universe {

    pub fn new(width: u32, height: u32, seed: u64, cursor_place_chance: f32) -> Universe {
        let random = Random::new(seed);
        let mut univ = Universe {
            width,
            height,
            cells: vec![],
            swap: vec![],
            activity: vec![],
            swap_activity: vec![],
            random,
            cursor_place_chance: if cursor_place_chance == 0.0f32 { 0.3 } else { cursor_place_chance }
        };
        univ.resize(width, height);
        univ
    }

    pub fn tick(&mut self) {
        self.clean_activity();
        let mut skips: u8 = 0;
        for y in 0..self.height {
            for x in 0..self.width {
                let i = self.get_index(x, y);
                if skips == 0 {
                    skips = self.get_skips(x, y);
                }
                if skips > 0 {
                    for n in 0..3 {
                        let cell = self.cells[i + n];
                        if cell > 0 && cell < 255 {
                            self.swap[i + n] = wither(cell);
                        }
                    }
                    skips -= 1;
                    continue;
                }
                let neig = self.neighbors(x, y);
                let live_neighbors = self.live_neighbor_count(&neig);
                for n in 0..3 {
                    let cell = self.cells[i + n];
    
                    let (next_cell, activity) = match (cell == 255, live_neighbors[n]) {
                        (true, 2 | 3) => (255, false),
                        (true, _) => (wither(cell), true),
                        (false, 3) => (255, true),
                        (_, _) => (wither(cell), false),
                    };
    
                    self.swap[i + n] = next_cell;
                    if activity {
                        self.add_activities(x, y, &neig);
                    }
                }
            }
        }

        std::mem::swap(&mut self.cells, &mut self.swap);
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
        let i = self.get_index(x, y);
        if i < self.cells.len() {
            for n in 0..3 {
                if self.random.next_float() > self.cursor_place_chance {
                    self.cells[i + n] = 255;
                    self.add_activity(x, y);
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
        self.swap = vec![255; (width * height * 4) as usize];
        self.activity = vec![255; ((width * height + 7) / 8) as usize];
        self.swap_activity = vec![255; ((width * height + 7) / 8) as usize];
    }

    pub fn fill_random(&mut self) {
        for i in 0..self.cells.len() {
            if i % 4 < 3 && self.random.next_float() > 0.4 {
                self.cells[i] = 255;
            }
        }
    }

    fn clean_activity(&mut self) {
        std::mem::swap(&mut self.activity, &mut self.swap_activity);
        self.swap_activity.fill(0);
    }

    fn get_skips(&self, x: u32, y: u32) -> u8 {
        let i = y * self.width + x;
        let chunk = self.activity[(i / 8) as usize];
        let skips = u8::leading_zeros(chunk) as i8 - (i % 8) as i8;
        skips.max(0) as u8
    }

    fn add_activity(&mut self, x: u32, y: u32) {
        self.add_activities(x, y, &self.neighbors(x, y));
    }

    fn add_activities(&mut self, x: u32, y: u32, neig: &[(u32, u32); 8]) {
        for &(nx, ny) in once(&(x, y)).chain(neig.iter()) {
            let i = ny * self.width + nx;
            self.swap_activity[(i / 8) as usize] |= 1 << (7 - i % 8);
        }
    }

    fn get_index(&self, x: u32, y: u32) -> usize {
        ((y * self.width + x) * 4) as usize
    }

    fn live_neighbor_count(&self, neig: &[(u32, u32); 8]) -> [u8; 3] {
        let mut count = [0; 3];
        for (nx, ny) in neig {
            let i = self.get_index(*nx, *ny);
            add_if_alive(self.cells[i], &mut count[0]);
            add_if_alive(self.cells[i + 1], &mut count[1]);
            add_if_alive(self.cells[i + 2], &mut count[2]);
        }
        count
    }

    fn neighbors(&self, x: u32, y: u32) -> [(u32, u32); 8] {
        let n = if y == 0 {
            self.height - 1
        } else {
            y - 1
        };
    
        let s = if y == self.height - 1 {
            0
        } else {
            y + 1
        };
    
        let w = if x == 0 {
            self.width - 1
        } else {
            x - 1
        };
    
        let e = if x == self.width - 1 {
            0
        } else {
            x + 1
        };

        [
            (w, n),
            (x, n),
            (e, n),
            (w, y),
            (e, y),
            (w, s),
            (x, s),
            (e, s),
        ]
    }
}

fn add_if_alive(cell: u8, var: &mut u8) {
    if cell == 255 {
        *var += 1;
    }
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
