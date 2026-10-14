# Prompt para Claude Code — Calculadora nutricional (100 % front, 100 % offline)

## 1. Contexto

Vas a construir una aplicación web **estática** (solo HTML, CSS y JavaScript, sin backend ni base de datos) para una **estudiante de nutrición**. La herramienta reemplaza un Excel de práctica ("Práctica No. 5 · Adolescente") con el que calcula:

1. Datos del paciente e IMC.
2. Gasto energético basal (GEB) con varias fórmulas, actividad física (AF), efecto térmico de los alimentos (ETA) y gasto energético total (GET).
3. Distribución de macronutrimentos (% → kcal → gramos).
4. Cuadro de equivalentes del SMAE (Sistema Mexicano de Alimentos Equivalentes) con totales y % de adecuación.
5. Reparto de los equivalentes por tiempos de comida: **Desayuno, Colación 1, Comida, Colación 2 y Cena**.

La usa todo el tiempo en **desktop, tablet y celular**, así que el diseño responsivo es un requisito, no un extra. Es una herramienta de apoyo académico, no un dispositivo clínico.

Toda la interfaz va en **español de México**.

## 2. Restricciones técnicas (no negociables)

- **Sin build step**: nada de Vite, Webpack, npm scripts ni frameworks de componentes (React, Vue, etc.). Se abre con doble clic en `index.html` y funciona.
- **100 % offline**: **cero CDNs y cero peticiones de red** en tiempo de ejecución. Todas las librerías y fuentes se descargan una sola vez y se guardan **dentro del proyecto** (`/vendor`, `/assets/fonts`). Usa npm solo como medio para descargar los archivos y luego cópialos a `/vendor`; el proyecto final no debe depender de `node_modules`.
- **Debe funcionar desde `file://`**. Por eso:
  - **No uses `<script type="module">`** ni `import`/`export` (los navegadores los bloquean en `file://`). Usa scripts clásicos en orden, con un solo namespace global (`window.NutriCalc = {...}`) o un patrón IIFE.
  - No uses `fetch()` para leer JSON locales; los datos van en archivos `.js`.
- **PWA opcional y progresiva**: agrega `manifest.webmanifest` y `sw.js` (service worker que precachea todos los archivos). Regístralo **solo si** `location.protocol` es `http:` o `https:`; en `file://` se omite sin errores. Así, si después se publica en GitHub Pages, se puede "Agregar a pantalla de inicio" en el celular y funciona sin internet.
- **Sin persistencia**: no se guardan pacientes. No uses localStorage, sessionStorage, IndexedDB ni cookies. El estado vive en memoria. El botón "Nuevo paciente" pide confirmación con un **modal de Bootstrap** (nunca `alert`/`confirm` nativos) y reinicia todo.
- **Librerías**:
  - **Bootstrap 5.3.x** (CSS + bundle JS) y **Bootstrap Icons**, guardados en `/vendor`.
  - No agregues más librerías salvo que sea indispensable; si agregas alguna, que sea local y justifícala en el README.
  - Personaliza Bootstrap con variables CSS (`--bs-*`) y tu propio `styles.css` para que **no se vea como un Bootstrap genérico** (ver sección de diseño).
- **Fuentes locales** (licencia OFL): **Instrument Sans** (texto e interfaz) y **JetBrains Mono** (todos los números y resultados). Descárgalas como `.woff2` (por ejemplo desde los paquetes `@fontsource/instrument-sans` y `@fontsource/jetbrains-mono`) y declara `@font-face` locales con `font-display: swap`. Fallback: `system-ui, sans-serif` y `ui-monospace, monospace`.

## 3. Estructura de archivos esperada

```
/
├── index.html
├── tests.html               ← página de pruebas de las fórmulas (ver §10)
├── manifest.webmanifest
├── sw.js
├── README.md                ← cómo abrirla, cómo publicarla en GitHub Pages, de dónde salen las fórmulas
├── css/
│   ├── fonts.css
│   ├── styles.css
│   └── print.css
├── js/
│   ├── data.js              ← constantes: fórmulas, coeficientes, tabla SMAE, tiempos de comida
│   ├── calc.js              ← funciones PURAS de cálculo (sin tocar el DOM)
│   ├── state.js             ← estado en memoria + suscripción a cambios
│   └── ui.js                ← render, eventos, formato de números
├── assets/
│   ├── fonts/*.woff2
│   └── icons/ (icon-192.png, icon-512.png, favicon.svg)
└── vendor/
    ├── bootstrap/ (css/bootstrap.min.css, js/bootstrap.bundle.min.js)
    └── bootstrap-icons/ (bootstrap-icons.min.css + fonts/)
```

