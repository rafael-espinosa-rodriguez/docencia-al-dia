/**
 * Convierte oklch() a hex/rgb() en el CSS generado.
 *
 * Motivo: Tailwind v4 emite su paleta por defecto en oklch() (66 tokens
 * --color-*). oklch() solo existe desde Chrome/WebView 111, así que en
 * terminales antiguos cualquier `color: var(--color-amber-500)` se descarta
 * y los textos/fondos pierden color.
 *
 * Se aplica al final del build (generateBundle) para que el fuente siga
 * siendo legible y cualquier utilidad nueva que use la paleta quede cubierta.
 *
 * Uso: node scripts/oklch-to-hex.mjs   (auto-test; también lo importa vite.config.ts)
 */

/** oklch → sRGB 8 bits con recorte de gamut. Devuelve [r, g, b]. */
export function oklchToRgb(lightness, chroma, hueDeg) {
  const L = lightness > 1 ? lightness / 100 : lightness;
  const h = (hueDeg * Math.PI) / 180;
  const a = chroma * Math.cos(h);
  const b = chroma * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return linear.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  });
}

const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

/**
 * Sustituye todas las funciones oklch() de un bloque de CSS.
 * @returns {{ css: string, count: number }}
 */
export function convertOklch(css) {
  let count = 0;
  const out = css.replace(
    /oklch\(\s*([-\d.]+)(%?)\s+([-\d.]+)\s+([-\d.]+)\s*(?:\/\s*([-\d.]+)(%?))?\s*\)/g,
    (whole, l, lUnit, c, h, alpha, alphaUnit) => {
      count += 1;
      const rgb = oklchToRgb(parseFloat(l), parseFloat(c), parseFloat(h));
      if (alpha === undefined) return hex(rgb);
      const a = alphaUnit === '%' ? parseFloat(alpha) / 100 : parseFloat(alpha);
      return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
    },
  );
  return { css: out, count };
}

/** Plugin Vite: reescribe los assets CSS del bundle antes de escribirlos. */
export function oklchToHexPlugin() {
  return {
    name: 'oklch-to-hex',
    generateBundle(_options, bundle) {
      let total = 0;
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue;
        const { css, count } = convertOklch(String(file.source));
        if (count > 0) {
          file.source = css;
          total += count;
        }
      }
      if (total > 0) console.log(`  oklch→hex: ${total} tokens convertidos`);
    },
  };
}

// Auto-test al ejecutarlo directamente: valores de la paleta de Tailwind v4
// contrastados con colour-science (python) como implementación de referencia.
if (process.argv[1] && process.argv[1].endsWith('oklch-to-hex.mjs')) {
  const casos = [
    ['oklch(76.9% .188 70.08)', '#fe9a00'], // amber-500
    ['oklch(82.7% .119 91.605)', '#e2c466'],
    ['oklch(55.5% .163 48.998)', '#bb4d00'],
    ['oklch(72.1% .179 149.214)', '#39c262'], // ±1 por redondeo
    ['oklch(60.6% .25 292.717)', '#8e51ff'], // violet-500
    ['oklch(100% 0 0)', '#ffffff'],
    ['oklch(0% 0 0)', '#000000'],
  ];
  const canales = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  let bad = 0;
  for (const [input, esperado] of casos) {
    const { css } = convertOklch(input);
    const got = canales(css);
    const want = canales(esperado);
    // ±1 por diferencia de redondeo entre implementaciones.
    const ok = got.every((v, i) => Math.abs(v - want[i]) <= 1);
    if (!ok) bad += 1;
    console.log(`${ok ? 'ok ' : 'FALLO'}  ${input} → ${css} (esperado ${esperado})`);
  }
  const { count } = convertOklch('a{color:oklch(50% .1 100);background:oklch(1 0 0 / 50%)}');
  if (count !== 2) bad += 1;
  console.log(count === 2 ? 'ok   recuento de conversiones' : `FALLO recuento: ${count}`);
  if (bad > 0) process.exit(1);
  console.log('test oklch→hex: todo correcto');
}
