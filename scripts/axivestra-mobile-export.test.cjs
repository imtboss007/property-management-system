const fs = require("node:fs");
const assert = require("node:assert/strict");

const helper = fs.readFileSync("src/lib/mobile-export.ts", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(helper, /@capacitor\/filesystem/);
assert.match(helper, /@capacitor\/share/);
assert.match(helper, /Directory\.Cache/);
assert.match(helper, /Share\.share\([\s\S]*files:\s*\[saved\.uri\]/);
assert.match(helper, /Capacitor\.isNativePlatform\(\)/);
assert.match(helper, /URL\.createObjectURL\(blob\)/);
assert.match(helper, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 60_000\)/);
assert.match(app, /saveBlobForUser\(blob,filename\)/);
assert.match(app, /saveBlobForUser\(blob, filename\)/);
assert.match(app, /saveBlobForUser\(saved\.file, saved\.name\)/);
assert.equal(pkg.dependencies["@capacitor/filesystem"], "^6.0.4");
assert.equal(pkg.dependencies["@capacitor/share"], "^6.0.2");
assert.match(pkg.scripts.test, /axivestra-mobile-export\.test\.cjs/);

console.log("AXIVESTRA mobile export contracts passed.");
