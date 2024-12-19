
use std::io::Write;

use flate2::Compression;
use flate2::write::ZlibEncoder;
use wasm_bindgen::prelude::*;
use lru::LruCache;
use std::num::NonZeroUsize;

use crate::JsResult;

#[wasm_bindgen]
pub struct ColorProfile {
    palette: [u8; 768],
}

#[wasm_bindgen]
impl ColorProfile {
    pub fn new(rawcolors: &[u32]) -> ColorProfile {
        const BRIGHTNESS: [u32; 4] = [180, 220, 255, 135];
        let mut palette = [0u8; 768];
        for i in 1..rawcolors.len().min(64) {
            let rgb = rawcolors[i];
            let r = 0xFF & (rgb >> 16);
            let g = 0xFF & (rgb >> 8);
            let b = 0xFF &  rgb;
            let ci = i * 12;
            for br in 0..4 {
                let bi = ci + br * 3;
                palette[bi    ] = (r * BRIGHTNESS[br] / 255) as u8;
                palette[bi + 1] = (g * BRIGHTNESS[br] / 255) as u8;
                palette[bi + 2] = (b * BRIGHTNESS[br] / 255) as u8;
            }
        }
        ColorProfile { palette }
    }

    pub fn palette(&self) -> *const u8 {
        self.palette.as_ptr()
    }

    pub fn paint(&self, data: &[u8]) -> Vec<u8> {
        let mut res = vec![0; data.len() * 4];
        for i in 0..data.len() {
            let c = data[i] as usize * 3;
            if c < 12 {
                continue;
            }
            let ii = i * 4;
            res[ii    ] = self.palette[c    ];
            res[ii + 1] = self.palette[c + 1];
            res[ii + 2] = self.palette[c + 2];
            res[ii + 3] = 255;
        }
        res
    }

