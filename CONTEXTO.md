Hola, estoy trabajando en mi app de RRHH.
Te paso el contexto del proyecto:

[PEGÁS TODO EL CONTENIDO DE CONTEXTO.md]

Hoy quiero trabajar en: [archivo específico o tarea]




#  Documento de Contexto - App RRHH

## 🎯 Resumen del proyecto

Aplicación web de Recursos Humanos para gestionar empleados, recibos de sueldo, asistencia, licencias y firmas digitales.

---

## 🛠️ Stack Técnico

- **Framework:** Next.js 16.2.7 (App Router)
- **Frontend:** React 19.2.4 + TypeScript
- **Estilos:** Tailwind CSS 4 + styled-jsx
- **Base de datos:** Supabase (PostgreSQL)
- **Backend Python:** http://localhost:8000 (endpoint `/extraer-lote-recibos`)
- **Librerías clave:**
  - `pdfjs-dist` 6.0.227 → Procesamiento de PDFs
  - `pdf-lib` → Generación/modificación de PDFs
  - `recharts` → Gráficos del dashboard
  - `xlsx` 0.18.5 → Importación de Excel
  - `sharp` → Procesamiento de imágenes
  - `formidable` → Upload de archivos
  - `zod` → Validación de datos
  - `@supabase/supabase-js` 2.106.2
  - `bcryptjs` → Hasheo de contraseñas de empleados

---

## 🔐 ARQUITECTURA DE AUTENTICACIÓN (CRÍTICO)

### Empleados: Sistema CUSTOM
- **NO usa Supabase Auth**
- **NO usa `auth.users`** de Supabase
- Autenticación contra tabla `empleados` con `password_hash` (bcrypt)
- Token: JWT simple en Base64 (no es JWT real, solo JSON codificado)
- Almacenamiento:
  - **Cookie:** `empleado_token` (path=/, max-age=86400, SameSite=Lax)
  - **LocalStorage:** `empleado_data` (datos del empleado)
- **Endpoint:** `POST /api/empleado/login`
- **Proxy:** Verifica cookie `empleado_token` en rutas `/empleado/*`

### Admin: Supabase Auth
- Email/Password tradicional
- Usa `supabase.auth.signInWithPassword()`
- Cookies de Supabase automáticas

### Proxy (Next.js 16)
- **IMPORTANTE:** En Next.js 16, `middleware.ts` se renombró a `proxy.ts`
- Verifica cookie `empleado_token` para rutas de empleados
- Expira después de 24 horas

---

## 🗄️ BASE DE DATOS (Supabase)

### Tabla `empleados`
- **RLS:** Desactivado temporalmente
- **CUIL:** Guardado SIN guiones (ej: `20287291451`)
- **Contraseñas:** Hasheadas con bcrypt en `password_hash`
- **Firma digital:** `firma_registrada` (boolean), `firma_guardada` (base64)
- **Campos clave:** `id`, `cuil`, `nombre_completo`, `email`, `activo`, `rol`
- **⚠️ CONSTRAINT ÚNICO en email:** `empleados_email_key` (causa errores 23505 si se repite)

### Tabla `recibos_sueldo`
- **RLS:** Desactivado temporalmente
- **CUIL:** Guardado SIN guiones (ej: `20287291451`)
- **DOS columnas de estado (CRÍTICO):**
  - `estado_firma`: Actualizada por el endpoint de firma
  - `estado`: Verificada por la UI (debe actualizarse AMBAS a 'firmado')
- **Columnas de firma:**
  - `firma_imagen_url`: Base64 de la firma
  - `firma_empleado_url`: Base64 de la firma (duplicado por compatibilidad)
  - `firma_hash`: SHA-256 de la firma
  - `fecha_firma`: Timestamp de cuando se firmó
  - `firma_empleado_fecha`: Timestamp (duplicado por compatibilidad)
  - `ip_firmante` / `ip_firma`: IP del firmante
