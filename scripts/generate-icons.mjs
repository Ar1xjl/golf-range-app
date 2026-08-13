// Genera los PNG de icono de la PWA a partir de src/icon.svg.
// Correr de nuevo con `npm run icons` si en algun momento se cambia el logo.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, '..', 'src', 'icon.svg');
const outDir = path.join(__dirname, '..', 'public', 'icons');
const svg = readFileSync(svgPath);

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'icon-180.png', size: 180 }, // apple-touch-icon
];

for (const { file, size } of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, file));
  console.log('generated', file);
}
