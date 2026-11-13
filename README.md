# Attendance Control Web

Responsive Angular frontend for the attendance-control system.

## Local development

Install Node.js dependencies and start Angular with the API proxy:

```powershell
npm ci
npm run start:local
```

The frontend runs at `http://localhost:4200` and proxies `/api` requests to the
Django backend at `http://127.0.0.1:8000`. Start the backend separately; see
its repository README for setup instructions.

## Build and tests

```powershell
npm run build
npm test
```

Authentication, schedules, attendance, class cancellations, and module
management are provided by the Django API; do not put database credentials or
application secrets in this frontend repository.

The header displays the institution and plan returned by the backend's
`GET /api/tenant`. It retains the generic heading for standalone deployments
without tenant settings and shows an error when the endpoint cannot be loaded.
The displayed plan does not enforce student quotas.

For student import and initial password downloads, see
[the credential workflow](CAMBIOS-CREDENCIALES.md). This requires the compatible
backend and its separately configured encryption key.
