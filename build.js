import fs from 'fs';
import path from 'path';

function copyFolderRecursiveSync(sources, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  sources.forEach(src => {
    if (!fs.existsSync(src)) return;
    const stats = fs.statSync(src);
    const destName = path.basename(src);
    const destPath = path.join(target, destName);

    if (stats.isDirectory()) {
      copyDir(src, destPath);
    } else {
      fs.copyFileSync(src, destPath);
    }
  });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log("🚀 Starting Cross-Platform Build Copy...");
const rootFiles = [
  'index.html',
  'main.js',
  'physics-worker.js',
  'style.css',
  'vite.config.js',
  'server.js',
  'network.config.js',
  'README.md',
  '.env.example',
  'assets',
  'shaders',
  'include',
  'src',
  'examples',
  'maps',
  'docs'
];

try {
  copyFolderRecursiveSync(rootFiles, 'dist');
  console.log("✅ Cross-Platform Build Copy Succeeded! All files copied to /dist.");
} catch (err) {
  console.error("❌ Build Copy Failed:", err);
  process.exit(1);
}