Separa bien la lógica (`calc.js`, testeable y sin DOM) de la interfaz (`ui.js`).

## 4. Flujo y funcionalidades

La app tiene **5 pasos**; cualquier cambio recalcula todo al instante (sin botón "Calcular"):

### Paso 1 — Datos del paciente
- Nombre (texto), Sexo (control segmentado Femenino/Masculino), Edad (años), **Talla en cm**, Peso en kg.
- **IMC** = peso / (talla_m)², con 1 decimal.
- Validación en línea con mensajes claros (rangos razonables: edad 1–110, talla 40–230 cm, peso 2–300 kg). Si un dato falta o es inválido, los resultados que dependen de él muestran "—" en vez de NaN.
- Acepta coma o punto como separador decimal (algunos teclados de celular escriben coma): normaliza `,` → `.` antes de convertir.

### Paso 2 — Gasto energético
- Muestra las **6 fórmulas de GEB a la vez** como tarjetas seleccionables (radio cards), cada una con su nombre, su rango válido y su resultado en kcal. La seleccionada se resalta. Si la edad está fuera del rango de una fórmula, esa tarjeta dice "Fuera de rango" y no se puede usar para el GET.
- Aviso (alerta suave, no roja) cuando se elige Harris-Benedict o Mifflin con menores de 18: "Ecuación validada en adultos; para menores de 18 años considera IOM o Schofield".
- Campos **AF** (default 1.6, paso 0.05) y **ETA** como fracción del GEB (default 0.10, paso 0.01).
- **GET = GEB × AF + GEB × ETA** (así está en el Excel). Muestra la operación con números reales debajo, por ejemplo: `1,374 × 1.60 + 1,374 × 0.10 = 2,335`.

### Paso 3 — Macronutrimentos y meta de energía
- **Meta de energía**: control con dos opciones:
  - **"Usar GET calculado"** (default): la meta = GET.
  - **"Meta manual"**: un campo numérico en kcal (por ejemplo 2,500, como en el Excel de la práctica), por si la docente pide una cifra redonda o se ajusta la energía.
  - Muestra siempre el GET calculado como referencia aunque se use meta manual.
- Porcentajes de Proteína, Lípidos e Hidratos de carbono (defaults **15 / 25 / 60**). Indicador "Suma: X %": verde si da 100, rojo si no. Mientras no sumen 100, el % de adecuación de macros muestra un aviso.
- Para cada macro: kcal = meta × % / 100; gramos = kcal / 4 (proteína e HdC) o / 9 (lípidos).
- Nota informativa con las referencias del Excel para adolescentes: "Proteína 24–45 g" y "Azúcares ≤ 5 % de la energía" (calcula esos gramos a partir de la meta: meta × 0.05 / 4).

### Paso 4 — Cuadro de equivalentes (SMAE)
- Tabla con los 17 subgrupos (§6). Por fila: grupo, subgrupo, **número de equivalentes** con botones − / + en pasos de **0.5** (y también editable escribiendo), kcal, proteína, lípidos e HdC = equivalentes × valor por equivalente.
- Fila de **TOTAL** (suma de kcal, P, L, HdC y equivalentes).
- **% de adecuación** = total / ideal × 100 para Energía, Proteína, Lípidos y HdC, con **semáforo**:
  - < 95 % → "Bajo" (ámbar)
  - 95–105 % → "Adecuado" (verde)
  - > 105 % → "Excede" (rojo)
  - Siempre con texto además del color (accesibilidad).
- Botón "Limpiar equivalentes" (con confirmación en modal).
- Filtro rápido en móvil: chips "Todos / Con valor / por grupo".

### Paso 5 — Reparto por tiempos de comida
- 5 columnas fijas: **Desayuno, Colación 1, Comida, Colación 2, Cena**.
- Filas: solo los subgrupos con equivalentes > 0 en el Paso 4 (con un interruptor "Mostrar todos").
- Cada celda es un número de equivalentes (pasos de 0.5, con − / +).
- Por fila, una columna de control: **"Asignado X de Y"**, con estado:
  - completo (verde) cuando lo repartido es igual al total del Paso 4;
  - "Faltan N" (ámbar) cuando falta;
  - "Sobran N" (rojo) cuando se pasa.