    pub fn create_indexed_png(&self, width: usize, height: usize, pixels: &[u8], compression_level: u8) -> JsResult<Vec<u8>> {
        if width * height != pixels.len() {
            return Err(JsValue::from_str(&format!("Calculated size doesn't match pixels data! {} * {} = {} != {}",
                width, height, width * height, pixels.len())));
        }
        if compression_level > 9 {
            return Err(JsValue::from_str(&format!("Compression level only supports up to 9. Received {}.", compression_level)));
        }
        let mut bytes: Vec<u8> = Vec::with_capacity(1024);
        bytes.extend(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

        let (use_trns, bitdepth, mut reduced_palette, processed_pixels) = reduce_bitdepth(&self.palette, pixels, width);

        let mut ihdr_data = Vec::with_capacity(13);
        ihdr_data.extend((width as u32).to_be_bytes());
        ihdr_data.extend((height as u32).to_be_bytes());
        ihdr_data.push(bitdepth); // Bit depth
        ihdr_data.push(3); // Color type (indexed)
        ihdr_data.push(0); // Compression method
        ihdr_data.push(0); // Filter method
        ihdr_data.push(0); // Interlace method
        bytes.append(&mut create_png_chunk(b"IHDR", &mut ihdr_data));

        bytes.append(&mut create_png_chunk(b"PLTE", &mut reduced_palette));
        if use_trns {
            bytes.append(&mut create_png_chunk(b"tRNS", &mut vec![0]));
        }

        // let mut scanlines = Vec::with_capacity((width + 1) * height);
        // for y in 0..height {
        //     let yw = y * width;
        //     scanlines.push(0);
        //     scanlines.extend(&pixels[yw..(yw + width)]);
        // }
        
        let mut enc = ZlibEncoder::new(Vec::new(), Compression::new(compression_level as u32));
        enc.write_all(&processed_pixels).unwrap();
        bytes.append(&mut create_png_chunk(b"IDAT", &mut enc.finish().unwrap()));

        bytes.append(&mut create_png_chunk(b"IEND", &mut Vec::new()));

        Ok(bytes)
    }

    pub fn convert_nearest(&self, abgrarr: &[i32]) -> Vec<u8> {
        let mut cache: LruCache<i32, u8> = LruCache::new(NonZeroUsize::new(256).unwrap());
        let mut bytes = vec![0u8; abgrarr.len()];
        for i in 0..abgrarr.len() {
            if abgrarr[i] >= 0 {
                continue;
            }
            let bgr = abgrarr[i] & 0xFFFFFF;
            bytes[i] = *cache.get_or_insert(bgr, || self.rmean_near(
                (bgr & 0xFF) as u8,
                ((bgr >> 8) & 0xFF) as u8,
                (bgr >> 16) as u8,
                255
            ))
        }
        bytes
    }
    
    pub fn rmean_near(&self, r: u8, g: u8, b: u8, a: u8) -> u8 {
        if a < 128 {
            return 0;
        }
        let mut nearest = 1;
        let mut dist = f32::INFINITY;

        let mut i = 4 * 3;
        while i < 61 * 4 * 3 {
            let dg = as_f32_sub(self.palette[i + 1], g);
            let mut d = 4.0 * dg * dg;
            if d >= dist {
                i += 3;
                continue;
            }
            let rmean = (self.palette[i] + r) as f32 / 2.0;
            let dr = as_f32_sub(self.palette[i], r);
            let wr = 2.0 + rmean / 256.0;
            d += wr * dr * dr;
            if d >= dist {
                i += 3;
                continue;
            }
            let db = as_f32_sub(self.palette[i + 2], b);
            let wb = 2.0 + (255.0 - rmean) / 256.0;
            d += wb * db * db;
            if d < dist {
                dist = d;
                nearest = i / 3;
            }
            i += 3;
        }
        nearest as u8
    }

}

#[inline]
fn as_f32_sub(a: u8, b: u8) -> f32 {
    a as f32 - b as f32
}

fn create_png_chunk(chunktype: &[u8; 4], data: &mut Vec<u8>) -> Vec<u8> {
    let mut chunk = Vec::with_capacity(data.len() + 12);
    chunk.extend((data.len() as u32).to_be_bytes());
    chunk.extend(chunktype);
    chunk.append(data);
    chunk.extend(crc32fast::hash(&chunk[4..]).to_be_bytes());
    return chunk;
}

/// (use_trns, bitdepth, reduced_palette, processed_pixels)
fn reduce_bitdepth(palette: &[u8], pixels: &[u8], width: usize) -> (bool, u8, Vec<u8>, Vec<u8>) {
    let used = {
        let mut used = [0u32; 256];
        for &v in pixels {
            used[v as usize] += 1;
        }
        used
    };
    let use_trns = !used.starts_with(&[0, 0, 0, 0]);
    let (map, reduced_palette, bitdepth) = {
        let mut sorted = (4..256).filter(|&v| used[v] > 0).collect::<Vec<usize>>();
        let mut pal: Vec<u8> = Vec::with_capacity(sorted.len() * 3 + 3);
        sorted.sort_unstable_by_key(|&i| used[i]);
        sorted.reverse();
        let mut map = [0u8; 256];
        let mut size = 0;
        if use_trns {
            pal.extend(&[0, 0, 0]);
            size += 1;
        }
        for i in sorted {
            map[i] = size;
            let i3 = i * 3;
            pal.extend(&palette[i3..i3 + 3]);
            size += 1;
        }

        let depth = u8::next_power_of_two(8 - u8::leading_zeros(size - 1) as u8);
        (map, pal, depth)
    };
    let processed_pixels: Vec<u8> = {
        let mapped = pixels.iter().map(|&n| map[n as usize]).collect::<Vec<u8>>();
        let scanlines = mapped.chunks(width);
        if bitdepth == 8 {
            scanlines.flat_map(|l| {
                let mut ve = Vec::with_capacity(l.len() + 1);
                ve.push(0);
                ve.extend(l);
                ve
            }).collect::<Vec<u8>>()
        } else {
            scanlines.flat_map(|l| {
                let mut ve = Vec::with_capacity(1 + pixels.len().div_ceil(8 / bitdepth as usize));
                ve.push(0);
                let mut ite = l.iter();
                let mut buf = 0u8;
                let mut bufs = 8u8 - bitdepth;
                while let Some(v) = ite.next() {
                    buf |= v << bufs;
                    if bufs == 0 {
                        ve.push(buf);
                        bufs = 8;
                        buf = 0;
                    }
                    bufs -= bitdepth;
                }
                if bufs < 8u8 - bitdepth {
                    ve.push(buf);
                }
                ve
            }).collect::<Vec<u8>>()
        }
    };
    (use_trns, bitdepth, reduced_palette, processed_pixels)
}
