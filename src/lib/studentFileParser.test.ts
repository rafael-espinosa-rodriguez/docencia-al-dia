import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseStudentFile } from './studentFileParser';

describe('studentFileParser', () => {
  it('parses XLSX file with headers correctly', async () => {
    const data = [
      ['N°', 'Código', 'Nombre del Estudiante'],
      [1, '202401', 'Alejandro Martínez'],
      [2, '202402', 'Camila Andrea Rodríguez'],
      [3, '202403', 'Daniel Esteban Gómez']
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
    const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([u8], 'alumnos.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const students = await parseStudentFile(file);

    expect(students).toHaveLength(3);
    expect(students[0].name).toBe('Alejandro Martínez');
    expect(students[0].code).toBe('202401');
    expect(students[1].name).toBe('Camila Andrea Rodríguez');
  });

  it('parses CSV file without headers using first column', async () => {
    const csvContent = "Lucía Valentina Fernández\nMateo Sebastián Morales\nSofía Elena Vargas";
    const file = new File([csvContent], 'lista.csv', { type: 'text/csv' });

    const students = await parseStudentFile(file);

    expect(students).toHaveLength(3);
    expect(students[0].name).toBe('Lucía Valentina Fernández');
    expect(students[1].name).toBe('Mateo Sebastián Morales');
    expect(students[2].name).toBe('Sofía Elena Vargas');
  });

  it('deduplicates identical student names', async () => {
    const csvContent = "Carlos Díaz\nCarlos Díaz\nAna Belén";
    const file = new File([csvContent], 'lista.csv', { type: 'text/csv' });

    const students = await parseStudentFile(file);
    expect(students).toHaveLength(2);
    expect(students[0].name).toBe('Carlos Díaz');
    expect(students[1].name).toBe('Ana Belén');
  });
});
