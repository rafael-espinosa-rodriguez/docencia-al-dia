# PRD - Docencia al Día: Sistema Móvil de Gestión Académica Universitaria

## 1. Visión General
Docencia al Día es una aplicación móvil profesional diseñada para profesores universitarios. Combina una arquitectura **PWA Local-First (IndexedDB)** con preparación completa para empaquetado nativo mediante **Capacitor**. Funciona 100% offline, permitiendo llevar el control de asistencia y calificaciones tanto en **Curso Diurno (CD)** como en **Curso por Encuentro (CPE)**, con exportación avanzada a Microsoft Excel.

## 2. Objetivos del Producto
- **Movilidad Total**: Diseñada para interacción táctil rápida con una sola mano en el aula.
- **Funcionamiento Offline Robusto**: Almacenamiento local mediante Dexie.js (IndexedDB).
- **Organización Jerárquica Universitaria**:
  - Semestres académicos (ej: 2026-I).
  - Modalidades de clase: **Curso Diurno (CD)** y **Curso por Encuentro (CPE)**.
  - Hasta **5 asignaturas por modalidad** por semestre para el profesor.
  - Estudiantes por asignatura.
- **Importación Inteligente**: Carga de nóminas de estudiantes desde archivos `.xlsx` o `.csv` o pegando listas de texto.
- **Modo Evaluador Especializado**: Flujo enfocado para calificar estudiantes con encabezados dinámicos como "Evaluación 1" o "Prueba Final".
- **Exportación Administrativa**: Generación de reportes Excel multishoet con asistencia detallada, notas y promedios.

## 3. Funcionalidades Principales

### 3.1. Modalidades de Clase
- **Curso Diurno (CD)**: Clases regulares semanales con control estricto de asistencia y evaluaciones continuas.
- **Curso por Encuentro (CPE)**: Clases quincenales/sabatino-dominicales con dinámicas de evaluación y control de asistencia adaptadas.
- **Regla de Negocio**: Cada profesor puede registrar hasta **5 asignaturas en CD** y hasta **5 asignaturas en CPE** por semestre (10 en total por ciclo).

### 3.2. Importación de Estudiantes (.csv / .xlsx)
- Soporte para subir archivos `.xlsx`, `.xls` o `.csv`.
- Detección automática de columnas de nombres ("Nombre", "Estudiante", "Alumno", "Apellidos y Nombres") o lectura por posición.
- Extracción opcional de código/carnet del estudiante.
- Vista previa antes de confirmar la importación.

### 3.3. Módulo de Asistencia
- Registro rápido de 4 estados: Presente (P), Ausente (A), Tardanza (T) y Justificado (J).
- Botón **"Todos Presentes"** para marcar asistencia completa con 1 toque.
- Selector de fechas pasadas y presentes.
- Filtros por asistencia y métricas en vivo.

### 3.4. Modo Evaluador (Calificaciones)
- Creación de evaluaciones con nombres personalizados ("Evaluación 1", "Prueba Final", etc.).
- Vista Lista con botones rápidos (0, Nota Máxima, incremento táctil).
- Vista Paso a Paso (Tarjeta de estudiante individual) para calificar con concentración.
- Cálculo de métricas: promedio del grupo, nota máxima, porcentaje de calificados.

### 3.5. Exportación a Excel
- Archivo `.xlsx` con encabezados exactos de las evaluaciones definidas.
- Hoja 1: Acta consolidada con notas, promedio final, total de clases, asistencias, faltas y % de asistencia.
- Hoja 2: Matriz cronológica de todas las fechas de clase con el estado de cada estudiante.
- Nombre de archivo descriptivo indicando Asignatura, Modalidad (CD o CPE), Semestre y Fecha.

### 3.6. Resumen Visual y Gráficos de Tendencia (Recharts)
- Curva cronológica interactiva de asistencia de los estudiantes durante el semestre.
- Dos modalidades de visualización táctil:
  - **Tasa de Asistencia (%)**: Gráfico de área con degradado suave mostrando la fluctuación del compromiso estudiantil.
  - **Distribución de Alumnos (P / A / T)**: Gráfico de barras apiladas por sesión con presentes, ausentes y tardanzas.
- Métricas instantáneas: promedio global del semestre, total de sesiones dictadas y pico máximo de asistencia.
- Tooltips personalizados con fecha, conteo de presentes/ausentes y tasa porcentual.

### 3.7. Sistema de Diseño: "Universitas Magna" (Editorial Rectoral & Canónico)
- **Modo Oscuro Predeterminado**: La aplicación inicializa y renderiza por defecto en Modo Oscuro (`dark:bg-[#080d1a]`, tarjetas `#0f172a`, acentos azul y oro) garantizando descanso visual en largas jornadas docentes nocturnas o aulas con proyectores. Cuenta con conmutador instantáneo a Modo Claro (`bg-slate-50`).
- **Paleta Canónica**: Azul rectoral (`#0a192f`, `#1e3a8a`, `#1d4ed8`), acentos oro y ámbar (`#b45309`, `#d97706`), verde esmeralda para asistencia y aprobación (`#059669`), y rojo carmesí para ausencias críticas (`#dc2626`).
- **Sistema Tipográfico Cuádruple**:
  - `Cinzel` (`font-crest`): Membrete rectoral y sello canónico.
  - `Newsreader` (`font-serif`): Títulos editoriales solemnes y números romanos.
  - `Inter` (`font-sans`): Cuerpos de texto y legibilidad suiza.
  - `JetBrains Mono` (`font-mono`): Códigos CD/CPE, notas y marcas de tiempo ISO.
- **Micro-interacciones y Ergonomía**: Altura táctil de 48px para todo control interactivo, micro-estados táctiles (`active:scale-95`), barra de navegación inferior de rectorado (Cátedras, Asistencia, Evaluador, Actas) y almacenamiento local soberano sin intermediarios ni dependencias en la nube.

## 4. Stack Tecnológico
- **Frontend**: React 19 + TypeScript + Vite.
- **Estilos**: Tailwind CSS v4 con diseño Mobile-First y navegación táctil ergonómica.
- **Base de Datos Local**: Dexie.js (IndexedDB).
- **Procesamiento de Archivos**: `xlsx` (lectura y generación tanto de Excel como CSV).
- **Empaquetado Móvil**: Progressive Web App (PWA) + Capacitor (`@capacitor/core`, `@capacitor/cli`).
- **Pruebas**: Vitest + fake-indexeddb para pruebas unitarias de lógica académica y base de datos.
