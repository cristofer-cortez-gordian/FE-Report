# Paleta de Colores Unificada

## Colores Principales

```
Primary Red:      #d32f2f  ■ (Headers, Primary Buttons)
Primary Blue:     #004d99  ■ (Secondary Buttons)
Background:       #f2f2f7  ■ (App Background)
Card/White:       #ffffff  ■ (Cards, Modals)
Border/Gray:      #ddd     ■ (Inputs, Dividers)
Text/Dark:        #333     ■ (Main Text)
Text/Secondary:   #666     ■ (Labels)
```

## Componentes Visuales

### 1. Header (Todos los Reportes)
```
┌─────────────────────────────────────────────────┐
│ Reporte: [Título]               [GUARDAR] ✓     │  ← #d32f2f (Rojo)
└─────────────────────────────────────────────────┘
```

### 2. Tabs Navigation
```
┌──────────────────────────────────────────────────┐
│  GENERAL  │  DETECTORES  │  MÓDULOS  │  FIRMAS  │  ← White background
├──────────────────────────────────────────────────┤
│     ▔▔▔▔▔▔▔▔                                      │  ← Red indicator when active
└──────────────────────────────────────────────────┘
```

### 3. Input Fields
```
┌──────────────────────────────────────────┐
│ Nombre del Cliente                       │  ← Label: #666 (Gray)
│ ┌──────────────────────────────────────┐ │
│ │ [User Input Here]                    │ │  ← #f9f9f9 (Light Gray BG)
│ │ Border: #ddd                         │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### 4. Buttons

#### Blue Button (Guardar Borrador)
```
┌──────────────────────────────┐
│      GUARDAR BORRADOR        │  ← #004d99 (Blue)
│      White Text Bold         │
└──────────────────────────────┘
  padding: 15px
  borderRadius: 8px
```

#### Red Button (Generar PDF)
```
┌──────────────────────────────┐
│    GENERAR PDF Y GUARDAR     │  ← #d32f2f (Red)
│      White Text Bold         │
└──────────────────────────────┘
  padding: 15px
  borderRadius: 8px
```

### 5. Cards
```
┌──────────────────────────────────┐
│  Datos del Sitio          ← #d32f2f │  ← Title: Red
├──────────────────────────────────┤
│                                  │
│  [Form Content Here]             │  ← White background
│                                  │
└──────────────────────────────────┘
  borderRadius: 10px
  padding: 15px
  margin-bottom: 15px
```

### 6. Firma Modal
```
┌──────────────────────────────────────────┐
│  Firmar - Cliente              [X]       │  ← #d32f2f header
├──────────────────────────────────────────┤
│                                          │
│        [Signature Canvas Area]           │  ← White background
│                                          │
├──────────────────────────────────────────┤
│       [Borrar]        [Guardar Firma]    │  ← #ccc / #004d99
├──────────────────────────────────────────┤
│              [CANCELAR]                  │  ← #d32f2f
└──────────────────────────────────────────┘
```

## Comparación Antes/Después

### ReportesBombas.js ANTES
- Header: #d32f2f pero tabs en negro (#000000)
- Inputs: Bordes negros (#000000) y fondo pálido
- Tabla: Header negro, texto gris
- Botones: Verde (#14ba3a), Azul (#2980b9)
- Modal: Fondo negro, botones grises
- **Problema:** Inconsistente y poco profesional

### ReportesBombas.js DESPUÉS ✅
- Header: #d32f2f con tabs en blanco
- Inputs: Bordes grises (#ddd) y fondo claro (#f9f9f9)
- Tabla: Header rojo (#d32f2f), texto consistente
- Botones: Azul (#004d99), Rojo (#d32f2f)
- Modal: Header rojo, fondo blanco, botones claros
- **Resultado:** Consistente con reporte_alarma.js

### reportehidrantes.js ANTES
- Header: #f30000 (Rojo oscuro)
- Background: #ee0101 (Rojo muy oscuro - ilegible)
- Inputs: Bordes grises oscuros (#3c3c3c)
- Botones: Verde (#0ecb17), Azul (#1565c0)
- Modal: Buttons nativos (feos)
- **Problema:** Colores muy oscuros, poco legible

### reportehidrantes.js DESPUÉS ✅
- Header: #d32f2f (Rojo estándar)
- Background: #f2f2f7 (Gris claro - legible)
- Inputs: Bordes #ddd, fondo #f9f9f9
- Botones: Azul (#004d99), Rojo (#d32f2f)
- Modal: Diseño limpio con header rojo
- **Resultado:** Profesional y legible como reporte_alarma.js

## Aplicación

Todos los reportes ahora:
- ✅ Tienen el mismo esquema de colores
- ✅ Usan la misma tipografía
- ✅ Tienen los mismos tamaños de botones
- ✅ Comparten el mismo estilo de inputs
- ✅ Usan modales con el mismo diseño
- ✅ Mostrarán una experiencia unificada al usuario

## Testing Visual

Para verificar la consistencia:

1. Abre cada reporte (ReportesBombas, reporte_alarma, reportehidrantes)
2. Compara los colores - todos deben ser iguales
3. Verifica botones - azul para guardar, rojo para generar PDF
4. Abre modales de firma - mismo diseño en los tres
5. Revisa inputs - mismo estilo en los tres

¡Listo para producción! 🎉
