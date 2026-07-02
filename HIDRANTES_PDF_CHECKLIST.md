# Checklist de mapeo campo -> PDF (Reporte Hidrantes)

## Datos generales (pie de pagina en ambos PDFs)
- [ ] fecha -> tabla de pie: "Fecha"
- [ ] aviso_departamento -> tabla de pie: "Departamento"
- [ ] predio -> tabla de pie: "Predio del Cliente"
- [ ] aviso_responsable -> tabla de pie: "Nombre del Responsable del departamento"
- [ ] hora_inicio -> tabla de pie: "Hora de inicio"
- [ ] hora_final -> tabla de pie: "Hora final"
- [ ] cantidad_hidrantes -> tabla de pie: "Cantidad de hidrantes"
- [ ] empresa_especialista -> bloque "Nombre del Especialista Fire Engineers"

## Encabezado (ambos PDFs)
- [ ] cliente_nombre -> header: Cliente
- [ ] cliente_contacto -> header: Contacto
- [ ] cliente_telefono -> header: Telefono
- [ ] cliente_correo -> header: Correo
- [ ] cliente_direccion -> header: Direccion
- [ ] empresa_nombre -> header: Empresa
- [ ] empresa_representante -> header: Representante
- [ ] empresa_telefono -> header: Telefono empresa
- [ ] empresa_correo -> header: Correo empresa

## Hidrantes (PDF de hidrantes)
- [ ] numero -> columna "Numero de hidrante"
- [ ] presion -> columna "Presion del manometro"
- [ ] ubicacion -> columna "Ubicacion de hidrante"
- [ ] manguera -> columna "Manguera"
- [ ] obstruido -> columna "Obstruido"
- [ ] sin_dano -> columna "Libre de dano"
- [ ] valvula -> columna "Valvula angular"
- [ ] accesorios -> columna "Vidrio/chiflon/llave"
- [ ] identificado -> columna "Identificado"
- [ ] espuma_dosificador -> columna "Espuma/dosificador"
- [ ] cristal -> columna "Cristal"
- [ ] obs_id -> columna "Observacion (texto)"
- [ ] fotos.antes -> columna "Observacion" (imagen)
- [ ] fotos.prueba -> columna "Prueba" (imagen)
- [ ] fotos.despues -> columna "Despues" (imagen)

## Incidencias (PDF de incidencias)
- [ ] descripcion -> columna "Descripcion de incidencias / evidencia grafica"
- [ ] fotos_descripcion -> imagenes en columna de descripcion
- [ ] pruebas -> columna "Pruebas y diagnostico / evidencias grafica"
- [ ] fotos_pruebas -> imagenes en columna de pruebas
- [ ] solucion -> columna "Solucion o recomendacion / evidencia grafica"
- [ ] fotos_solucion -> imagenes en columna de solucion

## Observaciones y firmas (ambos PDFs)
- [ ] observaciones_finales -> bloque "observaciones"
- [ ] firma_cliente -> firma en "Por Parte Del Cliente"
- [ ] nombre_cliente_firma -> nombre bajo firma cliente
- [ ] firma_tecnico -> firma en "Fire Engineers"
- [ ] nombre_tecnico_firma -> nombre bajo firma tecnico

## Prueba recomendada
1) Completar todos los campos con valores unicos (ej. AAA, BBB, 111, 222) en la app.
2) Generar ambos PDFs.
3) Marcar cada casilla al confirmar que aparece en el lugar correcto.
