/**
 * Incrusta la fuente de iconos Material Symbols como data URI (base64) dentro
 * de src/icon-font.embedded.css.
 *
 * Motivo (bug de distribución): el CSS se copia a assets/public pero el
 * archivo .woff2 podía no viajar junto (build desde Android Studio sin
 * `npm run build && npx cap sync`), y entonces los iconos se renderizaban
 * como texto crudo ("school", "calendar_month"...). Con el data URI dentro
 * del propio CSS, el ícono viaja siempre con el archivo que define la regla:
 * no hay dependencia externa ni ruta que se pueda perder.
 *
 * Además retira de src/fonts.css el @font-face de Material Symbols (si
 * existiera) para no duplicar la definición de la familia.
 *
 * Uso: node scripts/embed-icon-font.mjs   (npm run embed-icons)
 * Sin red: lee public/fonts/.
 */
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'fonts');
const CSS_OUT = path.join(ROOT, 'src', 'icon-font.embedded.css');
const FONTS_CSS = path.join(ROOT, 'src', 'fonts.css');

// Preferencia: el subconjunto (~7 KB). Si no existe, la fuente completa.
const CANDIDATES = [
  'material-symbols-outlined-subset.woff2',
  'material-symbols-outlined-full.woff2',
];

const FAMILY = 'Material Symbols Outlined';

const ICON_FACE_BLOCK = new RegExp(
  String.raw`@font-face\s*\{[^}]*font-family:\s*'${FAMILY}';[^}]*\}\s*`,
  'g',
);

async function pickSource() {
  for (const name of CANDIDATES) {
    const file = path.join(OUT_DIR, name);
    if (await stat(file).catch(() => null)) return { file, name };
  }
  throw new Error(
    `No se encontró ninguna fuente de iconos en public/fonts (${CANDIDATES.join(
      ', ',
    )}). Ejecuta: npm run fetch-fonts`,
  );
}

/** @returns {Promise<{bytes:number, source:string}>} */
export async function embedIconFont() {
  const { file, name } = await pickSource();
  const bytes = await readFile(file);
  if (bytes.length < 1000) {
    throw new Error(`${name} demasiado pequeño (${bytes.length} B): fuente corrupta`);
  }
  if (bytes.subarray(0, 4).toString('latin1') !== 'wOF2') {
    throw new Error(`${name} no es un woff2 válido (magic != wOF2)`);
  }

  const b64 = bytes.toString('base64');
  const css = [
    '/* Archivo generado por scripts/embed-icon-font.mjs — no editar a mano. */',
    `/* ${name} incrustado como data URI: los iconos no dependen de ningún`,
    '   archivo externo ni de que el bundle de assets se copie completo. */',
    '@font-face {',
    `  font-family: '${FAMILY}';`,
    '  font-style: normal;',
    '  font-weight: 100 700;',
    `  src: url(data:font/woff2;base64,${b64}) format('woff2');`,
    '  font-display: block;',
    '}',
    '',
  ].join('\n');
  await writeFile(CSS_OUT, css, 'utf8');

  // Evita definiciones duplicadas de la familia en fonts.css (generado).
  const fontsCss = await readFile(FONTS_CSS, 'utf8').catch(() => '');
  const stripped = fontsCss.replace(ICON_FACE_BLOCK, '');
  if (stripped !== fontsCss) await writeFile(FONTS_CSS, stripped, 'utf8');

  const kb = (bytes.length / 1024).toFixed(1);
  const outKb = (Buffer.byteLength(css) / 1024).toFixed(1);
  console.log(`  ${name}  ${kb} KB -> data URI en src/icon-font.embedded.css (${outKb} KB)`);
  if (bytes.length > 512 * 1024) {
    console.warn(
      `  AVISO: ${name} pesa ${(bytes.length / 1024 / 1024).toFixed(1)} MB; ` +
        'se recomienda el subconjunto (npm run fetch-fonts).',
    );
  }
  return { bytes: bytes.length, source: name };
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  embedIconFont().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
