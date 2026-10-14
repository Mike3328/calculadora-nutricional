/* NutriCalc · ui.js
 * Interfaz: construye las partes repetitivas del DOM una sola vez, escucha los eventos
 * y, cada vez que cambia el estado, actualiza solo el texto / valor / clases de los nodos
 * (no reconstruye formularios, así que no se pierde el foco al escribir).
 */
(function () {
  'use strict';

  var NC = window.NutriCalc;
  var D = NC.data;
  var C = NC.calc;
  var S = NC.state;

  /* ---------- formato de números (es-MX) ---------- */

  var RAYA = '—';

  function formato(min, max) {
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: min, maximumFractionDigits: max });
  }
  var F0 = formato(0, 0);    // kcal en resúmenes
  var F1 = formato(1, 1);    // gramos, kcal de resultados, IMC
  var F01 = formato(0, 1);   // celdas del cuadro
  var F02 = formato(0, 2);   // equivalentes
  var F2 = formato(2, 2);    // AF y ETA en la operación

  function num(valor, f) {
    return C.esNumero(valor) ? f.format(valor) : RAYA;
  }
  function porc(valor) {
    return C.esNumero(valor) ? F1.format(valor) + ' %' : RAYA;
  }

  /* ---------- utilidades de DOM ---------- */

  function $(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function h(tag, attrs, hijos) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    (hijos || []).forEach(function (c) {
      if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  function icono(nombre) {
    return h('i', { class: 'bi bi-' + nombre, 'aria-hidden': 'true' });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Cambia el texto solo si es distinto (evita anuncios repetidos en aria-live). */
  function txt(nodo, s) {
    if (nodo.textContent !== s) nodo.textContent = s;
  }

  /* Cambia el valor de un input salvo que la usuaria esté escribiendo en él. */
  function setVal(input, s) {
    if (document.activeElement === input) return;
    if (input.value !== s) input.value = s;
  }

  function mostrar(nodo, visible) {
    nodo.hidden = !visible;
  }

  /* ---------- catálogos ---------- */

  var GRUPO = {};
  D.GRUPOS.forEach(function (g) { GRUPO[g.id] = g; });

  function nombreCompleto(sub) {
    return GRUPO[sub.grupo].nombre + (sub.subgrupo ? ' · ' + sub.subgrupo : '');
  }

  var ADEC = [
    { id: 'kcal', nombre: 'Energía', unidad: 'kcal' },
    { id: 'p', nombre: 'Proteína', unidad: 'g' },
    { id: 'l', nombre: 'Lípidos', unidad: 'g' },
    { id: 'h', nombre: 'HdC', unidad: 'g' }
  ];

  var MENSAJES = {
    edad: {
      fuera: 'Edad: escribe un valor entre 1 y 110 años.',
      invalido: 'Edad: escribe solo números (por ejemplo, 15).'
    },
    talla: {
      fuera: 'Talla: escríbela en centímetros, entre 40 y 230.',
      metros: 'Talla: parece estar en metros. Escríbela en centímetros (por ejemplo, 161).',
      invalido: 'Talla: escribe solo números (por ejemplo, 161).'
    },
    peso: {
      fuera: 'Peso: escribe un valor entre 2 y 300 kg.',
      invalido: 'Peso: escribe solo números (por ejemplo, 56.5).'
    },
    af: {
      vacio: 'AF: escribe un factor (por ejemplo, 1.6).',
      fuera: 'AF: usa un factor entre 1 y 3.',
      invalido: 'AF: escribe solo números (por ejemplo, 1.6).'
    },
    eta: {
      vacio: 'ETA: escribe una fracción (por ejemplo, 0.10).',
      fuera: 'ETA: usa una fracción entre 0 y 0.30 (0.10 = 10 %).',
      invalido: 'ETA: escribe solo números (por ejemplo, 0.10).'
    },
    meta: {
      vacio: 'Escribe la meta en kcal para calcular los gramos ideales.',
      fuera: 'Meta: escribe las kcal sin separador de miles, entre 300 y 10,000 (por ejemplo, 2500).',
      invalido: 'Meta: escribe solo números, sin separador de miles (por ejemplo, 2500).'
    }
  };

  function mensaje(campo, v) {
    if (v.estado === 'ok') return null;
    if (campo === 'talla' && v.estado === 'fuera' && v.escrito < 3) return MENSAJES.talla.metros;
    return MENSAJES[campo][v.estado] || null;
  }

  /* ---------- estado de la interfaz (no forma parte de los datos del paciente) ---------- */

  var UI = { paso: 1, filtro: 'todos', mostrarTodos: false };
  var N = { steppers: {} };       // referencias a nodos
  var popovers = [];
  var mqDesktop = window.matchMedia('(min-width: 1200px)');
  var mqMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- steppers (− valor +) ---------- */

  var accesos = {};

  /* Cómo leer y escribir en el estado el valor de un stepper según su clave:
   * 'af' | 'eta' | 'eq:<subgrupo>' | 'rep:<subgrupo>:<tiempo>' */
  function acceso(clave) {
    if (accesos[clave]) return accesos[clave];
    var p = clave.split(':');
    var a;
    if (p[0] === 'af' || p[0] === 'eta') {
      var lim = D.LIMITES[p[0]];
      a = {
        esTexto: true, paso: lim.paso, min: lim.min, max: lim.max,
        leer: function (e) {
          var n = C.aNumero(e[p[0]]);
          return n == null ? C.aNumero(D.DEFAULTS[p[0]]) : n;
        },
        escribir: function (e, v) { e[p[0]] = v; },
        texto: function (e) { return e[p[0]]; },
        aTexto: function (n) { return p[0] === 'eta' ? n.toFixed(2) : String(n); }
      };
    } else {
      var le = D.LIMITES.equivalentes;
      a = { esTexto: false, paso: le.paso, min: le.min, max: le.max };
      if (p[0] === 'eq') {
        a.leer = function (e) { return e.eq[p[1]] || 0; };
        a.escribir = function (e, v) { e.eq[p[1]] = v; };
      } else {
        var t = Number(p[2]);
        a.leer = function (e) { return (e.reparto[p[1]] || [])[t] || 0; };
        a.escribir = function (e, v) {
          if (!e.reparto[p[1]]) e.reparto[p[1]] = D.TIEMPOS.map(function () { return 0; });
          e.reparto[p[1]][t] = v;
        };
      }
      a.texto = function (e) { return String(a.leer(e)); };
    }
    accesos[clave] = a;
    return a;
  }

  function registrarStepper(caja) {
    var clave = caja.dataset.stepper;
    (N.steppers[clave] = N.steppers[clave] || []).push($('.stepper__input', caja));
  }

  function crearStepper(clave, id, nombre) {
    var caja = h('div', { class: 'stepper', 'data-stepper': clave }, [
      h('button', { type: 'button', class: 'stepper__btn', 'data-dir': '-1', 'aria-label': 'Quitar 0.5 · ' + nombre }, [icono('dash-lg')]),
      h('input', { type: 'text', inputmode: 'decimal', class: 'stepper__input num', id: id, autocomplete: 'off' }),
      h('button', { type: 'button', class: 'stepper__btn', 'data-dir': '1', 'aria-label': 'Agregar 0.5 · ' + nombre }, [icono('plus-lg')])
    ]);
    registrarStepper(caja);
    return caja;
  }

  function moverStepper(caja, dir) {
    var a = acceso(caja.dataset.stepper);
    S.update(function (e) {
      var v = C.redondear(a.leer(e) + dir * a.paso, 2);
      v = Math.min(a.max, Math.max(a.min, v));
      a.escribir(e, a.esTexto ? a.aTexto(v) : v);
    });
    var input = $('.stepper__input', caja);
    input.value = a.texto(S.get());
    input.classList.remove('is-invalid');
  }

  function escribirStepper(input) {
    var a = acceso(input.closest('.stepper').dataset.stepper);
    if (a.esTexto) {
      S.update(function (e) { a.escribir(e, input.value); });
      return;
    }
    var n = C.aNumero(input.value);
    input.classList.toggle('is-invalid', input.value.trim() !== '' && n == null);
    var v = n == null ? 0 : Math.min(a.max, C.redondear(n, 2));
    S.update(function (e) { a.escribir(e, v); });
  }

  function pintarSteppers(e) {
    Object.keys(N.steppers).forEach(function (clave) {
      var s = acceso(clave).texto(e);
      N.steppers[clave].forEach(function (input) { setVal(input, s); });
    });
  }

  /* ---------- construcción: paso 2 ---------- */

  function contenidoPopover(f) {
    var usadas = {};
    var html = '';
    f.tramos.forEach(function (t) {
      [t.F, t.M].forEach(function (terminos) {
        terminos.forEach(function (x) { usadas[x[1]] = true; });
      });
      if (f.tramos.length > 1) html += '<div class="pop-tramo">' + esc(t.etiqueta) + '</div>';
      html += '<div class="pop-ec"><span>Mujer</span><code>' + esc(C.ecuacionTexto(t.F)) + '</code></div>';
      html += '<div class="pop-ec"><span>Hombre</span><code>' + esc(C.ecuacionTexto(t.M)) + '</code></div>';
    });
    var leyenda = [];
    if (usadas.P) leyenda.push('P = peso (kg)');
    if (usadas.T) leyenda.push('T = talla (cm)');
    if (usadas.Tm) leyenda.push('Tm = talla (m)');
    if (usadas.E) leyenda.push('E = edad (años)');
    html += '<p class="pop-vars">' + esc(leyenda.join(' · ')) + '. Resultado en kcal/día.</p>';
    html += '<p class="pop-ref">' + esc(f.referencia) + '</p>';
    return html;
  }

  function construirFormulas() {
    var cont = $('#formulas');
    N.formulas = {};
    D.FORMULAS.forEach(function (f) {
      var id = 'fm-' + f.id;
      var radio = h('input', { type: 'radio', class: 'btn-check', name: 'formula', id: id, value: f.id });
      var valor = h('span', { class: 'num', text: RAYA });
      var estado = h('span', { class: 'formula__estado' });
      var tarjeta = h('label', { class: 'formula__tarjeta', for: id }, [
        h('span', { class: 'formula__nombre', text: f.nombre }),
        h('span', { class: 'formula__rango', text: f.rango + (f.nota ? ' · ' + f.nota : '') }),
        h('span', { class: 'formula__valor' }, [valor, h('span', { class: 'formula__uni', text: 'kcal' })]),
        estado
      ]);
      var info = h('button', {
        type: 'button', class: 'formula__info',
        'aria-label': 'Ecuación y referencia de ' + f.nombre
      }, [icono('info-circle')]);
      var caja = h('div', { class: 'formula' }, [radio, tarjeta, info]);
      cont.appendChild(caja);
      N.formulas[f.id] = { caja: caja, radio: radio, valor: valor, estado: estado };

      popovers.push({
        boton: info,
        instancia: new bootstrap.Popover(info, {
          html: true,
          title: f.nombre,
          content: contenidoPopover(f),
          trigger: 'click',
          placement: 'auto',
          container: 'body',
          customClass: 'pop-formula'
        })
      });
    });
  }

  function cerrarPopovers(excepto) {
    popovers.forEach(function (p) {
      if (p.boton !== excepto) p.instancia.hide();
    });
  }

  /* ---------- construcción: paso 4 ---------- */

  function construirEquivalentes() {
    var tabla = $('#tabla-eq');
    N.eq = {};
    N.eqGrupos = {};

    D.GRUPOS.forEach(function (g) {
      var cuerpo = h('tbody', { class: 'eq-grupo', 'data-grupo': g.id });
      D.SMAE.filter(function (s) { return s.grupo === g.id; }).forEach(function (sub) {
        var id = 'eq-' + sub.id;
        var celdas = {};
        ['kcal', 'p', 'l', 'h'].forEach(function (k, i) {
          celdas[k] = h('td', {
            class: 'col-num num eq-valor',
            'data-etiqueta': ['kcal', 'Proteína g', 'Lípidos g', 'HdC g'][i],
            text: RAYA
          });
        });
        var fila = h('tr', { class: 'eq-fila' + (sub.subgrupo ? '' : ' eq-fila--unica'), 'data-sub': sub.id }, [
          h('th', { scope: 'row', class: 'eq-grupo__nombre', text: g.nombre }),
          h('td', { class: 'eq-sub', text: sub.subgrupo || RAYA }),
          h('td', { class: 'col-centro eq-cantidad' }, [
            h('label', { class: 'visually-hidden', for: id, text: 'Equivalentes de ' + nombreCompleto(sub) }),
            crearStepper('eq:' + sub.id, id, nombreCompleto(sub))
          ]),
          celdas.kcal, celdas.p, celdas.l, celdas.h
        ]);
        cuerpo.appendChild(fila);
        N.eq[sub.id] = { fila: fila, celdas: celdas };
      });
      tabla.insertBefore(cuerpo, tabla.tFoot);
      N.eqGrupos[g.id] = cuerpo;
    });

    var chips = $('#eq-filtros');
    var filtros = [{ id: 'todos', nombre: 'Todos' }, { id: 'valor', nombre: 'Con valor' }]
      .concat(D.GRUPOS.map(function (g) { return { id: g.id, nombre: g.corto }; }));
    filtros.forEach(function (f) {
      chips.appendChild(h('button', { type: 'button', class: 'chip', 'data-filtro': f.id, 'aria-pressed': 'false', text: f.nombre }));
    });
  }

  function crearAdec(cont) {
    var refs = {};
    ADEC.forEach(function (a) {
      var r = {
        pct: h('span', { class: 'adec__pct num', text: RAYA }),
        estado: h('span', { class: 'semaforo', text: RAYA }),
        barra: h('span', { class: 'barra__relleno' }),
        detalle: h('span', { class: 'adec__detalle num' })
      };
      r.caja = h('div', { class: 'adec' }, [
        h('span', { class: 'adec__nombre', text: a.nombre }),
        r.pct,
        r.estado,
        h('span', { class: 'barra', 'aria-hidden': 'true' }, [r.barra]),
        r.detalle
      ]);
      cont.appendChild(r.caja);
      refs[a.id] = r;
    });
    return refs;
  }

  /* ---------- construcción: paso 5 ---------- */

  function crearEstadoFila() {
    var r = {
      cuenta: h('span', { class: 'rep-estado__cuenta' }),
      badge: h('span', { class: 'semaforo' })
    };
    r.caja = h('span', { class: 'rep-estado' }, [r.cuenta, r.badge]);
    return r;
  }

  function etiquetaSub(sub) {
    var g = GRUPO[sub.grupo];
    if (!sub.subgrupo) return [h('span', { class: 'rep-sub__nombre', text: g.nombre })];
    return [
      h('span', { class: 'rep-sub__grupo', text: g.corto }),
      h('span', { class: 'rep-sub__nombre', text: sub.subgrupo })
    ];
  }

  function crearMenu(i, sufijo) {
    var id = 'menu-' + sufijo + '-' + i;
    return h('div', { class: 'menu' }, [
      h('label', { class: 'form-label', for: id, text: sufijo === 'e' ? D.TIEMPOS[i].nombre : 'Menú / platillos' }),
      h('textarea', { class: 'form-control', id: id, rows: '3', 'data-menu': String(i), placeholder: 'Opcional: escribe el menú de ' + D.TIEMPOS[i].nombre.toLowerCase() })
    ]);
  }

  function construirReparto() {
    N.rep = { filas: {}, pie: {}, tiempos: [], menus: [] };

    /* % de energía por tiempo */
    var pcts = $('#pct-tiempos');
    N.pctTiempos = D.TIEMPOS.map(function (t, i) {
      var id = 'pt-' + i;
      var input = h('input', { type: 'text', inputmode: 'decimal', class: 'form-control num', id: id, 'data-pct-tiempo': String(i), autocomplete: 'off' });
      pcts.appendChild(h('div', { class: 'campo' }, [
        h('label', { class: 'form-label', for: id }, [
          h('span', { 'aria-hidden': 'true', class: 'pt-corto', text: t.corto }),
          h('span', { 'aria-hidden': 'true', class: 'pt-largo', text: t.nombre }),
          h('span', { class: 'visually-hidden', text: t.nombre + ', % de la energía' })
        ]),
        input
      ]));
      return input;
    });

    /* Tabla (tablet y desktop) */
    var tabla = $('#tabla-reparto');
    tabla.appendChild(h('caption', { class: 'visually-hidden', text: 'Equivalentes de cada subgrupo por tiempo de comida' }));
    tabla.appendChild(h('thead', null, [
      h('tr', null, [h('th', { scope: 'col', class: 'rep-sub', text: 'Subgrupo · asignado' })]
        .concat(D.TIEMPOS.map(function (t) { return h('th', { scope: 'col', class: 'col-centro', text: t.nombre }); })))
    ]));
    var cuerpo = h('tbody');
    tabla.appendChild(cuerpo);

    /* Móvil: resumen por subgrupo y acordeón por tiempo */
    var resumen = $('#rep-resumen');
    var acordeon = $('#rep-acordeon');
    var listas = D.TIEMPOS.map(function (t, i) {
      var idPanel = 'rep-panel-' + i;
      var res = h('span', { class: 'rep-ac__res num' });
      var lista = h('ul', { class: 'rep-lista' });
      var tot = {};
      var dl = h('dl', { class: 'rep-tot' });
      [['kcal', 'kcal'], ['p', 'Proteína g'], ['l', 'Lípidos g'], ['h', 'HdC g'], ['pctEnergia', '% del día']].forEach(function (par) {
        tot[par[0]] = h('dd', { class: 'num', text: RAYA });
        dl.appendChild(h('div', null, [h('dt', { text: par[1] }), tot[par[0]]]));
      });
      var menu = crearMenu(i, 'm');
      acordeon.appendChild(h('div', { class: 'accordion-item' }, [
        h('h3', { class: 'accordion-header' }, [
          h('button', {
            type: 'button', class: 'accordion-button' + (i === 0 ? '' : ' collapsed'),
            'data-bs-toggle': 'collapse', 'data-bs-target': '#' + idPanel,
            'aria-expanded': i === 0 ? 'true' : 'false', 'aria-controls': idPanel
          }, [h('span', { class: 'rep-ac__nombre', text: t.nombre }), res])
        ]),
        h('div', { id: idPanel, class: 'accordion-collapse collapse' + (i === 0 ? ' show' : ''), 'data-bs-parent': '#rep-acordeon' }, [
          h('div', { class: 'accordion-body' }, [lista, dl, menu])
        ])
      ]));
      N.rep.tiempos.push({ res: res, tot: tot });
      N.rep.menus.push($('textarea', menu));
      return lista;
    });

    D.SMAE.forEach(function (sub) {
      var nombre = nombreCompleto(sub);
      var estadoTabla = crearEstadoFila();
      var estadoMovil = crearEstadoFila();
      var fila = h('tr', { 'data-sub': sub.id }, [
        h('th', { scope: 'row', class: 'rep-sub' }, etiquetaSub(sub).concat([estadoTabla.caja]))
      ]);
      var items = [];
      var minis = [];
      D.TIEMPOS.forEach(function (t, i) {
        var clave = 'rep:' + sub.id + ':' + i;
        var idTabla = 'rt-' + sub.id + '-' + i;
        fila.appendChild(h('td', { class: 'col-centro' }, [
          h('label', { class: 'visually-hidden', for: idTabla, text: nombre + ', ' + t.nombre }),
          crearStepper(clave, idTabla, nombre + ', ' + t.nombre)
        ]));

        var idMovil = 'rm-' + sub.id + '-' + i;
        var mini = h('span', { class: 'rep-mini num' });
        var item = h('li', { class: 'rep-item' }, [
          h('div', { class: 'rep-item__txt' }, [
            h('label', { for: idMovil }, etiquetaSub(sub)),
            mini
          ]),
          crearStepper(clave, idMovil, nombre + ', ' + t.nombre)
        ]);
        listas[i].appendChild(item);
        items.push(item);
        minis.push(mini);
      });
      cuerpo.appendChild(fila);

      var li = h('li', { class: 'rep-resumen__item' }, [
        h('span', { class: 'rep-resumen__nombre' }, etiquetaSub(sub)),
        estadoMovil.caja
      ]);
      resumen.appendChild(li);

      N.rep.filas[sub.id] = { fila: fila, li: li, items: items, minis: minis, estados: [estadoTabla, estadoMovil] };
    });

    var pie = h('tfoot');
    [['kcal', 'Energía (kcal)'], ['p', 'Proteína (g)'], ['l', 'Lípidos (g)'], ['h', 'HdC (g)'], ['pctEnergia', '% de la energía del día']].forEach(function (par) {
      N.rep.pie[par[0]] = D.TIEMPOS.map(function () { return h('td', { class: 'col-centro num', text: RAYA }); });
      pie.appendChild(h('tr', { class: par[0] === 'pctEnergia' ? 'rep-pie--pct' : null },
        [h('th', { scope: 'row', class: 'rep-sub', text: par[1] })].concat(N.rep.pie[par[0]])));
    });
    tabla.appendChild(pie);

    var menus = $('#menus-escritorio');
    D.TIEMPOS.forEach(function (t, i) {
      var menu = crearMenu(i, 'e');
      menus.appendChild(menu);
      N.rep.menus.push($('textarea', menu));
    });
  }

  /* ---------- render ---------- */

  function pintarError(input, nodo, msg, esAviso) {
    var hayError = !!msg && !esAviso;
    input.classList.toggle('is-invalid', hayError);
    if (hayError) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    txt(nodo, msg || '');
    nodo.classList.toggle('error-campo--aviso', !!esAviso);
    mostrar(nodo, !!msg);
  }

  function renderPaciente(e, d) {
    setVal(N.nombre, e.paciente.nombre);
    N.sexoF.checked = e.paciente.sexo !== 'M';
    N.sexoM.checked = e.paciente.sexo === 'M';
    ['edad', 'talla', 'peso'].forEach(function (k) {
      setVal(N[k], e.paciente[k]);
      pintarError(N[k], N.err[k], mensaje(k, d.paciente.campos[k]));
    });
    txt(N.imc, num(d.imc, F1));
  }

  function renderEnergia(e, d) {
    D.FORMULAS.forEach(function (f) {
      var r = d.gebs[f.id];
      var n = N.formulas[f.id];
      var fuera = r.motivo === 'rango';
      var elegida = e.formulaId === f.id;
      n.radio.checked = elegida;
      n.radio.disabled = fuera && !elegida;
      n.caja.classList.toggle('es-elegida', elegida);
      n.caja.classList.toggle('es-fuera', fuera);
      txt(n.valor, num(r.valor, F1));
      txt(n.estado, fuera ? 'Fuera de rango' : r.motivo === 'datos' ? 'Faltan datos' : '');
    });

    var sel = d.geb;
    var f = C.formula(e.formulaId);
    var aviso = null;
    if (sel.motivo === 'rango') {
      aviso = 'La edad está fuera del rango de ' + f.nombre + ' (' + f.rango + '). Elige otra fórmula para calcular el GET.';
    } else if (sel.aviso) {
      aviso = sel.aviso;
    } else if (sel.motivo === 'datos') {
      aviso = 'Completa los datos del paciente (paso 1) para calcular el GEB.';
    }
    txt(N.avisoFormulaTxt, aviso || '');
    mostrar(N.avisoFormula, !!aviso);

    pintarError(N.af, N.err.af, mensaje('af', d.af));
    pintarError(N.eta, N.err.eta, mensaje('eta', d.eta));

    txt(N.get, num(d.get, F1));
    txt(N.getOp, d.get == null ? '' :
      F0.format(sel.valor) + ' × ' + F2.format(d.af.valor) + ' + ' +
      F0.format(sel.valor) + ' × ' + F2.format(d.eta.valor) + ' = ' + F0.format(d.get));
  }

  function renderMacros(e, d) {
    var manual = e.metaModo === 'manual';
    N.metaGet.checked = !manual;
    N.metaManual.checked = manual;
    N.meta.disabled = !manual;
    N.campoMeta.classList.toggle('es-inactivo', !manual);
    setVal(N.meta, e.metaManual);
    var msg = manual ? mensaje('meta', d.metaManual) : null;
    pintarError(N.meta, N.err.meta, msg, manual && d.metaManual.estado === 'vacio');

    txt(N.getRef, num(d.get, F0));
    txt(N.metaVal, num(d.meta, F0));
    txt(N.metaOrigen, manual ? 'manual' : 'GET');

    D.MACROS.forEach(function (m) {
      var i = d.ideales[m.id];
      setVal(N.pct[m.id], e.pct[m.id]);
      N.pct[m.id].classList.toggle('is-invalid', i.pct == null);
      txt(N.kcal[m.id], num(i.kcal, F1));
      txt(N.g[m.id], num(i.g, F1));
    });

    var ok = d.ideales.sumaOk;
    N.suma.className = 'pildora ' + (ok ? 'pildora--ok' : 'pildora--mal');
    txt(N.suma, 'Suma: ' + F02.format(d.ideales.suma) + ' %' + (ok ? ' · correcto' : ' · debe ser 100 %'));

    txt(N.azucares, num(d.azucaresMaxG, F1));
  }

  function pintarAdec(refs, d) {
    ADEC.forEach(function (a) {
      var r = refs[a.id];
      var valor = d.adecuacion[a.id];
      var sem = d.semaforo[a.id];
      var ideal = a.id === 'kcal' ? d.meta : d.ideales[a.id].g;
      r.caja.className = 'adec' + (sem ? ' adec--' + sem.id : ' adec--sin-dato');
      txt(r.pct, porc(valor));
      r.estado.className = 'semaforo' + (sem ? ' semaforo--' + sem.id : '');
      txt(r.estado, sem ? sem.texto : 'Sin dato');
      /* La barra llega al 100 % de adecuación a 4/5 de su ancho; tope en 125 %. */
      r.barra.style.width = (C.esNumero(valor) ? Math.min(valor, 125) / 125 * 100 : 0) + '%';
      txt(r.detalle, C.esNumero(ideal)
        ? F01.format(d.totales[a.id]) + ' de ' + F01.format(ideal) + ' ' + a.unidad
        : F01.format(d.totales[a.id]) + ' ' + a.unidad);
    });
  }

  function aplicarFiltro(e) {
    var hayVisibles = false;
    D.GRUPOS.forEach(function (g) {
      var visiblesGrupo = 0;
      D.SMAE.forEach(function (sub) {
        if (sub.grupo !== g.id) return;
        var visible = UI.filtro === 'todos' ||
          (UI.filtro === 'valor' ? (e.eq[sub.id] || 0) > 0 : UI.filtro === g.id);
        var fila = N.eq[sub.id].fila;
        mostrar(fila, visible);
        fila.classList.toggle('es-primera', visible && visiblesGrupo === 0);
        if (visible) visiblesGrupo++;
      });
      mostrar(N.eqGrupos[g.id], visiblesGrupo > 0);
      if (visiblesGrupo > 0) hayVisibles = true;
    });
    mostrar(N.eqVacio, !hayVisibles);
    Array.prototype.forEach.call(N.chips.children, function (chip) {
      chip.setAttribute('aria-pressed', chip.dataset.filtro === UI.filtro ? 'true' : 'false');
    });
  }

  function renderEquivalentes(e, d) {
    D.SMAE.forEach(function (sub) {
      var n = N.eq[sub.id];
      var a = C.aporte(sub, e.eq[sub.id]);
      n.fila.classList.toggle('tiene-valor', a.eq > 0);
      ['kcal', 'p', 'l', 'h'].forEach(function (k) { txt(n.celdas[k], F01.format(a[k])); });
    });
    txt(N.total.eq, F02.format(d.totales.eq));
    ['kcal', 'p', 'l', 'h'].forEach(function (k) { txt(N.total[k], F01.format(d.totales[k])); });
    mostrar(N.avisoSuma, !d.ideales.sumaOk);
    pintarAdec(N.adecEq, d);
    aplicarFiltro(e);
  }

  function pintarEstadoFila(r, f) {
    var texto = 'Asignado ' + F02.format(f.asignado) + ' de ' + F02.format(f.total);
    var clase = '';
    var badge = RAYA;
    if (f.estado === 'completo') { clase = ' semaforo--adecuado'; badge = 'Completo'; }
    else if (f.estado === 'faltan') { clase = ' semaforo--bajo'; badge = 'Faltan ' + F02.format(f.diferencia); }
    else if (f.estado === 'sobran') { clase = ' semaforo--excede'; badge = 'Sobran ' + F02.format(f.diferencia); }
    txt(r.cuenta, texto);
    r.badge.className = 'semaforo' + clase;
    txt(r.badge, badge);
  }

  function renderReparto(e, d) {
    var hayFilas = false;
    D.SMAE.forEach(function (sub) {
      var f = d.filasReparto[sub.id];
      var n = N.rep.filas[sub.id];
      var visible = UI.mostrarTodos || f.total > 0 || f.asignado > 0;
      if (visible) hayFilas = true;
      mostrar(n.fila, visible);
      mostrar(n.li, visible);
      n.items.forEach(function (item) { mostrar(item, visible); });
      n.estados.forEach(function (r) { pintarEstadoFila(r, f); });
      n.minis.forEach(function (mini) { txt(mini, F02.format(f.asignado) + ' de ' + F02.format(f.total)); });
    });
    N.paso5.classList.toggle('sin-filas', !hayFilas);
    mostrar(N.repVacio, !hayFilas);

    d.tiempos.forEach(function (t, i) {
      ['kcal', 'p', 'l', 'h'].forEach(function (k) {
        var s = F01.format(t[k]);
        txt(N.rep.pie[k][i], s);
        txt(N.rep.tiempos[i].tot[k], s);
      });
      txt(N.rep.pie.pctEnergia[i], porc(t.pctEnergia));
      txt(N.rep.tiempos[i].tot.pctEnergia, porc(t.pctEnergia));
      txt(N.rep.tiempos[i].res, F0.format(t.kcal) + ' kcal · ' + porc(t.pctEnergia));
    });

    N.pctTiempos.forEach(function (input, i) {
      setVal(input, e.pctTiempos[i]);
      input.classList.toggle('is-invalid', d.pctTiempos.valores[i] == null);
    });
    var ok = d.pctTiempos.ok;
    N.sumaTiempos.className = 'pildora ' + (ok ? 'pildora--ok' : 'pildora--mal');
    txt(N.sumaTiempos, 'Suma: ' + F02.format(d.pctTiempos.suma) + ' %' + (ok ? ' · correcto' : ' · debe ser 100 %'));
    N.btnSugerir.disabled = !ok || d.totales.eq === 0;

    N.rep.menus.forEach(function (ta) { setVal(ta, e.menus[Number(ta.dataset.menu)]); });
    N.swTodos.checked = UI.mostrarTodos;
  }

  function renderResumen(e, d) {
    var nombre = e.paciente.nombre.trim();
    txt(N.rNombre, nombre || 'Sin nombre');
    txt(N.rDatos, (d.paciente.sexo === 'M' ? 'Masculino' : 'Femenino') +
      (d.paciente.edad != null ? ' · ' + F01.format(d.paciente.edad) + (d.paciente.edad === 1 ? ' año' : ' años') : ''));
    txt(N.rGet, num(d.get, F0));
    txt(N.rGeb, num(d.geb.valor, F0));
    txt(N.rFormula, C.formula(e.formulaId).nombre);
    txt(N.rImc, num(d.imc, F1));
    txt(N.rMeta, num(d.meta, F0));
    txt(N.rMetaOrigen, e.metaModo === 'manual' ? 'manual' : 'GET');
    pintarAdec(N.adecResumen, d);
  }

  function render() {
    var e = S.get();
    var d = C.derivar(e);
    renderPaciente(e, d);
    pintarSteppers(e);
    renderEnergia(e, d);
    renderMacros(e, d);
    renderEquivalentes(e, d);
    renderReparto(e, d);
    renderResumen(e, d);
  }

  /* ---------- navegación entre pasos ---------- */

  function marcarPaso() {
    N.pasos.forEach(function (s) {
      s.classList.toggle('es-activo', Number(s.dataset.paso) === UI.paso);
    });
    N.botonesIr.forEach(function (b) {
      if (Number(b.dataset.ir) === UI.paso) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
  }

  function irA(paso) {
    UI.paso = paso;
    marcarPaso();
    cerrarPopovers();
    var suave = mqMovimiento.matches ? 'auto' : 'smooth';
    if (mqDesktop.matches) {
      var seccion = N.pasos[paso - 1];
      var y = seccion.getBoundingClientRect().top + window.scrollY - N.nav.offsetHeight - 16;
      window.scrollTo({ top: Math.max(0, y), behavior: suave });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  /* En desktop todos los pasos están en la página: se resalta el que se está viendo. */
  var scrollPendiente = false;
  function alHacerScroll() {
    if (!mqDesktop.matches || scrollPendiente) return;
    scrollPendiente = true;
    window.requestAnimationFrame(function () {
      scrollPendiente = false;
      var limite = N.nav.offsetHeight + 120;
      var actual = 1;
      N.pasos.forEach(function (s) {
        if (s.getBoundingClientRect().top <= limite) actual = Number(s.dataset.paso);
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) actual = N.pasos.length;
      if (actual !== UI.paso) {
        UI.paso = actual;
        marcarPaso();
      }
    });
  }

  /* ---------- modal de confirmación ---------- */

  var modal = null;
  var alConfirmar = null;
  var focoPrevio = null;

  function confirmar(opciones, accion) {
    txt(N.modalTitulo, opciones.titulo);
    txt(N.modalTexto, opciones.texto);
    txt(N.modalOk, opciones.boton);
    N.modalOk.className = 'btn ' + (opciones.peligro ? 'btn-danger' : 'btn-primary');
    alConfirmar = accion;
    focoPrevio = document.activeElement;
    cerrarPopovers();
    modal.show();
  }

  /* ---------- acciones ---------- */

  function nuevoPaciente() {
    confirmar({
      titulo: '¿Empezar con un nuevo paciente?',
      texto: 'Se borrarán los datos, los equivalentes, el reparto y los menús escritos. Esta acción no se puede deshacer.',
      boton: 'Sí, borrar todo',
      peligro: true
    }, function () {
      UI.filtro = 'todos';
      UI.mostrarTodos = false;
      S.reiniciar();
      irA(1);
      focoPrevio = N.nombre;
    });
  }

  function limpiarEquivalentes() {
    confirmar({
      titulo: '¿Limpiar los equivalentes?',
      texto: 'Todos los equivalentes del cuadro volverán a 0. El reparto por tiempos no se borra.',
      boton: 'Sí, limpiar',
      peligro: true
    }, function () {
      S.update(function (e) { e.eq = {}; });
    });
  }

  function sugerir() {
    var aplicar = function () {
      S.update(function (e) {
        var reparto = C.sugerirReparto(e.eq, e.pctTiempos);
        if (reparto) e.reparto = reparto;
      });
    };
    if (C.derivar(S.get()).hayReparto) {
      confirmar({
        titulo: '¿Reemplazar el reparto actual?',
        texto: 'Ya hay equivalentes repartidos. La sugerencia sobrescribe todas las celdas.',
        boton: 'Sí, reemplazar',
        peligro: false
      }, aplicar);
    } else {
      aplicar();
    }
  }

  /* ---------- hoja de impresión ---------- */

  function construirImpresion() {
    var e = S.get();
    var d = C.derivar(e);
    var f = C.formula(e.formulaId);
    var nombre = e.paciente.nombre.trim() || 'Sin nombre';
    var fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    var o = [];

    function celda(s, clase) { return '<td' + (clase ? ' class="' + clase + '"' : '') + '>' + esc(s) + '</td>'; }
    function cab(s, clase) { return '<th scope="col"' + (clase ? ' class="' + clase + '"' : '') + '>' + esc(s) + '</th>'; }
    function filaTh(s) { return '<th scope="row">' + esc(s) + '</th>'; }

    o.push('<header class="imp-cab"><div><p class="imp-eyebrow">Calculadora nutricional · Equivalentes SMAE</p>' +
      '<h1>' + esc(nombre) + '</h1></div><p class="imp-fecha">' + esc(fecha) + '</p></header>');

    o.push('<section><h2>Datos del paciente</h2><table class="imp-tabla imp-datos"><tbody><tr>' +
      filaTh('Sexo') + celda(d.paciente.sexo === 'M' ? 'Masculino' : 'Femenino') +
      filaTh('Edad') + celda(d.paciente.edad != null ? F01.format(d.paciente.edad) + ' años' : RAYA) +
      filaTh('Talla') + celda(d.paciente.talla != null ? F01.format(d.paciente.talla) + ' cm' : RAYA) +
      filaTh('Peso') + celda(d.paciente.peso != null ? F01.format(d.paciente.peso) + ' kg' : RAYA) +
      filaTh('IMC') + celda(d.imc != null ? F1.format(d.imc) + ' kg/m²' : RAYA) +
      '</tr></tbody></table></section>');

    o.push('<section><h2>Gasto energético</h2><table class="imp-tabla imp-datos"><tbody><tr>' +
      filaTh('Fórmula') + celda(f.nombre) +
      filaTh('GEB') + celda(d.geb.valor != null ? F1.format(d.geb.valor) + ' kcal' : RAYA) +
      filaTh('AF') + celda(d.af.valor != null ? F2.format(d.af.valor) : RAYA) +
      filaTh('ETA') + celda(d.eta.valor != null ? F2.format(d.eta.valor) : RAYA) +
      filaTh('GET') + celda(d.get != null ? F1.format(d.get) + ' kcal' : RAYA) +
      '</tr></tbody></table>' +
      '<p class="imp-nota">GET = GEB × AF + GEB × ETA' + (N.getOp.textContent ? ' → ' + esc(N.getOp.textContent) : '') +
      '. Meta de energía: <strong>' + esc(num(d.meta, F0)) + ' kcal</strong> (' +
      (e.metaModo === 'manual' ? 'meta manual' : 'GET calculado') + ').</p></section>');

    o.push('<section><h2>Macronutrimentos</h2><table class="imp-tabla"><thead><tr>' +
      cab('Macronutrimento') + cab('%', 'n') + cab('kcal', 'n') + cab('g', 'n') + '</tr></thead><tbody>');
    D.MACROS.forEach(function (m) {
      var i = d.ideales[m.id];
      o.push('<tr>' + filaTh(m.nombre) + celda(num(i.pct, F02), 'n') + celda(num(i.kcal, F1), 'n') + celda(num(i.g, F1), 'n') + '</tr>');
    });
    o.push('</tbody></table>' + (d.ideales.sumaOk ? '' : '<p class="imp-nota">Atención: los porcentajes suman ' +
      esc(F02.format(d.ideales.suma)) + ' %, no 100 %.</p>') + '</section>');

    o.push('<section><h2>Cuadro de equivalentes</h2><table class="imp-tabla imp-eq"><thead><tr>' +
      cab('Grupo') + cab('Subgrupo') + cab('Equiv.', 'n') + cab('kcal', 'n') + cab('Proteína g', 'n') +
      cab('Lípidos g', 'n') + cab('HdC g', 'n') + '</tr></thead><tbody>');
    var conValor = D.SMAE.filter(function (sub) { return (e.eq[sub.id] || 0) > 0; });
    conValor.forEach(function (sub) {
      var a = C.aporte(sub, e.eq[sub.id]);
      o.push('<tr>' + filaTh(GRUPO[sub.grupo].nombre) + celda(sub.subgrupo || RAYA) + celda(F02.format(a.eq), 'n') +
        celda(F01.format(a.kcal), 'n') + celda(F01.format(a.p), 'n') + celda(F01.format(a.l), 'n') + celda(F01.format(a.h), 'n') + '</tr>');
    });
    if (!conValor.length) o.push('<tr><td colspan="7">Sin equivalentes capturados.</td></tr>');
    o.push('</tbody><tfoot>' +
      '<tr><th scope="row" colspan="2">Total</th>' + celda(F02.format(d.totales.eq), 'n') +
      ['kcal', 'p', 'l', 'h'].map(function (k) { return celda(F01.format(d.totales[k]), 'n'); }).join('') + '</tr>' +
      '<tr><th scope="row" colspan="2">Ideal</th>' + celda('', 'n') + celda(num(d.meta, F01), 'n') +
      D.MACROS.map(function (m) { return celda(num(d.ideales[m.id].g, F1), 'n'); }).join('') + '</tr>' +
      '<tr><th scope="row" colspan="2">% de adecuación</th>' + celda('', 'n') +
      ADEC.map(function (a) {
        var sem = d.semaforo[a.id];
        return '<td class="n">' + esc(porc(d.adecuacion[a.id])) + (sem ? '<br>' + esc(sem.texto) : '') + '</td>';
      }).join('') + '</tr></tfoot></table></section>');

    var conReparto = D.SMAE.filter(function (sub) {
      var fr = d.filasReparto[sub.id];
      return fr.total > 0 || fr.asignado > 0;
    });
    o.push('<section><h2>Reparto por tiempos de comida</h2><table class="imp-tabla"><thead><tr>' + cab('Subgrupo') +
      D.TIEMPOS.map(function (t) { return cab(t.nombre, 'n'); }).join('') + cab('Asignado', 'n') + '</tr></thead><tbody>');
    conReparto.forEach(function (sub) {
      var fr = d.filasReparto[sub.id];
      var nota = fr.estado === 'faltan' ? ' (faltan ' + F02.format(fr.diferencia) + ')'
        : fr.estado === 'sobran' ? ' (sobran ' + F02.format(fr.diferencia) + ')' : '';
      o.push('<tr>' + filaTh(nombreCompleto(sub)) +
        D.TIEMPOS.map(function (t, i) {
          var v = (e.reparto[sub.id] || [])[i] || 0;
          return celda(v ? F02.format(v) : '', 'n');
        }).join('') +
        celda(F02.format(fr.asignado) + ' de ' + F02.format(fr.total) + nota, 'n') + '</tr>');
    });
    if (!conReparto.length) o.push('<tr><td colspan="7">Sin equivalentes por repartir.</td></tr>');
    o.push('</tbody><tfoot>');
    [['kcal', 'Energía (kcal)'], ['p', 'Proteína (g)'], ['l', 'Lípidos (g)'], ['h', 'HdC (g)']].forEach(function (par) {
      o.push('<tr>' + filaTh(par[1]) + d.tiempos.map(function (t) { return celda(F01.format(t[par[0]]), 'n'); }).join('') +
        celda(F01.format(d.tiempos.reduce(function (s, t) { return s + t[par[0]]; }, 0)), 'n') + '</tr>');
    });
    o.push('<tr>' + filaTh('% de la energía del día') + d.tiempos.map(function (t) { return celda(porc(t.pctEnergia), 'n'); }).join('') +
      celda(porc(d.totales.kcal > 0 ? d.tiempos.reduce(function (s, t) { return s + t.pctEnergia; }, 0) : null), 'n') + '</tr>');
    o.push('</tfoot></table></section>');

    var hayMenus = e.menus.some(function (m) { return m.trim() !== ''; });
    if (hayMenus) {
      o.push('<section><h2>Menú / platillos</h2>');
      D.TIEMPOS.forEach(function (t, i) {
        if (e.menus[i].trim() === '') return;
        o.push('<div class="imp-menu"><h3>' + esc(t.nombre) + '</h3><p>' + esc(e.menus[i].trim()) + '</p></div>');
      });
      o.push('</section>');
    }

    o.push('<footer class="imp-pie">Herramienta de apoyo académico. Verifica los resultados con tu docente y tu bibliografía.</footer>');
    N.impresion.innerHTML = o.join('');
  }

  /* ---------- eventos ---------- */

  function asignar(obj, ruta, valor) {
    var partes = ruta.split('.');
    for (var i = 0; i < partes.length - 1; i++) obj = obj[partes[i]];
    obj[partes[partes.length - 1]] = valor;
  }

  function conectarEventos() {
    document.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.matches('[data-campo]')) {
        S.update(function (e) { asignar(e, t.dataset.campo, t.value); });
      } else if (t.matches('.stepper__input')) {
        escribirStepper(t);
      } else if (t.matches('[data-pct-tiempo]')) {
        S.update(function (e) { e.pctTiempos[Number(t.dataset.pctTiempo)] = t.value; });
      } else if (t.matches('[data-menu]')) {
        S.update(function (e) { e.menus[Number(t.dataset.menu)] = t.value; });
      }
    });

    document.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.name === 'sexo') {
        S.update(function (e) { e.paciente.sexo = t.value; });
      } else if (t.name === 'formula') {
        S.update(function (e) { e.formulaId = t.value; });
      } else if (t.name === 'metaModo') {
        S.update(function (e) { e.metaModo = t.value; });
        if (t.value === 'manual') N.meta.focus();
      } else if (t === N.swTodos) {
        UI.mostrarTodos = t.checked;
        render();
      }
    });

    document.addEventListener('click', function (ev) {
      var t = ev.target;
      var info = t.closest('.formula__info');
      if (!t.closest('.popover')) cerrarPopovers(info);

      var paso = t.closest('.stepper__btn');
      if (paso) {
        moverStepper(paso.closest('.stepper'), Number(paso.dataset.dir));
        return;
      }
      var ir = t.closest('[data-ir]');
      if (ir) {
        irA(Number(ir.dataset.ir));
        return;
      }
      var chip = t.closest('[data-filtro]');
      if (chip) {
        UI.filtro = chip.dataset.filtro;
        aplicarFiltro(S.get());
      }
    });

    /* Flechas ↑ / ↓ dentro de un stepper: mismo efecto que los botones. */
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') cerrarPopovers();
      if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
      if (!ev.target.matches || !ev.target.matches('.stepper__input')) return;
      ev.preventDefault();
      moverStepper(ev.target.closest('.stepper'), ev.key === 'ArrowUp' ? 1 : -1);
    });

    document.addEventListener('focusin', function (ev) {
      if (ev.target.matches('.stepper__input')) ev.target.select();
    });

    /* Al salir de un stepper se normaliza lo escrito (p. ej. «2,5» → «2.5»; vacío → «0»). */
    document.addEventListener('focusout', function (ev) {
      var t = ev.target;
      if (!t.matches || !t.matches('.stepper__input')) return;
      var a = acceso(t.closest('.stepper').dataset.stepper);
      if (a.esTexto) return;
      t.value = a.texto(S.get());
      t.classList.remove('is-invalid');
    });

    $('#btn-nuevo').addEventListener('click', nuevoPaciente);
    $('#btn-limpiar-eq').addEventListener('click', limpiarEquivalentes);
    N.btnSugerir.addEventListener('click', sugerir);
    $('#btn-imprimir').addEventListener('click', function () {
      cerrarPopovers();
      construirImpresion();
      window.print();
    });
    window.addEventListener('beforeprint', construirImpresion);

    N.modalOk.addEventListener('click', function () {
      var accion = alConfirmar;
      alConfirmar = null;
      modal.hide();
      if (accion) accion();
    });
    N.modalEl.addEventListener('hidden.bs.modal', function () {
      alConfirmar = null;
      if (focoPrevio && document.contains(focoPrevio)) focoPrevio.focus();
      focoPrevio = null;
    });

    window.addEventListener('scroll', alHacerScroll, { passive: true });
  }

  /* ---------- PWA (solo si se sirve por http/https; en file:// se omite) ---------- */

  function activarPWA() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    document.head.appendChild(h('link', { rel: 'manifest', href: 'manifest.webmanifest' }));
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sin SW la app funciona igual */ });
    });
  }

  /* ---------- arranque ---------- */

  function iniciar() {
    construirFormulas();
    construirEquivalentes();
    construirReparto();
    registrarStepper($('[data-stepper="af"]'));
    registrarStepper($('[data-stepper="eta"]'));

    N.nav = $('.pasos-nav');
    N.pasos = Array.prototype.slice.call(document.querySelectorAll('.paso'));
    N.botonesIr = Array.prototype.slice.call(document.querySelectorAll('[data-ir]'));

    N.nombre = $('#f-nombre');
    N.sexoF = $('#f-sexo-f');
    N.sexoM = $('#f-sexo-m');
    N.edad = $('#f-edad');
    N.talla = $('#f-talla');
    N.peso = $('#f-peso');
    N.af = $('#f-af');
    N.eta = $('#f-eta');
    N.meta = $('#f-meta');
    N.err = {
      edad: $('#e-edad'), talla: $('#e-talla'), peso: $('#e-peso'),
      af: $('#e-af'), eta: $('#e-eta'), meta: $('#e-meta')
    };
    N.imc = $('#o-imc');

    N.avisoFormula = $('#aviso-formula');
    N.avisoFormulaTxt = $('#aviso-formula-txt');
    N.get = $('#o-get');
    N.getOp = $('#o-get-op');

    N.metaGet = $('#f-meta-get');
    N.metaManual = $('#f-meta-manual');
    N.campoMeta = N.meta.closest('.campo');
    N.getRef = $('#o-get-ref');
    N.metaVal = $('#o-meta');
    N.metaOrigen = $('#o-meta-origen');
    N.pct = {}; N.kcal = {}; N.g = {};
    D.MACROS.forEach(function (m) {
      N.pct[m.id] = $('#f-pct-' + m.id);
      N.kcal[m.id] = $('#o-kcal-' + m.id);
      N.g[m.id] = $('#o-g-' + m.id);
    });
    N.suma = $('#o-suma');
    N.azucares = $('#o-azucares');

    N.chips = $('#eq-filtros');
    N.eqVacio = $('#eq-vacio');
    N.total = { eq: $('#t-eq'), kcal: $('#t-kcal'), p: $('#t-p'), l: $('#t-l'), h: $('#t-h') };
    N.avisoSuma = $('#aviso-suma');
    N.adecEq = crearAdec($('#adec-eq'));

    N.paso5 = $('#paso-5');
    N.repVacio = $('#rep-vacio');
    N.sumaTiempos = $('#o-suma-tiempos');
    N.btnSugerir = $('#btn-sugerir');
    N.swTodos = $('#sw-todos');

    N.rNombre = $('#r-nombre');
    N.rDatos = $('#r-datos');
    N.rGet = $('#r-get');
    N.rGeb = $('#r-geb');
    N.rFormula = $('#r-formula');
    N.rImc = $('#r-imc');
    N.rMeta = $('#r-meta');
    N.rMetaOrigen = $('#r-meta-origen');
    N.adecResumen = crearAdec($('#r-adec'));

    N.modalEl = $('#modal-confirmar');
    N.modalTitulo = $('#modal-confirmar-titulo');
    N.modalTexto = $('#modal-confirmar-texto');
    N.modalOk = $('#modal-confirmar-ok');
    modal = new bootstrap.Modal(N.modalEl);
    N.impresion = $('#impresion');

    conectarEventos();
    S.subscribe(render);
    render();
    marcarPaso();
    activarPWA();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
