const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outputDir, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function createSvg(size) {
  const r = Math.round(size * 0.2225);

  const parts = [
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" xmlns="http://www.w3.org/2000/svg">',
    '<rect width="' + size + '" height="' + size + '" fill="#0f172a" rx="' + r + '"/>',
    '<g transform="translate(' + Math.round(size * 0.08) + ',' + Math.round(size * 0.25) + ') scale(' + (size / 190).toFixed(4) + ')">',
    '<g transform="skewX(-18)">',
    '<rect x="15" y="5" width="40" height="50" rx="4" fill="#0284c7"/>',
    '<text x="35" y="41" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-style="italic" font-size="34" fill="#ffffff" text-anchor="middle">F</text>',
    '<rect x="60" y="5" width="40" height="50" rx="4" fill="#f97316"/>',
    '<text x="80" y="41" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-style="italic" font-size="34" fill="#ffffff" text-anchor="middle">D</text>',
    '<rect x="105" y="5" width="40" height="50" rx="4" fill="#22c55e"/>',
    '<text x="125" y="41" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-style="italic" font-size="34" fill="#ffffff" text-anchor="middle">I</text>',
    '</g>',
    '</g>',
    '</svg>'
  ];

  return parts.join('\n');
}

sizes.forEach(function(size) {
  var svg = createSvg(size);
  var svgFile = path.join(outputDir, 'icon-' + size + '.svg');
  var pngFile = path.join(outputDir, 'icon-' + size + '.png');
  fs.writeFileSync(svgFile, svg, 'utf8');
  fs.writeFileSync(pngFile, svg, 'utf8');
  console.log('OK: icon-' + size + '.png');
});

console.log('All ' + sizes.length + ' icons created in ' + outputDir);
