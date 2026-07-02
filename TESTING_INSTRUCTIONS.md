# 🎯 INSTRUCCIONES DE TESTING Y DEPLOYMENT - COMPLETAS

## Estado Actual: ✅ LISTO PARA TESTING

El proyecto ha completado:
- ✅ Offline-first architecture 
- ✅ Auto-sync con NetInfo
- ✅ Image limit enforcement (1500)
- ✅ Estilo visual unificado
- ✅ Prebuild completado exitosamente

---

## TESTING EN EMULADOR ANDROID (RECOMENDADO PRIMERO)

### Paso 1: Iniciar el servidor Expo
```bash
cd C:\Proyectos\FireReport
npx expo start
```

Esperado: Terminal muestra:
```
Expo Go launcher
Scan the QR code above with Expo Go (Android) or Camera app (iOS) to open your project
```

### Paso 2: Abrir en Android Emulator
Presiona **`a`** en la terminal

Espera 2-3 minutos mientras la app compila y carga.

### Paso 3: Verificar que carga sin errores
```
Debería ver:
- Home screen con opciones de reportes
- Sin mensajes de error
- App responsiva
```

Si hay errores, verás rojo en la terminal. Nota el error y avísame.

---

## 🔌 TESTING OFFLINE-FIRST (LO MÁS IMPORTANTE)

### Setup: Emulador con Airplane Mode
```
Emulador Android:
1. Abre Settings
2. Busca "Airplane Mode"
3. Actívalo (toggle ON)
4. Verifica que WiFi dice "Airplane mode on"
```

### Test 1: Guardar Reporte Offline

```
Pasos:
1. Abre ReportesBombas (u otro reporte)
2. Llena datos básicos:
   - Cliente: "Test Cliente"
   - Dirección: "Test Dirección"
   - Contacto: "Test Contact"
3. Toma MÍNIMO 3 fotos (Cámara)
4. Presiona "GUARDAR BORRADOR"

Esperado:
✓ Alert: "Reporte guardado localmente. Se sincronizará con nube..."
✓ Sin error
✓ App continúa funcionando

Validación:
5. Cierra el reporte (back)
6. Abre "Historial" 
7. ¡Deberías ver el reporte guardado!
8. Toca el reporte → Se abre y muestra los datos
```

### Test 2: Crear Múltiples Reportes Offline

```
Pasos:
1. Airplane Mode: ON (mantener)
2. Crear 3 reportes diferentes:
   - Bombas: Cliente "Bombas Test", 3 fotos
   - Alarma: Cliente "Alarma Test", 4 fotos panel
   - Hidrantes: Cliente "Hidrantes Test", 2 hidrantes, 6 fotos

3. Guardar todos: "GUARDAR BORRADOR"

Validación:
4. Abre Historial
5. Deberías ver los 3 reportes
6. Abre cada uno → Datos están presentes
```

### Test 3: Auto-Sync cuando Conecta Internet

```
Pasos:
1. Con los 3 reportes guardados offline
2. Airplane Mode: OFF (desactiva)
3. Espera 3-5 segundos
4. Abre Developer Console:
   - Presiona Ctrl+D (Android emulator)
   - Selecciona "View logs"
   
Busca logs que contengan:
   [NetworkListener] Starting backup queue sync...
   [NetworkListener] ✅ Successfully synced X report(s)

Validación en Supabase:
5. Ve a Supabase Dashboard
6. Reports table → Busca tus reportes
7. Deberías ver 3 nuevos registros con "cliente": "Bombas Test", "Alarma Test", etc.
```

### Test 4: Verificar Fotos en la Nube

```
Pasos:
1. En Supabase Dashboard → Storage
2. Busca bucket "report-images"
3. Deberías ver carpetas con tus reportes:
   - /[timestamp-reporte1]/
   - /[timestamp-reporte2]/
   - /[timestamp-reporte3]/

4. Abre una carpeta
5. Verifica que hay imágenes (3-6 por reporte)

Validación:
✓ Fotos están en la nube
✓ Nombres de archivo tienen formato correcto
✓ Tamaños parecen correctos (no 0 bytes)
```

---

## 🖼️ TESTING VISUAL (ESTILO)

### ReportesBombas.js
```
Verifica:
□ Header rojo (#d32f2f) con texto blanco
□ Tabs blancos con línea roja en tab activo
□ Cards blancas con padding consistente
□ Inputs con borde gris (#ddd), fondo claro (#f9f9f9)
□ Tabla con header rojo
□ Botones:
  - "GUARDAR BORRADOR" → Azul (#004d99)
  - "GENERAR PDF Y GUARDAR" → Rojo (#d32f2f)
□ Modal de firma con header rojo
```

