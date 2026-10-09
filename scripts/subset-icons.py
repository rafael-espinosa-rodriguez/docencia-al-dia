#!/usr/bin/env python3
"""Subconjunta el woff2 de Material Symbols Outlined a los símbolos usados.

Google Fonts no subconjunta esta familia vía `&text=` (devuelve la fuente
completa de ~4 MB) y un subset simple tampoco sirve: todas las ligaduras
comparten las mismas letras (a-z), por lo que el cierre de GSUB vuelve a
arrastrar los ~6600 glifos. Por eso este script:

  1. compone cada símbolo con HarfBuzz para obtener su glifo exacto;
  2. elimina de GSB todas las ligaduras salvo las de esos glifos;
  3. subconjunta con fontTools (ahora sí: ~50 glifos);
  4. verifica de nuevo que las 52 ligaduras sigan componiéndose.

Si la verificación falla se sale con el código 2 para que el llamante use la
fuente completa.

Requiere: pip install fonttools brotli uharfbuzz

Uso:
    python scripts/subset-icons.py <full.woff2> <out.woff2> <simbolo1,simbolo2,...>
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
import uharfbuzz as hb


def shape_names(path: Path, symbols: list[str]) -> dict[str, str]:
    """Compone cada símbolo y devuelve {símbolo: nombre_de_glifo}.

    Debe recibir un .ttf: uharfbuzz no descomprime woff2. Los símbolos que no
    existen como ligadura se descartan con un aviso (son cadenas que no son
    iconos, p. ej. una condición de ternario capturada por error).
    """
    blob = hb.Blob.from_file_path(str(path))
    face = hb.Face(blob)
    font = hb.Font(face)
    ttf = TTFont(str(path))
    order = ttf.getGlyphOrder()
    out: dict[str, str] = {}
    skipped = []
    for name in symbols:
        buf = hb.Buffer()
        buf.add_str(name)
        buf.guess_segment_properties()
        hb.shape(font, buf)
        infos = buf.glyph_infos
        if len(infos) != 1 or infos[0].codepoint == 0:
            skipped.append(name)
            continue
        out[name] = order[infos[0].codepoint]
    ttf.close()
    if skipped:
        print(f"  descartados (no son ligaduras): {', '.join(skipped)}")
    if not out:
        raise SystemExit("ningún símbolo compone como ligadura")
    return out


def prune_ligatures(font: TTFont, keep: set[str]) -> int:
    """Elimina de GSB las ligaduras cuyo glifo no esté en `keep`."""
    if "GSUB" not in font:
        raise SystemExit("la fuente no tiene GSB")
    removed = 0
    for lookup in font["GSUB"].table.LookupList.Lookup:
        for st in lookup.SubTable:
            target = st.ExtSubTable if lookup.LookupType == 7 else st
            if not hasattr(target, "ligatures"):
                continue
            for first, ligs in list(target.ligatures.items()):
                kept = [l for l in ligs if l.LigGlyph in keep]
                removed += len(ligs) - len(kept)
                if kept:
                    target.ligatures[first] = kept
                else:
                    del target.ligatures[first]
    return removed


def save_ttf(font: TTFont, dest: Path) -> None:
    font.flavor = None
    font.save(str(dest))


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print(__doc__)
        return 1
    src, dest, symbols_csv = Path(argv[1]), Path(argv[2]), argv[3]
    symbols = [s.strip() for s in symbols_csv.split(",") if s.strip()]
    if not symbols:
        print("error: sin símbolos")
        return 1

    dest.parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix="iconsubset-"))
    try:
        opts = subset.Options()
        opts.layout_features = ["*"]
        opts.layout_scripts = ["*"]
        opts.glyph_names = True
        opts.name_IDs = ["*"]
        opts.name_legacy = True
        opts.notdef_outline = True
        opts.recalc_bounds = True
        opts.recalc_timestamp = False
        opts.prune_unicode_ranges = False

        font = subset.load_font(str(src), opts)

        # 1) glifo de cada símbolo con la fuente completa
        probe = work / "full.ttf"
        save_ttf(font, probe)
        glyph_of = shape_names(probe, symbols)
        symbols = list(glyph_of)  # solo los que existen como ligadura

        # 2) dejar solo esas ligaduras en GSB
        removed = prune_ligatures(font, set(glyph_of.values()))
        pruned = work / "pruned.ttf"
        save_ttf(font, pruned)
        if shape_names(pruned, symbols) != glyph_of:
            raise SystemExit("el podado de GSB rompió alguna ligadura")

        # 3) subconjuntar (ya sin cierre masivo de GSB)
        ss = subset.Subsetter(options=opts)
        ss.populate(text="".join(symbols))
        ss.subset(font)

        if "fvar" in font:
            # La app no usa font-variation-settings: fijamos los ejes a sus
            # valores por defecto para eliminar gvar/fvar.
            axes = {a.axisTag: a.defaultValue for a in font["fvar"].axes}
            font = instancer.instantiateVariableFont(font, axes, inplace=False)

        # 4) verificación final sobre un ttf temporal
        final_ttf = work / "final.ttf"
        save_ttf(font, final_ttf)
        if shape_names(final_ttf, symbols) != glyph_of:
            raise SystemExit("el subconjunto rompió alguna ligadura")

        opts.flavor = "woff2"
        subset.save_font(font, str(dest), opts)
    finally:
        # En Windows el borrado puede fallar si queda algún handle abierto:
        # no debe impedir usar la fuente ya generada.
        for f in work.glob("*"):
            try:
                f.unlink()
            except OSError as exc:
                print(f"  aviso: no se pudo borrar {f.name}: {exc}")
        try:
            work.rmdir()
        except OSError:
            pass

    size = dest.stat().st_size
    check = TTFont(str(dest))
    n_glyphs = check["maxp"].numGlyphs
    check.close()
    print(
        f"ok  {dest.name}: {size / 1024:.1f} KB, "
        f"{n_glyphs} glifos, {len(symbols)} ligaduras verificadas "
        f"({removed} ligaduras ajenas eliminadas)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