- Por columna (tiempo), totales de kcal, P, L y HdC, y **% de la energía del día** que aporta ese tiempo.
- **"Sugerir reparto"**: porcentajes de energía por tiempo editables (default **25 / 10 / 30 / 10 / 25**, deben sumar 100). Al pulsar, reparte cada subgrupo proporcionalmente, redondea a 0.5 y pone el residuo de redondeo en el tiempo con mayor %, de modo que cada fila cuadre exacto con su total. Es solo una sugerencia: después se ajusta a mano. Si ya hay celdas capturadas, pide confirmación antes de sobrescribir.
- Debajo de cada tiempo, un `textarea` opcional "Menú / platillos" para escribir el menú a mano (no se guarda, pero sí se imprime).
- Si se cambian equivalentes en el Paso 4 después de repartir, no borres el reparto: deja que los indicadores "Faltan/Sobran" muestren la diferencia.

### Resumen persistente
- Un panel de resumen siempre visible con: nombre y edad, **GET** grande, GEB (y qué fórmula), IMC, meta usada y las 4 barras de % de adecuación con semáforo.
- Desktop: columna lateral derecha (puede ser `position: sticky`). Tablet: tira superior compacta. Móvil: barra inferior compacta encima de la navegación, con las 4 adecuaciones.

### Imprimir / PDF
- Botón "Imprimir / PDF" → `window.print()` con `print.css`: oculta la navegación y los botones, imprime en una columna (encabezado con nombre, fecha, datos del paciente, fórmula y GET, macros, cuadro de equivalentes con adecuación, tabla de reparto por tiempos y los menús escritos). Tamaño carta, márgenes razonables y que las tablas no se corten entre páginas cuando se pueda (`break-inside: avoid`).

## 5. Fórmulas de GEB (implementar exactamente así)

Notación: P = peso (kg), T = talla (cm), Tm = talla (m) = T / 100, E = edad (años). Resultado en kcal/día.

| ID | Nombre en la UI | Rango | Mujer | Hombre |
|---|---|---|---|---|
| `IOM` | IOM 2005 (en el Excel: "OMS niñas") | 3–18 años | 189 − 17.6·E + 625·Tm + 7.9·P | 68 − 43.3·E + 712·Tm + 19.2·P |
| `SCH` | Schofield | 10–18 años | 13.384·P + 692.6 | 17.686·P + 658.2 |
| `FAO` | FAO/OMS 1985 | 10–<18 | 12.2·P + 746 | 17.5·P + 651 |
| | | 18–<30 | 14.7·P + 496 | 15.3·P + 679 |
| | | 30–60 | 8.47·P + 829 ⚠ | 11.6·P + 879 |
| | | >60 | 10.5·P + 596 | 13.5·P + 487 |
| `VAL` | Valencia (población mexicana) | 18–30 | 11.02·P + 679 | 13.7·P + 747 ⚠ |
| | | 31–60 | 10.92·P + 677 | 13.08·P + 693 |
| `MIF` | Mifflin-St Jeor | adultos (aviso si <18) | 9.99·P + 6.25·T − 4.92·E − 161 | 9.99·P + 6.25·T − 4.92·E + 5 |
| `HB` | Harris-Benedict | adultos (aviso si <18) | 655 + 9.56·P + 1.85·T − 4.68·E | 66.5 + 13.75·P + 5·T − 6.78·E |

Reglas:
- **Harris-Benedict y Mifflin usan talla en cm; IOM usa talla en metros.** (En el Excel original la talla estaba capturada en metros y eso rompía Harris y Mifflin; aquí la UI siempre pide cm y convierte internamente.)
- Valencia: de 18.0 a 30.x años = primer rango; de más de 30 a 60 = segundo; fuera de 18–60 → fuera de rango.
- ⚠ Esos coeficientes se tomaron del Excel de la estudiante y **difieren de la versión publicada más común** (FAO/OMS mujeres 30–60: 8.7·P + 829; Valencia hombres 18–30: 13.37·P + 747). Pon **todos** los coeficientes en `data.js` como constantes con comentarios, y deja estos dos marcados con `// TODO: confirmar con la bibliografía de la estudiante`, para que se cambien en un solo lugar. Menciónalo en el README.
- Agrega en cada tarjeta un ícono de información (tooltip o popover de Bootstrap) con la ecuación escrita y su referencia.

## 6. Tabla SMAE (valores por 1 equivalente)

