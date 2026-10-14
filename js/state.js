/* NutriCalc · state.js
 * Estado de la app, solo en memoria (no se guarda nada: al recargar se pierde).
 * Los campos que se escriben a mano se guardan como texto, tal cual los tecleó la
 * usuaria; calc.js los convierte a número. Los equivalentes y el reparto son números.
 */
(function (root) {
  'use strict';

  var NC = (root.NutriCalc = root.NutriCalc || {});
  var D = NC.data;

  function estadoVacio() {
    return {
      paciente: { nombre: '', sexo: D.DEFAULTS.sexo, edad: '', talla: '', peso: '' },
      formulaId: D.DEFAULTS.formulaId,
      af: D.DEFAULTS.af,
      eta: D.DEFAULTS.eta,
      metaModo: 'get',          // 'get' | 'manual'
      metaManual: '',
      pct: { p: D.DEFAULTS.pct.p, l: D.DEFAULTS.pct.l, h: D.DEFAULTS.pct.h },
      eq: {},                   // { [subgrupoId]: equivalentes }
      reparto: {},              // { [subgrupoId]: [des, c1, com, c2, cen] }
      pctTiempos: D.DEFAULTS.pctTiempos.slice(),
      menus: D.TIEMPOS.map(function () { return ''; })
    };
  }

  function estadoEjemplo() {
    var e = estadoVacio();
    var ej = D.EJEMPLO;
    Object.keys(ej.paciente).forEach(function (k) { e.paciente[k] = ej.paciente[k]; });
    e.formulaId = ej.formulaId;
    e.af = ej.af;
    e.eta = ej.eta;
    Object.keys(ej.pct).forEach(function (k) { e.pct[k] = ej.pct[k]; });
    Object.keys(ej.eq).forEach(function (k) { e.eq[k] = ej.eq[k]; });
    return e;
  }

  var estado = estadoEjemplo();
  var suscriptores = [];

  function avisar() {
    suscriptores.forEach(function (fn) { fn(estado); });
  }

  NC.state = {
    get: function () { return estado; },

    /* Aplica un cambio al estado y avisa a los suscriptores. */
    update: function (cambiar) {
      cambiar(estado);
      avisar();
    },

    subscribe: function (fn) {
      suscriptores.push(fn);
    },

    /* «Nuevo paciente»: deja todo en blanco con los valores por defecto. */
    reiniciar: function () {
      estado = estadoVacio();
      avisar();
    },

    cargarEjemplo: function () {
      estado = estadoEjemplo();
      avisar();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
