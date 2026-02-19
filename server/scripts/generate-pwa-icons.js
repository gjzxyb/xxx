/**
 * PWA 图标生成脚本
 * 生成简单的占位图标，用于 PWA 功能
 */

const fs = require('fs');
const path = require('path');

// 图标尺寸
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// 创建目录
const iconsDir = path.join(__dirname, '../../client/icons');
const screenshotsDir = path.join(__dirname, '../../client/screenshots');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// 生成简单的 SVG 图标
function generateSVGIcon(size, emoji = '📚', bgColor = '#0ea5e9') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.1}"/>
  <text x="50%" y="50%" font-size="${size * 0.5}" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial, sans-serif" font-weight="bold">${emoji}</text>
</svg>`;
}

// 生成所有图标
console.log('🎨 开始生成 PWA 图标...\n');

sizes.forEach(size => {
  const svg = generateSVGIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);
  fs.writeFileSync(filepath, svg);
  console.log(`✓ 生成: ${filename}`);
});

// 生成快捷方式图标
const shortcutSelection = generateSVGIcon(96, '✓', '#10b981');
fs.writeFileSync(path.join(iconsDir, 'shortcut-selection.svg'), shortcutSelection);
console.log('✓ 生成: shortcut-selection.svg');

const shortcutProfile = generateSVGIcon(96, '👤', '#8b5cf6');
fs.writeFileSync(path.join(iconsDir, 'shortcut-profile.svg'), shortcutProfile);
console.log('✓ 生成: shortcut-profile.svg');

// 生成占位截图
const desktopScreenshot = generateSVGIcon(1280, '🖥️', '#1e293b');
fs.writeFileSync(path.join(screenshotsDir, 'desktop-1.svg'), desktopScreenshot);
console.log('✓ 生成: desktop-1.svg');

const mobileScreenshot = generateSVGIcon(750, '📱', '#1e293b');
fs.writeFileSync(path.join(screenshotsDir, 'mobile-1.svg'), mobileScreenshot);
console.log('✓ 生成: mobile-1.svg');

console.log('\n✅ 所有图标生成完成！');
console.log('\n⚠️  注意：当前生成的是 SVG 占位图标');
console.log('   如需更好的视觉效果，请使用以下方法之一：\n');
console.log('   方法1: 在浏览器中打开 client/generate-icons.html');
console.log('          然后右键保存每个图标为 PNG 格式\n');
console.log('   方法2: 使用在线工具生成图标');
console.log('          推荐: https://realfavicongenerator.net/');
console.log('          或: https://www.pwabuilder.com/imageGenerator\n');
