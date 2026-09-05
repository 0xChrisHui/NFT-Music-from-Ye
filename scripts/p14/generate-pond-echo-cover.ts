import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const SIZE = 1200;
const OUTPUT = join(process.cwd(), 'public', 'pond-echoes', 'cover-v1.png');
const pixels = Buffer.alloc(SIZE * SIZE * 4);

function noise(x: number, y: number): number {
  let value = Math.imul(x + 17, 374_761_393) ^ Math.imul(y + 29, 668_265_263);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffff_ffff;
}

function blend(index: number, color: readonly number[], alpha: number): void {
  const inverse = 1 - alpha;
  pixels[index] = Math.round(pixels[index] * inverse + color[0] * alpha);
  pixels[index + 1] = Math.round(pixels[index + 1] * inverse + color[1] * alpha);
  pixels[index + 2] = Math.round(pixels[index + 2] * inverse + color[2] * alpha);
}

function paintBase(): void {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const index = (y * SIZE + x) * 4;
      const distance = Math.hypot(x - 600, y - 530) / 850;
      const glow = Math.max(0, 1 - distance) ** 2;
      const grain = (noise(x, y) - 0.5) * 5;
      pixels[index] = Math.max(0, Math.round(7 + grain + glow * 15));
      pixels[index + 1] = Math.max(0, Math.round(7 + grain + glow * 20));
      pixels[index + 2] = Math.max(0, Math.round(6 + grain + glow * 16));
      pixels[index + 3] = 255;
    }
  }
}

function paintRing(radius: number, width: number, alpha: number): void {
  const brass = [195, 161, 95] as const;
  const min = Math.floor(600 - radius - width);
  const max = Math.ceil(600 + radius + width);
  for (let y = min; y <= max; y += 1) {
    if (y < 0 || y >= SIZE) continue;
    for (let x = min; x <= max; x += 1) {
      if (x < 0 || x >= SIZE) continue;
      const edge = Math.abs(Math.hypot(x - 600, y - 530) - radius);
      if (edge > width) continue;
      blend((y * SIZE + x) * 4, brass, alpha * (1 - edge / width));
    }
  }
}

function paintDisc(cx: number, cy: number, radius: number, color: readonly number[]): void {
  const minX = Math.floor(cx - radius);
  const maxX = Math.ceil(cx + radius);
  const minY = Math.floor(cy - radius);
  const maxY = Math.ceil(cy + radius);
  for (let y = minY; y <= maxY; y += 1) {
    if (y < 0 || y >= SIZE) continue;
    for (let x = minX; x <= maxX; x += 1) {
      if (x < 0 || x >= SIZE) continue;
      const distance = Math.hypot(x - cx, y - cy);
      if (distance > radius) continue;
      blend((y * SIZE + x) * 4, color, Math.min(1, (radius - distance) / 2));
    }
  }
}

function paintEchoes(): void {
  [118, 214, 318, 430].forEach((radius, index) => paintRing(radius, 2.2, 0.42 - index * 0.06));
  for (let index = 0; index < 36; index += 1) {
    const turn = index * 2.399963 + 0.35;
    const radius = 82 + index * 10.2;
    const x = 600 + Math.cos(turn) * radius;
    const y = 530 + Math.sin(turn) * radius * 0.93;
    const color = index === 0 ? [227, 220, 207] : [195, 161, 95];
    paintDisc(x, y, index === 0 ? 18 : 7 + (index % 4), color);
  }
  paintDisc(600, 530, 25, [227, 220, 207]);
  paintDisc(600, 530, 10, [7, 7, 6]);
}

function crc32(input: Buffer): number {
  let crc = 0xffff_ffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb8_8320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, 'ascii');
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}

function encodePng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    const target = y * (SIZE * 4 + 1);
    scanlines[target] = 0;
    pixels.copy(scanlines, target + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

paintBase();
paintEchoes();
const png = encodePng();
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, png);
console.log(`P14-E5 封面已生成：1200×1200，${png.length} bytes，SHA-256 ${createHash('sha256').update(png).digest('hex')}`);
