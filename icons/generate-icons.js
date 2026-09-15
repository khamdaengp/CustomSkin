// Node script to generate valid 16x16, 48x48, 128x128 PNG icons for CustomSkin
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function createPNG(size) {
  // RGBA pixels
  const rawData = Buffer.alloc(size * (size * 4 + 1)); // 1 filter byte per scanline
  let offset = 0;

  const center = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < size; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Smooth squircle shape: (dx/r)^4 + (dy/r)^4 <= 1
      const nx = Math.abs(dx) / radius;
      const ny = Math.abs(dy) / radius;
      const squircle = Math.pow(nx, 4) + Math.pow(ny, 4);

      if (squircle <= 1.0) {
        // Gradient from vibrant indigo (#6366f1) to cyan (#06b6d4)
        const t = (x + y) / (size * 2);
        let r = Math.round(99 * (1 - t) + 6 * t);
        let g = Math.round(102 * (1 - t) + 182 * t);
        let b = Math.round(241 * (1 - t) + 212 * t);

        // Render a stylized paintbrush/swatch emblem
        const isSlash = Math.abs(dx + dy) < (size * 0.12) && dist < (radius * 0.7);
        const isDot = (Math.hypot(dx - radius * 0.25, dy + radius * 0.25) < size * 0.09) ||
                      (Math.hypot(dx + radius * 0.25, dy - radius * 0.25) < size * 0.09);

        if (isSlash || isDot) {
          // Crisp white emblem
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 255;
          rawData[offset++] = 255;
        } else {
          rawData[offset++] = r;
          rawData[offset++] = g;
          rawData[offset++] = b;
          const alpha = squircle > 0.88 ? Math.round(255 * (1 - (squircle - 0.88) / 0.12)) : 255;
          rawData[offset++] = Math.max(0, Math.min(255, alpha));
        }
      } else {
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
        rawData[offset++] = 0;
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname);
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const pngBuffer = createPNG(size);
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, pngBuffer);
  console.log(`Generated ${filePath} (${pngBuffer.length} bytes)`);
});
