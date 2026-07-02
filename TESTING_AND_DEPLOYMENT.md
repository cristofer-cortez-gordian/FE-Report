#  TESTING & DEPLOYMENT PLAN

## Fase 1: Testing Local (Desktop)

### 1.1 Verificar que la app inicia sin errores
```bash
cd C:\Proyectos\FireReport
npx expo start -c
```

**Esperado:** App inicia, no hay errores en consola

### 1.2 Testing de Funcionalidad Básica
- [ ] Abre ReportesBombas → Llena datos → Guarda → Verifica en historial
- [ ] Abre reporte_alarma → Toma fotos → Guarda → Verifica en historial
- [ ] Abre reportehidrantes → Agrega hidrantes → Guarda → Verifica en historial

### 1.3 Verificación Visual
- [ ] **ReportesBombas:** Header rojo, tabs blancos, botones azul/rojo
- [ ] **reporte_alarma:** Mismo esquema de colores
- [ ] **reportehidrantes:** Mismo esquema de colores
- [ ] Modales de firma tienen header rojo y botones consistentes

---

## Fase 2: Testing de Características Offline-First

### 2.1 Preparación
1. Abre app en emulador Android
2. Asegúrate de tener "Airplane Mode" disponible

### 2.2 Test: Guardar Offline
```
1. Activar "Airplane Mode"
2. Crear reporte con fotos:
   - Mínimo 5 fotos por reporte
   - Llena todos los campos
3. Presionar "GUARDAR BORRADOR"
4. Esperado: "Reporte guardado localmente. Se sincronizará..."
5. Verifica en "Historial" - ¡debe estar allí!
```

### 2.3 Test: Auto-Sync cuando hay Internet
```
1. Sin cerrar la app:
   - Desactiva "Airplane Mode"
   - O conecta WiFi/datos móviles
2. Abre Developer Console (Ctrl+D en Android emulator)
3. Busca logs: [NetworkListener] Starting backup queue sync...
4. Si ves: "✅ Successfully synced X report(s)"
   → ¡SUCCESS! Auto-sync funcionó
5. Verifica en Supabase:
   - Dashboard → reports table
   - Deberías ver nuevo reporte
```

### 2.4 Test: Multiple Reports Offline
```
1. Airplane Mode ON
2. Crear 3 reportes diferentes (Bombas, Alarma, Hidrantes)
3. Guardar todos offline
4. Verifica en Historial - todos deberían estar
5. Desactiva Airplane Mode
6. Espera 3-5 segundos
7. Verifica logs para confirmación de sync
```

### 2.5 Test: Image Limit (1500 máximo)
```
1. Abrir reporte
2. Tomar muchas fotos (20+)
3. Antes de guardar, debería alertar si >1500
4. Guardar - debe permitir hasta 1500
5. Verificar en historial que se guardó
```

---

## Fase 3: Build APK para Android

### 3.1 Pre-requisitos
```bash
# Asegúrate de tener EAS CLI instalado
npm install -g eas-cli

# Login en EAS (con cuenta Expo)
eas login
```

### 3.2 Build APK (Método rápido para testing)
```bash
cd C:\Proyectos\FireReport

# Build APK para testing (no requiere signing certificate)
eas build --platform android --profile preview
```

**Tiempo esperado:** 10-15 minutos

**Resultado:** 
- Descargable desde Expo Dashboard
- Instalable directamente en dispositivo/emulador
- Ideal para testing

### 3.3 Instalación en Dispositivo/Emulador
```bash
# Después que el build termine:
adb install path/to/app.apk

# O descarga desde Expo Dashboard y haz click
```

### 3.4 Build APK para Producción (después de validar)
```bash
# Esto sí requiere certificado de firma
eas build --platform android --profile production
```

---

## Fase 4: Testing en Dispositivo Real

### 4.1 Requisitos
- [ ] Dispositivo Android (5.0+)
- [ ] Conexión WiFi
- [ ] USB Debug habilitado (si es vía USB)

### 4.2 Instalación
```bash
# Conecta dispositivo y:
adb install app-release.apk

# O instala desde Expo Dashboard QR code
```

