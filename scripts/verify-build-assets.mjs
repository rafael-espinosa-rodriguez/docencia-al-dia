/**
 * Verificación previa a empaquetar (rompe el build si algo falta).
 *
 * Comprueba que el bundle realmente contiene todo lo necesario para que la app
 * funcione offline en el dispositivo:
 *   - los iconos Material Symbols incrustados como data URI en el CSS
 *     (sin esto los íconos aparecen como texto crudo: "school", "grading"...)
 *   - cada url('/fonts/...') declarada en el CSS resuelve a un archivo
 *   - cero referencias a Google Fonts y cero oklch( en el CSS compilado
 *   - el service worker pre-cachea las fuentes
 *   - la misma comprobación sobre android/app/src/main/assets/public (lo que
 *     realmente viaja al APK vía `cap sync`)
 *
 * Uso: node scripts/verify-build-assets.mjs   (npm run verify-assets)
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ANDROID_PUBLIC = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'public');
const TEXT_WOFF2_RE = /^(?!material-symbols).*\.woff2$/i;

const failures = [];
const ok = (msg) => console.log(`  OK   ${msg}`);
const fail = (msg) => {
  failures.push(msg);
  console.error(`  FAIL ${msg}`);
};

async function exists(file) {
  return !!(await stat(file).catch(() => null));
}

async function listFiles(dir, ext) {
  const out = [];
  if (!(await exists(dir))) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full, ext)));
    else if (!ext || entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/** Verifica un directorio con index.html + *.css + fonts/ (dist o assets público). */
async function verifyBundle(label, dir) {
  console.log(`\n[${label}] ${path.relative(ROOT, dir)}`);

  if (!(await exists(dir))) {
    fail(`${label}: no existe (${path.relative(ROOT, dir)})`);
    return;
  }

  // 1) index.html sin CDNs de fuentes.
  const htmlFile = path.join(dir, 'index.html');
  if (!(await exists(htmlFile))) {
    fail(`${label}: falta index.html`);
  } else {
    const html = await readFile(htmlFile, 'utf8');
    if (/fonts\.(googleapis|gstatic)\.com/i.test(html)) {
      fail(`${label}: index.html referencia Google Fonts`);
    } else {
      ok(`${label}: index.html sin Google Fonts`);
    }
  }

  // 2) CSS compilado.
  const cssFiles = await listFiles(dir, '.css');
  if (cssFiles.length === 0) fail(`${label}: no hay archivos .css`);

  let iconEmbedded = false;
  const missing = [];
  for (const cssFile of cssFiles) {
    const css = await readFile(cssFile, 'utf8');
    const rel = path.relative(ROOT, cssFile);

    if (css.includes('oklch(')) fail(`${label}: ${rel} contiene oklch() (WebView < 111 lo ignora)`);
    if (/fonts\.(googleapis|gstatic)\.com/i.test(css)) fail(`${label}: ${rel} referencia Google Fonts`);
    if (/Material Symbols Outlined/.test(css) && /data:font\/woff2;base64/.test(css)) {
      iconEmbedded = true;
    } else if (/Material Symbols Outlined/.test(css)) {
      fail(`${label}: ${rel} declara Material Symbols sin data URI (iconos dependen de un .woff2 externo)`);
    }

    // Toda url() hacia /fonts/ debe resolver a un archivo real.
    for (const m of css.matchAll(/url\(\s*['"]?(\/fonts\/[^'")]+)['"]?\s*\)/g)) {
      const target = path.join(dir, m[1].replace(/^\//, ''));
      if (!(await exists(target))) missing.push(`${rel} -> ${m[1]}`);
    }
  }
  if (cssFiles.length > 0 && !iconEmbedded) {
    fail(`${label}: ningún CSS contiene los iconos incrustados como data URI`);
  } else if (iconEmbedded) {
    ok(`${label}: iconos Material Symbols incrustados en el CSS (data URI)`);
  }
  if (missing.length > 0) {
    missing.forEach((m) => fail(`${label}: url() a fuentes inexistentes: ${m}`));
  } else if (cssFiles.length > 0) {
    ok(`${label}: todas las url('/fonts/...') del CSS resuelven`);
  }

  // 3) fuentes de texto presentes.
  const fontsDir = path.join(dir, 'fonts');
  const woff2 = (await listFiles(fontsDir, '.woff2')).map((f) => path.basename(f));
  const textFonts = woff2.filter((n) => TEXT_WOFF2_RE.test(n));
  if (textFonts.length < 20) {
    fail(`${label}: solo ${textFonts.length} fuentes de texto en fonts/ (se esperan 24)`);
  } else {
    ok(`${label}: ${textFonts.length} fuentes de texto en fonts/`);
  }

  // 4) service worker (solo donde exista: dist y su copia en assets).
  const swFile = path.join(dir, 'sw.js');
  if (await exists(swFile)) {
    const sw = await readFile(swFile, 'utf8');
    const precached = countOccurrences(sw, 'fonts/');
    if (precached < 20) {
      fail(`${label}: sw.js pre-cachea solo ${precached} recursos de fonts/ (se esperan 24)`);
    } else {
      ok(`${label}: sw.js pre-cachea ${precached} recursos de fonts/`);
    }
  }
}

async function verifySources() {
  console.log('\n[fuentes del repositorio]');

  const embedded = path.join(ROOT, 'src', 'icon-font.embedded.css');
  if (!(await exists(embedded))) {
    fail('falta src/icon-font.embedded.css (npm run embed-icons)');
  } else if (!/data:font\/woff2;base64/.test(await readFile(embedded, 'utf8'))) {
    fail('src/icon-font.embedded.css no contiene el data URI');
  } else {
    ok('src/icon-font.embedded.css con data URI');
  }

  const fontsCss = path.join(ROOT, 'src', 'fonts.css');
  if ((await exists(fontsCss)) && /Material Symbols/.test(await readFile(fontsCss, 'utf8'))) {
    fail('src/fonts.css declara Material Symbols (duplicado con icon-font.embedded.css)');
  } else {
    ok('src/fonts.css sin @font-face de Material Symbols (sin duplicados)');
  }
}

async function main() {
  console.log('Verificación de assets del build…');
  await verifySources();
  await verifyBundle('dist', DIST);
  if (await exists(ANDROID_PUBLIC)) await verifyBundle('android', ANDROID_PUBLIC);

  if (failures.length > 0) {
    console.error(`\n${failures.length} comprobación(es) fallida(s):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    console.error('\nBuild bloqueado: la app no sería 100% offline. Corrige y vuelve a compilar.');
    process.exit(1);
  }
  console.log('\nTodo OK: el bundle es autosuficiente (offline-ready).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
