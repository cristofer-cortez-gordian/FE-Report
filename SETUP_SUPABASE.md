# Configuración de Supabase para FireReport

La aplicación ahora usa **Supabase** en lugar de Firebase. Sigue estos pasos para configurar todo.

## Pasos de Configuración

###  Crear Proyecto en Supabase

1. Ve a **https://app.supabase.com/**
2. Crea una cuenta o inicia sesión
3. Haz clic en **"New Project"**
4. Completa:
   - **Project name**: `FireReport` (o el que prefieras)
   - **Database password**: Pon una contraseña fuerte
   - **Region**: Elige la más cercana a ti
5. Haz clic en **"Create new project"** (toma 1-2 minutos)

###  Obtener las Credenciales

Una vez creado el proyecto:

1. Ve a **Settings** (engranaje en la esquina inferior izquierda)
2. Selecciona **API**
3. Busca la sección **"Project API keys"**
4. Copia estos valores:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`

###  Crear el archivo `.env`

En la **raíz del proyecto** (junto a `package.json`), crea un archivo `.env` con:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key-aqui
```

**Reemplaza** con tus valores reales copiados en el paso anterior.

###  Crear la Tabla `reports` en Supabase

1. En Supabase, ve a **SQL Editor** (icono de database)
2. Haz clic en **"New Query"**
3. Copia y pega esto:

```sql
-- Crear tabla para almacenar reportes
create table public.reports (
  id bigint primary key,
  client text,
  tipo text,
  data jsonb not null,
  created_at timestamptz default now(),
  last_backup timestamptz
);

-- Crear índice para búsquedas rápidas
create index on public.reports ((data->>'cliente'));
```

4. Haz clic en **"Run"** (botón play)

###  Crear el Bucket `report-photos` para almacenar fotos

1. En Supabase, ve a **Storage** (icono de carpeta)
2. Haz clic en **"Create a new bucket"**
3. Pon el nombre: `report-photos`
4. **Política**: Elige **Public** para que las fotos sean accesibles públicamente (o Privado si prefieres seguridad)
5. Haz clic en **"Create bucket"**

###  Configurar Políticas de Seguridad (RLS - Row Level Security)

Para mayor seguridad (opcional pero recomendado):

1. En Supabase, ve a **Settings → RLS** (Realtime Filters)
2. En la tabla `reports`, habilita **Enable RLS**
3. Crea una política permitiendo inserts/updates:

```sql
-- Permitir que cualquiera inserte/actualice (desarrollo)
create policy "Allow all inserts and updates"
on public.reports
for insert, update
to anon
using (true)
with check (true);

-- Para producción, restringe solo a usuarios autenticados
-- create policy "Users can only access their reports"
-- on public.reports
-- using (auth.uid() = user_id);
```

###  Instalar Dependencias y Reiniciar

```bash
npm install
npx expo start -c
```

##  Verificar que Todo Funciona

- Abre la aplicación
- Crea un reporte y haz clic en **"GENERAR PDF Y GUARDAR"**
- En Supabase, ve a **Table Editor** → `reports` y verifica que aparezca tu reporte
- En **Storage** → `report-photos`, deberías ver las carpetas con las fotos

##  Variables de Entorno (Resumen)

| Variable | Valor | Dónde obtenerla |
|---|---|---|
| `SUPABASE_URL` | `https://tu-proyecto.supabase.co` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Tu anon key | Supabase → Settings → API → anon public |

##  Seguridad

- **NO** comitas el archivo `.env` al repositorio (ya está en `.gitignore`)
- Las claves anon en producción son seguras (solo pueden acceder a datos según RLS)
- Para producción, usa **EAS secrets**:
  ```bash
  eas secret:create --name SUPABASE_URL --value "tu-url"
  eas secret:create --name SUPABASE_ANON_KEY --value "tu-anon-key"
  ```

##  Solución de Problemas

### Error: "Cannot connect to Supabase"
- Verifica que `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `.env` sean correctos
- Comprueba que el proyecto esté activo en Supabase

### Error: "Table 'reports' doesn't exist"
- Asegúrate de haber ejecutado el SQL para crear la tabla
- Verifica en Supabase → Table Editor

### Error: "Storage 'report-photos' not found"
- Crea el bucket `report-photos` en Storage
- Asegúrate de que sea **Public** para que las fotos sean accesibles

### Error: "database or disk is full (code 13 SQLITE_FULL[13])"
**Problema:** El almacenamiento local del teléfono está lleno.

**Soluciones:**

#### 1️⃣ Limpiar Almacenamiento en la App (Recomendado)
1. Abre FireReport
2. Ve a la pantalla **"Backups"**
3. Verás cuánto espacio ocupan tus reportes locales (ej: "Almacenamiento local: 5.23 MB")
4. Presiona el botón rojo **"Limpiar"** para eliminar:
   - Borradores vacíos (sin datos completados)
   - Reportes temporales en edición
   - Archivos innecesarios

#### 2️⃣ Liberar Espacio en Android Manualmente
Si el paso anterior no es suficiente, sigue estos pasos en tu teléfono Android:

1. **Abre Configuración** → **Almacenamiento** (o **Espacio de almacenamiento**)
2. **Revisa qué está consumiendo espacio:**
   - Fotos y videos (Galería)
   - Descargas
   - Apps instaladas
   - Caché de aplicaciones

3. **Opciones para liberar espacio:**

   **Eliminar fotos y videos no usados:**
   - Abre la Galería
   - Selecciona y elimina fotos/videos viejos
   - Vacía la papelera (si existe)

   **Limpiar caché de apps:**
   - Ve a **Configuración** → **Aplicaciones** → **Almacenamiento**
   - Selecciona una app y presiona **"Borrar caché"** (NO borres datos)
   - Repite con otras apps

   **Desinstalar apps no usadas:**
   - **Configuración** → **Aplicaciones**
   - Mantén presionada una app y selecciona **"Desinstalar"**

   **Eliminar descargas:**
   - Abre la app **"Descargas"** o carpeta **"Downloads"**
   - Elimina archivos que no necesites

   **Borrar archivos temporales:**
   - Usa una app como **CCleaner** o **Files by Google**
   - Escanea y elimina archivos basura

4. **Verifica el espacio disponible:**
   - **Configuración** → **Almacenamiento**
   - Asegúrate de tener al menos **500 MB - 1 GB** libre

5. **Reinicia la app e intenta guardar nuevamente.**

#### 3️⃣ Prevención
- Usa regularmente el botón **"Limpiar"** en Backups
- Después de guardar un reporte, verifica que esté en Supabase
- Elimina reportes locales viejos que ya tengan backup en la nube

---

¡Listo! Tu aplicación ahora usa Supabase. 
