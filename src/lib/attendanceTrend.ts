import type { Attendance } from '../db';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface SessionTrendPoint {
  date: string;
  displayDate: string;
  presents: number;
  absents: number;
  lates: number;
  excused: number;
  total: number;
  attendanceRate: number; // Porcentaje de 0 a 100
}

export interface CourseAttendanceMetrics {
  trendData: SessionTrendPoint[];
  totalSessions: number;
  averageRate: number;
  bestSession: SessionTrendPoint | null;
  lowestSession: SessionTrendPoint | null;
}

export function computeAttendanceTrend(attendanceRecords: Attendance[]): CourseAttendanceMetrics {
  if (!attendanceRecords || attendanceRecords.length === 0) {
    return {
      trendData: [],
      totalSessions: 0,
      averageRate: 0,
      bestSession: null,
      lowestSession: null
    };
  }

  // Agrupar por fecha
  const dateMap = new Map<string, Attendance[]>();
  for (const record of attendanceRecords) {
    const list = dateMap.get(record.date) || [];
    list.push(record);
    dateMap.set(record.date, list);
  }

  // Ordenar fechas cronológicamente
  const sortedDates = Array.from(dateMap.keys()).sort();

  const trendData: SessionTrendPoint[] = sortedDates.map(dateStr => {
    const records = dateMap.get(dateStr)!;
    const presents = records.filter(r => r.status === 'present').length;
    const absents = records.filter(r => r.status === 'absent').length;
    const lates = records.filter(r => r.status === 'late').length;
    const excused = records.filter(r => r.status === 'excused').length;
    const total = records.length;

    const effective = presents + excused + (lates * 0.5);
    const attendanceRate = total > 0 ? Math.min(100, Math.round((effective / total) * 100)) : 100;

    let displayDate = dateStr;
    try {
      displayDate = format(parseISO(dateStr), 'dd MMM', { locale: es });
    } catch {
      displayDate = dateStr;
    }

    return {
      date: dateStr,
      displayDate,
      presents,
      absents,
      lates,
      excused,
      total,
      attendanceRate
    };
  });

  const totalSessions = trendData.length;
  const averageRate = totalSessions > 0
    ? Math.round(trendData.reduce((acc, curr) => acc + curr.attendanceRate, 0) / totalSessions)
    : 0;

  let bestSession: SessionTrendPoint | null = null;
  let lowestSession: SessionTrendPoint | null = null;

  if (totalSessions > 0) {
    bestSession = trendData.reduce((best, curr) => curr.attendanceRate > best.attendanceRate ? curr : best, trendData[0]);
    lowestSession = trendData.reduce((lowest, curr) => curr.attendanceRate < lowest.attendanceRate ? curr : lowest, trendData[0]);
  }

  return {
    trendData,
    totalSessions,
    averageRate,
    bestSession,
    lowestSession
  };
}
