import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AcademicModule,
  Actor,
  AttendanceApiService,
  AttendanceRow,
  AttendanceToday,
  AuditLogEntry,
  ClassDate,
  StudentClass,
} from './attendance-api.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly api = inject(AttendanceApiService);

  actor: Actor | null = null;
  loginMode: 'student' | 'admin' = 'student';
  section: 'attendance' | 'modules' | 'audit' = 'attendance';
  registrationNumber = '';
  studentPassword = '';
  adminEmail = '';
  adminPassword = '';
  error = '';
  notice = '';
  busy = false;
  today: AttendanceToday | null = null;
  studentSchedule: StudentClass[] = [];
  modules: AcademicModule[] = [];
  classDates: ClassDate[] = [];
  classModuleId = '';
  reportRows: AttendanceRow[] = [];
  reportDate = this.localDate();
  reportSearch = '';
  reportModuleId = '';
  reportTotal = 0;
  reportPage = 1;
  reportPages = 0;
  newModuleName = '';
  newModuleStart = '';
  newModuleEnd = '';
  importModuleId = '';

  // Student password change
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showPasswordForm = false;

  // Audit log
  auditEntries: AuditLogEntry[] = [];
  auditPage = 1;
  auditPages = 0;
  auditTotal = 0;
  auditModuleId = '';
  auditDate = '';
  auditRol = '';
  auditActionFilter = '';

  private studentCache = new Map<string, { name: string; reg: string }>();
  private classCache = new Map<string, { date: string; time: string }>();

  get filteredAuditEntries(): AuditLogEntry[] {
    if (!this.auditActionFilter) return this.auditEntries;
    if (this.auditActionFilter === 'MODIFICAR_ASISTENCIA') {
      return this.auditEntries.filter((e) => e.accion === 'MODIFICAR_ASISTENCIA');
    }
    if (this.auditActionFilter === 'CLASES') {
      return this.auditEntries.filter(
        (e) => e.accion === 'CANCELAR_CLASE' || e.accion === 'RESTAURAR_CLASE',
      );
    }
    if (this.auditActionFilter === 'MODULOS') {
      return this.auditEntries.filter(
        (e) => e.accion === 'ACTIVAR_MODULO' || e.accion === 'IMPORTAR_EXCEL',
      );
    }
    return this.auditEntries;
  }

  ngOnInit(): void {
    this.api.currentActor().subscribe({
      next: (actor) => {
        this.actor = actor;
        this.refreshView();
      },
      error: () => {
        this.actor = null;
      },
    });
  }

  get isAdmin(): boolean {
    return this.actor?.actor === 'ADMIN';
  }

  get isStudent(): boolean {
    return this.actor?.actor === 'ESTUDIANTE';
  }

  async login(): Promise<void> {
    this.error = '';
    this.notice = '';
    this.busy = true;
    try {
      await firstValueFrom(this.api.csrf());
      this.actor =
        this.loginMode === 'student'
          ? await firstValueFrom(
              this.api.loginStudent(this.registrationNumber.trim(), this.studentPassword),
            )
          : await firstValueFrom(
              this.api.loginAdmin(this.adminEmail.trim(), this.adminPassword),
            );
      this.registrationNumber = '';
      this.studentPassword = '';
      this.adminPassword = '';
      this.refreshView();
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    } finally {
      this.busy = false;
    }
  }

  async logout(): Promise<void> {
    this.busy = true;
    try {
      await firstValueFrom(this.api.logout());
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
      this.busy = false;
      return;
    }
    this.actor = null;
    this.section = 'attendance';
    this.busy = false;
    this.error = '';
    this.notice = '';
  }

  async refreshAttendance(): Promise<void> {
    if (!this.isStudent) return;
    this.busy = true;
    this.error = '';
    try {
      this.today = await firstValueFrom(this.api.todayAttendance());
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    } finally {
      this.busy = false;
    }
  }

  async refreshStudentSchedule(): Promise<void> {
    if (!this.isStudent) return;
    try {
      const result = await firstValueFrom(this.api.studentSchedule());
      this.studentSchedule = result.results;
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    }
  }

  async markAttendance(): Promise<void> {
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await firstValueFrom(this.api.markAttendance());
      this.notice = 'Tu asistencia quedó registrada.';
      await this.refreshAttendance();
      await this.refreshStudentSchedule();
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    } finally {
      this.busy = false;
    }
  }

  async loadAdminData(): Promise<void> {
    if (!this.isAdmin) return;
    this.error = '';
    try {
      const result = await firstValueFrom(this.api.modules());
      this.modules = result.results;
      if (!this.reportModuleId) {
        this.reportModuleId =
          this.modules.find((module) => module.es_activo)?.id_modulo ??
          this.modules[0]?.id_modulo ??
          '';
      }
      if (!this.importModuleId && this.modules.length) {
        this.importModuleId =
          this.modules.find((module) => !module.es_activo)?.id_modulo ??
          this.modules[0].id_modulo;
      }
      if (!this.classModuleId && this.modules.length) {
        this.classModuleId =
          this.modules.find((module) => module.es_activo)?.id_modulo ??
          this.modules[0].id_modulo;
      }
      if (!this.modules.length) {
        this.reportRows = [];
        this.reportTotal = 0;
        this.reportPage = 1;
        this.reportPages = 0;
        this.classDates = [];
        return;
      }
      await this.loadReport();
      await this.loadClassDates();
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    }
  }

  async loadReport(page = 1): Promise<void> {
    this.error = '';
    try {
      const result = await firstValueFrom(
        this.api.attendanceReport(
          this.reportDate,
          this.reportSearch,
          page,
          this.reportModuleId,
        ),
      );
      this.reportRows = result.results;
      this.reportTotal = result.total;
      this.reportPage = result.pagina;
      this.reportPages = result.paginas;
      for (const row of this.reportRows) {
        this.studentCache.set(row.id_estudiante, {
          name: row.nombre_completo,
          reg: row.numero_registro,
        });
        this.classCache.set(row.id_fecha_clase, {
          date: row.fecha,
          time: `${row.hora_inicio.slice(0, 5)} - ${row.hora_fin.slice(0, 5)}`,
        });
      }
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    }
  }

  async saveAttendance(row: AttendanceRow): Promise<void> {
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await firstValueFrom(this.api.updateAttendance(row));
      this.notice = `Asistencia de ${row.nombre_completo} actualizada.`;
      await this.loadReport();
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    } finally {
      this.busy = false;
    }
  }

  async loadClassDates(): Promise<void> {
    if (!this.classModuleId) {
      this.classDates = [];
      return;
    }
    this.error = '';
    try {
      const result = await firstValueFrom(
        this.api.moduleClasses(this.classModuleId),
      );
      this.classDates = result.results;
      for (const cd of this.classDates) {
        this.classCache.set(cd.id_fecha_clase, {
          date: cd.fecha,
          time: `${cd.hora_inicio.slice(0, 5)} - ${cd.hora_fin.slice(0, 5)}`,
        });
      }
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    }
  }

  async cancelClass(classDate: ClassDate): Promise<void> {
    const reason = window.prompt(
      `Motivo de cancelación para ${classDate.fecha} (${classDate.hora_inicio}–${classDate.hora_fin}):`,
    );
    if (reason === null) return;
    if (!reason.trim()) {
      this.error = 'Indica el motivo de cancelación.';
      return;
    }
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await firstValueFrom(
        this.api.cancelClass(classDate.id_fecha_clase, reason.trim()),
      );
      this.notice = `Clase del ${classDate.fecha} cancelada. No se registrarán faltas.`;
      await this.loadClassDates();
      await this.loadReport();
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    } finally {
      this.busy = false;
    }
  }

  async restoreClass(classDate: ClassDate): Promise<void> {
    if (
      !window.confirm(
        `¿Restaurar la clase del ${classDate.fecha} (${classDate.hora_inicio}–${classDate.hora_fin})?`,
      )
    ) {
      return;
    }
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      await firstValueFrom(this.api.restoreClass(classDate.id_fecha_clase));
      this.notice = `Clase del ${classDate.fecha} restaurada.`;
      await this.loadClassDates();
      await this.loadReport();
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    } finally {
      this.busy = false;
    }
  }

  async createModule(): Promise<void> {
    this.error = '';
    this.notice = '';
    this.busy = true;
    try {
      const module = await firstValueFrom(
        this.api.createModule({
          nombre: this.newModuleName,
          fecha_inicio: this.newModuleStart,
          fecha_fin: this.newModuleEnd,
        }),
      );
      this.notice = `Módulo "${module.nombre}" creado. Ahora puedes importar los datos y activarlo.`;
      this.newModuleName = '';
      this.newModuleStart = '';
      this.newModuleEnd = '';
      await this.loadAdminData();
      this.importModuleId = module.id_modulo;
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    } finally {
      this.busy = false;
    }
  }

  async activateModule(module: AcademicModule): Promise<void> {
    const confirmed = window.confirm(
      `¿Activar "${module.nombre}"? El módulo activo actual será desactivado.`,
    );
    if (!confirmed) return;
    this.error = '';
    this.notice = '';
    this.busy = true;
    try {
      await firstValueFrom(this.api.activateModule(module.id_modulo));
      this.notice = `El módulo "${module.nombre}" ya está activo.`;
      await this.loadAdminData();
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    } finally {
      this.busy = false;
    }
  }

  async importWorkbook(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.importModuleId) {
      this.error = 'Selecciona un módulo y un archivo .xlsx.';
      return;
    }
    this.error = '';
    this.notice = '';
    this.busy = true;
    try {
      const result = await firstValueFrom(
        this.api.importWorkbook(this.importModuleId, file),
      );
      this.notice = `Importación completada: ${result.importados.estudiantes} estudiantes y ${result.importados.fechas_clase} fechas de clase.`;
      await this.loadAdminData();
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    } finally {
      this.busy = false;
      input.value = '';
    }
  }

  chooseSection(section: 'attendance' | 'modules' | 'audit'): void {
    this.section = section;
    this.error = '';
    this.notice = '';
    if (section === 'modules') {
      void this.loadAdminData();
    } else if (section === 'audit') {
      void this.loadAuditLog();
    } else {
      void this.loadReport();
    }
  }

  async loadAuditLog(page = 1): Promise<void> {
    this.error = '';
    try {
      const result = await firstValueFrom(
        this.api.auditLog(page, this.auditModuleId, this.auditDate, this.auditRol),
      );
      this.auditEntries = result.results;
      this.auditTotal = result.total;
      this.auditPage = result.pagina;
      this.auditPages = result.paginas;
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    }
  }

  async changePassword(): Promise<void> {
    this.error = '';
    this.notice = '';
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }
    this.busy = true;
    try {
      await firstValueFrom(
        this.api.changeStudentPassword(this.currentPassword, this.newPassword),
      );
      this.notice = 'Contraseña actualizada correctamente.';
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.showPasswordForm = false;
    } catch (error: unknown) {
      this.error = this.messageFrom(error);
    } finally {
      this.busy = false;
    }
  }

  formatAuditAction(action: string): string {
    const map: Record<string, string> = {
      MODIFICAR_ASISTENCIA: 'Modificación de asistencia',
      MARCAR_ASISTENCIA: 'Marcado de asistencia',
      CANCELAR_CLASE: 'Cancelación de clase',
      RESTAURAR_CLASE: 'Restauración de clase',
      ACTIVAR_MODULO: 'Activación de módulo',
      IMPORTAR_EXCEL: 'Importación de Excel',
      CAMBIAR_PASSWORD: 'Cambio de contraseña',
    };
    return map[action] ?? action;
  }

  getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      MODIFICAR_ASISTENCIA: '✏️',
      MARCAR_ASISTENCIA: '⏱️',
      CANCELAR_CLASE: '🚫',
      RESTAURAR_CLASE: '🔄',
      ACTIVAR_MODULO: '⚡',
      IMPORTAR_EXCEL: '📊',
      CAMBIAR_PASSWORD: '🔑',
    };
    return icons[action] ?? '📋';
  }

  isAttendanceAction(entry: AuditLogEntry): boolean {
    return (
      entry.accion === 'MODIFICAR_ASISTENCIA' ||
      entry.entidad_afectada === 'asistencias'
    );
  }

  getAuditStudent(entry: AuditLogEntry): { name: string; reg?: string } | null {
    const data = entry.valor_nuevo || entry.valor_anterior;
    if (!data) return null;
    const studentId = String(data['id_estudiante'] ?? '');
    if (!studentId) return null;
    const cached = this.studentCache.get(studentId);
    if (cached) return cached;
    return { name: `Estudiante #${studentId.slice(0, 8)}` };
  }

  getAuditClassDate(entry: AuditLogEntry): string | null {
    const data = entry.valor_nuevo || entry.valor_anterior;
    if (!data) return null;
    const classId = String(data['id_fecha_clase'] ?? '');
    if (!classId) return null;
    const cached = this.classCache.get(classId);
    if (cached) return `${cached.date} (${cached.time})`;
    return null;
  }

  getMarkedTime(value: Record<string, unknown> | null | undefined): string | null {
    const raw = value?.['fecha_hora_marcado'];
    return typeof raw === 'string' && raw.trim() ? raw : null;
  }

  formatAttendanceStatus(status: unknown): string {
    const str = String(status ?? '').toUpperCase();
    switch (str) {
      case 'PRESENTE':
        return 'Presente';
      case 'FALTA':
        return 'Falta';
      case 'PENDIENTE':
        return 'Pendiente';
      case 'SIN_MARCA':
        return 'Sin marca';
      case 'CANCELADA':
        return 'Cancelada';
      default:
        return str || '—';
    }
  }

  attendanceStatusClass(status: unknown): string {
    const str = String(status ?? '').toUpperCase();
    switch (str) {
      case 'PRESENTE':
        return 'audit-badge-presente';
      case 'FALTA':
        return 'audit-badge-falta';
      case 'PENDIENTE':
        return 'audit-badge-pendiente';
      case 'SIN_MARCA':
        return 'audit-badge-sin-marca';
      case 'CANCELADA':
        return 'audit-badge-cancelada';
      default:
        return 'audit-badge-default';
    }
  }

  formatOtherAuditValue(
    action: string,
    value: Record<string, unknown> | null,
    isPrevious: boolean,
  ): string {
    if (!value) return isPrevious ? '— (Sin valor previo)' : '—';
    if (action === 'CANCELAR_CLASE') {
      if (isPrevious) return 'Sesión activa';
      const motivo = value['motivo_cancelacion'] || value['motivo'];
      return motivo ? `Cancelada · Motivo: "${motivo}"` : 'Cancelada';
    }
    if (action === 'RESTAURAR_CLASE') {
      if (isPrevious) return 'Sesión cancelada';
      return 'Restaurada (Programada)';
    }
    if (action === 'ACTIVAR_MODULO') {
      if (isPrevious) return 'Módulo inactivo';
      return `Módulo activo: ${value['nombre'] ?? ''}`;
    }
    if (action === 'IMPORTAR_EXCEL') {
      if (isPrevious) return '—';
      const est =
        value['estudiantes_importados'] ??
        value['estudiantes'] ??
        0;
      const cls =
        value['fechas_clase_importadas'] ??
        value['fechas_clase'] ??
        0;
      return `Importación: ${est} estudiantes, ${cls} clases registradas`;
    }
    if (action === 'CAMBIAR_PASSWORD') {
      return isPrevious ? '—' : 'Contraseña actualizada';
    }
    if (action === 'MARCAR_ASISTENCIA') {
      if (isPrevious) return 'Sin marca';
      return 'Presente (Auto-marcado)';
    }
    return this.jsonSummary(value);
  }

  jsonSummary(value: Record<string, unknown> | null): string {
    if (!value) return '—';
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${v ?? '—'}`)
      .join(', ');
  }

  private refreshView(): void {
    if (this.isStudent) {
      void this.refreshAttendance();
      void this.refreshStudentSchedule();
    } else if (this.isAdmin) {
      void this.loadAdminData();
    }
  }

  private messageFrom(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { error?: string; detail?: string } | null;
      return body?.error ?? body?.detail ?? 'Ocurrió un error al comunicarse con el servidor.';
    }
    return 'Ocurrió un error inesperado.';
  }

  private localDate(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date());
  }
}
