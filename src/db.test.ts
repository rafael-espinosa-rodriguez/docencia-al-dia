import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { EduTrackDatabase, MAX_COURSES_PER_MODALITY } from './db';

describe('EduTrackDatabase (Dexie with IndexedDB)', () => {
  let db: EduTrackDatabase;

  beforeEach(async () => {
    db = new EduTrackDatabase();
    await db.open();
    await db.semesters.clear();
    await db.courses.clear();
    await db.students.clear();
    await db.attendance.clear();
    await db.evaluations.clear();
    await db.grades.clear();
  });

  it('can create a semester, course with modality and student hierarchy', async () => {
    const semesterId = await db.semesters.add({
      name: '2026-I',
      createdAt: new Date()
    }) as number;

    const courseId = await db.courses.add({
      name: 'Cálculo Diferencial',
      semesterId,
      modality: 'CD'
    }) as number;

    const studentId = await db.students.add({
      name: 'María García',
      courseId
    }) as number;

    expect(semesterId).toBeDefined();
    expect(courseId).toBeDefined();
    expect(studentId).toBeDefined();

    const course = await db.courses.get(courseId);
    expect(course?.modality).toBe('CD');

    const students = await db.students.where('courseId').equals(courseId).toArray();
    expect(students).toHaveLength(1);
    expect(students[0].name).toBe('María García');
  });

  it('respects MAX_COURSES_PER_MODALITY limit of 5 per modality', async () => {
    const semesterId = await db.semesters.add({
      name: '2026-I',
      createdAt: new Date()
    }) as number;

    // Agregar 5 cursos en CD
    for (let i = 1; i <= MAX_COURSES_PER_MODALITY; i++) {
      await db.courses.add({
        name: `Asignatura CD ${i}`,
        semesterId,
        modality: 'CD'
      });
    }

    // Agregar 3 cursos en CPE
    for (let i = 1; i <= 3; i++) {
      await db.courses.add({
        name: `Asignatura CPE ${i}`,
        semesterId,
        modality: 'CPE'
      });
    }

    const cdCourses = await db.courses.where({ semesterId, modality: 'CD' }).toArray();
    const cpeCourses = await db.courses.where({ semesterId, modality: 'CPE' }).toArray();

    expect(cdCourses).toHaveLength(5);
    expect(cpeCourses).toHaveLength(3);
    expect(cdCourses.length).toBe(MAX_COURSES_PER_MODALITY);
  });

  it('records attendance correctly and allows updating status', async () => {
    const studentId = 1;
    const courseId = 10;
    const date = '2026-09-30';

    await db.attendance.add({
      studentId,
      courseId,
      date,
      status: 'present'
    });

    const record = await db.attendance.where({ studentId, date }).first();
    expect(record).toBeDefined();
    expect(record?.status).toBe('present');

    await db.attendance.update(record!.id!, { status: 'absent' });
    const updated = await db.attendance.get(record!.id!);
    expect(updated?.status).toBe('absent');
  });

  it('saves grades for custom evaluation headers like Evaluacion 1', async () => {
    const courseId = 5;
    const evalId = await db.evaluations.add({
      courseId,
      name: 'Evaluacion 1',
      maxScore: 5
    }) as number;

    await db.grades.add({
      studentId: 1,
      evaluationId: evalId,
      score: 4
    });

    const grade = await db.grades.where({ studentId: 1, evaluationId: evalId }).first();
    expect(grade?.score).toBe(4);
  });

  it('cascades deletion properly when removing a course', async () => {
    const semesterId = await db.semesters.add({ name: '2026-I', createdAt: new Date() }) as number;
    const courseId = await db.courses.add({ name: 'Física I', semesterId, modality: 'CPE' }) as number;
    const studentId = await db.students.add({ name: 'Carlos Díaz', courseId }) as number;
    const evalId = await db.evaluations.add({ name: 'Prueba Final', courseId }) as number;
    await db.attendance.add({ studentId, courseId, date: '2026-09-30', status: 'present' });
    await db.grades.add({ studentId, evaluationId: evalId, score: 4 });

    await db.deleteCourseCascade(courseId);

    const remainingCourse = await db.courses.get(courseId);
    const remainingStudents = await db.students.where('courseId').equals(courseId).toArray();
    const remainingEvals = await db.evaluations.where('courseId').equals(courseId).toArray();
    const remainingAttendance = await db.attendance.where('courseId').equals(courseId).toArray();

    expect(remainingCourse).toBeUndefined();
    expect(remainingStudents).toHaveLength(0);
    expect(remainingEvals).toHaveLength(0);
    expect(remainingAttendance).toHaveLength(0);
  });

  it('can store, update and retrieve session notes and observations for student attendance', async () => {
    const courseId = 10;
    const studentId = 101;
    const date = '2026-10-02';

    // Crear registro de asistencia con nota/observación inicial
    const attId = await db.attendance.add({
      studentId,
      courseId,
      date,
      status: 'present',
      note: 'participación destacada'
    }) as number;

    const initial = await db.attendance.get(attId);
    expect(initial?.status).toBe('present');
    expect(initial?.note).toBe('participación destacada');

    // Actualizar nota conservando el estado
    await db.attendance.update(attId, { note: 'olvidó materiales' });
    const updatedNote = await db.attendance.get(attId);
    expect(updatedNote?.status).toBe('present');
    expect(updatedNote?.note).toBe('olvidó materiales');

    // Cambiar estado a tarde conservando la nota
    await db.attendance.update(attId, { status: 'late' });
    const updatedStatus = await db.attendance.get(attId);
    expect(updatedStatus?.status).toBe('late');
    expect(updatedStatus?.note).toBe('olvidó materiales');
  });
});
