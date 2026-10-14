/* NutriCalc · data.js
 * Constantes de la calculadora: fórmulas de GEB, tabla SMAE, tiempos de comida,
 * valores por defecto y el caso de ejemplo. No contiene lógica ni toca el DOM.
 * Para corregir un coeficiente, cámbialo aquí: es el único lugar donde aparece.
 */
(function (root) {
  'use strict';

  var NC = (root.NutriCalc = root.NutriCalc || {});

  /* ------------------------------------------------------------------ *
   * Fórmulas de gasto energético basal (GEB), en kcal/día.
   *
   * Cada ecuación es una suma de términos [coeficiente, variable]:
   *   '1'  → constante
   *   'P'  → peso en kg
   *   'T'  → talla en cm
   *   'Tm' → talla en metros (T / 100)
   *   'E'  → edad en años
   * El orden de los términos es el orden en que se escribe la ecuación.
   *
   * Cada tramo define un intervalo de edad:
   *   min / max           → límites en años
   *   minIncl / maxIncl   → si el límite se incluye (por defecto min sí, max no)
   * ------------------------------------------------------------------ */
  var FORMULAS = [
    {
      id: 'IOM',
      nombre: 'IOM 2005',
      nota: 'En el Excel: «OMS niñas»',
      rango: '3 a 18 años',
      avisoMenoresDe: null,
      tramos: [
        {
          etiqueta: '3–18 años', min: 3, max: 18, maxIncl: true,
          F: [[189, '1'], [-17.6, 'E'], [625, 'Tm'], [7.9, 'P']],
          M: [[68, '1'], [-43.3, 'E'], [712, 'Tm'], [19.2, 'P']]
        }
      ],
      referencia: 'Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. Washington, DC: National Academies Press; 2005.'
    },
    {
      id: 'SCH',
      nombre: 'Schofield',
      nota: null,
      rango: '10 a 18 años',
      avisoMenoresDe: null,
      tramos: [
        {
          etiqueta: '10–18 años', min: 10, max: 18, maxIncl: true,
          F: [[13.384, 'P'], [692.6, '1']],
          M: [[17.686, 'P'], [658.2, '1']]
        }
      ],
      referencia: 'Schofield WN. Predicting basal metabolic rate, new standards and review of previous work. Hum Nutr Clin Nutr. 1985;39(Suppl 1):5–41.'
    },
    {
      id: 'FAO',
      nombre: 'FAO/OMS 1985',
      nota: null,
      rango: '10 años en adelante',
      avisoMenoresDe: null,
      tramos: [
        {
          etiqueta: '10 a <18 años', min: 10, max: 18,
          F: [[12.2, 'P'], [746, '1']],
          M: [[17.5, 'P'], [651, '1']]
        },
        {
          etiqueta: '18 a <30 años', min: 18, max: 30,
          F: [[14.7, 'P'], [496, '1']],
          M: [[15.3, 'P'], [679, '1']]
        },
        {
          etiqueta: '30 a 60 años', min: 30, max: 60, maxIncl: true,
          // TODO: confirmar con la bibliografía de la estudiante.
          // El Excel usa 8.47; la versión publicada más común es 8.7·P + 829.
          F: [[8.47, 'P'], [829, '1']],
          M: [[11.6, 'P'], [879, '1']]
        },
        {
          etiqueta: '>60 años', min: 60, minIncl: false, max: Infinity,
          F: [[10.5, 'P'], [596, '1']],
          M: [[13.5, 'P'], [487, '1']]
        }
      ],
      referencia: 'FAO/OMS/UNU. Necesidades de energía y de proteínas. Serie de Informes Técnicos 724. Ginebra: OMS; 1985.'
    },
    {
      id: 'VAL',
      nombre: 'Valencia',
      nota: 'Población mexicana',
      rango: '18 a 60 años',
      avisoMenoresDe: null,
      tramos: [
        {
          // De 18.0 a 30.x años (hasta antes de cumplir 31).
          etiqueta: '18–30 años', min: 18, max: 31,
          F: [[11.02, 'P'], [679, '1']],
          // TODO: confirmar con la bibliografía de la estudiante.
          // El Excel usa 13.7; la versión publicada más común es 13.37·P + 747.
          M: [[13.7, 'P'], [747, '1']]
        },
        {
          etiqueta: '31–60 años', min: 31, max: 60, maxIncl: true,
          F: [[10.92, 'P'], [677, '1']],
          M: [[13.08, 'P'], [693, '1']]
        }
      ],
      referencia: 'Valencia ME. Energía. En: Bourges H, Casanueva E, Rosado JL (eds.). Recomendaciones de ingestión de nutrimentos para la población mexicana. Tomo 2. México: Editorial Médica Panamericana; 2008.'
    },
    {
      id: 'MIF',
      nombre: 'Mifflin-St Jeor',
      nota: null,
      rango: 'Adultos',
      avisoMenoresDe: 18,
      tramos: [
        {
          etiqueta: 'Adultos', min: 0, max: Infinity,
          F: [[9.99, 'P'], [6.25, 'T'], [-4.92, 'E'], [-161, '1']],
          M: [[9.99, 'P'], [6.25, 'T'], [-4.92, 'E'], [5, '1']]
        }
      ],
      referencia: 'Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241–7.'
    },
    {
      id: 'HB',
      nombre: 'Harris-Benedict',
      nota: null,
      rango: 'Adultos',
      avisoMenoresDe: 18,
      tramos: [
        {
          etiqueta: 'Adultos', min: 0, max: Infinity,
          F: [[655, '1'], [9.56, 'P'], [1.85, 'T'], [-4.68, 'E']],
          M: [[66.5, '1'], [13.75, 'P'], [5, 'T'], [-6.78, 'E']]
        }
      ],
      referencia: 'Harris JA, Benedict FG. A Biometric Study of Basal Metabolism in Man. Washington, DC: Carnegie Institution of Washington; 1919.'
    }
  ];

  var AVISO_MENORES = 'Ecuación validada en adultos; para menores de 18 años considera IOM o Schofield.';

  /* ------------------------------------------------------------------ *
   * SMAE: aporte nutrimental promedio por 1 equivalente de cada subgrupo.
   * Solo valores por grupo; no incluye el catálogo de alimentos.
   * ------------------------------------------------------------------ */
  var GRUPOS = [
    { id: 'verduras', nombre: 'Verduras', corto: 'Verduras' },
    { id: 'frutas', nombre: 'Frutas', corto: 'Frutas' },
    { id: 'cereales', nombre: 'Cereales y tubérculos', corto: 'Cereales' },
    { id: 'leguminosas', nombre: 'Leguminosas', corto: 'Leguminosas' },
    { id: 'aoa', nombre: 'Alimentos de origen animal', corto: 'AOA' },
    { id: 'leche', nombre: 'Leche', corto: 'Leche' },
    { id: 'grasas', nombre: 'Aceites y grasas', corto: 'Grasas' },
    { id: 'azucares', nombre: 'Azúcares', corto: 'Azúcares' }
  ];

  //            id               grupo          subgrupo                    kcal  P  L  HdC
  var SMAE = [
    { id: 'verduras',     grupo: 'verduras',    subgrupo: null,                       kcal: 25,  p: 2, l: 0, h: 4 },
    { id: 'frutas',       grupo: 'frutas',      subgrupo: null,                       kcal: 60,  p: 0, l: 0, h: 15 },
    { id: 'cer-sg',       grupo: 'cereales',    subgrupo: 'Sin grasa',                kcal: 70,  p: 2, l: 0, h: 15 },
    { id: 'cer-cg',       grupo: 'cereales',    subgrupo: 'Con grasa',                kcal: 115, p: 2, l: 5, h: 15 },
    { id: 'leguminosas',  grupo: 'leguminosas', subgrupo: null,                       kcal: 120, p: 8, l: 1, h: 20 },
    { id: 'aoa-mb',       grupo: 'aoa',         subgrupo: 'Muy bajo aporte de grasa', kcal: 40,  p: 7, l: 1, h: 0 },
    { id: 'aoa-b',        grupo: 'aoa',         subgrupo: 'Bajo aporte de grasa',     kcal: 55,  p: 7, l: 3, h: 0 },
    { id: 'aoa-m',        grupo: 'aoa',         subgrupo: 'Moderado aporte de grasa', kcal: 75,  p: 7, l: 5, h: 0 },
    { id: 'aoa-a',        grupo: 'aoa',         subgrupo: 'Alto aporte de grasa',     kcal: 100, p: 7, l: 8, h: 0 },
    { id: 'leche-d',      grupo: 'leche',       subgrupo: 'Descremada',               kcal: 95,  p: 9, l: 2, h: 12 },
    { id: 'leche-s',      grupo: 'leche',       subgrupo: 'Semidescremada',           kcal: 110, p: 9, l: 4, h: 12 },
    { id: 'leche-e',      grupo: 'leche',       subgrupo: 'Entera',                   kcal: 150, p: 9, l: 8, h: 12 },
    { id: 'leche-a',      grupo: 'leche',       subgrupo: 'Con azúcar',               kcal: 200, p: 8, l: 5, h: 30 },
    { id: 'grasas-sp',    grupo: 'grasas',      subgrupo: 'Sin proteína',             kcal: 45,  p: 0, l: 5, h: 0 },
    { id: 'grasas-cp',    grupo: 'grasas',      subgrupo: 'Con proteína',             kcal: 70,  p: 3, l: 5, h: 3 },
    { id: 'azucares-sg',  grupo: 'azucares',    subgrupo: 'Sin grasa',                kcal: 40,  p: 0, l: 0, h: 10 },
    { id: 'azucares-cg',  grupo: 'azucares',    subgrupo: 'Con grasa',                kcal: 85,  p: 0, l: 5, h: 10 }
  ];

  var TIEMPOS = [
    { id: 'des', nombre: 'Desayuno', corto: 'Des.' },
    { id: 'c1', nombre: 'Colación 1', corto: 'Col. 1' },
    { id: 'com', nombre: 'Comida', corto: 'Com.' },
    { id: 'c2', nombre: 'Colación 2', corto: 'Col. 2' },
    { id: 'cen', nombre: 'Cena', corto: 'Cena' }
  ];

  var MACROS = [
    { id: 'p', nombre: 'Proteína', corto: 'Proteína', kcalPorGramo: 4 },
    { id: 'l', nombre: 'Lípidos', corto: 'Lípidos', kcalPorGramo: 9 },
    { id: 'h', nombre: 'Hidratos de carbono', corto: 'HdC', kcalPorGramo: 4 }
  ];

  /* Semáforo del % de adecuación: < bajo → «Bajo»; > excede → «Excede». */
  var SEMAFORO = { bajo: 95, excede: 105 };

  /* Rangos razonables para validar la captura. */
  var LIMITES = {
    edad: { min: 1, max: 110 },
    talla: { min: 40, max: 230 },
    peso: { min: 2, max: 300 },
    af: { min: 1, max: 3, paso: 0.05 },
    eta: { min: 0, max: 0.3, paso: 0.01 },
    metaManual: { min: 300, max: 10000 },
    equivalentes: { min: 0, max: 99, paso: 0.5 }
  };

  /* Referencias del Excel de la práctica (adolescentes). */
  var REFERENCIAS_ADOLESCENTE = {
    proteinaMin: 24,   // g/día
    proteinaMax: 45,   // g/día
    azucaresPct: 5     // % máximo de la energía
  };

  var DEFAULTS = {
    sexo: 'F',
    formulaId: 'IOM',
    af: '1.6',
    eta: '0.10',
    pct: { p: '15', l: '25', h: '60' },
    pctTiempos: ['25', '10', '30', '10', '25']
  };

  /* Caso del Excel «Práctica No. 5 · Adolescente», precargado al abrir. */
  var EJEMPLO = {
    paciente: { nombre: 'Ermenegilda', sexo: 'F', edad: '15', talla: '161', peso: '56' },
    formulaId: 'IOM',
    af: '1.6',
    eta: '0.10',
    pct: { p: '15', l: '25', h: '60' },
    eq: {
      'verduras': 4,
      'frutas': 6,
      'cer-sg': 7,
      'leguminosas': 5,
      'aoa-m': 2,
      'aoa-a': 0.5,
      'leche-e': 2,
      'grasas-sp': 5.5,
      'azucares-sg': 2,
      'azucares-cg': 1
    }
  };

  NC.data = {
    FORMULAS: FORMULAS,
    AVISO_MENORES: AVISO_MENORES,
    GRUPOS: GRUPOS,
    SMAE: SMAE,
    TIEMPOS: TIEMPOS,
    MACROS: MACROS,
    SEMAFORO: SEMAFORO,
    LIMITES: LIMITES,
    REFERENCIAS_ADOLESCENTE: REFERENCIAS_ADOLESCENTE,
    DEFAULTS: DEFAULTS,
    EJEMPLO: EJEMPLO
  };
})(typeof window !== 'undefined' ? window : globalThis);
