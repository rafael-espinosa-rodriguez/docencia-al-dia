import Dexie, { type Table } from 'dexie';

export type ClassModality = 'CD' | 'CPE'; // Curso Diurno (CD) o Curso por Encuentro (CPE)

export const MAX_COURSES_PER_MODALITY = 5;

export interface Semester {
  id?: number;
  name: string;
  period?: string;
  createdAt: Date;
}

export interface Course {
  id?: number;
  name: string;
  code?: string;
  semesterId: number;
  modality: ClassModality; // 'CD' o 'CPE'
}

export interface Student {
  id?: number;
  name: string;
  code?: string;
  courseId: number;
}

export interface Attendance {
  id?: number;
  studentId: number;
  courseId: number;
  date: string; // Formato YYYY-MM-DD
  status: 'present' | 'absent' | 'late' | 'excused';
  note?: string; // Nota breve u observación de la sesión (ej. 'participación destacada', 'olvidó materiales')
}

export interface Evaluation {
  id?: number;
  courseId: number;
  name: string; // Ej: "Evaluación 1", "Prueba Final", "Taller 1"
  weight?: number; // Ponderación en % (ej: 20)
  maxScore?: number; // Nota máxima (escala oficial fija: 5)
}

export interface Grade {
  id?: number;
  studentId: number;
  evaluationId: number;
  score: number;
  notes?: string;
}

export class EduTrackDatabase extends Dexie {
  semesters!: Table<Semester>;
  courses!: Table<Course>;
  students!: Table<Student>;
  attendance!: Table<Attendance>;
  evaluations!: Table<Evaluation>;
  grades!: Table<Grade>;

  constructor() {
    super('EduTrackDB');
    this.version(3).stores({
      semesters: '++id, name, createdAt',
      courses: '++id, name, semesterId, modality',
      students: '++id, name, courseId',
      attendance: '++id, [studentId+date], courseId, date, status',
      evaluations: '++id, courseId, name',
      grades: '++id, [studentId+evaluationId], evaluationId, studentId'
    }).upgrade(tx => {
      // Migración defensiva: si existen cursos anteriores sin modalidad, asignar 'CD' por defecto
      return tx.table('courses').toCollection().modify(course => {
        if (!course.modality) {
          course.modality = 'CD';
        }
      });
    });
  }

  // Eliminar en cascada
  async deleteSemesterCascade(semesterId: number) {
    const courseIds = (await this.courses.where('semesterId').equals(semesterId).toArray()).map(c => c.id!);
    for (const cId of courseIds) {
      await this.deleteCourseCascade(cId);
    }
    await this.semesters.delete(semesterId);
  }

  async deleteCourseCascade(courseId: number) {
    const studentIds = (await this.students.where('courseId').equals(courseId).toArray()).map(s => s.id!);
    const evalIds = (await this.evaluations.where('courseId').equals(courseId).toArray()).map(e => e.id!);

    for (const sId of studentIds) {
      await this.attendance.where('studentId').equals(sId).delete();
      await this.grades.where('studentId').equals(sId).delete();
    }
    for (const eId of evalIds) {
      await this.grades.where('evaluationId').equals(eId).delete();
    }
    await this.evaluations.where('courseId').equals(courseId).delete();
    await this.students.where('courseId').equals(courseId).delete();
    await this.courses.delete(courseId);
  }

  async deleteStudentCascade(studentId: number) {
    await this.attendance.where('studentId').equals(studentId).delete();
    await this.grades.where('studentId').equals(studentId).delete();
    await this.students.delete(studentId);
  }

  async deleteEvaluationCascade(evaluationId: number) {
    await this.grades.where('evaluationId').equals(evaluationId).delete();
    await this.evaluations.delete(evaluationId);
  }

  async seedDemoData() {
    const count = await this.semesters.count();
    if (count > 0) return;

    const semesterId = await this.semesters.add({
      name: 'Semestre 2026-I',
      period: 'Pregrado Universitario',
      createdAt: new Date()
    }) as number;

    // Asignatura en Curso Diurno (CD)
    const courseCdId = await this.courses.add({
      name: 'Metodología de la Investigación',
      code: 'ASG-101',
      semesterId,
      modality: 'CD'
    }) as number;

    // Asignatura en Curso por Encuentro (CPE)
    const courseCpeId = await this.courses.add({
      name: 'Gestión y Evaluación de Proyectos',
      code: 'ASG-201',
      semesterId,
      modality: 'CPE'
    }) as number;

    const studentNamesCD = [
      'Alejandro Martínez Castro',
      'Camila Andrea Rodríguez',
      'Daniel Esteban Gómez',
      'Lucía Valentina Fernández',
      'Mateo Sebastián Morales',
      'Sofía Elena Vargas'
    ];

    const studentIdsCD: number[] = [];
    for (const name of studentNamesCD) {
      const sId = await this.students.add({
        name,
        courseId: courseCdId
      }) as number;
      studentIdsCD.push(sId);
    }

    const studentNamesCPE = [
      'Beatriz Adriana Morales',
      'Carlos Eduardo Silva',
      'Diana Marcela Herrera',
      'Enrique Javier Fuentes'
    ];

    for (const name of studentNamesCPE) {
      await this.students.add({
        name,
        courseId: courseCpeId
      });
    }

    // Evaluaciones requeridas para CD (escala oficial 2–5)
    const eval1Id = await this.evaluations.add({
      courseId: courseCdId,
      name: 'Evaluación 1',
      maxScore: 5
    }) as number;

    const evalFinalId = await this.evaluations.add({
      courseId: courseCdId,
      name: 'Prueba Final',
      maxScore: 5
    }) as number;

    // Asistencia de muestra para CD
    const sampleDates = ['2026-09-22', '2026-09-24', '2026-09-29'];
    for (const date of sampleDates) {
      for (const [idx, sId] of studentIdsCD.entries()) {
        const status = idx === 3 && date === '2026-09-24' ? 'absent' : (idx === 1 && date === '2026-09-29' ? 'late' : 'present');
        await this.attendance.add({
          studentId: sId,
          courseId: courseCdId,
          date,
          status
        });
      }
    }

    // Calificaciones de muestra para CD (escala 2–5)
    const sampleGrades = [
      [5, 4],
      [4, 3],
      [3, 3],
      [5, 5],
      [2, 3],
      [4, 5]
    ];

    for (let i = 0; i < studentIdsCD.length; i++) {
      await this.grades.add({
        studentId: studentIdsCD[i],
        evaluationId: eval1Id,
        score: sampleGrades[i][0]
      });
      await this.grades.add({
        studentId: studentIdsCD[i],
        evaluationId: evalFinalId,
        score: sampleGrades[i][1]
      });
    }
  }
}

export const db = new EduTrackDatabase();