| Grupo | Subgrupo | kcal | Proteína g | Lípidos g | HdC g |
|---|---|---|---|---|---|
| Verduras | — | 25 | 2 | 0 | 4 |
| Frutas | — | 60 | 0 | 0 | 15 |
| Cereales y tubérculos | Sin grasa | 70 | 2 | 0 | 15 |
| Cereales y tubérculos | Con grasa | 115 | 2 | 5 | 15 |
| Leguminosas | — | 120 | 8 | 1 | 20 |
| Alimentos de origen animal (AOA) | Muy bajo aporte de grasa | 40 | 7 | 1 | 0 |
| AOA | Bajo aporte de grasa | 55 | 7 | 3 | 0 |
| AOA | Moderado aporte de grasa | 75 | 7 | 5 | 0 |
| AOA | Alto aporte de grasa | 100 | 7 | 8 | 0 |
| Leche | Descremada | 95 | 9 | 2 | 12 |
| Leche | Semidescremada | 110 | 9 | 4 | 12 |
| Leche | Entera | 150 | 9 | 8 | 12 |
| Leche | Con azúcar | 200 | 8 | 5 | 30 |
| Aceites y grasas | Sin proteína | 45 | 0 | 5 | 0 |
| Aceites y grasas | Con proteína | 70 | 3 | 5 | 3 |
| Azúcares | Sin grasa | 40 | 0 | 0 | 10 |
| Azúcares | Con grasa | 85 | 0 | 5 | 10 |

Usa solo estos valores por grupo. **No** incluyas un catálogo de alimentos individuales del SMAE (es material con derechos de autor).

## 7. Diseño visual

Estilo "cuaderno clínico": limpio, sobrio y legible, con mucho aire. Nada de gradientes, sombras exageradas, emojis ni el look de Bootstrap por defecto.

**Tokens (como variables CSS en `:root`):**
- Fondo de página `#F3F5F2` · superficies/tarjetas `#FFFFFF` · bordes `#DCE2DE` · bordes de inputs `#C9D2CD`
- Texto principal `#16231F` · texto secundario `#52605B`
- Acento (botones primarios, selección, foco) `#1F6F5C` · acento suave (fondo seleccionado) `#E3EFEA`
- Panel oscuro de resumen `#16231F` con texto `#F3F5F2`, subtítulos `#B9C7C1` y sub-tarjetas `#24342F`
- Semáforo: Adecuado fondo `#DDEFE3` / texto `#1D7A45` · Bajo `#FBEBD3` / `#8A5208` · Excede `#F7DCD8` / `#9C2E20`
- Radios: tarjetas 18 px, inputs y botones 10 px, chips 999 px
- Mapea el acento a `--bs-primary` / `--bs-primary-rgb` y ajusta `--bs-body-font-family`, `--bs-border-color` y `--bs-border-radius`.

**Tipografía:** Instrument Sans (títulos 600–700, texto 400–500). **Todos los números y resultados en JetBrains Mono** con `font-variant-numeric: tabular-nums`. Formato con `Intl.NumberFormat('es-MX')`: kcal sin decimales en resúmenes, gramos con 1 decimal, % con 1 decimal.

**Componentes:**
- Cada paso es una tarjeta blanca con número de paso en mono y color de acento ("01", "02"…) y su título.
- Tarjetas de fórmula: borde de 2 px del acento y fondo de acento suave cuando están seleccionadas.
- Steppers − / + de 44 × 44 px como mínimo.
- Badges de semáforo tipo píldora y barras de progreso delgadas (10 px).
- Íconos de Bootstrap Icons, siempre con `aria-label` cuando el botón solo tiene ícono.

**Responsivo (mobile first):**
- **Móvil (< 768 px)**: un paso a la vez con **barra de navegación inferior fija** de 5 ítems con ícono y texto (Paciente, Energía, Macros, Equivalentes, Tiempos). Encima, la barra compacta de adecuación. En el Paso 2 las fórmulas pueden mostrarse como `select` o como lista vertical de tarjetas. En el Paso 5, en vez de la tabla de 5 columnas, usa **pestañas o acordeón por tiempo de comida** y un resumen "Faltan/Sobran" por subgrupo. Datos del paciente en una cuadrícula de 3 columnas (Edad, Talla, Peso).
- **Tablet (768–1199 px)**: pestañas superiores por paso, tira de resumen arriba (GET + 4 adecuaciones). Equivalentes en tarjetas por grupo a 2 columnas. Reparto como tabla con scroll horizontal dentro de su contenedor si hace falta.
- **Desktop (≥ 1200 px)**: todos los pasos en una sola página con scroll, contenedor de máx. ~1360 px, contenido principal + columna de resumen a la derecha. La navegación superior hace scroll a cada sección.
- Nunca debe haber scroll horizontal en la página; las tablas anchas van en `.table-responsive`.
- Inputs numéricos con `inputmode="decimal"` y `font-size` ≥ 16 px (evita el zoom automático en iOS).

