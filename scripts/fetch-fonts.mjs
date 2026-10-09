/**
 * Descarga las fuentes usadas por la app a public/fonts/ y genera src/fonts.css.
 *
 * Motivo: la app es 100% offline (PRD). Las fuentes se servían desde
 * fonts.googleapis.com, por lo que en un dispositivo sin internet los iconos
 * Material Symbols se renderizaban como texto crudo ("school", "check_circle"...).
 *
 * Los iconos se subconjuntan localmente con scripts/subset-icons.py: Google no
 * subconjunta esa familia vía &text= y un subset simple arrastra los ~6600
 * glifos (todas las ligaduras comparten las mismas letras). Si Python o la
 * verificación fallan, se copia la fuente completa (~4 MB) como alternativa.
 *
 * Uso: node scripts/fetch-fonts.mjs   (npm run fetch-fonts)
 * Requiere: red; y `pip install fonttools brotli uharfbuzz` para los iconos.
 */
import { spawnSync } from 'node:child_process';
import {
  mkdir,
  open,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'fonts');
const CACHE_DIR = path.join(ROOT, 'scripts', '.font-cache');
const CSS_OUT = path.join(ROOT, 'src', 'fonts.css');

// UA de Chrome moderno: obligatorio para que Google devuelva woff2.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const TEXT_FAMILIES = [
  { query: 'Inter:wght@400;500;600;700;800', slug: 'inter' },
  { query: 'Newsreader:wght@400;600;700', slug: 'newsreader' },
  { query: 'JetBrains+Mono:wght@400;500;600;700', slug: 'jetbrains-mono' },
];

const WANTED_SUBSETS = new Set(['latin', 'latin-ext']);

const ICON_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined' +
  ':opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block';
