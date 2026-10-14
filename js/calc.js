/* NutriCalc · calc.js
 * Funciones PURAS de cálculo: reciben datos y devuelven resultados.
 * No tocan el DOM ni el estado global, así que se pueden probar solas (tests.html).
 * Cuando un dato falta o es inválido devuelven null, nunca NaN.
 */
(function (root) {
  'use strict';

  var NC = (root.NutriCalc = root.NutriCalc || {});
  var D = NC.data;

  /* ---------- utilidades numéricas ---------- */

  function esNumero(n) {
    return typeof n === 'number' && isFinite(n);
  }

  /* Convierte texto a número aceptando coma o punto decimal. Devuelve null si no es un número. */
  function aNumero(v) {
    if (esNumero(v)) return v;
    if (typeof v !== 'string') return null;
    var s = v.trim().replace(',', '.');
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    return Number(s);
  }

  function redondear(n, decimales) {
    var f = Math.pow(10, decimales || 0);
    return Math.round((n + Number.EPSILON) * f) / f;
  }

  /* Valida un campo contra { min, max }. estado: 'vacio' | 'invalido' | 'fuera' | 'ok'. */
  function validarCampo(v, limites) {
    if (v == null || (typeof v === 'string' && v.trim() === '')) return { valor: null, estado: 'vacio' };
    var n = aNumero(v);
    if (n == null) return { valor: null, estado: 'invalido' };
    if (limites && (n < limites.min || n > limites.max)) return { valor: null, estado: 'fuera', escrito: n };
    return { valor: n, estado: 'ok' };
  }

  /* ---------- paso 1: paciente ---------- */

  function leerPaciente(p) {
    p = p || {};
    var edad = validarCampo(p.edad, D.LIMITES.edad);
    var talla = validarCampo(p.talla, D.LIMITES.talla);
    var peso = validarCampo(p.peso, D.LIMITES.peso);
    return {
      sexo: p.sexo === 'M' ? 'M' : 'F',
      edad: edad.valor,
      talla: talla.valor,
      peso: peso.valor,
      campos: { edad: edad, talla: talla, peso: peso }
    };
  }

  /* IMC = peso (kg) / talla (m)². La talla se recibe en cm. */
  function imc(peso, tallaCm) {
    if (!esNumero(peso) || !esNumero(tallaCm) || tallaCm <= 0) return null;
    var m = tallaCm / 100;
    return peso / (m * m);
  }

  /* ---------- paso 2: gasto energético ---------- */

  function formula(id) {
    for (var i = 0; i < D.FORMULAS.length; i++) {
      if (D.FORMULAS[i].id === id) return D.FORMULAS[i];
    }
    return null;
  }

  function tramoPara(f, edad) {
    if (!f || !esNumero(edad)) return null;
    for (var i = 0; i < f.tramos.length; i++) {
      var t = f.tramos[i];
      var pasaMin = t.minIncl === false ? edad > t.min : edad >= t.min;
      var pasaMax = t.maxIncl === true ? edad <= t.max : edad < t.max;
      if (pasaMin && pasaMax) return t;
    }
    return null;
  }

  /* GEB con la fórmula indicada. datos = { sexo: 'F'|'M', edad, talla (cm), peso (kg) }.
   * Devuelve { valor, motivo, tramo, aviso }:
   *   motivo 'ok'    → valor en kcal/día
   *   motivo 'rango' → la edad queda fuera del rango de la fórmula
   *   motivo 'datos' → falta algún dato que la ecuación necesita
   */
  function geb(formulaId, datos) {
    var res = { valor: null, motivo: 'datos', tramo: null, aviso: null };
    var f = formula(formulaId);
    if (!f || !datos || !esNumero(datos.edad)) return res;

    var tramo = tramoPara(f, datos.edad);
    if (!tramo) {
      res.motivo = 'rango';
      return res;
    }
    res.tramo = tramo;

    var vars = {
      '1': 1,
      P: datos.peso,
      T: datos.talla,
      Tm: esNumero(datos.talla) ? datos.talla / 100 : null,
      E: datos.edad
    };
    var terminos = tramo[datos.sexo === 'M' ? 'M' : 'F'];
    var suma = 0;
    for (var i = 0; i < terminos.length; i++) {
      var x = vars[terminos[i][1]];
      if (!esNumero(x)) return res;
      suma += terminos[i][0] * x;
    }
    if (!(suma > 0)) return res;

    res.valor = suma;
    res.motivo = 'ok';
    if (f.avisoMenoresDe != null && datos.edad < f.avisoMenoresDe) res.aviso = D.AVISO_MENORES;
    return res;
  }

  /* Escribe la ecuación de un tramo, p. ej. «189 − 17.6·E + 625·Tm + 7.9·P». */
  function ecuacionTexto(terminos) {
    return terminos.map(function (t, i) {
      var c = t[0];
      var abs = String(Math.abs(c)) + (t[1] === '1' ? '' : '·' + t[1]);
      if (i === 0) return (c < 0 ? '−' : '') + abs;
      return (c < 0 ? '− ' : '+ ') + abs;
    }).join(' ');
  }

  /* GET = GEB × AF + GEB × ETA (ETA como fracción del GEB), igual que en el Excel. */
  function get(gebKcal, af, eta) {
    if (!esNumero(gebKcal) || !esNumero(af) || !esNumero(eta)) return null;
    return gebKcal * af + gebKcal * eta;
  }

  /* ---------- paso 3: macronutrimentos ---------- */

  /* meta en kcal; pct = { p, l, h } en %. Por macro: kcal = meta × % / 100; g = kcal / (4 o 9). */
  function macrosIdeales(meta, pct) {
    pct = pct || {};
    var res = { suma: 0, sumaOk: false };
    D.MACROS.forEach(function (m) {
      var porc = esNumero(pct[m.id]) ? pct[m.id] : null;
      var kcal = esNumero(meta) && porc != null ? meta * porc / 100 : null;
      res[m.id] = { pct: porc, kcal: kcal, g: kcal != null ? kcal / m.kcalPorGramo : null };
      res.suma += porc || 0;
    });
    res.suma = redondear(res.suma, 2);
    res.sumaOk = Math.abs(res.suma - 100) < 0.005;
    return res;
  }

  /* ---------- paso 4: equivalentes ---------- */

  function cantidad(n) {
    return esNumero(n) && n > 0 ? n : 0;
  }

  /* Aporte de n equivalentes de un subgrupo. */
  function aporte(sub, n) {
    n = cantidad(n);
    return { eq: n, kcal: n * sub.kcal, p: n * sub.p, l: n * sub.l, h: n * sub.h };
  }

  function sumar(acum, a) {
    acum.eq += a.eq; acum.kcal += a.kcal; acum.p += a.p; acum.l += a.l; acum.h += a.h;
    return acum;
  }

  function limpiarSuma(t) {
    ['eq', 'kcal', 'p', 'l', 'h'].forEach(function (k) { t[k] = redondear(t[k], 4); });
    return t;
  }

  /* eq = { [subgrupoId]: equivalentes }. Devuelve los totales del cuadro. */
  function totalesEquivalentes(eq) {
    eq = eq || {};
    var t = { eq: 0, kcal: 0, p: 0, l: 0, h: 0 };
    D.SMAE.forEach(function (sub) { sumar(t, aporte(sub, eq[sub.id])); });
    return limpiarSuma(t);
  }

  /* % de adecuación = total / ideal × 100, para energía y cada macro. */
  function adecuacion(totales, meta, ideales) {
    function pct(total, ideal) {
      return esNumero(total) && esNumero(ideal) && ideal > 0 ? total / ideal * 100 : null;
    }
    return {
      kcal: pct(totales.kcal, meta),
      p: pct(totales.p, ideales && ideales.p ? ideales.p.g : null),
      l: pct(totales.l, ideales && ideales.l ? ideales.l.g : null),
      h: pct(totales.h, ideales && ideales.h ? ideales.h.g : null)
    };
  }

  /* Semáforo: < 95 % Bajo · 95–105 % Adecuado · > 105 % Excede.
   * Se clasifica con el % redondeado a 1 decimal, que es el que se muestra en pantalla. */
  function estadoSemaforo(pct) {
    if (!esNumero(pct)) return null;
    var r = redondear(pct, 1);
    if (r < D.SEMAFORO.bajo) return { id: 'bajo', texto: 'Bajo' };
    if (r > D.SEMAFORO.excede) return { id: 'excede', texto: 'Excede' };
    return { id: 'adecuado', texto: 'Adecuado' };
  }

  /* ---------- paso 5: reparto por tiempos ---------- */

  function celda(reparto, subId, i) {
    var fila = reparto && reparto[subId];
    return fila ? cantidad(fila[i]) : 0;
  }

  /* reparto = { [subgrupoId]: [des, c1, com, c2, cen] }.
   * Devuelve, por tiempo, sus totales y el % de la energía del día (sobre el total del cuadro). */
  function totalesPorTiempo(reparto, kcalDia) {
    return D.TIEMPOS.map(function (_, i) {
      var t = { eq: 0, kcal: 0, p: 0, l: 0, h: 0 };
      D.SMAE.forEach(function (sub) { sumar(t, aporte(sub, celda(reparto, sub.id, i))); });
      limpiarSuma(t);
      t.pctEnergia = esNumero(kcalDia) && kcalDia > 0 ? t.kcal / kcalDia * 100 : null;
      return t;
    });
  }

  /* Por subgrupo: cuánto se repartió frente al total del paso 4.
   * estado: 'completo' | 'faltan' | 'sobran' | 'vacio' (sin total ni reparto). */
  function estadoReparto(reparto, eq) {
    var res = {};
    D.SMAE.forEach(function (sub) {
      var total = cantidad(eq && eq[sub.id]);
      var asignado = 0;
      for (var i = 0; i < D.TIEMPOS.length; i++) asignado += celda(reparto, sub.id, i);
      asignado = redondear(asignado, 4);
      var dif = redondear(total - asignado, 4);
      var estado = 'completo';
      if (total === 0 && asignado === 0) estado = 'vacio';
      else if (dif > 0) estado = 'faltan';
      else if (dif < 0) estado = 'sobran';
      res[sub.id] = { total: total, asignado: asignado, diferencia: Math.abs(dif), estado: estado };
    });
    return res;
  }

  /* Suma de los % de energía por tiempo. valores: números o null. */
  function leerPctTiempos(pctTiempos) {
    var valores = (pctTiempos || []).map(function (v) {
      var n = aNumero(v);
      return n != null && n >= 0 ? n : null;
    });
    var completos = valores.length === D.TIEMPOS.length && valores.every(function (n) { return n != null; });
    var suma = redondear(valores.reduce(function (s, n) { return s + (n || 0); }, 0), 2);
    return { valores: valores, suma: suma, ok: completos && Math.abs(suma - 100) < 0.005 };
  }

  /* Reparte los equivalentes de cada subgrupo en proporción a los % de energía por tiempo,
   * redondea a 0.5 y pone el residuo del redondeo en el tiempo con mayor %, para que cada
   * fila sume exactamente su total. Si ese tiempo quedara negativo, el sobrante pasa al
   * siguiente con mayor %. Devuelve null si los % no suman 100.
   * Se trabaja en centésimas de equivalente para no arrastrar errores de punto flotante. */
  function sugerirReparto(eq, pctTiempos) {
    var pct = leerPctTiempos(pctTiempos);
    if (!pct.ok) return null;

    var orden = pct.valores
      .map(function (p, i) { return i; })
      .sort(function (a, b) { return pct.valores[b] - pct.valores[a] || a - b; });

    var reparto = {};
    D.SMAE.forEach(function (sub) {
      var total = Math.round(cantidad(eq && eq[sub.id]) * 100);
      if (total === 0) return;

      var fila = pct.valores.map(function (p) {
        return Math.round(total * p / 100 / 50) * 50;
      });
      var residuo = total - fila.reduce(function (s, n) { return s + n; }, 0);
      for (var k = 0; k < orden.length && residuo !== 0; k++) {
        var v = fila[orden[k]] + residuo;
        fila[orden[k]] = Math.max(0, v);
        residuo = Math.min(0, v);
      }
      reparto[sub.id] = fila.map(function (n) { return n / 100; });
    });
    return reparto;
  }

  /* ---------- todo junto ---------- */

  /* Calcula todos los resultados a partir del estado de la app (ver state.js). */
  function derivar(estado) {
    var pac = leerPaciente(estado.paciente);

    var gebs = {};
    D.FORMULAS.forEach(function (f) { gebs[f.id] = geb(f.id, pac); });
    var gebSel = gebs[estado.formulaId] || { valor: null, motivo: 'datos', tramo: null, aviso: null };

    var af = validarCampo(estado.af, D.LIMITES.af);
    var eta = validarCampo(estado.eta, D.LIMITES.eta);
    var getKcal = get(gebSel.valor, af.valor, eta.valor);

    var metaManual = validarCampo(estado.metaManual, D.LIMITES.metaManual);
    var meta = estado.metaModo === 'manual' ? metaManual.valor : getKcal;

    var pct = {};
    D.MACROS.forEach(function (m) {
      var n = aNumero(estado.pct ? estado.pct[m.id] : null);
      pct[m.id] = n != null && n >= 0 && n <= 100 ? n : null;
    });
    var ideales = macrosIdeales(meta, pct);

    var totales = totalesEquivalentes(estado.eq);
    var adec = adecuacion(totales, meta, ideales);
    var semaforo = {};
    Object.keys(adec).forEach(function (k) { semaforo[k] = estadoSemaforo(adec[k]); });

    var filas = estadoReparto(estado.reparto, estado.eq);
    var hayReparto = Object.keys(filas).some(function (id) { return filas[id].asignado > 0; });

    return {
      paciente: pac,
      imc: imc(pac.peso, pac.talla),
      gebs: gebs,
      geb: gebSel,
      af: af,
      eta: eta,
      get: getKcal,
      metaManual: metaManual,
      meta: meta,
      ideales: ideales,
      azucaresMaxG: esNumero(meta) ? meta * D.REFERENCIAS_ADOLESCENTE.azucaresPct / 100 / 4 : null,
      totales: totales,
      adecuacion: adec,
      semaforo: semaforo,
      filasReparto: filas,
      hayReparto: hayReparto,
      tiempos: totalesPorTiempo(estado.reparto, totales.kcal),
      pctTiempos: leerPctTiempos(estado.pctTiempos)
    };
  }

  NC.calc = {
    esNumero: esNumero,
    aNumero: aNumero,
    redondear: redondear,
    validarCampo: validarCampo,
    leerPaciente: leerPaciente,
    imc: imc,
    formula: formula,
    tramoPara: tramoPara,
    geb: geb,
    ecuacionTexto: ecuacionTexto,
    get: get,
    macrosIdeales: macrosIdeales,
    aporte: aporte,
    totalesEquivalentes: totalesEquivalentes,
    adecuacion: adecuacion,
    estadoSemaforo: estadoSemaforo,
    totalesPorTiempo: totalesPorTiempo,
    estadoReparto: estadoReparto,
    leerPctTiempos: leerPctTiempos,
    sugerirReparto: sugerirReparto,
    derivar: derivar
  };
})(typeof window !== 'undefined' ? window : globalThis);