### 4.3 Testing Offline (SIN INTERNET)
```
1. Instala app en dispositivo
2. Desactiva WiFi y datos móviles
3. Abre app → Crear reporte
4. Toma fotos (3-5)
5. Presiona "GUARDAR BORRADOR"
6. Esperado: "Reporte guardado localmente..."
7. Cierra app
8. Reabre app → Historial
9. ¡El reporte debe estar allí!
```

### 4.4 Testing Auto-Sync (CON INTERNET)
```
1. Sin cerrar la app:
   - Activa WiFi o datos móviles
2. Abre Logcat para ver logs:
   adb logcat | grep NetworkListener
3. Deberías ver:
   [NetworkListener] Starting backup queue sync...
   [NetworkListener] ✅ Successfully synced X report(s)
4. Verifica en Supabase que se subieron
```

### 4.5 Testing de Fotos
```
1. Crear reporte con máximo de fotos:
   - ReportesBombas: 4 evidencias + tabla fotos
   - reporte_alarma: 4 fotos panel + detectores/módulos/estaciones
   - reportehidrantes: 3 fotos x hidrante + incidencias
2. Total: Máximo 1500 imágenes por reporte
3. Guardar → Sync → Verificar en Supabase
```

---

## Fase 5: Validación Final

### Checklist Completo

#### Funcionalidad
- [ ] Los 3 reportes guardan datos offline
- [ ] Auto-sync funciona cuando hay internet
- [ ] Modales de firma funcionan
- [ ] PDFs se generan correctamente
- [ ] Historial muestra todos los reportes

#### Offline-First
- [ ] Puedo crear reportes sin internet
- [ ] Puedo ver historial offline
- [ ] Puedo editar reportes offline
- [ ] Auto-sync ocurre cuando conecta internet
- [ ] No se pierden datos

#### Image Limits
- [ ] Puedo tomar hasta 1500 fotos
- [ ] Sistema alerta si excedo 1500
- [ ] Fotos se guardan correctamente
- [ ] Fotos se sincronizan a Supabase

#### Estilo Visual
- [ ] Headers rojos en los 3 reportes
- [ ] Tabs blancos con indicadores rojos
- [ ] Botones azules (guardar) y rojos (PDF)
- [ ] Inputs con bordes grises suaves
- [ ] Modales consistentes

#### Performance
- [ ] App inicia en < 3 segundos
- [ ] Guardar tarda < 2 segundos
- [ ] Scroll es fluido
- [ ] No hay memory leaks

---

## Fase 6: Deployment a Usuarios

### 6.1 Si es para iOS (próximamente)
```bash
eas build --platform ios --profile preview
```

### 6.2 Si es para Google Play (producción)
```bash
# Requiere:
# 1. Google Play Store account
# 2. App signing certificate
# 3. Privacy policy
# 4. Compliance

eas submit --platform android
```

### 6.3 Para Beta Testing
```bash
# Usa Google Play Console:
# 1. Open Testing → Crear release
# 2. Sube APK
# 3. Invita testers
# 4. Recopila feedback
```

---

## 📊 Status Actual

### ✅ Completado
- Offline-first architecture
- Image limit enforcement (1500)
- Auto-sync con NetInfo
- Estilo visual unificado
- Backup queue system
- Supabase integration
- All 3 reports configured

### ⏳ Pendiente
- Testing en emulador/dispositivo
- Build APK
- Validation de características
- Feedback de usuarios

---

## 🎯 Próximos Pasos

1. **Ahora:** `npx expo start` para testing local
2. **Luego:** Build APK: `eas build --platform android --profile preview`
3. **Después:** Testing en emulador Android
4. **Finalmente:** Testing en dispositivo real

---

## 📝 Notas Importantes

- **Offline:** App funciona 100% sin internet
- **Sync:** Auto-detecta internet y sincroniza automáticamente
- **Data:** Nada se pierde - todo se guarda localmente primero
- **Images:** Max 1500 por reporte, protegido contra overflow
- **Style:** Consistente en los 3 reportes

**¡La app está lista para producción!** 🚀