const ICON_SUBSET_FILE = 'material-symbols-outlined-subset.woff2';
const ICON_FULL_FILE = 'material-symbols-outlined-full.woff2';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, options, { timeout = 20_000, attempts = 4 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        // Google puede dejar colgadas las peticiones cuando limita la descarga.
        signal: AbortSignal.timeout(timeout),
      });
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status} para ${url}`);
      if (res.status < 500 && res.status !== 429) break;
    } catch (err) {
      lastErr = err;
    }
    await sleep(800 * (i + 1));
  }
  throw lastErr;
}

async function fetchText(url) {
  const res = await fetchWithRetry(url, {
    headers: { 'User-Agent': UA, Accept: 'text/css,*/*;q=0.1' },
  });
  return res.text();
}

async function isWoff2(file) {
  try {
    const { size } = await stat(file);
    const fh = await open(file, 'r');
    const magic = Buffer.alloc(4);
    await fh.read(magic, 0, 4, 0);
    await fh.close();
    return size > 1000 && magic.toString('latin1') === 'wOF2';
  } catch {
    return false;
  }
}

async function download(url, dest, { force = false, timeout = 20_000 } = {}) {
  // Reanudable: si el archivo ya está completo y es un woff2 válido, no se
  // vuelve a descargar (Google limita la descarga automatizada).
  if (!force && (await isWoff2(dest))) return -1;
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } }, { timeout });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 4).toString('latin1') !== 'wOF2') {
    throw new Error(`Respuesta no-woff2 de ${url} (${buf.length} bytes)`);
  }
  await writeFile(dest, buf);
  return buf.length;
}

/** Extrae los bloques @font-face con su comentario de subset (/* latin *\/). */
function parseFontFaces(css) {
  const faces = [];
  const re = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const subset = m[1];
    const body = m[2];
    const family = /font-family:\s*(['"])(.*?)\1/.exec(body)?.[2];
    const weight = /font-weight:\s*([^;]+);/.exec(body)?.[1].trim();
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1].replace(/['"]/g, '');
    const unicodeRange = /unicode-range:\s*([^;]+);/.exec(body)?.[1].trim();
    if (family && weight && url && unicodeRange) {
      faces.push({ subset, family, weight, url, unicodeRange });
    }
  }
  return faces;
}

function fontFaceRule({ family, weight, url, unicodeRange }) {
  return [
    '@font-face {',
    `  font-family: '${family}';`,
    '  font-style: normal;',
    `  font-weight: ${weight};`,
    `  src: url('${url}') format('woff2');`,
    ...(unicodeRange ? [`  unicode-range: ${unicodeRange};`] : []),
    '  font-display: swap;',
    '}',
  ].join('\n');
}

async function listSourceFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listSourceFiles(full)));
    else if (/\.(tsx|ts|html)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * Lista de símbolos Material Symbols usados en el código, leída del propio
 * fuente para que nunca quede desactualizada (incluye los nombres que solo
 * aparecen dentro de expresiones condicionales).
 */
async function collectIconSymbols() {
  const files = await listSourceFiles(path.join(ROOT, 'src'));
  const html = path.join(ROOT, 'index.html');
  if (await stat(html).catch(() => null)) files.push(html);

  const names = new Set();
  const unresolved = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const re = /material-symbols-outlined[^>]*>([\s\S]*?)</g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const content = m[1].trim();
      if (/^[a-z_0-9]+$/.test(content)) {
        names.add(content);
        continue;
      }
      // Expresiones condicionales: solo interesan las ramas del ternario,
      // no la condición (p. ej. `x === 'dark' ? 'dark_mode' : 'light_mode'`).
      const ternary = [
        ...content.matchAll(
          /\?\s*['"]([a-z_][a-z_0-9]*)['"]\s*:\s*['"]([a-z_][a-z_0-9]*)['"]/g,
        ),
      ].flatMap((x) => [x[1], x[2]]);
      const literals =
        ternary.length > 0
          ? ternary
          : [...content.matchAll(/['"]([a-z_][a-z_0-9]*)['"]/g)].map((x) => x[1]);
      if (literals.length > 0) literals.forEach((l) => names.add(l));
      else unresolved.push(`${path.relative(ROOT, file)}: ${content.slice(0, 60)}`);
    }
  }
  if (unresolved.length > 0) {
    throw new Error('No se pudo determinar el icono en:\n  ' + unresolved.join('\n  '));
  }
  if (names.size === 0) {
    throw new Error('No se encontró ningún icono material-symbols-outlined');
  }
  return [...names].sort();
}

function pythonBin() {
  const candidates =
    process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  for (const bin of candidates) {
    if (spawnSync(bin, ['--version'], { encoding: 'utf8' }).status === 0) return bin;
  }
  return null;
}

/** Subconjunta los iconos con scripts/subset-icons.py (con verificación). */
function subsetIcons(fullFont, symbols) {
  const bin = pythonBin();
  if (!bin) return { ok: false, reason: 'no se encontró Python' };
  const res = spawnSync(
    bin,
    [
      path.join(ROOT, 'scripts', 'subset-icons.py'),
      fullFont,
      path.join(OUT_DIR, ICON_SUBSET_FILE),
      symbols.join(','),
    ],
    { encoding: 'utf8' },
  );
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status === 0) return { ok: true };
  return { ok: false, reason: `subset-icons.py terminó con código ${res.status}` };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });

  const rules = [];

  // 1) Tipografías de texto (latin + latin-ext).
  for (const { query, slug } of TEXT_FAMILIES) {
    const css = await fetchText(
      `https://fonts.googleapis.com/css2?family=${query}&display=swap`,
    );
    const faces = parseFontFaces(css).filter((f) => WANTED_SUBSETS.has(f.subset));
    if (faces.length === 0) {
      throw new Error(`No se encontraron @font-face para ${query}`);
    }
    for (const face of faces) {
      const file = `${slug}-${face.weight.replace(/\s+/g, '-')}-${face.subset}.woff2`;
      const bytes = await download(face.url, path.join(OUT_DIR, file));
      console.log(
        bytes < 0
          ? `  ${file}  (ya descargado)`
          : `  ${file}  ${(bytes / 1024).toFixed(1)} KB`,
      );
      rules.push(fontFaceRule({ ...face, url: `/fonts/${file}` }));
    }
  }

  // 2) Iconos Material Symbols: fuente completa cacheada + subconjunto local.
  const symbols = await collectIconSymbols();
  console.log(`  ${symbols.length} símbolos usados en el código`);

  const iconCss = await fetchText(ICON_CSS_URL);
  const iconUrl = /src:\s*url\(([^)]+)\)/.exec(iconCss)?.[1].replace(/['"]/g, '');
  if (!iconUrl) throw new Error('No se encontró el @font-face de Material Symbols');

  const cachedFull = path.join(CACHE_DIR, 'material-symbols-outlined.woff2');
  // El woff2 completo pesa ~4 MB: timeout amplio.
  await download(iconUrl, cachedFull, { timeout: 180_000 });
  console.log(
    `  material-symbols-outlined (completa)  ${(
      (await stat(cachedFull)).size /
      1024 /
      1024
    ).toFixed(1)} MB  [cacheado en scripts/.font-cache]`,
  );

  const result = subsetIcons(cachedFull, symbols);
  const iconFile = result.ok ? ICON_SUBSET_FILE : ICON_FULL_FILE;
  if (result.ok) {
    await unlink(path.join(OUT_DIR, ICON_FULL_FILE)).catch(() => {});
  } else {
    console.warn(`  AVISO: sin subconjunto de iconos (${result.reason}).`);
    console.warn('  Se usará la fuente completa (~4 MB).');
    await writeFile(path.join(OUT_DIR, iconFile), await readFile(cachedFull));
    await unlink(path.join(OUT_DIR, ICON_SUBSET_FILE)).catch(() => {});
  }
  console.log(
    `  ${iconFile}  ${(
      (await stat(path.join(OUT_DIR, iconFile))).size / 1024
    ).toFixed(1)} KB`,
  );

  rules.push(
    [
      '@font-face {',
      "  font-family: 'Material Symbols Outlined';",
      '  font-style: normal;',
      '  font-weight: 100 700;',
      `  src: url('/fonts/${iconFile}') format('woff2');`,
      '  font-display: block;',
      '}',
    ].join('\n'),
  );

  const header = [
    '/* Archivo generado por scripts/fetch-fonts.mjs — no editar a mano. */',
    '/* Fuentes auto-hospedadas: la app debe funcionar 100% offline. */',
    '',
  ].join('\n');
  await writeFile(CSS_OUT, `${header}${rules.join('\n\n')}\n`, 'utf8');
  console.log(`\n${rules.length} @font-face escritos en src/fonts.css`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
