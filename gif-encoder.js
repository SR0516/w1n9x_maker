'use strict';

/*
 * Small self-contained animated GIF encoder for Win9x UI Generator.
 * Input frames: Uint8ClampedArray RGBA, same width/height.
 */

const HIST_SIZE = 32 * 32 * 32;

function rgbKey(r, g, b) {
  return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
}

function keyToRgb(key) {
  const r5 = (key >> 10) & 31;
  const g5 = (key >> 5) & 31;
  const b5 = key & 31;
  return [(r5 * 255) / 31, (g5 * 255) / 31, (b5 * 255) / 31];
}

function buildPalette(frames, width, height, maxColors = 255) {
  const counts = new Uint32Array(HIST_SIZE);
  const sumR = new Float64Array(HIST_SIZE);
  const sumG = new Float64Array(HIST_SIZE);
  const sumB = new Float64Array(HIST_SIZE);
  const sampleLimit = 180000;
  let hasAlpha = false;

  for (const rgba of frames) {
    const pixels = width * height;
    const step = Math.max(1, Math.ceil(Math.sqrt(pixels / sampleLimit)));
    for (let y = 0; y < height; y += step) {
      const row = y * width;
      for (let x = 0; x < width; x += step) {
        const i = (row + x) * 4;
        const a = rgba[i + 3];
        if (a < 32) {
          hasAlpha = true;
          continue;
        }
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        const k = rgbKey(r, g, b);
        counts[k]++;
        sumR[k] += r;
        sumG[k] += g;
        sumB[k] += b;
      }
    }
  }

  const bins = [];
  for (let k = 0; k < HIST_SIZE; k++) {
    if (counts[k]) bins.push(k);
  }
  bins.sort((a, b) => counts[b] - counts[a]);

  const actualMaxColors = hasAlpha ? Math.min(255, maxColors) : Math.min(256, maxColors);
  const palette = new Uint8Array(256 * 3);
  const used = Math.min(actualMaxColors, bins.length);

  for (let i = 0; i < used; i++) {
    const k = bins[i];
    const c = counts[k];
    palette[i * 3] = Math.round(sumR[k] / c);
    palette[i * 3 + 1] = Math.round(sumG[k] / c);
    palette[i * 3 + 2] = Math.round(sumB[k] / c);
  }

  const nearest = new Uint8Array(HIST_SIZE);
  for (let k = 0; k < HIST_SIZE; k++) {
    const [r, g, b] = keyToRgb(k);
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < used; i++) {
      const pr = palette[i * 3];
      const pg = palette[i * 3 + 1];
      const pb = palette[i * 3 + 2];
      const dr = r - pr, dg = g - pg, db = b - pb;
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    nearest[k] = best;
  }

  const transparentIndex = hasAlpha ? 255 : -1;
  return { palette, nearest, transparentIndex };
}

function indexedPixels(rgba, nearest, transparentIndex) {
  const out = new Uint8Array(rgba.length >> 2);
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    const a = rgba[i + 3];
    if (a < 32 && transparentIndex >= 0) {
      out[p] = transparentIndex;
    } else {
      out[p] = nearest[rgbKey(rgba[i], rgba[i + 1], rgba[i + 2])];
    }
  }
  return out;
}

class ByteWriter {
  constructor() { this.bytes = []; }
  byte(v) { this.bytes.push(v & 255); }
  bytesFrom(arr) { for (let i = 0; i < arr.length; i++) this.bytes.push(arr[i] & 255); }
  u16(v) { this.byte(v); this.byte(v >> 8); }
  ascii(s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  finish() { return Uint8Array.from(this.bytes); }
}

function lzwEncode(indices, minCodeSize = 8) {
  const clearCode = 1 << minCodeSize; // 256
  const endCode = clearCode + 1;      // 257
  let codeSize = minCodeSize + 1;     // 9
  let maxCode = 1 << codeSize;        // 512
  let nextCode = endCode + 1;         // 258

  const dict = new Map();
  const out = [];
  let cur = 0;
  let bits = 0;

  const writeCode = (code) => {
    cur |= (code << bits);
    bits += codeSize;
    while (bits >= 8) {
      out.push(cur & 255);
      cur >>>= 8;
      bits -= 8;
    }
  };

  const resetDict = () => {
    dict.clear();
    codeSize = minCodeSize + 1;
    maxCode = 1 << codeSize;
    nextCode = endCode + 1;
  };

  writeCode(clearCode);

  if (!indices.length) {
    writeCode(endCode);
    if (bits > 0) out.push(cur & ((1 << bits) - 1));
    return out;
  }

  let prefix = indices[0];

  for (let i = 1; i < indices.length; i++) {
    const symbol = indices[i];
    const key = (prefix << 8) | symbol;

    if (dict.has(key)) {
      prefix = dict.get(key);
    } else {
      writeCode(prefix);

      if (nextCode < 4096) {
        dict.set(key, nextCode++);
        if (nextCode > maxCode && codeSize < 12) {
          codeSize++;
          maxCode = 1 << codeSize;
        }
      } else {
        writeCode(clearCode);
        resetDict();
      }
      prefix = symbol;
    }
  }

  writeCode(prefix);
  writeCode(endCode);

  if (bits > 0) {
    out.push(cur & ((1 << bits) - 1));
  }

  return out;
}

function writeSubBlocks(writer, bytes) {
  let i = 0;
  while (i < bytes.length) {
    const n = Math.min(255, bytes.length - i);
    writer.byte(n);
    for (let j = 0; j < n; j++) writer.byte(bytes[i + j]);
    i += n;
  }
  writer.byte(0);
}

function encodeGif(frames, width, height, delays, { repeat = 0 } = {}) {
  if (!frames?.length) throw new Error('No animation frames.');
  if (frames.some(f => f.length !== width * height * 4)) throw new Error('Frame size mismatch.');
  if (width > 65535 || height > 65535) throw new Error('GIF dimensions exceed 65535px.');

  const { palette, nearest, transparentIndex } = buildPalette(frames, width, height);
  const indexed = frames.map(frame => indexedPixels(frame, nearest, transparentIndex));
  const w = new ByteWriter();
  w.ascii('GIF89a');
  w.u16(width); w.u16(height);
  w.byte(0xF7); // global color table, 256 colors
  w.byte(0);    // background color index
  w.byte(0);    // pixel aspect
  w.bytesFrom(palette);

  // Netscape loop extension
  w.byte(0x21); w.byte(0xFF); w.byte(11); w.ascii('NETSCAPE2.0');
  w.byte(3); w.byte(1); w.u16(Math.max(0, Math.min(65535, repeat))); w.byte(0);

  const hasTrans = transparentIndex >= 0;

  for (let frameIndex = 0; frameIndex < indexed.length; frameIndex++) {
    const delay = Math.max(1, Math.round((delays[frameIndex] || 83) / 10));
    w.byte(0x21); w.byte(0xF9); w.byte(4);
    const packed = hasTrans ? 0x09 : 0x04;
    w.byte(packed);
    w.u16(Math.min(65535, delay));
    w.byte(hasTrans ? transparentIndex : 0);
    w.byte(0);

    w.byte(0x2C); // Image Descriptor
    w.u16(0); w.u16(0); w.u16(width); w.u16(height);
    w.byte(0); // use global palette

    w.byte(8); // LZW minimum code size
    writeSubBlocks(w, lzwEncode(indexed[frameIndex], 8));
  }

  w.byte(0x3B);
  return w.finish();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { encodeGif };
}
if (typeof window !== 'undefined') {
  window.Win9xGif = { encodeGif };
}