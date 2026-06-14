(function () {
    'use strict';

    Statamic.booting(() => {
        const { h, ref, computed } = window.Vue;

        Statamic.$components.register('spacing-fieldtype', {
            inheritAttrs: false,
            props: {
                value:  { default: null },
                meta:   { type: Object, default: () => ({}) },
                config: { type: Object, default: () => ({}) },
            },
            emits: ['update:value', 'focus', 'blur'],
            setup(props, { emit }) {
                const minVal   = computed(() => props.config.min  ?? 0);
                const maxVal   = computed(() => props.config.max  ?? 200);
                const stepSize = computed(() => props.config.step ?? 1);
                const unit     = computed(() => props.config.unit || 'px');
                const numSteps = computed(() => Math.round((maxVal.value - minVal.value) / stepSize.value) + 1);
                const visual   = computed(() => numSteps.value - (minVal.value === 0 ? 1 : 0));

                function parseRows(val) {
                    if (Array.isArray(val) && val.length > 0) {
                        return val.map(r => {
                            const isCustom = r.custom ?? (typeof r.value === 'string' && isNaN(Number(r.value)));
                            return {
                                sides:     Array.isArray(r.sides) ? [...r.sides] : ['top'],
                                value:     isCustom ? minVal.value : (r.value ?? minVal.value),
                                custom:    isCustom,
                                customVal: isCustom ? String(r.value) : '',
                            };
                        });
                    }
                    return [{ sides: ['top'], value: minVal.value, custom: false, customVal: '' }];
                }

                const rows      = ref(parseRows(props.value));
                const trackRefs = ref([]);

                function emitRows() {
                    emit('update:value', rows.value.map(r => ({
                        sides:  r.sides,
                        value:  r.custom ? (r.customVal || null) : r.value,
                        custom: r.custom,
                    })));
                }

                function toggleSide(rowIdx, side) {
                    const row = rows.value[rowIdx];
                    const idx = row.sides.indexOf(side);
                    if (idx === -1) row.sides.push(side);
                    else row.sides.splice(idx, 1);
                    emitRows();
                }

                function addRow() {
                    rows.value.push({ sides: ['top'], value: minVal.value, custom: false, customVal: '' });
                    emitRows();
                }

                function removeRow(idx) {
                    rows.value.splice(idx, 1);
                    emitRows();
                }

                function stepFromX(rowIdx, clientX) {
                    const el = trackRefs.value[rowIdx];
                    if (!el) return minVal.value;
                    const rect  = el.getBoundingClientRect();
                    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                    const idx   = Math.round(ratio * (visual.value - 1));
                    return minVal.value === 0
                        ? (idx + 1) * stepSize.value
                        : minVal.value + idx * stepSize.value;
                }

                function onMousedown(rowIdx, e) {
                    if (e.button !== 0) return;
                    emit('focus');
                    rows.value[rowIdx].value = stepFromX(rowIdx, e.clientX);
                    emitRows();
                    const move = (mv) => { rows.value[rowIdx].value = stepFromX(rowIdx, mv.clientX); emitRows(); };
                    const up   = ()   => { emit('blur'); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
                    document.addEventListener('mousemove', move);
                    document.addEventListener('mouseup', up);
                }

                function onKeydown(rowIdx, e) {
                    const row = rows.value[rowIdx];
                    let idx = Math.round((row.value - minVal.value) / stepSize.value);
                    if      (e.key === 'ArrowRight' || e.key === 'ArrowUp')   idx = Math.min(numSteps.value - 1, idx + 1);
                    else if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') idx = Math.max(0, idx - 1);
                    else if (e.key === 'Home') idx = 0;
                    else if (e.key === 'End')  idx = numSteps.value - 1;
                    else return;
                    e.preventDefault();
                    row.value = Math.max(1, minVal.value + idx * stepSize.value);
                    emitRows();
                }

                function toggleCustom(rowIdx) {
                    const row = rows.value[rowIdx];
                    row.custom = !row.custom;
                    if (row.custom) {
                        row.customVal = row.value > 0 ? row.value + unit.value : '';
                    } else {
                        row.customVal = '';
                        row.value = 0;
                    }
                    emitRows();
                }

                function clickableBoxSvg(activeSides, rowIdx) {
                    const sides = [
                        { side: 'top',    x1: '4',  y1: '2',  x2: '16', y2: '2',  hx: 0,  hy: 0,  hw: 20, hh: 5  },
                        { side: 'right',  x1: '18', y1: '4',  x2: '18', y2: '16', hx: 15, hy: 0,  hw: 5,  hh: 20 },
                        { side: 'bottom', x1: '16', y1: '18', x2: '4',  y2: '18', hx: 0,  hy: 15, hw: 20, hh: 5  },
                        { side: 'left',   x1: '2',  y1: '16', x2: '2',  y2: '4',  hx: 0,  hy: 0,  hw: 5,  hh: 20 },
                    ];
                    return h('svg', { width: '20', height: '20', viewBox: '0 0 20 20', fill: 'none', style: 'display:block;flex-shrink:0;user-select:none' },
                        sides.flatMap(({ side, x1, y1, x2, y2, hx, hy, hw, hh }) => [
                            h('line', {
                                x1, y1, x2, y2,
                                stroke: activeSides.includes(side) ? '#3b82f6' : '#d1d5db',
                                'stroke-width': '3',
                                'stroke-linecap': 'butt',
                            }),
                            h('rect', {
                                x: hx, y: hy, width: hw, height: hh,
                                fill: 'transparent',
                                style: 'cursor:pointer',
                                onClick: (e) => { e.stopPropagation(); toggleSide(rowIdx, side); },
                            }),
                        ])
                    );
                }

                function pencilSvg() {
                    return h('svg', { width: '20', height: '20', viewBox: '0 0 24 24', style: 'display:block' }, [
                        h('path', { fill: 'currentColor', d: 'm12.9 6.855l4.242 4.242l-9.9 9.9H3v-4.243zm1.414-1.415l2.121-2.121a1 1 0 0 1 1.414 0l2.829 2.828a1 1 0 0 1 0 1.415l-2.122 2.121z' }),
                    ]);
                }

                function plusSvg() {
                    return h('svg', { width: '14', height: '14', viewBox: '0 0 24 24', style: 'display:block' }, [
                        h('path', { fill: 'currentColor', d: 'M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z' }),
                    ]);
                }

                function xSvg() {
                    return h('svg', { width: '12', height: '12', viewBox: '0 0 24 24', style: 'display:block' }, [
                        h('path', { fill: 'currentColor', d: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' }),
                    ]);
                }

                return () => {
                    const rowEls = rows.value.map((row, rowIdx) => {
                        const v         = row.custom ? 0 : (row.value ?? minVal.value);
                        const vi        = Math.round((v - minVal.value) / stepSize.value);
                        const visualIdx = minVal.value === 0 ? vi - 1 : vi;
                        const useTicks  = visual.value <= 40;
                        const cm        = row.custom;

                        let trackChildren;
                        if (useTicks) {
                            trackChildren = Array.from({ length: visual.value }, (_, i) => {
                                const active = v > 0 && i <= visualIdx;
                                return h('div', {
                                    key: i,
                                    class: active ? 'vzl-sp-tick is-active' : 'vzl-sp-tick',
                                }, i === visualIdx && v > 0 ? [
                                    h('div', { class: 'vzl-sp-tick-thumb' }),
                                ] : []);
                            });
                        } else {
                            const pct = visual.value > 1 ? (visualIdx / (visual.value - 1)) * 100 : 0;
                            trackChildren = [
                                h('div', { key: 'track', class: 'vzl-sp-track-bg' }),
                                h('div', { key: 'fill',  class: 'vzl-sp-track-fill', style: { width: pct + '%' } }),
                                h('div', { key: 'dot',   class: 'vzl-sp-track-dot', style: { left: pct + '%' } }),
                            ];
                        }

                        return h('div', { key: rowIdx, class: 'vzl-sp-row' }, [
                            clickableBoxSvg(row.sides, rowIdx),

                            cm
                                ? h('input', {
                                    value:       row.customVal,
                                    placeholder: 'f.eks. 5rem',
                                    class:       'cp-input vzl-sp-input',
                                    onInput:     (e) => { rows.value[rowIdx].customVal = e.target.value; emitRows(); },
                                    onFocus:     () => emit('focus'),
                                    onBlur:      () => emit('blur'),
                                })
                                : h('div', {
                                    ref:         el => { trackRefs.value[rowIdx] = el; },
                                    tabindex:    '0',
                                    class:       'vzl-sp-track',
                                    onMousedown: (e) => onMousedown(rowIdx, e),
                                    onKeydown:   (e) => onKeydown(rowIdx, e),
                                    onFocus:     () => emit('focus'),
                                    onBlur:      () => emit('blur'),
                                }, trackChildren),

                            h('button', {
                                type:    'button',
                                title:   cm ? 'Brug slider' : 'Angiv custom værdi',
                                class:   ['vzl-sp-edit', cm ? 'is-active' : ''],
                                onClick: () => toggleCustom(rowIdx),
                            }, pencilSvg()),

                            rows.value.length > 1
                                ? h('button', {
                                    type:    'button',
                                    title:   'Fjern',
                                    class:   'vzl-sp-remove-btn',
                                    onClick: () => removeRow(rowIdx),
                                }, xSvg())
                                : null,
                        ]);
                    });

                    return h('div', { class: 'vzl-sp-sides' }, [
                        ...rowEls,
                        rows.value.length < 4
                            ? h('button', {
                                type:    'button',
                                title:   'Tilføj',
                                class:   'vzl-sp-add-btn',
                                onClick: addRow,
                            }, [plusSvg(), 'Tilføj'])
                            : null,
                    ]);
                };
            },
        });

    });
}());
