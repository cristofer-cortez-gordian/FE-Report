# Actualización de Estilos - Consistencia Visual

## Resumen

Se ha estandarizado el estilo visual de los tres archivos de reportes para que coincidan con el diseño limpio y profesional de `reporte_alarma.js`.

## Cambios Realizados

### Color Scheme Unificado
- **Primary Red:** #d32f2f (Headers, botones principales)
- **Primary Blue:** #004d99 (Botones secundarios, guardar)
- **Background:** #f2f2f7 (Fondo general)
- **Cards:** White con bordes redondeados (10px)
- **Borders:** #ddd (gris suave)

### ReportesBombas.js
- ✅ Header rojo (#d32f2f) con texto blanco
- ✅ Tabs en blanco con indicador activo rojo
- ✅ Cards blancas con padding consistente
- ✅ Inputs con bordes #ddd y fondo #f9f9f9
- ✅ Tabla con header rojo y celdas claras
- ✅ Botones: Azul (#004d99) para "Guardar", Rojo (#d32f2f) para "Generar PDF"
- ✅ Modal de firma mejorado con header rojo
- ✅ Botones modales consistentes

### reportehidrantes.js
- ✅ Header rojo (#d32f2f) con texto blanco
- ✅ Tabs con indicador activo rojo
- ✅ Cards blancas con bordes redondeados
- ✅ Tarjetas de hidrantes con borde izquierdo rojo
- ✅ Inputs con bordes #ddd y fondo #f9f9f9
- ✅ Botones de toggle con colores consistentes
- ✅ Botones: Azul (#004d99) para "Guardar Borrador", Rojo (#d32f2f) para "Generar PDF"
- ✅ Modal de firma con diseño limpio y moderno
- ✅ Componentes visuales alineados con reporte_alarma.js

### reporte_alarma.js
- (Referencia - sin cambios necesarios)

## Elementos de Diseño Estandarizados

### Botones
```javascript
// Guardar / Secundario
btnBlue: { backgroundColor: '#004d99', padding: 15, borderRadius: 8 }

// Generar PDF / Principal
btnSave: { backgroundColor: '#d32f2f', padding: 15, borderRadius: 8 }
```

### Inputs
```javascript
input: { 
  borderWidth: 1, 
  borderColor: '#ddd', 
  borderRadius: 5, 
  padding: 8, 
  fontSize: 12, 
  backgroundColor: '#f9f9f9' 
}
```

### Cards
```javascript
card: { 
  backgroundColor: 'white', 
  padding: 15, 
  borderRadius: 10, 
  marginBottom: 15 
}
```

### Modal
- Header rojo (#d32f2f)
- Fondo blanco para área de firma
- Botones en footer gris
- Botón cerrar rojo al final

## Beneficios

✅ **Consistencia Visual** - Todos los reportes se ven iguales  
✅ **Mejor UX** - Usuarios aprenden un patrón y lo aplican en todos lados  
✅ **Profesionalismo** - Diseño limpio y moderno  
✅ **Mantenimiento** - Cambios futuros afectan a todos uniformemente  

## Próximos Pasos

- Los tres reportes ya tienen offline-first + image limits
- El estilo visual es ahora consistente
- Listo para build APK y testing en Android

## Archivos Modificados

- `app/ReportesBombas.js` - StyleSheet actualizado
- `app/reportehidrantes.js` - StyleSheet + Modal mejorado
- `utils/backup.js` - (sin cambios en este update)
- `utils/networkSync.js` - (sin cambios en este update)
- `app/_layout.js` - (sin cambios en este update)
