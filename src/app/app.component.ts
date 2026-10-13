
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
  ClassDate,
  StudentClass,
} from './attendance-api.service';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly api = inject(AttendanceApiService);

  actor: Actor | null = null;
  loginMode: 'student' | 'admin' = 'student';
  section: 'attendance' | 'modules' = 'attendance';
  registrationNumber = '';
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
              this.api.loginStudent(this.registrationNumber.trim()),
            )
          : await firstValueFrom(
              this.api.loginAdmin(this.adminEmail.trim(), this.adminPassword),
            );
      this.registrationNumber = '';
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

  chooseSection(section: 'attendance' | 'modules'): void {
    this.section = section;
    this.error = '';
    if (section === 'modules') {
      void this.loadAdminData();
    } else {
      void this.loadReport();
    }
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
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