**Accesibilidad:** `<label>` real en cada campo, contraste AA, foco visible (outline de 2 px del acento), regiones `aria-live="polite"` para resultados que cambian, el semáforo nunca depende solo del color, se puede usar todo con teclado y se respeta `prefers-reduced-motion`.

**Pie de página discreto:** "Herramienta de apoyo académico. Verifica los resultados con tu docente y tu bibliografía."

## 8. Estado y lógica

- Un solo objeto de estado en `state.js`, por ejemplo: `{ paciente, formulaId, af, eta, metaModo: 'get'|'manual', metaManual, pct: {p,l,h}, eq: {[subgrupoId]: n}, reparto: {[subgrupoId]: [d, c1, co, c2, ce]}, pctTiempos: [25,10,30,10,25], menus: ['', '', '', '', ''] }`.
- `calc.js` expone funciones puras: `imc()`, `geb(formulaId, datos)` → `{ valor | null, motivo }`, `get()`, `macrosIdeales()`, `totalesEquivalentes()`, `adecuacion()`, `estadoSemaforo(pct)`, `totalesPorTiempo()`, `sugerirReparto()`.
- Render reactivo sencillo: al cambiar el estado se recalcula y se actualizan solo los nodos afectados (sin librerías). Evita que cada tecla reconstruya formularios completos y haga perder el foco.

## 9. Datos de ejemplo

Al abrir, precarga el caso del Excel para que se pueda ver el funcionamiento de inmediato, con el botón "Nuevo paciente" para limpiar:
- Ermenegilda · Femenino · 15 años · 161 cm · 56 kg · fórmula IOM · AF 1.6 · ETA 0.10 · macros 15/25/60
- Equivalentes: Verduras 4, Frutas 6, Cereales sin grasa 7, Leguminosas 5, AOA moderado 2, AOA alto 0.5, Leche entera 2, Aceites sin proteína 5.5, Azúcares sin grasa 2, Azúcares con grasa 1 (el resto en 0).
- Reparto vacío.

## 10. Criterios de aceptación (verifícalos tú en `tests.html`)

Crea `tests.html`, que carga `data.js` y `calc.js`, ejecuta estas comprobaciones (tolerancia ±0.1) y muestra una lista en verde/rojo:

Caso Ermenegilda (F, 15 años, 161 cm, 56 kg):
- IMC = 21.6
- GEB IOM = 1373.65 · Schofield = 1442.1 · FAO/OMS = 1429.2 · Mifflin = 1330.9 · Harris-Benedict = 1418.0 · Valencia = fuera de rango
- GET (IOM, AF 1.6, ETA 0.1) = 2335.2
- Totales de equivalentes = 2462.5 kcal · 97.5 g P · 67.5 g L · 365 g HdC
- Con **meta manual 2,500** y 15/25/60: ideales 93.75 g P · 69.44 g L · 375 g HdC → adecuación 98.5 % (Adecuado) · 104.0 % (Adecuado) · 97.2 % (Adecuado) · 97.3 % (Adecuado). Estos valores coinciden con el Excel original.
- Con **meta = GET 2335.2**: adecuación 105.5 % (Excede) · 111.3 % (Excede) · 104.1 % (Adecuado) · 104.2 % (Adecuado).

Caso hombre (M, 16 años, 170 cm, 60 kg): GEB IOM = 1737.6.

Reparto: con la sugerencia 25/10/30/10/25, cada fila suma exactamente su total y todos los valores son múltiplos de 0.5.

Además verifica manualmente:
- [ ] Abre con doble clic (`file://`) sin errores en consola y **sin ninguna petición de red** (revisa la pestaña Network).
- [ ] Servida en `http://localhost`, el service worker se instala y la app recarga sin conexión.
- [ ] Se ve bien y sin scroll horizontal en 360, 390, 768, 834, 1024, 1280 y 1440 px de ancho.
- [ ] La vista de impresión sale limpia en tamaño carta.
- [ ] Todo se puede usar solo con teclado.

## 11. Forma de trabajo

1. Primero descarga las dependencias a `/vendor` y `/assets/fonts` y confirma que no queda ninguna URL externa en el código (busca `http` en HTML, CSS y JS).
2. Escribe `data.js` y `calc.js` junto con `tests.html` y haz que todas las pruebas pasen **antes** de construir la interfaz.
3. Construye la UI mobile first; luego tablet y desktop.
4. Al final ejecuta las verificaciones de §10, corrige y resume qué quedó, qué supuestos hiciste y qué falta confirmar (los coeficientes marcados con ⚠).

Fuera de alcance por ahora: cuentas o login, guardar pacientes, sincronizar entre dispositivos, catálogo de alimentos individuales y menús generados automáticamente.
