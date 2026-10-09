import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { TrendingUp, BarChart2, Calendar } from 'lucide-react';
import type { Attendance } from '../db';
import { computeAttendanceTrend } from '../lib/attendanceTrend';

interface AttendanceTrendChartProps {
  attendanceRecords: Attendance[];
}

export const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({ attendanceRecords }) => {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const metrics = computeAttendanceTrend(attendanceRecords);

  if (metrics.totalSessions === 0) {
    return (
      <div className="bg-white dark:bg-[#0f172a] p-5 rounded-xl academic-border border border-slate-200 dark:border-slate-800 text-center">
        <TrendingUp className="w-7 h-7 text-slate-400 mx-auto mb-2" />
        <h4 className="font-serif text-xs font-bold text-slate-800 dark:text-slate-200">Sin sesiones registradas aún</h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
          Registra asistencia para visualizar la curva cronológica del semestre.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0f172a] p-4 rounded-xl academic-border border border-slate-200/80 dark:border-slate-800 space-y-3">
      {/* Encabezado y Selector de Tipo de Gráfico */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
              Curva de Asistencia Semestral
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              Evolución cronológica
            </span>
          </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold shrink-0 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setChartType('area')}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 text-[11px] font-mono ${
              chartType === 'area'
                ? 'bg-white dark:bg-[#0f172a] text-blue-900 dark:text-amber-400 shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            <span>Tasa (%)</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1 text-[11px] font-mono ${
              chartType === 'bar'
                ? 'bg-white dark:bg-[#0f172a] text-blue-900 dark:text-amber-400 shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart2 className="w-3 h-3" />
            <span>Alumnos</span>
          </button>
        </div>
      </div>

      {/* Métricas Rápidas */}
      <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
        <div className="bg-slate-50 dark:bg-[#080d1a] p-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[9.5px] uppercase font-mono font-bold text-slate-400 block">Promedio</span>
          <span className={`text-base font-serif font-bold ${
            metrics.averageRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
          }`}>
            {metrics.averageRate}%
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-[#080d1a] p-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[9.5px] uppercase font-mono font-bold text-slate-400 block">Sesiones</span>
          <span className="text-base font-serif font-bold text-blue-900 dark:text-blue-300">
            {metrics.totalSessions}
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-[#080d1a] p-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-[9.5px] uppercase font-mono font-bold text-slate-400 block">Pico Máx.</span>
          <span className="text-base font-serif font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.bestSession ? `${metrics.bestSession.attendanceRate}%` : '—'}
          </span>
        </div>
      </div>

      {/* Gráfico Recharts */}
      <div className="h-44 sm:h-52 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={metrics.trendData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
              <XAxis 
                dataKey="displayDate" 
                tick={{ fontSize: 9.5, fill: '#94a3b8' }} 
                tickLine={false} 
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fontSize: 9.5, fill: '#94a3b8' }} 
                tickLine={false} 
                axisLine={false}
                ticks={[0, 25, 50, 75, 100]}
                unit="%"
              />
              <Tooltip content={<CustomAreaTooltip />} />
              <Area 
                type="monotone" 
                dataKey="attendanceRate" 
                name="Tasa de Asistencia"
                stroke="#2563eb" 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#attendanceGradient)" 
                activeDot={{ r: 5, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          ) : (
            <BarChart data={metrics.trendData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
              <XAxis 
                dataKey="displayDate" 
                tick={{ fontSize: 9.5, fill: '#94a3b8' }} 
                tickLine={false} 
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis 
                tick={{ fontSize: 9.5, fill: '#94a3b8' }} 
                tickLine={false} 
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar dataKey="presents" name="Presentes" fill="#059669" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="lates" name="Tardanzas" fill="#d97706" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="excused" name="Justificados" fill="#7c3aed" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="absents" name="Ausentes" fill="#dc2626" radius={[0, 0, 0, 0]} stackId="a" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

function CustomAreaTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0f172a] text-white p-2.5 rounded-lg border border-slate-700 shadow-xl text-xs font-sans z-50">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-amber-300 pb-1 border-b border-slate-700 mb-1.5">
          <Calendar className="w-3 h-3" />
          <span>{data.fullDate}</span>
        </div>
        <div className="flex items-center justify-between gap-4 font-mono">
          <span className="text-slate-300">Asistencia:</span>
          <span className="font-bold text-emerald-400">{data.attendanceRate}%</span>
        </div>
        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
          {data.presents} presentes de {data.total}
        </div>
      </div>
    );
  }
  return null;
}

function CustomBarTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0f172a] text-white p-2.5 rounded-lg border border-slate-700 shadow-xl text-xs font-sans z-50">
        <div className="font-mono text-[10px] text-amber-300 pb-1 border-b border-slate-700 mb-1.5">
          {data.fullDate} ({data.attendanceRate}%)
        </div>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex items-center justify-between gap-3 text-emerald-400">
            <span>Presentes:</span>
            <strong>{data.presents}</strong>
          </div>
          <div className="flex items-center justify-between gap-3 text-amber-400">
            <span>Tardanzas:</span>
            <strong>{data.lates}</strong>
          </div>
          <div className="flex items-center justify-between gap-3 text-purple-400">
            <span>Justificados:</span>
            <strong>{data.excused}</strong>
          </div>
          <div className="flex items-center justify-between gap-3 text-rose-400">
            <span>Ausentes:</span>
            <strong>{data.absents}</strong>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