- **Vinculación:** `empleado_id` debe coincidir con `empleados.id`
- **PDF original:** `pdf_original_url` apunta al PDF individual del empleado
- **Upsert conflict:** `onConflict: 'empleado_id,periodo,quincena'`

### Normalización de CUILs (CRÍTICO)
- **Todos los CUILs deben estar SIN guiones**
- Si hay CUILs con guiones, ejecutar:
  ```sql
  UPDATE empleados SET cuil = REPLACE(cuil, '-', '');
  UPDATE recibos_sueldo SET cuil = REPLACE(cuil, '-', '');




📦 STORAGE (Supabase)
Buckets existentes
recibos-originales (PÚBLICO) - PDFs originales subidos por admin
recibos-firmados (PÚBLICO) - PDFs con firma superpuesta
documentos-legajo - Documentos del legajo digital
Políticas de Storage
INSERT: Permitir uploads autenticados al bucket recibos-originales
SELECT: Público para lectura de recibos
🐍 Backend Python (Extractor)
Ubicación: C:\Users\Usuario\backend-extractor
Entorno virtual: venv (DEBE activarse antes de ejecutar)
Comando de inicio:
cd C:\Users\Usuario\backend-extractor
venv\Scripts\activate
python main.py
Puerto: 8000
Endpoint principal: POST /extraer-lote-recibos
Framework: FastAPI
Dependencias: fastapi, uvicorn, python-multipart, pdfplumber, Pillow
Soporta múltiples archivos en un solo request (FormData con 'files')

📁 Estructura del proyecto
app-rrhh/
├── app/ ← App Router (principal)
│   ├── layout.tsx ← Layout raíz
│   ├── page.tsx ← Página de inicio
│   ├── globals.css
│   ├── admin/
│   │   ├── cargar-recibos/ ← Funcional ✅ (optimizado para lote)
│   │   ├── dashboard/ ← Funcional ✅ (con métricas)
│   │   ├── empleados/
│   │   │   ├── recibos/
│   │   │   │   └── FirmaDigital.tsx ← ✅ Optimizado
│   │   │   └── [id]/
│   │   ├── recibos/
│   │   ├── asistencia/
│   │   ├── licencias/
│   │   ├── documentos/
│   │   └── reportes/
│   ├── empleado/
│   │   ├── login/ ← ✅ Funcional (sistema custom)
│   │   ├── recibos/ ← ✅ Funcional
│   │   └── registro-firma/ ← ✅ Funcional
│   └── api/ ← API Routes
│       ├── admin/
│       │   ── procesar-recibo-url/ ← ✅ Optimizado (lote paralelo)
│       ├── empleado/
│       │   ├── login/ ← ✅ Sistema custom
│       │   └── registro-firma/ ← ✅ Actualiza firma en empleados
│       └── recibos/
│           ├── firmar/ ← ✅ Actualiza estado Y estado_firma
│           ├── anular-firma/
│           └── generar-pdf/ ← ⚠️ PENDIENTE (problema con PDFs multi-página)
├── proxy.ts ← Next.js 16 (antes middleware.ts)
└── public/

✅ Optimizaciones ya aplicadas
1. package.json
Activado Turbopack: "dev": "next dev --turbo"
Beneficio: 70% más rápido en desarrollo
2. app/api/admin/procesar-recibo-url/route.ts
OPTIMIZACIÓN DE LOTE: Procesa todos los PDFs en paralelo
Cliente Supabase FUERA del handler (reutilizable)
Búsqueda de empleados con Map O(1)
Upsert masivo en vez de uno por uno
Validación de tamaño de PDF (50MB máx)
Manejo de emails duplicados: Si falla por constraint único, busca por email y vincula
Beneficio: 10x más rápido (38 PDFs en 26 segundos vs 3-5 minutos)
3. app/empleado/recibos/FirmaDigital.tsx
getContext('2d') cacheado en ref (1 sola vez)
Coordenadas escaladas con DPR para pantallas retina
JPEG 80% en vez de PNG (70% más liviano)
Validación de trazo vacío
Beneficio: Firma fluida, sin lag, sin memory leaks
4. Sistema de Autenticación Custom
Login de empleados sin depender de Supabase Auth
Cookies + LocalStorage para persistencia
Proxy (proxy.ts) verifica token en cada request
5. Flujo de Carga de Recibos (OPTIMIZADO)
Admin sube múltiples PDFs individuales → Storage → Backend extrae → Inserta en BD
DECISIÓN DE DISEÑO: Los PDFs se separan ANTES de subir (con I LOVE PDF)
Cada empleado tiene su propio PDF individual
Vinculación automática por CUIL
Beneficio: Carga masiva de recibos en segundos
🧪 Datos de Prueba
Empleado de prueba
CUIL: 20-28729145-1 (o 20287291451 sin guiones)
Contraseña: 123456
Nombre: DIAZ, DIEGO MARIANO
ID: 50c95548-407e-4293-a72f-cb1db0f394eb (puede cambiar tras eliminar duplicados)
Recibos cargados
Período: 2026-06
Quincena: 1ra
Cantidad: 33 empleados (después de eliminar duplicados)
Ejemplo: DIAZ, DIEGO MARIANO - $566.029
Total de empleados en BD
85 empleados únicos (después de limpiar duplicados)
⚠️ Pendiente de optimizar
Prioridad ALTA
⚠️ CRÍTICO: Descarga de PDF firmado
Problema: Descarga el lote completo (13 páginas) en vez del recibo individual
Problema: La firma aparece como bloque negro
Causa: pdf_original_url apunta al PDF lote, no al individual
Solución pendiente: Verificar que cada recibo tenga su propio PDF individual
Notificaciones → Pop-ups cuando hay recibo nuevo
Vista previa de PDF → Antes de firmar
Prioridad MEDIA
Sistema de roles → Gerentes, referentes zonales
Anulación de firma → Dentro de las 24 horas
Reportes administrativos → Excel/PDF
Prioridad BAJA
Migrar Pages Router → pages/api/importar-recibos.ts a App Router
Problemas conocidos y soluciones
✅ Resueltos
Login de empleados no funcionaba → Implementado sistema custom
Canvas de firma descuadrado → Coordenadas escaladas con DPR
Recibos no aparecían → Normalización de CUILs sin guiones
Firma quedaba en "pendiente" → Actualizar AMBAS columnas (estado y estado_firma)
RLS bloqueaba inserts → Desactivado temporalmente
Backend Python no iniciaba → Activar entorno virtual venv
Empleados duplicados → Eliminar con DISTINCT ON y re-vincular recibos
Password borrado → Regenerar con bcrypt y actualizar en BD
Endpoint login 404 → Reiniciar servidor y borrar caché .next
Emails duplicados al crear empleados → Buscar por email y vincular en vez de crear
Carga lenta de PDFs → Optimizar a procesamiento en lote paralelo
⚠️ Pendientes
⚠️ PDF firmado descarga lote completo (no individual)
⚠️ Firma aparece como bloque negro en el PDF
App lenta al cargar (necesita optimización)
Consumo alto de memoria
Generación de PDF firmado (no probado aún correctamente)
📌 Notas importantes
Next.js 16: Usa proxy.ts en lugar de middleware.ts
CUILs: Siempre SIN guiones en la base de datos
RLS: Desactivado en desarrollo (reactivar en producción)
Backend Python: Debe estar corriendo en puerto 8000 para cargar recibos
Storage: Buckets recibos-originales y recibos-firmados deben ser públicos
Doble estado: recibos_sueldo tiene estado y estado_firma (actualizar ambas)
Firma digital: Se guarda como base64 en múltiples columnas por compatibilidad
PDFs individuales: Los PDFs se separan ANTES de subir (con I LOVE PDF), cada empleado tiene su propio archivo
Email único: La tabla empleados tiene constraint único en email - manejar errores 23505
Upsert de recibos: Usa onConflict: 'empleado_id,periodo,quincena'
🚀 Estado actual (25/06/2026)
✅ Funcional
Login de empleados (sistema custom)
Registro de firma digital
Carga masiva de recibos desde admin (optimizada, 10x más rápida)
Vista de recibos del empleado
Firma de recibos con validación secuencial
Actualización de estado post-firma
Dashboard administrativo con métricas
Eliminación de empleados duplicados
🔄 En progreso
⚠️ Descarga de PDF firmado (problema con PDFs multi-página)
⚠️ Firma aparece como bloque negro en el PDF
📋 Próximos pasos
URGENTE: Corregir descarga de PDF firmado (individual + firma visible)
Implementar sistema de notificaciones
Agregar roles y permisos
Sistema de licencias y vacaciones
🔧 Comandos útiles
Iniciar desarrollo
# Terminal 1: Backend Python
cd C:\Users\Usuario\backend-extractor
venv\Scripts\activate
python main.py

# Terminal 2: Frontend Next.js
cd C:\Users\Usuario\app-rrhh
npm run dev
Limpiar caché de Next.js
rmdir /s /q .next
npm run dev

Establecer contraseña de empleado
node -e "const bcrypt = require('bcryptjs'); const hash = bcrypt.hashSync('123456', 10); console.log(hash);"

Luego actualizar en Supabase:
UPDATE empleados SET password_hash = 'PEGAR_HASH_AQUI' WHERE cuil = '20287291451';

SQL útiles
-- Normalizar CUILs
UPDATE empleados SET cuil = REPLACE(cuil, '-', '');
UPDATE recibos_sueldo SET cuil = REPLACE(cuil, '-', '');

-- Eliminar empleados duplicados (mantener el más reciente)
DELETE FROM empleados
WHERE id NOT IN (
  SELECT DISTINCT ON (cuil) id
  FROM empleados
  ORDER BY cuil, updated_at DESC NULLS LAST
);

-- Verificar recibos de un empleado
SELECT rs.*, e.nombre_completo
FROM recibos_sueldo rs
JOIN empleados e ON e.id = rs.empleado_id
WHERE e.cuil = '20287291451'
ORDER BY rs.periodo DESC;

-- Corregir estado de recibos firmados
UPDATE recibos_sueldo
SET estado = 'firmado', estado_firma = 'firmado'
WHERE firma_imagen_url IS NOT NULL AND estado = 'pendiente';

-- Verificar PDF original de un recibo
SELECT id, periodo, cuil, pdf_original_url, firma_imagen_url IS NOT NULL as tiene_firma
FROM recibos_sueldo
WHERE cuil = '20287291451';

-- Ver empleados duplicados por email
SELECT email, COUNT(*) as cantidad
FROM empleados
GROUP BY email
HAVING COUNT(*) > 1;

-- Métricas para dashboard
SELECT 
  COUNT(DISTINCT e.id) as total_empleados,
  COUNT(DISTINCT rs.id) as total_recibos,
  COUNT(DISTINCT CASE WHEN rs.estado = 'firmado' THEN rs.id END) as recibos_firmados,
  COUNT(DISTINCT CASE WHEN rs.estado = 'pendiente' THEN rs.id END) as recibos_pendientes
FROM empleados e
LEFT JOIN recibos_sueldo rs ON rs.empleado_id = e.id;

📚 Decisiones de diseño importantes
Separación de PDFs antes de subir
Decisión: Los admin separan los PDFs con I LOVE PDF antes de subirlos.
Razón: Más simple que implementar separación automática en el backend.
Consecuencia: Cada empleado tiene su propio PDF individual desde el inicio.
Manejo de empleados duplicados
Decisión: Si falla la creación por email duplicado, buscar el empleado existente y vincularlo.
Razón: Evita perder datos y mantiene la integridad referencial.
Doble columna de estado
Decisión: Mantener estado y estado_firma como columnas separadas.
Razón: Compatibilidad con código legacy. Ambas deben actualizarse juntas.
Última actualización: 25 de junio de 2026
