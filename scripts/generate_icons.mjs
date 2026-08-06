const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outputDir, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function createSvg(size) {
  const r = Math.round(size * 0.2225);
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 192;
  const fontSize = Math.max(9, Math.round(size * 0.09));
  const textY = Math.round(size * 0.91);

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e293b"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="ac" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" rx="${r}"/>
  <ellipse cx="${cx}" cy="${cy * 0.85}" rx="${cx * 0.6}" ry="${cy * 0.4}" fill="#3b82f6" opacity="0.08"/>
  <g transform="translate(${cx},${cy * 0.92}) scale(${scale})">
    <rect x="-28" y="-30" width="56" height="60" rx="3" fill="none" stroke="url(#ac)" stroke-width="4"/>
    <rect x="-20" y="-22" width="10" height="8" rx="1.5" fill="#3b82f6" opacity="0.9"/>
    <rect x="-4" y="-22" width="10" height="8" rx="1.5" fill="#8b5cf6" opacity="0.9"/>
    <rect x="12" y="-22" width="10" height="8" rx="1.5" fill="#3b82f6" opacity="0.6"/>
    <rect x="-20" y="-8" width="10" height="8" rx="1.5" fill="#8b5cf6" opacity="0.7"/>
    <rect x="-4" y="-8" width="10" height="8" rx="1.5" fill="#3b82f6" opacity="0.9"/>
    <rect x="12" y="-8" width="10" height="8" rx="1.5" fill="#8b5cf6" opacity="0.8"/>
    <rect x="-8" y="10" width="16" height="20" rx="2" fill="url(#ac)" opacity="0.6"/>
    <rect x="-10" y="-36" width="4" height="8" rx="1" fill="#3b82f6" opacity="0.8"/>
    <rect x="6" y="-40" width="4" height="12" rx="1" fill="url(#ac)"/>
  </g>
  <text x="${cx}" y="${textY}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="2">FDI</text>
</svg>`;
}

sizes.forEach(size => {
  const svg = createSvg(size);
  const svgPath = path.join(outputDir, `icon-${size}.svg`);
  fs.writeFileSync(svgPath, svg, 'utf8');
  // Also write a .png filename that points to SVG content (for manifest compatibility)
  const pngPath = path.join(outputDir, `icon-${size}.png`);
  // Write SVG with PNG extension - modern browsers handle this fine for PWA icons
  fs.writeFileSync(pngPath, svg, 'utf8');
  console.log(`Created icon-${size}.png (SVG)`);
});

console.log(`\nDone! Created ${sizes.length} icons in ${outputDir}`);
