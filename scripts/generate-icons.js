const fs = require("fs");
const path = require("path");

// 最小限のPNGを生成する（純粋なNode.js、依存なし）
// フォーマット: PNG chunk構造を手書きで組み立てる

const zlib = require("zlib");

function createPng(size, bgColor, fgColor) {
  const width = size;
  const height = size;

  // RGBAピクセルデータを生成（タブアイコンのシンプルなデザイン）
  const pixels = new Uint8Array(width * height * 4);

  const [bgR, bgG, bgB] = bgColor;
  const [fgR, fgG, fgB] = fgColor;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const px = x / width;
      const py = y / height;

      // 角丸の背景
      const radius = 0.2;
      const inRoundRect =
        px > radius && px < 1 - radius && py > radius && py < 1 - radius ||
        px > 0.05 && px < 0.95 && py > radius && py < 1 - radius ||
        px > radius && px < 1 - radius && py > 0.05 && py < 0.95;

      if (!inRoundRect) {
        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0;
        continue;
      }

      // 3本の横線（タブっぽいアイコン）
      let isFg = false;
      const barPositions = [0.25, 0.45, 0.65];
      const barHeight = 0.1;
      const barLeft = 0.2;
      const barRight = 0.8;
      for (const barY of barPositions) {
        if (py >= barY && py <= barY + barHeight && px >= barLeft && px <= barRight) {
          isFg = true;
          break;
        }
      }
      // 最初のバーは短め（タブの「見出し」風）
      if (py >= barPositions[0] && py <= barPositions[0] + barHeight && px > 0.5) {
        isFg = false;
      }

      pixels[idx]   = isFg ? fgR : bgR;
      pixels[idx+1] = isFg ? fgG : bgG;
      pixels[idx+2] = isFg ? fgB : bgB;
      pixels[idx+3] = 255;
    }
  }

  // PNG構造を組み立てる
  function crc32(buf) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    let crc = 0xffffffff;
    for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crcInput = Buffer.concat([typeBytes, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcInput));
    return Buffer.concat([len, typeBytes, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // IDAT: フィルタバイト付きの行データをDeflate圧縮
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    rawRows.push(0); // filter type: None
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      rawRows.push(pixels[idx], pixels[idx+1], pixels[idx+2], pixels[idx+3]);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(rawRows));

  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", iend),
  ]);
}

const iconsDir = path.join(__dirname, "../icons");
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

const bgColor = [37, 99, 235];   // #2563eb (青)
const fgColor = [255, 255, 255]; // 白

for (const size of [16, 48, 128]) {
  const png = createPng(size, bgColor, fgColor);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icons/icon${size}.png (${png.length} bytes)`);
}
