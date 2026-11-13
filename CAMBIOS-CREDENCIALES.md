# Credenciales iniciales de estudiantes

1. En **Módulos y carga**, importa el Excel sin columnas de contraseñas.
2. Descarga las contraseñas iniciales desde el módulo y entrega cada una por
   un canal privado. Las descargas pueden repetirse antes de que se cambien.
3. Cada estudiante ingresa con su contraseña y la cambia. Después ya no aparece
   en las descargas posteriores; los archivos descargados deben eliminarse
   manualmente.

Se requiere el backend compatible, su migración y una clave de cifrado separada.
El panel no almacena la clave. Los estudiantes existentes no son modificados
por esta actualización. Pruebas: `npm test` y `npm run build`.