### reporte_alarma.js
```
Verifica:
□ Idéntico a ReportesBombas
□ Headers rojos
□ Tabs blancos
□ Botones mismo color
□ Modales idénticos
```

### reportehidrantes.js
```
Verifica:
□ Header rojo (#d32f2f)
□ Tabs blancos con indicador rojo
□ Cards blancas
□ Hidrantes cards con borde izquierdo rojo
□ Botones azul/rojo como otros
□ Modal de firma con header rojo
```

---

## 📸 TESTING DE IMAGE LIMITS

### Test: 1500 Imágenes Máximo

```
Pasos:
1. Abre reporte
2. Toma muchas fotos (mínimo 10)
   - ReportesBombas: Toma múltiples fotos en tabla
   - reporte_alarma: 4 panel + detectores
   - reportehidrantes: Múltiples hidrantes

3. Al guardar, sistema debería:
   ✓ Contar total de imágenes
   ✓ Si > 1500: Mostrar alert "Límite de Imágenes"
   ✓ Si ≤ 1500: Permitir guardar

Validación:
4. Guardar reporte
5. Verificar en AsyncStorage:
   - Abre React DevTools (Cmd+D Android)
   - Storage → AsyncStorage → mis_reportes
   - Verifica que report se guardó
```

---

## 🛠️ TROUBLESHOOTING DURANTE TESTING

### Si la app no carga:
```
1. Terminal: Ctrl+C para detener expo
2. Limpiar caché: 
   npx expo start -c
3. Si persiste, reinstalar:
   npm install
```

### Si offline-first no funciona:
```
1. Verificar que AsyncStorage está disponible:
   - Check en React DevTools
2. Verificar Airplane Mode está activado:
   - Emulator Settings → Airplane Mode
3. Revisar logs en consola
```

### Si auto-sync no ocurre:
```
1. Verificar que NetInfo está instalado:
   npm install @react-native-community/netinfo
2. Revisar logs: [NetworkListener]
3. Verificar credenciales Supabase en .env
```

### Si fotos no se guardan:
```
1. Verificar permisos de cámara:
   - Emulator Settings → Permissions → Camera
2. Verificar AsyncStorage tiene espacio
3. Revisar console logs para errores
```

---

## ✅ CHECKLIST COMPLETO DE TESTING

### Funcionalidad Básica
- [ ] App inicia sin errores
- [ ] Puedo crear reportes Bombas
- [ ] Puedo crear reportes Alarma  
- [ ] Puedo crear reportes Hidrantes
- [ ] Modales de firma funcionan
- [ ] PDFs se generan (después de testing)

### Offline-First (CRÍTICO)
- [ ] Puedo guardar offline con Airplane Mode
- [ ] Reportes aparecen en Historial offline
- [ ] Auto-sync ocurre cuando conecto internet
- [ ] Logs muestran [NetworkListener] ✅
- [ ] Fotos aparecen en Supabase

### Visual
- [ ] Headers rojos en los 3 reportes
- [ ] Tabs blancos/grises
- [ ] Botones azules y rojos consistentes
- [ ] Inputs con mismo estilo
- [ ] Modales consistentes

### Performance
- [ ] App carga en < 3 segundos
- [ ] Guardar toma < 2 segundos
- [ ] Scroll es fluido
- [ ] Sin crashes

### Supabase
- [ ] Reportes se crean en tabla
- [ ] Fotos se suben a Storage
- [ ] Datos se ven correctamente
- [ ] Timestamps son correctos

---

## 🚀 SIGUIENTE: BUILD APK

Después de completar testing en emulador:

```bash
# Build APK para testing (no requiere certificado)
eas build --platform android --profile preview

# Esto tardará 10-15 minutos
# Descarga desde Expo Dashboard
# Instala en dispositivo real:
adb install app-release.apk
```

---

## 📊 RESULTADO ESPERADO

Después de este testing, deberías poder:

1. ✅ Crear reportes offline
2. ✅ Ver reportes en historial
3. ✅ Auto-sync a Supabase cuando hay internet
4. ✅ Verificar fotos en la nube
5. ✅ Interfaz visual consistente
6. ✅ Sin errores o crashes

Si todo funciona → **LISTO PARA DEPLOYMENT** 🎉

---

## 📞 Reportar Problemas

Si encuentras algo que no funciona:
1. Nota el error exacto
2. Screenshot si es visual
3. Logs desde console (Ctrl+D)
4. Pasos para reproducir

**¡Vamos a testear!** 🚀
