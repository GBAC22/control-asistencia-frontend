import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Actor {
  actor: 'ADMIN' | 'ESTUDIANTE';
  id_admin?: string;
  id_estudiante?: string;
  nombre?: string;
  nombre_completo?: string;
  correo?: string;
  numero_registro?: string;
  modulo?: string;
}

export interface AttendanceToday {
  programada: boolean;
  cancelada?: boolean;
  fecha: string;
  id_fecha_clase?: string;
  hora_inicio?: string;
  hora_fin?: string;
  motivo_cancelacion?: string | null;
  asistencia: { estado: string; fecha_hora_marcado: string | null } | null;
}

export interface StudentClass {
  id_fecha_clase: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  es_hoy: boolean;
  es_cancelada: boolean;
  motivo_cancelacion: string | null;
  asistencia: string | null;
}

export interface AttendanceRow {
  id_estudiante: string;
  id_fecha_clase: string;
  id_asistencia: string | null;
  numero_registro: string;
  nombre_completo: string;
  correo_electronico: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: 'PRESENTE' | 'FALTA' | 'PENDIENTE' | 'CANCELADA';
  es_cancelada: boolean;
  motivo_cancelacion: string | null;
}

export interface AttendanceReport {
  fecha: string;
  total: number;
  pagina: number;
  paginas: number;
  results: AttendanceRow[];
}

export interface AcademicModule {
  id_modulo: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  es_activo: boolean | null;
  creado_en: string | null;
}

export interface ClassDate {
  id_fecha_clase: string;
  id_modulo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  es_cancelada: boolean;
  motivo_cancelacion: string | null;
}

export interface ModuleList {
  results: AcademicModule[];
}

export interface ImportResult {
  importados: { estudiantes: number; fechas_clase: number };
}

export interface AuditLogEntry {
  id_auditoria: string;
  id_modulo: string;
  nombre_modulo: string;
  usuario_actor: string;
  rol_actor: string;
  accion: string;
  entidad_afectada: string;
  valor_anterior: Record<string, unknown> | null;
  valor_nuevo: Record<string, unknown> | null;
  fecha_hora: string;
}

export interface AuditLogReport {
  total: number;
  pagina: number;
  paginas: number;
  results: AuditLogEntry[];
}

@Injectable({ providedIn: 'root' })
export class AttendanceApiService {
  private readonly http = inject(HttpClient);

  csrf(): Observable<{ detail: string }> {
    return this.http.get<{ detail: string }>('/api/auth/csrf');
  }

  loginStudent(numero_registro: string, password: string): Observable<Actor> {
    return this.http.post<Actor>('/api/auth/login/student', { numero_registro, password });
  }

  loginAdmin(correo: string, password: string): Observable<Actor> {
    return this.http.post<Actor>('/api/auth/login/admin', { correo, password });
  }

  currentActor(): Observable<Actor> {
    return this.http.get<Actor>('/api/auth/me');
  }

  logout(): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>('/api/auth/logout', {});
  }

  todayAttendance(): Observable<AttendanceToday> {
    return this.http.get<AttendanceToday>('/api/student/attendance');
  }

  studentSchedule(): Observable<{ results: StudentClass[] }> {
    return this.http.get<{ results: StudentClass[] }>('/api/student/schedule');
  }

  markAttendance(): Observable<{
    estado: string;
    fecha_hora_marcado: string | null;
  }> {
    return this.http.post<{
      estado: string;
      fecha_hora_marcado: string | null;
    }>(
      '/api/student/attendance/mark',
      {},
    );
  }

  modules(): Observable<ModuleList> {
    return this.http.get<ModuleList>('/api/admin/modules');
  }

  moduleClasses(moduleId: string): Observable<{ results: ClassDate[] }> {
    return this.http.get<{ results: ClassDate[] }>(
      `/api/admin/modules/${moduleId}/classes`,
    );
  }

  cancelClass(classId: string, motivo: string): Observable<ClassDate> {
    return this.http.post<ClassDate>(`/api/admin/classes/${classId}/cancel`, {
      motivo,
    });
  }

  restoreClass(classId: string): Observable<ClassDate> {
    return this.http.post<ClassDate>(
      `/api/admin/classes/${classId}/restore`,
      {},
    );
  }

  createModule(payload: {
    nombre: string;
    fecha_inicio: string;
    fecha_fin: string;
  }): Observable<AcademicModule> {
    return this.http.post<AcademicModule>('/api/admin/modules/create', payload);
  }

  activateModule(id: string): Observable<AcademicModule> {
    return this.http.post<AcademicModule>(
      `/api/admin/modules/${id}/activate`,
      { confirmar: true },
    );
  }

  importWorkbook(id: string, file: File): Observable<ImportResult> {
    const form = new FormData();
    form.append('archivo', file);
    return this.http.post<ImportResult>(`/api/admin/modules/${id}/import`, form);
  }

  attendanceReport(
    fecha: string,
    estudiante = '',
    pagina = 1,
    moduleId = '',
  ): Observable<AttendanceReport> {
    let params = new HttpParams().set('fecha', fecha).set('pagina', pagina);
    if (estudiante.trim()) {
      params = params.set('estudiante', estudiante.trim());
    }
    if (moduleId) {
      params = params.set('id_modulo', moduleId);
    }
    return this.http.get<AttendanceReport>('/api/admin/attendance', { params });
  }

  updateAttendance(row: AttendanceRow): Observable<{ estado: string }> {
    return this.http.put<{ estado: string }>('/api/admin/attendance/update', {
      id_fecha_clase: row.id_fecha_clase,
      id_estudiante: row.id_estudiante,
      estado: row.estado,
    });
  }

  changeStudentPassword(
    current_password: string,
    new_password: string,
  ): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>('/api/student/password/change', {
      current_password,
      new_password,
    });
  }

  auditLog(
    pagina = 1,
    moduleId = '',
    fecha = '',
    rol = '',
  ): Observable<AuditLogReport> {
    let params = new HttpParams().set('pagina', pagina);
    if (moduleId) params = params.set('id_modulo', moduleId);
    if (fecha) params = params.set('fecha', fecha);
    if (rol) params = params.set('rol', rol);
    return this.http.get<AuditLogReport>('/api/admin/audit', { params });
  }
}
