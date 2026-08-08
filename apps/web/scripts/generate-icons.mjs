/**
 * Draws the app icons a browser needs to install the site.
 *
 * Written by hand rather than pulled from an image library: the mark is four
 * rectangles and a rounded corner, and a build-time dependency that exists to
 * draw four rectangles is a dependency that will one day break a deploy.
 *
 *   node scripts/generate-icons.mjs
 *
 * Re-run it after changing SIZES or the palette; the output is deterministic,
 * so an unchanged mark produces byte-identical files and no diff.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// The chrome palette from tailwind.config.ts: graphite, not a brand hue.
const INK = [20, 20, 23, 255];
const PAPER = [255, 255, 255, 255];

/**
 * @param {number} size
 * @param {number} padding fraction of the canvas kept clear of the mark. A
 *   maskable icon is cropped to a circle by the launcher, so its mark has to
 *   sit inside the safe zone — 20% on every side.
 * @param {boolean} rounded plain icons carry their own corner radius; maskable
 *   ones must fill the square edge to edge or the launcher mats them.
 */
function drawIcon(size, padding, rounded) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = rounded ? Math.round(size * 0.22) : 0;

  const put = (x, y, [r, g, b, a]) => {
    const at = (y * size + x) * 4;
    pixels[at] = r;
    pixels[at + 1] = g;
    pixels[at + 2] = b;
    pixels[at + 3] = a;
  };

  // Background, with rounded corners cut out as transparent.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      put(x, y, insideRoundedSquare(x, y, size, radius) ? INK : [0, 0, 0, 0]);
    }
  }

  // Three ascending bars: a ledger read at a glance. Drawn in canvas fractions
  // so every size is the same picture rather than the same pixel counts.
  const inset = size * padding;
  const span = size - inset * 2;
  const barWidth = span * 0.2;
  const gap = (span - barWidth * 3) / 2;
  const heights = [0.45, 0.72, 1];

  heights.forEach((height, index) => {
    const left = Math.round(inset + index * (barWidth + gap));
    const right = Math.round(left + barWidth);
    const bottom = Math.round(inset + span);
    const top = Math.round(bottom - span * height);

    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) put(x, y, PAPER);
      }
    }
  });

  return encodePng(size, pixels);
}

function insideRoundedSquare(x, y, size, radius) {
  if (radius === 0) return true;
  const near = (v) =>
    v < radius ? radius - v : v > size - 1 - radius ? v - (size - 1 - radius) : 0;
  const dx = near(x);
  const dy = near(y);
  return dx * dx + dy * dy <= radius * radius;
}

/** Minimal 8-bit RGBA PNG: signature, IHDR, IDAT, IEND. */
function encodePng(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    // Filter byte 0 (None) per scanline — the images are flat colour, so the
    // adaptive filters would buy nothing but complexity.
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([head, body, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

mkdirSync(OUT_DIR, { recursive: true });

const files = [
  ['icon-192.png', drawIcon(192, 0.26, true)],
  ['icon-512.png', drawIcon(512, 0.26, true)],
  // Filled to the edge and padded inside, for Android's adaptive icon crop.
  ['icon-maskable-512.png', drawIcon(512, 0.32, false)],
  // iOS ignores the manifest and takes this one; it is never masked, so it
  // keeps the rounded square iOS would otherwise draw over a transparent edge.
  ['apple-touch-icon.png', drawIcon(180, 0.26, true)],
];

for (const [name, data] of files) {
  writeFileSync(join(OUT_DIR, name), data);
  console.log(`${name}  ${data.length} bytes`);
}
