import * as XLSX from 'xlsx';

export interface ParsedStudentItem {
  name: string;
  code?: string;
}

export async function parseStudentFile(file: File): Promise<ParsedStudentItem[]> {
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');
  let workbook: XLSX.WorkBook;

  if (isCsv) {
    const text = await file.text();
    workbook = XLSX.read(text, { type: 'string' });
  } else {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: 'array' });
  }

  // Leer la primera hoja
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo no contiene hojas de cálculo válidas.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  // Convertir a matriz 2D (filas x columnas)
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rows || rows.length === 0) {
    throw new Error('El archivo está vacío.');
  }

  // Buscar si la fila 0 o 1 tiene encabezados reconocibles
  let nameColIdx = -1;
  let codeColIdx = -1;
  let startRowIdx = 0;

  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const cellText = String(row[c]).toLowerCase().trim();
      if (
        cellText.includes('nombre') || 
        cellText.includes('estudiante') || 
        cellText.includes('alumno') ||
        cellText.includes('apellidos')
      ) {
        nameColIdx = c;
        startRowIdx = r + 1;
      }
      if (
        cellText.includes('código') || 
        cellText.includes('codigo') || 
        cellText.includes('carnet') || 
        cellText.includes('id') || 
        cellText.includes('ci') ||
        cellText.includes('dni')
      ) {
        codeColIdx = c;
      }
    }
    if (nameColIdx !== -1) break;
  }

  // Si no se encontró encabezado explícito, inferir:
  // Si la primera columna parece un número o código corto y la segunda es texto largo -> col 1 es nombre
  if (nameColIdx === -1) {
    // Si la col 0 tiene nombres (longitud > 3 y con espacios), es col 0; si col 0 es solo números, nombre es col 1
    const sampleVal0 = String(rows[0]?.[0] || '');
    const sampleVal1 = String(rows[0]?.[1] || '');

    if (/^\d+$/.test(sampleVal0) && sampleVal1.length > 2) {
      codeColIdx = 0;
      nameColIdx = 1;
    } else {
      nameColIdx = 0;
    }
    startRowIdx = 0;
  }

  const results: ParsedStudentItem[] = [];
  const seenNames = new Set<string>();

  for (let r = startRowIdx; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawName = String(row[nameColIdx] || '').trim();
    // Descartar encabezados residuales o cadenas vacías
    if (!rawName || rawName.length < 2) continue;
    const lowerName = rawName.toLowerCase();
    if (
      lowerName === 'nombres' || 
      lowerName === 'nombre' || 
      lowerName === 'estudiante' || 
      lowerName === 'apellidos y nombres' ||
      lowerName === 'alumno'
    ) {
      continue;
    }

    let code: string | undefined;
    if (codeColIdx !== -1 && row[codeColIdx]) {
      const rawCode = String(row[codeColIdx]).trim();
      if (rawCode && rawCode.length > 0 && !/^(código|codigo|carnet|id)$/i.test(rawCode)) {
        code = rawCode;
      }
    }

    if (!seenNames.has(rawName)) {
      seenNames.add(rawName);
      results.push({ name: rawName, code });
    }
  }

  if (results.length === 0) {
    throw new Error('No se detectaron nombres de estudiantes en el archivo.');
  }

  return results;
}
