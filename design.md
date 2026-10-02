# Design Document - EduTrack Mobile

## 1. Arquitectura de Datos (Local-First via Dexie.js)
Estructura en IndexedDB orientada a funcionamiento 100% offline:

- `semesters`: `{ id, name, createdAt }`
- `courses`: `{ id, name, code, semesterId, modality: 'CD' | 'CPE' }`
- `students`: `{ id, name, code, courseId }`
- `attendance`: `{ id, studentId, courseId, date, status: 'present' | 'absent' | 'late' | 'excused' }`
- `evaluations`: `{ id, courseId, name, weight, maxScore }`
- `grades`: `{ id, studentId, evaluationId, score, notes }`

### Regla de Capacidad por Modalidad
- `MAX_COURSES_PER_MODALITY = 5`
- Para un semestre dado $S$ y modalidad $M \in \{'CD', 'CPE'\}$:
  $$\text{Count}(c \in \text{courses} \mid c.\text{semesterId} = S \land c.\text{modality} = M) \le 5$$

## 2. Flujo de Importación de Nómina (.csv / .xlsx)
1. El docente selecciona un archivo `.xlsx`, `.xls` o `.csv` desde su móvil o explorador.
2. La función `parseStudentFile(file)` decodifica el archivo binario usando `XLSX.read()`.
3. Normaliza las columnas:
   - Detecta claves como "nombre", "estudiante", "alumno", "apellidos", "nombres".
   - Detecta código o carnet si existe.
   - Si no hay encabezados identificables, toma la primera columna como nombres de estudiantes.
4. Muestra una vista previa con el conteo de alumnos detectados para confirmar la inserción.
5. Inserción por lotes en Dexie vinculada a la asignatura actual.

## 3. Arquitectura de Capacitor para Empaquetado Nativo
- Archivo de configuración: `capacitor.config.ts`.
- Directorio de distribución: `dist/`.
- Comandos de empaquetado:
  - `npm run build`
  - `npx cap sync`
  - `npx cap open android`
- La app funciona directamente en el navegador del teléfono como PWA y como APK nativo sin bifurcaciones de código.

## 4. System Design: Universitas Magna (Academic Editorial & Canónico)
Sistema de diseño con **Modo Oscuro como visualización por defecto** y selector conmutador a **Modo Claro**:

### 4.1. Filosofía de Marca y Estilo Rectoral
- **Institucional Rectoral Canónico:** Inspirado en sellos universitarios de alta tradición académica suiza y editorial anglosajona (`Cinzel` y `Newsreader`).
- **Modo Oscuro Canónico por Defecto:** Fondo `#080d1a` con tarjetas `#0f172a`, bordes sutiles `border-slate-800` y tipografía de alto contraste `text-slate-100`.
- **Modo Claro de Alto Rendimiento:** Fondo `bg-slate-50`, tarjetas `bg-white`, micro-bordes `border-slate-200` y acentos azul rectoral `bg-blue-900`.
- **Ergonomía Táctil:** Altura mínima de interacción de 48px en botones y cuadrantes de registro.

### 4.2. Tokens de Color Semántico
- **Azul Rectoral (`univ-navy: #0a192f`, `univ-blue: #1e3a8a`, `univ-cobalt: #1d4ed8`):** Navegación, encabezados y llamadas a la acción primarias.
- **Oro Canónico (`univ-gold: #b45309`, `univ-amber: #d97706`, `univ-goldlight: #fef3c7`):** Insignias, iniciales de catedrático, acentos de actas y modo nocturno.
- **Verde Esmeralda (`#059669` / `#10b981`):** Asistencia confirmada (P), actas al día y generación oficial de archivos XLSX.
- **Rojo Carmesí (`#dc2626` / `#ef4444`):** Inasistencias críticas (A), alertas de actas por asentar y calificaciones reprobatorias (<11).

### 4.3. Sistema Tipográfico
- **Cinzel (`font-crest`):** Membrete institucional rectoral (*UNIVERSITAS MAGNA · DOCENCIA DIGITAL*).
- **Newsreader (`font-serif`):** Títulos editoriales solemnes, nombres de cátedras y números romanos.
- **Inter (`font-sans`):** Cuerpos de texto, controles de interfaz y botones de acción rápida.
- **JetBrains Mono (`font-mono`):** Códigos de cátedra (`INF-301`, `ADM-502`), matrículas estudiantiles, estados `P/A/T/J` y marcas de tiempo ISO.

### 4.4. Componentes y Pantallas Clave
1. **Cátedras Asignadas:** Tarjeta ejecutiva universitaria universal con filigrana `§`, badge de activo, indicadores clave (118 matriculados, 91.4% media global, 02 actas pendientes) y desglose estricto CD / CPE con cupos restantes, sin dependencias técnicas ni departamentales.
2. **Control de Asistencia:** Navegación por fechas `< Hoy, [Fecha] >`, bento grid de 4 cuadrantes, botón 1-tap "Todos Presentes", Recharts con curva de tendencia (área o barras) y filas con cuadrantes de 48px (P, A, T, J).
3. **Evaluador Canónico:** Columna activa de Excel con edición inline de encabezado, métricas del grupo, atajos numéricos (-1, +1, 00, 11, 20) y drawer oral con teclado 1-9.
4. **Actas y Secretaría:** Libro canónico de 2 hojas, vista previa de Hoja 1 y Hoja 2, nomenclatura oficial con botón de copiado y descarga instantánea offline en .xlsx.
