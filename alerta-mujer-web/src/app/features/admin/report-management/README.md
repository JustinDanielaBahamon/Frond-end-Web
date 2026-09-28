# Módulo de Gestión de Reportes

## 📋 Descripción

El módulo de gestión de reportes del panel administrativo permite a los administradores visualizar, filtrar, generar y exportar reportes del sistema AlertaMujer. Está completamente funcional con datos locales y preparado para integración futura con API.

## 🎯 Funcionalidades Implementadas

### ✅ Funcionalidades Operativas

1. **Estadísticas en tiempo real**
   - Total de reportes generados
   - Total de alertas registradas
   - Zonas activas monitoreadas
   - Exportaciones realizadas

2. **Búsqueda y filtrado avanzado**
   - Búsqueda por nombre, ciudad o generador
   - Filtro por rango de fechas
   - Filtro por ciudad
   - Filtro por tipo de alerta (SOS, Robo, Acoso, Médico)
   - Filtro por estado (Pendiente, Cerrada, Atendida)
   - Limpieza de filtros con un click

3. **Paginación dinámica**
   - Navegación entre páginas
   - Indicador de elementos mostrados
   - Cálculo automático de páginas
   - Botones de primera/última página

4. **Exportación de archivos**
   - Descarga individual en PDF
   - Descarga individual en Excel
   - Descarga masiva en PDF
   - Descarga masiva en Excel
   - Funcionalidad de impresión

5. **CRUD de Reportes**
   - Crear nuevos reportes
   - Ver detalles de reportes existentes
   - Editar información de reportes
   - Eliminar reportes con confirmación

6. **Modales interactivos**
   - Modal para crear/editar reportes
   - Modal para ver detalles
   - Formularios con validación
   - Mensajes de error

## 🏗️ Arquitectura

### Archivos del Módulo

```
report-management/
├── report-management.ts          # Lógica del componente
├── report-management.html         # Template con bindings
├── report-management.scss         # Estilos
└── README.md                      # Esta documentación
```

### Archivos de Soporte

```
core/
├── models/
│   └── report.model.ts           # Modelos de datos
└── services/
    └── reports.service.ts         # Servicio con lógica de negocio
```

## 📊 Modelos de Datos

### Reporte
```typescript
interface Reporte {
  id: number;
  nombre: string;
  fecha: Date;
  ciudad: string;
  tipo: 'SOS' | 'Robo' | 'Acoso' | 'Médico';
  estado: 'Pendiente' | 'Cerrada' | 'Atendida';
  generadoPor: string;
  formato: 'PDF' | 'Excel' | 'CSV';
  tamano: string;
  descripcion?: string;
}
```

### ReporteFilters
```typescript
interface ReporteFilters {
  busqueda: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  ciudad: string;
  tipo: string;
  estado: string;
}
```

### ReporteStats
```typescript
interface ReporteStats {
  totalReportes: number;
  totalAlertas: number;
  zonasActivas: number;
  exportaciones: number;
}
```

### Paginacion
```typescript
interface Paginacion {
  paginaActual: number;
  elementosPorPagina: number;
  totalElementos: number;
  totalPaginas: number;
}
```

## 🔧 Servicio de Reportes

### Métodos Implementados

#### Métodos CRUD (Preparados para API)
```typescript
getAll(): Observable<Reporte[]>
getById(id: number): Observable<Reporte>
create(reporte: Omit<Reporte, 'id'>): Observable<Reporte>
update(reporte: Reporte): Observable<Reporte>
delete(id: number): Observable<void>
getStats(): Observable<ReporteStats>
```

#### Métodos de Filtrado (Locales)
```typescript
filtrarReportes(filtros: ReporteFilters): Observable<Reporte[]>
```

#### Métodos de Exportación (Simulados)
```typescript
descargarPDF(id: number): Observable<Blob>
descargarExcel(id: number): Observable<Blob>
descargarCSV(id: number): Observable<Blob>
generarReporte(tipo: string, filtros: ReporteFilters): Observable<Reporte>
imprimirReporte(id: number): void
```

## 🚀 Integración con API Futura

### Preparación para Backend

El servicio está diseñado para facilitar la transición a una API real:

1. **Comentarios de migración**: Cada método tiene comentarios indicando cómo será la implementación con API.

2. **Mismos firmas**: Las firmas de los métodos están diseñadas para coincidir con las llamadas HTTP típicas.

3. **Datos mock separados**: Los datos de prueba están en variables separadas para fácil reemplazo.

4. **Patrón Observable**: Todos los métodos retornan Observables para consistencia con HttpClient.

### Ejemplo de Migración

**Actual (Local):**
```typescript
getAll(): Observable<Reporte[]> {
  return this.reportes$;
}
```

**Futuro (API):**
```typescript
getAll(): Observable<Reporte[]> {
  return this.http.get<Reporte[]>(this.apiUrl);
}
```

