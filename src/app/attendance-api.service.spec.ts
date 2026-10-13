import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AttendanceApiService } from './attendance-api.service';

describe('AttendanceApiService', () => {
  let service: AttendanceApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AttendanceApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AttendanceApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('sends date, student, module and page filters in the attendance request', () => {
    service.attendanceReport('2026-06-01', 'REG-1', 2, 'module-1').subscribe();

    const request = httpTesting.expectOne((candidate) =>
      candidate.url === '/api/admin/attendance' &&
      candidate.params.get('fecha') === '2026-06-01' &&
      candidate.params.get('estudiante') === 'REG-1' &&
      candidate.params.get('id_modulo') === 'module-1' &&
      candidate.params.get('pagina') === '2',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      fecha: '2026-06-01',
      total: 0,
      pagina: 1,
      paginas: 0,
      results: [],
    });
  });

  it('sends the reason when cancelling a class and can restore it', () => {
    service.cancelClass('class-1', 'Lluvia intensa').subscribe();

    const cancelRequest = httpTesting.expectOne('/api/admin/classes/class-1/cancel');
    expect(cancelRequest.request.method).toBe('POST');
    expect(cancelRequest.request.body).toEqual({ motivo: 'Lluvia intensa' });
    cancelRequest.flush({
      id_fecha_clase: 'class-1',
      id_modulo: 'module-1',
      fecha: '2026-06-01',
      hora_inicio: '09:00:00',
      hora_fin: '11:00:00',
      es_cancelada: true,
      motivo_cancelacion: 'Lluvia intensa',
    });

    service.restoreClass('class-1').subscribe();
    const restoreRequest = httpTesting.expectOne(
      '/api/admin/classes/class-1/restore',
    );
    expect(restoreRequest.request.method).toBe('POST');
    restoreRequest.flush({
      id_fecha_clase: 'class-1',
      id_modulo: 'module-1',
      fecha: '2026-06-01',
      hora_inicio: '09:00:00',
      hora_fin: '11:00:00',
      es_cancelada: false,
      motivo_cancelacion: null,
    });
  });

  it('requests the authenticated student schedule', () => {
    service.studentSchedule().subscribe();

    const request = httpTesting.expectOne('/api/student/schedule');
    expect(request.request.method).toBe('GET');
    request.flush({ results: [] });
  });
});
