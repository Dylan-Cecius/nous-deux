const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '..');
const target = path.join(source, '.security-deploy');
fs.mkdirSync(target, { recursive: true });
for (const dir of ['lib', 'src']) {
  fs.rmSync(path.join(target, dir), { recursive: true, force: true });
  fs.cpSync(path.join(source, dir), path.join(target, dir), { recursive: true });
}
for (const file of ['package-lock.json', 'tsconfig.json']) fs.copyFileSync(path.join(source, file), path.join(target, file));
const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
pkg.main = 'lib/core.js';
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
console.log('Security deployment package prepared.');
