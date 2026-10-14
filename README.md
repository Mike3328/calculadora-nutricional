# Calculadora nutricional

Herramienta web de apoyo académico para estudiantes de nutrición. Reemplaza el Excel de la «Práctica No. 5 · Adolescente» y calcula, en cinco pasos:

1. Datos del paciente e IMC.
2. Gasto energético basal (GEB) con seis fórmulas, actividad física (AF), efecto térmico de los alimentos (ETA) y gasto energético total (GET).
3. Meta de energía y distribución de macronutrimentos (% → kcal → g).
4. Cuadro de equivalentes del SMAE con totales y % de adecuación.
5. Reparto de los equivalentes en Desayuno, Colación 1, Comida, Colación 2 y Cena.

Es una página estática (HTML, CSS y JavaScript), sin servidor ni base de datos, y funciona **sin internet**.

> Herramienta de apoyo académico, no un dispositivo clínico. Verifica los resultados con tu docente y tu bibliografía.

## Cómo abrirla

- **En la computadora:** doble clic en `index.html`. No hay que instalar nada.
- **Pruebas de las fórmulas:** abre `tests.html`. Muestra una lista en verde/rojo que compara los cálculos contra el Excel de la práctica.
- **En el celular o la tablet:** publícala (ver [Publicar en GitHub Pages](#publicar-en-github-pages)) y ábrela desde el navegador; después se puede instalar en la pantalla de inicio.

Al abrir se precarga el caso del Excel (Ermenegilda, 15 años) para ver el funcionamiento. El botón **Nuevo paciente** deja todo en blanco.

**No se guarda nada.** La app no usa `localStorage`, cookies ni ningún otro almacenamiento: al recargar o cerrar la página se pierde lo capturado. Para conservar un caso usa **Imprimir / PDF**.

## Estructura

```
index.html              La aplicación
tests.html              Pruebas de las fórmulas
manifest.webmanifest    Datos para instalarla como app (PWA)
sw.js                   Service worker: guarda los archivos para usarla sin conexión
css/
  fonts.css             Fuentes locales (@font-face)
  styles.css            Diseño y adaptación a móvil, tablet y desktop
  print.css             Hoja de impresión (tamaño carta)
js/
  data.js               Constantes: fórmulas, coeficientes, tabla SMAE, tiempos, valores por defecto
  calc.js               Cálculos puros (sin tocar la página)
  state.js              Estado en memoria
  ui.js                 Interfaz: eventos, actualización de pantalla, formato de números
assets/fonts/           Instrument Sans y JetBrains Mono (.woff2)
assets/icons/           Favicon e íconos de la app
vendor/                 Bootstrap 5.3 y Bootstrap Icons
```

Los archivos `.js` son scripts clásicos (sin `import`/`export`) que comparten un único objeto global, `window.NutriCalc`; por eso la app funciona abierta con doble clic (`file://`).

## Fórmulas

Notación: **P** = peso (kg), **T** = talla (cm), **Tm** = talla (m), **E** = edad (años). Resultado en kcal/día.

| Fórmula | Rango | Mujer | Hombre |
|---|---|---|---|
| IOM 2005 (en el Excel: «OMS niñas») | 3–18 años | 189 − 17.6·E + 625·Tm + 7.9·P | 68 − 43.3·E + 712·Tm + 19.2·P |
| Schofield | 10–18 años | 13.384·P + 692.6 | 17.686·P + 658.2 |
| FAO/OMS 1985 | 10 a <18 | 12.2·P + 746 | 17.5·P + 651 |
| | 18 a <30 | 14.7·P + 496 | 15.3·P + 679 |
| | 30 a 60 | 8.47·P + 829 ⚠ | 11.6·P + 879 |
| | >60 | 10.5·P + 596 | 13.5·P + 487 |
| Valencia (población mexicana) | 18–30 | 11.02·P + 679 | 13.7·P + 747 ⚠ |
| | 31–60 | 10.92·P + 677 | 13.08·P + 693 |
| Mifflin-St Jeor | adultos | 9.99·P + 6.25·T − 4.92·E − 161 | 9.99·P + 6.25·T − 4.92·E + 5 |
| Harris-Benedict | adultos | 655 + 9.56·P + 1.85·T − 4.68·E | 66.5 + 13.75·P + 5·T − 6.78·E |

Otras operaciones:

- **IMC** = peso / talla(m)²
- **GET** = GEB × AF + GEB × ETA (ETA como fracción del GEB; así está en el Excel)
- **Macronutrimentos:** kcal = meta × % / 100; gramos = kcal / 4 (proteína e hidratos de carbono) o / 9 (lípidos)
- **% de adecuación** = total del cuadro / ideal × 100 → Bajo (< 95 %), Adecuado (95–105 %), Excede (> 105 %)
- **Azúcares máximos** = meta × 0.05 / 4 (g)

### ⚠ Coeficientes por confirmar

Dos coeficientes se tomaron tal cual del Excel de la práctica y **difieren de la versión publicada más común**:

| Dónde | En la app (Excel) | Versión publicada más común |
|---|---|---|
| FAO/OMS, mujeres de 30 a 60 años | 8.47·P + 829 | 8.7·P + 829 |
| Valencia, hombres de 18 a 30 años | 13.7·P + 747 | 13.37·P + 747 |

Confírmalos con la bibliografía de la materia. Si hay que cambiarlos, están en `js/data.js`, marcados con `// TODO: confirmar con la bibliografía de la estudiante`. Es el único lugar donde aparecen: la ecuación que se muestra en el ícono de información de cada tarjeta se genera a partir de esos mismos números.

### Referencias

Las mismas que muestra el ícono de información de cada fórmula. Revísalas contra la bibliografía del curso antes de citarlas.

- **IOM 2005:** Institute of Medicine. *Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids.* Washington, DC: National Academies Press; 2005.
- **Schofield:** Schofield WN. Predicting basal metabolic rate, new standards and review of previous work. *Hum Nutr Clin Nutr.* 1985;39(Suppl 1):5–41.
- **FAO/OMS 1985:** FAO/OMS/UNU. *Necesidades de energía y de proteínas.* Serie de Informes Técnicos 724. Ginebra: OMS; 1985.
- **Valencia:** Valencia ME. Energía. En: Bourges H, Casanueva E, Rosado JL (eds.). *Recomendaciones de ingestión de nutrimentos para la población mexicana.* Tomo 2. México: Editorial Médica Panamericana; 2008.
- **Mifflin-St Jeor:** Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy expenditure in healthy individuals. *Am J Clin Nutr.* 1990;51(2):241–7.
- **Harris-Benedict:** Harris JA, Benedict FG. *A Biometric Study of Basal Metabolism in Man.* Washington, DC: Carnegie Institution of Washington; 1919.
- **Equivalentes:** Pérez Lizaur AB, Palacios González B, Castro Becerra AL, Flores Galicia I. *Sistema Mexicano de Alimentos Equivalentes.* México: Fomento de Nutrición y Salud. La app solo usa el aporte promedio por grupo; no incluye el catálogo de alimentos.

## Decisiones y supuestos

- **La talla siempre se captura en centímetros.** IOM la usa en metros y Harris-Benedict y Mifflin en centímetros; la app convierte por dentro. Si se escribe en metros (por ejemplo `1.61`), avisa.
- **Coma o punto decimal:** `56,5` y `56.5` valen lo mismo. Por eso la meta manual se escribe sin separador de miles (`2500`, no `2,500`).
- **Valencia:** de 18 años hasta antes de cumplir 31 usa el primer rango; de 31 a 60, el segundo.
- **Mifflin y Harris-Benedict** se calculan a cualquier edad, pero muestran un aviso en menores de 18 años.
- **Schofield y FAO/OMS** solo usan el peso, así que dan resultado aunque falte la talla.
- **Semáforo:** se clasifica con el porcentaje redondeado a un decimal, que es el que se ve en pantalla (105.0 % es «Adecuado»; 105.1 % es «Excede»).
- **% de la energía por tiempo de comida:** se calcula sobre el total de kcal del cuadro de equivalentes.
- **Sugerir reparto:** reparte cada subgrupo según los % de energía, redondea a 0.5 y pone el residuo en el tiempo con mayor %. Como el redondeo es por subgrupo, la energía de cada tiempo puede no coincidir exactamente con los % pedidos; es un punto de partida para ajustar a mano.
- **Equivalentes escritos a mano:** se aceptan hasta dos decimales; los botones − / + avanzan de 0.5 en 0.5.
- **Rangos de captura:** edad 1–110 años, talla 40–230 cm, peso 2–300 kg, AF 1–3, ETA 0–0.30, meta manual 300–10,000 kcal. Se cambian en `LIMITES`, en `js/data.js`.

## Publicar en GitHub Pages

GitHub Pages es gratuito para repositorios públicos.

1. Crea un repositorio vacío en GitHub (por ejemplo, `calculadora-nutricional`), **público** y sin README ni `.gitignore`.
2. Desde la carpeta del proyecto:

   ```bash
   git add .
   git commit -m "Calculadora nutricional"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/calculadora-nutricional.git
   git push -u origin main
   ```

3. En GitHub: **Settings → Pages → Build and deployment**. En *Source* elige **Deploy from a branch**; en *Branch*, `main` y `/ (root)`. Guarda.
4. En uno o dos minutos la app queda en `https://TU-USUARIO.github.io/calculadora-nutricional/`.

El archivo `.nojekyll` le indica a GitHub que publique los archivos tal cual.

### Instalarla en el celular

Abre la dirección una vez con internet y:

- **Android (Chrome):** menú ⋮ → *Agregar a pantalla principal* / *Instalar app*.
- **iPhone o iPad (Safari):** botón Compartir → *Agregar a inicio*.

Desde entonces abre sin conexión.

### Publicar cambios

```bash
git add .
git commit -m "Describe el cambio"
git push
```

La app instalada muestra primero la versión guardada y descarga la nueva en segundo plano: los cambios se ven **la segunda vez** que se abre con internet. Si agregas, quitas o renombras archivos, actualiza la lista `ARCHIVOS` de `sw.js` y sube `VERSION` (`v1` → `v2`).

## Dependencias (todas locales)

No hay CDNs ni peticiones a otros sitios. Las librerías se descargaron una vez y se copiaron al proyecto:

| Librería | Versión | Licencia | Ubicación |
|---|---|---|---|
| Bootstrap (CSS + bundle JS) | 5.3.8 | MIT | `vendor/bootstrap/` |
| Bootstrap Icons | 1.13.2 | MIT | `vendor/bootstrap-icons/` |
| Instrument Sans (400, 500, 600, 700) | Fontsource 5.3.0 | OFL 1.1 | `assets/fonts/` |
| JetBrains Mono (400, 500, 700) | Fontsource 5.3.0 | OFL 1.1 | `assets/fonts/` |

No se agregó ninguna otra librería. Para actualizarlas:

```bash
npm install bootstrap@5.3 bootstrap-icons @fontsource/instrument-sans @fontsource/jetbrains-mono
```

y copia a mano `dist/css/bootstrap.min.css`, `dist/js/bootstrap.bundle.min.js`, `font/bootstrap-icons.min.css`, `font/fonts/*` y los `.woff2` del subconjunto `latin`. `node_modules` no se publica (está en `.gitignore`).

Las únicas URL que aparecen en el código son comentarios de licencia dentro de `/vendor` y el identificador `xmlns` de los SVG; ninguna genera una petición de red.