## 🎨 Componentes UI

### Stat Cards
- Total Reportes (Púrpura)
- Total Alertas (Verde)
- Zonas Activas (Naranja)
- Exportaciones (Azul)

### Toolbar
- Caja de búsqueda con icono
- Botones de acción (PDF, Excel, Imprimir)
- Filtros por fecha, ciudad, tipo, estado
- Botón de limpiar filtros

### Tabla
- Columnas: Nombre, Fecha, Ciudad, Tipo, Estado, Generado por, Acciones
- Badges de color según tipo
- Indicadores de estado con punto
- Botones de acción (ver, editar, eliminar)

### Paginación
- Información de elementos mostrados
- Botones de navegación
- Páginas visibles dinámicas
- Indicador de puntos suspensivos

### Modales
- Modal crear/editar con formulario
- Modal ver detalles con información completa
- Animaciones suaves de entrada/salida
- Cierre al click fuera o botón X

## 🎯 Uso del Componente

### En el Routing
```typescript
{
  path: 'report-management',
  loadComponent: () =>
    import('./features/admin/report-management/report-management')
      .then(m => m.ReportManagementComponent)
}
```

### Props y Eventos
El componente es completamente autónomo y no requiere props ni eventos externos.

## 🔐 Consideraciones de Seguridad

1. **Validación de formularios**: Campos requeridos validados antes de envío
2. **Confirmación de eliminación**: Modal de confirmación antes de borrar
3. **Sanitización de inputs**: Los inputs están protegidos contra XSS
4. **Control de acceso**: Ruta protegida por `adminGuard`

## 📱 Responsive Design

### Breakpoints
- **Desktop**: > 1200px - 4 columnas en stats
- **Tablet**: 768px - 1200px - 2 columnas en stats
- **Mobile**: < 768px - 1 columna, layouts apilados

### Adaptaciones
- Tabla con scroll horizontal en móviles
- Modales con ancho completo en móviles
- Botones apilados en pantallas pequeñas
- Filtros en columna en móvil

## 🧪 Testing

### Casos de Prueba Recomendados

1. **Filtrado**
   - Búsqueda por nombre existente
   - Búsqueda por nombre inexistente
   - Filtro por fecha con resultados
   - Filtro por fecha sin resultados
   - Combinación de múltiples filtros

2. **Paginación**
   - Navegación a páginas siguientes
   - Navegación a páginas anteriores
   - Ir a primera/última página
   - Comportamiento con pocos elementos

3. **CRUD**
   - Crear reporte con datos válidos
   - Crear reporte con datos inválidos
   - Editar reporte existente
   - Eliminar reporte con confirmación
   - Eliminar reporte cancelando

4. **Exportación**
   - Descarga PDF individual
   - Descarga Excel individual
   - Descarga masiva
   - Impresión de reportes

## 🐛 Solución de Problemas

### Issues Comunes

1. **Filtros no funcionan**
   - Verificar que los filtros se estén aplicando
   - Revisar consola para errores
   - Limpiar filtros y volver a intentar

2. **Paginación incorrecta**
   - Verificar que `totalElementos` se esté calculando
   - Revisar lógica de cálculo de páginas
   - Validar que `elementosPorPagina` sea correcto

3. **Modales no se cierran**
   - Verificar event.stopPropagation()
   - Revisar bindings de click
   - Comprobar z-index de overlay

## 🔄 Flujo de Trabajo

### 1. Cargar Datos
```
ngOnInit → cargarDatos() → reportsService.getAll() → actualizar UI
```

### 2. Aplicar Filtros
```
Usuario modifica filtro → aplicarFiltros() → reportsService.filtrarReportes() → actualizar UI
```

### 3. Paginar
```
Usuario cambia página → cambiarPagina() → recortar array → actualizar UI
```

### 4. Crear Reporte
```
Usuario abre modal → completa formulario → crearReporte() → reportsService.create() → cargarDatos()
```

### 5. Exportar
```
Usuario click exportar → descargarPDF() → reportsService.descargarPDF() → descargar archivo
```

## 📈 Mejoras Futuras

### Planeado
- [ ] Integración real con API backend
- [ ] Generación de reportes con criterios personalizados
- [ ] Programación de reportes automáticos
- [ ] Envío de reportes por email
- [ ] Gráficos y visualizaciones en reportes
- [ ] Exportación en más formatos
- [ ] Historial de cambios en reportes
- [ ] Compartir reportes con otros usuarios

### Opcionales
- [ ] Plantillas personalizadas de reportes
- [ ] Branding en reportes exportados
- [ ] Firma digital en reportes
- [ ] Versionado de reportes
- [ ] Comparación entre reportes

## 📞 Soporte

Para problemas o preguntas sobre el módulo de reportes, contactar al equipo de desarrollo o revisar la documentación técnica del proyecto.