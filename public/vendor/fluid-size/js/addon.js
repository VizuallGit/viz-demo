(function () {
    'use strict';

    // Injicér @font-face for alle fonte i public/fonts/
    Statamic.booting(() => {
        if (document.getElementById('cp-fonts')) return;
        const fonts = Statamic.$config.get('cp-fonts') || [];
        if (!fonts.length) return;
        const s = document.createElement('style');
        s.id = 'cp-fonts';
        s.textContent = fonts.map(({ family, file, variable, weight }) => {
            const encoded = encodeURIComponent(file);
            const format  = variable ? 'woff2-variations' : 'woff2';
            const w       = variable ? '100 900' : (weight || '400');
            return `@font-face{font-family:"${family}";src:url("/fonts/${encoded}") format("${format}");font-weight:${w};font-display:swap;}`;
        }).join('');
        document.head.appendChild(s);
    });

    Statamic.booting(() => {
        const { h, ref, computed } = window.Vue;

        Statamic.$components.register('fluid-font-size-fieldtype', {
            props: {
                value:  { default: null },
                meta:   { type: Object, default: () => ({}) },
                config: { type: Object, default: () => ({}) },
            },
            emits: ['update:value', 'focus', 'blur'],
            setup(props, { emit }) {
                function parseValue(val) {
                    if (val && typeof val === 'object' && val.global) {
                        return {
                            global: {
                                min:  parseFloat(val.global.min)  || 1,
                                pref: parseFloat(val.global.pref) || 5,
                                unit: val.global.unit || 'cqi',
                                max:  parseFloat(val.global.max)  || 3,
                            },
                            overrides: val.overrides || {},
                        };
                    }
                    return { global: { min: 1, pref: 5, unit: 'cqi', max: 3 }, overrides: {} };
                }

                const p        = parseValue(props.value);
                const gMin     = ref(p.global.min);
                const gPref    = ref(p.global.pref);
                const gUnit    = ref(p.global.unit);
                const gMax     = ref(p.global.max);
                const overrides    = ref({ ...p.overrides });
                const editingRow   = ref(null);
                const editMin      = ref(0);
                const editPref     = ref(0);
                const editUnit     = ref('cqi');
                const editMax      = ref(0);

                const LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
                const PREVIEW = {
                    default: 'Den hurtige ræv hopper over den dovne hund',
                    p: 'Her er et eksempel på, hvordan en brødtekst vil se ud med den valgte skriftstørrelse. God læsbarhed er afgørende for brugeroplevelsen, og den rette linjehøjde og størrelse gør teksten behagelig at læse.',
                };
                const UNITS  = ['cqi', 'vw', 'vi', 'svw'];

                const previewPos = ref(100);

                function autoValues(i) {
                    const key  = LEVELS[i];
                    const mn   = Math.min(gMin.value, gMax.value);
                    const mx   = Math.max(gMin.value, gMax.value);
                    const pf   = gPref.value;

                    if (key === 'p') {
                        const pMax  = mn;
                        const pMin  = Math.round(mn * 0.75 * 100) / 100;
                        const pPref = Math.round(pf * (mn / mx) * 10) / 10;
                        return { min: pMin, pref: pPref, unit: gUnit.value, max: pMax };
                    }

                    const h6Max = Math.min(mx, Math.round(mn * 1.25 * 100) / 100);
                    const t     = i / 5;
                    const sMax  = Math.round((mx - t * (mx - h6Max)) * 100) / 100;
                    const fac   = mx > 0 ? sMax / mx : 1;
                    return {
                        min:  mn,
                        pref: Math.round(pf * fac * 10) / 10,
                        unit: gUnit.value,
                        max:  sMax,
                    };
                }

                function valuesForLevel(i) {
                    const ov = overrides.value[LEVELS[i]];
                    return ov || autoValues(i);
                }

                function previewSize(v) {
                    const containerPx = 200 + (previewPos.value / 100) * 1000;
                    const fluidRem    = v.pref * containerPx / 100 / 16;
                    return Math.round(Math.min(v.max, Math.max(v.min, fluidRem)) * 100) / 100;
                }

                function clampStr(v) {
                    return `clamp(${v.min}rem, ${v.pref}${v.unit}, ${v.max}rem)`;
                }

                function emitVal() {
                    emit('update:value', {
                        global: { min: gMin.value, pref: gPref.value, unit: gUnit.value, max: gMax.value },
                        overrides: overrides.value,
                    });
                }

                function startEdit(i) {
                    const key = LEVELS[i];
                    if (editingRow.value === key) { editingRow.value = null; return; }
                    const existing = overrides.value[key];
                    const auto     = autoValues(i);
                    editMin.value  = existing ? existing.min  : auto.min;
                    editPref.value = existing ? existing.pref : auto.pref;
                    editUnit.value = existing ? existing.unit : auto.unit;
                    editMax.value  = existing ? existing.max  : auto.max;
                    editingRow.value = key;
                }

                function saveOverride(i) {
                    overrides.value = {
                        ...overrides.value,
                        [LEVELS[i]]: { min: editMin.value, pref: editPref.value, unit: editUnit.value, max: editMax.value },
                    };
                    editingRow.value = null;
                    emitVal();
                }

                function clearOverride(i) {
                    const copy = { ...overrides.value };
                    delete copy[LEVELS[i]];
                    overrides.value = copy;
                    editingRow.value = null;
                    emitVal();
                }

                function pencilSvg() {
                    return h('svg', { width: '13', height: '13', viewBox: '0 0 24 24', class: 'block' }, [
                        h('path', { fill: 'currentColor', d: 'm12.9 6.855l4.242 4.242l-9.9 9.9H3v-4.243zm1.414-1.415l2.121-2.121a1 1 0 0 1 1.414 0l2.829 2.828a1 1 0 0 1 0 1.415l-2.122 2.121z' }),
                    ]);
                }

                return () => {
                    const globalV = clampStr({ min: gMin.value, pref: gPref.value, unit: gUnit.value, max: gMax.value });

                    return h('div', { class: 'flex flex-col gap-2.5' }, [

                        h('div', { class: 'flex items-center gap-2.5 flex-wrap' }, [
                            h('label', { class: 'fluid-ft-label flex items-center gap-1.5 text-[12px]' }, [
                                'Min',
                                h('input', {
                                    type: 'number', value: gMin.value, step: '0.1', min: '0.1',
                                    class: 'cp-input rounded w-[58px] text-[13px] px-1.5 py-[3px] text-right',
                                    onInput: e => { gMin.value = Math.max(0.1, parseFloat(e.target.value) || 0.5); emitVal(); },
                                    onFocus: () => emit('focus'), onBlur: () => emit('blur'),
                                }),
                                h('span', { class: 'fluid-ft-unit text-[11px]' }, 'rem'),
                            ]),
                            h('span', { class: 'fluid-ft-sep' }, '—'),
                            h('label', { class: 'fluid-ft-label flex items-center gap-1.5 text-[12px]' }, [
                                'Fluid',
                                h('input', {
                                    type: 'number', value: gPref.value, step: '0.5', min: '0.1',
                                    class: 'cp-input rounded w-[58px] text-[13px] px-1.5 py-[3px] text-right',
                                    onInput: e => { gPref.value = Math.max(0.1, parseFloat(e.target.value) || 1); emitVal(); },
                                    onFocus: () => emit('focus'), onBlur: () => emit('blur'),
                                }),
                                h('select', {
                                    class: 'cp-input rounded text-[13px] px-[5px] py-[3px] cursor-pointer',
                                    onChange: e => { gUnit.value = e.target.value; emitVal(); },
                                }, UNITS.map(u => h('option', { value: u, selected: gUnit.value === u }, u))),
                            ]),
                            h('span', { class: 'fluid-ft-sep' }, '—'),
                            h('label', { class: 'fluid-ft-label flex items-center gap-1.5 text-[12px]' }, [
                                'Max',
                                h('input', {
                                    type: 'number', value: gMax.value, step: '0.1', min: '0.1',
                                    class: 'cp-input rounded w-[58px] text-[13px] px-1.5 py-[3px] text-right',
                                    onInput: e => { gMax.value = Math.max(0.1, parseFloat(e.target.value) || 1); emitVal(); },
                                    onFocus: () => emit('focus'), onBlur: () => emit('blur'),
                                }),
                                h('span', { class: 'fluid-ft-unit text-[11px]' }, 'rem'),
                            ]),
                            h('code', {
                                class: 'fluid-ft-clamp ml-auto text-[11px] px-2 py-[3px] rounded whitespace-nowrap font-mono'
                            }, globalV),
                        ]),

                        h('div', { class: 'fluid-ft-panel rounded-lg overflow-hidden' }, [
                            h('div', { class: 'fluid-ft-panel-hd flex items-center gap-2 px-3 py-[7px]' }, [
                                h('span', { class: 'fluid-ft-slider-label text-[10px] whitespace-nowrap' }, '← Mobil'),
                                h('input', {
                                    type: 'range', min: '0', max: '100', value: previewPos.value,
                                    class: 'flex-1 accent-blue-500 cursor-pointer h-1',
                                    onInput: e => { previewPos.value = parseInt(e.target.value); },
                                }),
                                h('span', { class: 'fluid-ft-slider-label text-[10px] whitespace-nowrap' }, 'Desktop →'),
                            ]),
                            ...LEVELS.map((key, i) => {
                            const v      = valuesForLevel(i);
                            const hasOvr = !!overrides.value[key];
                            const isEditing = editingRow.value === key;

                            return h('div', {
                                key,
                                class: i < LEVELS.length - 1 ? 'fluid-ft-row-sep' : '',
                            }, [

                                h('div', { class: 'flex items-center px-2.5 py-2.5 gap-2' }, [
                                    h('div', {
                                        class: 'fluid-ft-preview-text flex-1 min-w-0 overflow-hidden',
                                        style: {
                                            fontSize: previewSize(v) + 'rem',
                                            lineHeight: key === 'p' ? '1.6' : '1.1',
                                            fontWeight: key === 'p' ? '400' : '700',
                                            display: '-webkit-box',
                                            WebkitLineClamp: key === 'p' ? '3' : '1',
                                            WebkitBoxOrient: 'vertical',
                                        }
                                    }, PREVIEW[key] || PREVIEW.default),
                                    h('span', {
                                        class: `text-[11px] font-semibold uppercase tracking-[0.05em] shrink-0 ${hasOvr ? 'text-blue-500' : 'fluid-ft-tag'}`
                                    }, key.toUpperCase()),
                                    h('button', {
                                        type: 'button',
                                        title: hasOvr ? 'Tilpasset — klik for at redigere' : 'Overstyr størrelse',
                                        class: `cursor-pointer p-[3px] border-none bg-transparent flex items-center shrink-0 rounded ${isEditing || hasOvr ? 'text-blue-500' : 'fluid-ft-tag'}`,
                                        onClick: () => startEdit(i),
                                    }, pencilSvg()),
                                ]),

                                isEditing ? h('div', {
                                    class: 'fluid-ft-override-panel flex items-center gap-2 px-2.5 pb-2.5 pt-2 flex-wrap'
                                }, [
                                    h('span', { class: 'text-[11px] text-blue-500 font-semibold shrink-0' }, key.toUpperCase() + ' override:'),
                                    h('label', { class: 'fluid-ft-label flex items-center gap-1 text-[11px]' }, [
                                        'Min',
                                        h('input', {
                                            type: 'number', value: editMin.value, step: '0.1', min: '0.1',
                                            class: 'cp-input rounded w-[52px] text-[12px] px-[5px] py-[2px] text-right',
                                            onInput: e => { editMin.value = Math.max(0.1, parseFloat(e.target.value) || 0.1); },
                                            onFocus: () => emit('focus'), onBlur: () => emit('blur'),
                                        }),
                                        h('span', { class: 'fluid-ft-unit text-[10px]' }, 'rem'),
                                    ]),
                                    h('span', { class: 'fluid-ft-override-sep' }, '—'),
                                    h('label', { class: 'fluid-ft-label flex items-center gap-1 text-[11px]' }, [
                                        'Fluid',
                                        h('input', {
                                            type: 'number', value: editPref.value, step: '0.1', min: '0.1',
                                            class: 'cp-input rounded w-[52px] text-[12px] px-[5px] py-[2px] text-right',
                                            onInput: e => { editPref.value = Math.max(0.1, parseFloat(e.target.value) || 0.1); },
                                            onFocus: () => emit('focus'), onBlur: () => emit('blur'),
                                        }),
                                        h('select', {
                                            class: 'cp-input rounded text-[12px] px-1 py-[2px] cursor-pointer',
                                            onChange: e => { editUnit.value = e.target.value; },
                                        }, UNITS.map(u => h('option', { value: u, selected: editUnit.value === u }, u))),
                                    ]),
                                    h('span', { class: 'fluid-ft-override-sep' }, '—'),
                                    h('label', { class: 'fluid-ft-label flex items-center gap-1 text-[11px]' }, [
                                        'Max',
                                        h('input', {
                                            type: 'number', value: editMax.value, step: '0.1', min: '0.1',
                                            class: 'cp-input rounded w-[52px] text-[12px] px-[5px] py-[2px] text-right',
                                            onInput: e => { editMax.value = Math.max(0.1, parseFloat(e.target.value) || 0.1); },
                                            onFocus: () => emit('focus'), onBlur: () => emit('blur'),
                                        }),
                                        h('span', { class: 'fluid-ft-unit text-[10px]' }, 'rem'),
                                    ]),
                                    h('code', {
                                        class: 'fluid-ft-override-code text-[10px] px-1.5 py-[2px] rounded font-mono whitespace-nowrap'
                                    }, `clamp(${editMin.value}rem, ${editPref.value}${editUnit.value}, ${editMax.value}rem)`),
                                    h('div', { class: 'flex gap-1.5 ml-auto' }, [
                                        hasOvr ? h('button', {
                                            type: 'button',
                                            class: 'text-[12px] px-2.5 py-[3px] bg-transparent text-red-500 border border-red-300 rounded cursor-pointer',
                                            onClick: () => clearOverride(i),
                                        }, 'Nulstil') : null,
                                        h('button', {
                                            type: 'button',
                                            class: 'text-[12px] px-2.5 py-[3px] bg-blue-500 text-white border-none rounded cursor-pointer font-medium',
                                            onClick: () => saveOverride(i),
                                        }, 'Gem'),
                                    ]),
                                ]) : null,
                            ]);
                        })]),
                    ]);
                };
            },
        });

        Statamic.$components.register('fluid-size-fieldtype', {
            props: {
                value:  { default: null },
                meta:   { type: Object, default: () => ({}) },
                config: { type: Object, default: () => ({}) },
            },
            emits: ['update:value', 'focus', 'blur'],
            setup(props, { emit }) {
                const { ref, computed, inject, onMounted } = window.Vue;

                const MIN_VP = 320;

                const CW_MAP = {
                    '64em':     { px: 1024, label: 'XS / 1024px' },
                    '71.25em':  { px: 1140, label: 'Small / 1140px' },
                    '75em':     { px: 1200, label: 'Medium / 1200px' },
                    '80em':     { px: 1280, label: 'Large / 1280px' },
                    '85.375em': { px: 1366, label: 'XL / 1366px' },
                    '100%':     { px: 1920, label: 'Full width' },
                };

                const DEFAULT_SIZES = [
                    { handle: 'size-100', min: 15,  max: 16  },
                    { handle: 'size-200', min: 16,  max: 18  },
                    { handle: 'size-300', min: 18,  max: 22  },
                    { handle: 'size-400', min: 21,  max: 26  },
                    { handle: 'size-500', min: 24,  max: 34  },
                    { handle: 'size-600', min: 31,  max: 44  },
                    { handle: 'size-700', min: 38,  max: 56  },
                    { handle: 'size-800', min: 48,  max: 70 },
                    { handle: 'size-900', min: 60,  max: 86 },
                    { handle: 'size-1000', min: 72,  max: 110 },
                    { handle: 'size-1100', min: 84, max: 135 },
                    { handle: 'size-1200', min: 90, max: 150 },
                ].map((s, i) => ({ ...s, id: `default-${i}` }));

                const publishContext = inject('PublishContainerContext', null);

                const containerWidthKey = computed(() => {
                    try {
                        const cw = publishContext?.values?.value?.container_width;
                        if (cw && CW_MAP[cw]) return cw;
                    } catch {}
                    return props.meta?.container_width || '75em';
                });

                const maxVP          = computed(() => CW_MAP[containerWidthKey.value]?.px ?? 1200);
                const containerLabel = computed(() => CW_MAP[containerWidthKey.value]?.label ?? 'Medium / 1200px');

                function parseValue(val) {
                    const existingMap = (val && typeof val === 'object' && val.sizes)
                        ? val.sizes.reduce((m, s) => (m[s.handle] = s, m), {})
                        : {};
                    const sizes = DEFAULT_SIZES.map(d => ({
                        ...d,
                        min: existingMap[d.handle]?.min ?? d.min,
                        max: existingMap[d.handle]?.max ?? d.max,
                    }));
                    return { unit: (val && val.unit) || 'vw', sizes };
                }

                const p     = parseValue(props.value);
                const unit  = ref(p.unit);
                const sizes = ref(p.sizes);

                function computeClamp(minPx, maxPx) {
                    const range  = maxVP.value - MIN_VP;
                    const minRem = Math.round(minPx / 16 * 10000) / 10000;
                    const maxRem = Math.round(maxPx / 16 * 10000) / 10000;
                    if (range <= 0 || Math.abs(maxPx - minPx) < 0.01) return `${minRem}rem`;
                    const slope      = (maxPx - minPx) / range;
                    const intPx      = minPx - slope * MIN_VP;
                    const slopeFluid = Math.round(slope * 100 * 10000) / 10000;
                    const intRem     = Math.round(intPx / 16 * 10000) / 10000;
                    return `clamp(${minRem}rem, ${intRem}rem + ${slopeFluid}${unit.value}, ${maxRem}rem)`;
                }

                function emitVal() {
                    emit('update:value', {
                        max_viewport: maxVP.value,
                        unit: unit.value,
                        sizes: sizes.value,
                    });
                }

                function updateSize(i, field, val) {
                    sizes.value = sizes.value.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
                    emitVal();
                }

                function resetSizes() {
                    sizes.value = DEFAULT_SIZES.map(d => ({ ...d }));
                    emitVal();
                }

                onMounted(() => { props.value ? emit('update:value', props.value) : emitVal(); });

                const hoveredClamp = ref(null);
                const tooltipPos   = ref({ x: 0, y: 0 });

                return () => {
                    const allMax     = sizes.value.reduce((a, s) => Math.max(a, parseFloat(s.max) || 0), 32);
                    const isModified = sizes.value.some((s, i) => s.min !== DEFAULT_SIZES[i]?.min || s.max !== DEFAULT_SIZES[i]?.max);

                    return h('div', { class: 'flex flex-col gap-2.5' }, [

                        h('div', { class: 'fluid-sz-info flex items-center gap-2.5 flex-wrap px-3 py-2 rounded-md' }, [
                            h('span', { class: 'fluid-sz-label text-[12px]' }, [
                                'Viewport: ',
                                h('strong', { class: 'fluid-sz-strong' }, `${MIN_VP}px`),
                                h('span', { class: 'fluid-sz-muted mx-[5px]' }, '→'),
                                h('strong', { class: 'fluid-sz-strong' }, `${maxVP.value}px`),
                                h('span', { class: 'fluid-sz-muted text-[11px] ml-[5px]' }, `(Container: ${containerLabel.value})`),
                            ]),
                            h('label', { class: 'fluid-sz-label flex items-center gap-1.5 text-[12px] ml-auto' }, [
                                'Enhed',
                                h('select', {
                                    class: 'cp-input rounded text-[13px] px-1.5 py-1 cursor-pointer',
                                    onChange: e => { unit.value = e.target.value; emitVal(); },
                                }, ['vw', 'cqi'].map(u => h('option', { value: u, selected: unit.value === u }, u))),
                            ]),
                            h('button', {
                                type: 'button',
                                class: 'text-[12px] px-2.5 py-1 rounded cursor-pointer border-none transition-all',
                                style: isModified ? {
                                    background: 'var(--theme-color-primary)',
                                    color: '#ffffff',
                                } : {
                                    background: 'transparent',
                                    color: 'var(--theme-color-gray-400)',
                                    border: '1px solid currentColor',
                                },
                                onClick: resetSizes,
                            }, 'Nulstil'),
                        ]),

                        h('div', { class: 'fluid-sz-table rounded-lg overflow-hidden' }, [
                            h('div', {
                                class: 'fluid-sz-table-hd grid px-3 py-[6px]',
                                style: { gridTemplateColumns: '72px 1fr 72px' },
                            }, [
                                h('span', { class: 'fluid-sz-th text-[11px] font-semibold' }, '@min'),
                                h('span', { class: 'fluid-sz-th text-[11px] font-bold text-center' }, 'Visualisation'),
                                h('span', { class: 'fluid-sz-th text-[11px] font-semibold text-right' }, '@max'),
                            ]),
                            ...sizes.value.map((s, i) => {
                                const minPx  = parseFloat(s.min) || 0;
                                const maxPx  = parseFloat(s.max) || 0;
                                const labelH       = 18;
                                const barH         = maxPx;
                                const minHeightPct = Math.round(minPx / Math.max(maxPx, 1) * 100);

                                return h('div', {
                                    key: s.id || i,
                                    class: `grid items-start gap-3 px-3 py-3 ${i < sizes.value.length - 1 ? 'fluid-sz-row-sep' : ''}`,
                                    style: { gridTemplateColumns: '72px 1fr 72px' },
                                }, [
                                    h('div', { class: 'flex flex-col' }, [
                                        h('span', {
                                            class: 'fluid-sz-th text-[10px] font-semibold leading-none',
                                            style: { height: labelH + 'px', display: 'flex', alignItems: 'flex-start' },
                                        }, s.handle.replace('size-', 'Size ')),
                                        h('input', {
                                            type: 'number', value: s.min, step: '1', min: '1',
                                            class: 'cp-input rounded text-[13px] px-[6px] py-1.5 w-full text-center',
                                            onInput: e => updateSize(i, 'min', parseFloat(e.target.value) || 1),
                                            onFocus: () => emit('focus'), onBlur: () => emit('blur'),
                                        }),
                                    ]),

                                    h('div', {
                                        class: 'relative',
                                        style: { height: (barH + labelH) + 'px' },
                                    }, [
                                        h('span', {
                                            class: 'absolute top-0 left-0 text-[10px] font-semibold pointer-events-none leading-none',
                                            style: { color: 'var(--theme-color-primary)' },
                                        }, `${minPx}px`),
                                        h('span', {
                                            class: 'absolute top-0 right-0 text-[10px] font-semibold pointer-events-none leading-none',
                                            style: { color: 'var(--theme-color-primary)' },
                                        }, `${maxPx}px`),

                                        h('div', {
                                            class: 'absolute left-0 right-0',
                                            style: { top: labelH + 'px', height: barH + 'px' },
                                        }, [
                                            h('div', {
                                                class: 'absolute top-0 bottom-0 cursor-default',
                                                style: {
                                                    left: (minPx + 2) + 'px',
                                                    right: (maxPx + 2) + 'px',
                                                    background: 'linear-gradient(to right, color-mix(in oklch, var(--theme-color-primary), transparent 65%), color-mix(in oklch, var(--theme-color-primary), transparent 78%))',
                                                    clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% ${minHeightPct}%)`,
                                                },
                                                onMouseenter: (e) => {
                                                    hoveredClamp.value = computeClamp(minPx, maxPx);
                                                    const r = e.currentTarget.getBoundingClientRect();
                                                    tooltipPos.value = { x: r.left + r.width / 2, y: r.bottom + 6 };
                                                },
                                                onMouseleave: () => { hoveredClamp.value = null; },
                                            }),
                                            h('div', {
                                                class: 'absolute top-0 left-0',
                                                style: {
                                                    width: minPx + 'px',
                                                    height: minPx + 'px',
                                                    background: 'color-mix(in oklch, var(--theme-color-primary), transparent 25%)',
                                                    borderRadius: '2px',
                                                },
                                            }),
                                            h('div', {
                                                class: 'absolute top-0 right-0',
                                                style: {
                                                    width: maxPx + 'px',
                                                    height: maxPx + 'px',
                                                    background: 'color-mix(in oklch, var(--theme-color-primary), transparent 25%)',
                                                    borderRadius: '2px',
                                                },
                                            }),
                                        ]),
                                    ]),

                                    h('input', {
                                        type: 'number', value: s.max, step: '1', min: '1',
                                        class: 'cp-input rounded text-[13px] px-[6px] py-1.5 w-full text-center',
                                        style: { marginTop: labelH + 'px' },
                                        onInput: e => updateSize(i, 'max', parseFloat(e.target.value) || 1),
                                        onFocus: () => emit('focus'), onBlur: () => emit('blur'),
                                    }),
                                ]);
                            }),
                        ]),

                        hoveredClamp.value ? h('div', {
                            class: 'fluid-sz-clamp-tip',
                            style: {
                                left: tooltipPos.value.x + 'px',
                                top:  tooltipPos.value.y + 'px',
                            },
                        }, hoveredClamp.value) : null,
                    ]);
                };
            },
        });

        Statamic.$components.register('fluid-font-preview-fieldtype', {
            props: {
                value:  { default: null },
                meta:   { type: Object, default: () => ({}) },
                config: { type: Object, default: () => ({}) },
            },
            emits: ['update:value', 'focus', 'blur'],
            setup(props, { emit }) {
                const { inject, computed, ref, watchEffect } = window.Vue;

                const LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'];
                const PREVIEW = {
                    default: 'Den hurtige ræv hopper over den dovne hund',
                    p: 'Her er et eksempel på, hvordan en brødtekst vil se ud med den valgte skriftstørrelse. God læsbarhed er afgørende for brugeroplevelsen, og den rette linjehøjde og størrelse gør teksten behagelig at læse.',
                };

                const publishContext = inject('PublishContainerContext', null);

                const adobeKits = computed(() => publishContext?.values?.value?.adobe_kits || []);

                watchEffect(() => {
                    adobeKits.value.forEach(kit => {
                        const url = kit?.url;
                        if (!url) return;
                        const id = 'cp-adobe-kit-' + url.replace(/[^a-z0-9]/gi, '');
                        if (!document.getElementById(id)) {
                            const link = document.createElement('link');
                            link.rel  = 'stylesheet';
                            link.id   = id;
                            link.href = url;
                            document.head.appendChild(link);
                        }
                    });
                });

                const fluidSizes = computed(() => {
                    const fs = publishContext?.values?.value?.fluid_sizes;
                    if (!fs) return [];

                    let rawSizes = fs.sizes;
                    if (!rawSizes || typeof rawSizes !== 'object') return [];
                    if (!Array.isArray(rawSizes)) rawSizes = Object.values(rawSizes);
                    if (rawSizes.length === 0) return [];

                    const minVP = 320;
                    const maxVP = parseFloat(fs.max_viewport) || 1200;
                    const unit  = fs.unit || 'vw';
                    const range = maxVP - minVP;

                    return rawSizes
                        .filter(s => s && s.handle)
                        .map(s => {
                            const minPx  = parseFloat(s.min) || 16;
                            const maxPx  = parseFloat(s.max) || 16;
                            const minRem = Math.round(minPx / 16 * 10000) / 10000;
                            const maxRem = Math.round(maxPx / 16 * 10000) / 10000;

                            let preferred;
                            if (range > 0 && Math.abs(maxPx - minPx) > 0.001) {
                                const slope       = (maxPx - minPx) / range;
                                const interceptPx = minPx - slope * minVP;
                                const slopeFluid  = Math.round(slope * 100 * 10000) / 10000;
                                const intRem      = Math.round(interceptPx / 16 * 10000) / 10000;
                                preferred = `${intRem}rem + ${slopeFluid}${unit}`;
                            } else {
                                preferred = `${minRem}rem`;
                            }

                            return {
                                handle: s.handle,
                                clamp:  `clamp(${minRem}rem, ${preferred}, ${maxRem}rem)`,
                                minPx,
                                maxPx,
                            };
                        });
                });

                const DEFAULTS = props.config?.defaults || {};

                function parseValue(val) {
                    if (val && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length > 0) {
                        return { ...val };
                    }
                    return { ...DEFAULTS };
                }

                const selected     = ref(parseValue(props.value));
                const previewPos   = ref(100);
                const previewText  = ref('Vi skaber retning i jeres brand – så jeres markeds­føring virker.');

                const headingFont  = computed(() => publishContext?.values?.value?.font_family?.headings || null);
                const headingUpper = computed(() => !!publishContext?.values?.value?.font_family?.headings_uppercase);
                const baseFont     = computed(() => publishContext?.values?.value?.font_family?.base || null);

                const headingFVS = computed(() => {
                    const wdth = publishContext?.values?.value?.font_family?.heading_wdth;
                    const ital = publishContext?.values?.value?.font_family?.heading_ital;
                    const parts = [];
                    if (wdth) parts.push(`'wdth' ${wdth}`);
                    if (ital) parts.push(`'ital' 1`);
                    return parts.length ? parts.join(', ') : null;
                });
                const baseFVS = computed(() => {
                    const wdth = publishContext?.values?.value?.font_family?.base_wdth;
                    const ital = publishContext?.values?.value?.font_family?.base_ital;
                    const parts = [];
                    if (wdth) parts.push(`'wdth' ${wdth}`);
                    if (ital) parts.push(`'ital' 1`);
                    return parts.length ? parts.join(', ') : null;
                });

                const LEGACY_FW = { 'font-light': '300', 'font-regular': '400', 'font-medium': '500', 'font-semibold': '600', 'font-bold': '700' };
                function resolveWeight(val, fallback) {
                    if (val == null) return fallback;
                    const s = String(val);
                    if (/^\d+$/.test(s)) return s;
                    return LEGACY_FW[s] || fallback;
                }
                const headingWeight = computed(() => resolveWeight(publishContext?.values?.value?.font_family?.headline_font_weight, '700'));
                const baseWeight    = computed(() => resolveWeight(publishContext?.values?.value?.font_family?.base_font_weight, '400'));

                const customFonts = computed(() => publishContext?.values?.value?.custom_fonts || []);

                function extractFontFamily(filename) {
                    const stem = filename.replace(/\.[^.]+$/, '').replace(/\s*\(\d+\)$/, '').trim();
                    if (/icon|symbol|awesome|material/i.test(stem)) return '';
                    const suffixes = ['VariableFont','Variable','ExtraLight','UltraLight','ExtraBold','UltraBold',
                        'SemiBold','DemiBold','Thin','Light','Regular','Normal','Medium','Bold','Black','Heavy',
                        'Italic','Oblique','Expanded','Narrow','wght','ital'];
                    const pattern = new RegExp('[-_ ](' + suffixes.join('|') + ').*$', 'i');
                    return stem.replace(pattern, '').replace(/[-_]?[1-9]00$/, '').trim();
                }

                function buildFontFaceCSS(rows) {
                    return rows
                        .filter(f => f.file && !String(f.file).startsWith('{'))
                        .map(f => {
                            const family = extractFontFamily(String(f.file));
                            if (!family) return '';
                            const format = f.variable ? 'woff2-variations' : 'woff2';
                            const weight = f.variable ? '100 900' : (f.weight || '400');
                            const encoded = String(f.file).split('/').map(encodeURIComponent).join('/');
                            return `@font-face{font-family:"${family}";src:url("/fonts/${encoded}") format("${format}");font-weight:${weight};font-display:swap;}`;
                        })
                        .join('');
                }

                function getOrCreateFontStyle() {
                    let style = document.getElementById('cp-custom-fonts');
                    if (!style) {
                        style = document.createElement('style');
                        style.id = 'cp-custom-fonts';
                        document.head.appendChild(style);
                    }
                    return style;
                }

                // Injecter gemte fonte straks (fra preload)
                getOrCreateFontStyle().textContent = buildFontFaceCSS(props.meta?.customFonts || []);

                // Opdater reaktivt ved formændringer — brug preload-fonte som fallback
                watchEffect(() => {
                    const rows = customFonts.value && customFonts.value.length
                        ? customFonts.value
                        : (props.meta?.customFonts || []);
                    getOrCreateFontStyle().textContent = buildFontFaceCSS(rows);
                });

                function setSize(level, handle) {
                    selected.value = { ...selected.value, [level]: handle };
                    emit('update:value', { ...selected.value });
                }

                function getPreviewRem(level) {
                    const handle = selected.value[level];
                    if (!handle) return null;
                    const sz = fluidSizes.value.find(s => s.handle === handle);
                    if (!sz) return null;

                    const fs    = publishContext?.values?.value?.fluid_sizes;
                    const minVP = 320;
                    const maxVP = parseFloat(fs?.max_viewport) || 1200;
                    const vp    = minVP + (previewPos.value / 100) * (maxVP - minVP);
                    const range = maxVP - minVP;

                    if (range <= 0 || Math.abs(sz.maxPx - sz.minPx) < 0.001) {
                        return (sz.minPx / 16) + 'rem';
                    }
                    const slope    = (sz.maxPx - sz.minPx) / range;
                    const fluidPx  = sz.minPx + slope * (vp - minVP);
                    const clampedPx = Math.min(sz.maxPx, Math.max(sz.minPx, fluidPx));
                    return (Math.round(clampedPx / 16 * 100) / 100) + 'rem';
                }

                return () => {
                    const sizes = fluidSizes.value;

                    return h('div', { class: 'fluid-ft-panel rounded-lg overflow-hidden' }, [

                        h('div', { class: 'fluid-ft-panel-hd flex flex-col gap-2 px-3 pt-2.5 pb-[7px]' }, [
                            h('input', {
                                type: 'text',
                                value: previewText.value,
                                placeholder: 'Skriv preview-tekst…',
                                class: 'cp-input rounded text-[13px] px-2.5 py-[5px] w-full',
                                onInput: e => { previewText.value = e.target.value; },
                                onFocus: () => emit('focus'),
                                onBlur:  () => emit('blur'),
                            }),
                            h('div', { class: 'flex items-center gap-2' }, [
                                h('span', { class: 'fluid-ft-slider-label text-[10px] whitespace-nowrap' }, '← Mobil'),
                                h('input', {
                                    type: 'range', min: '0', max: '100', value: previewPos.value,
                                    class: 'flex-1 cursor-pointer h-1',
                                    style: { accentColor: 'var(--theme-color-primary)' },
                                    onInput: e => { previewPos.value = parseInt(e.target.value); },
                                }),
                                h('span', { class: 'fluid-ft-slider-label text-[10px] whitespace-nowrap' }, 'Desktop →'),
                            ]),
                        ]),

                        ...LEVELS.map((key, i) => {
                            const fontSize      = getPreviewRem(key);
                            const currentHandle = selected.value[key] || '';

                            return h('div', {
                                key,
                                class: i < LEVELS.length - 1 ? 'fluid-ft-row-sep' : '',
                            }, [
                                h('div', { class: 'flex items-center px-2.5 py-4 gap-2' }, [
                                    h('div', {
                                        class: 'fluid-ft-preview-text flex-1 min-w-0 overflow-hidden',
                                        style: {
                                            fontSize:              fontSize || null,
                                            lineHeight:            key === 'p' ? '1.6' : '1.25',
                                            fontWeight:            key === 'p' ? baseWeight.value : headingWeight.value,
                                            fontFamily:            key === 'p' ? (baseFont.value || null) : (headingFont.value || null),
                                            fontVariationSettings: key === 'p' ? (baseFVS.value || null) : (headingFVS.value || null),
                                            textTransform:         (key !== 'p' && headingUpper.value) ? 'uppercase' : null,
                                            display:               '-webkit-box',
                                            WebkitLineClamp:       key === 'p' ? '3' : '1',
                                            WebkitBoxOrient:       'vertical',
                                        },
                                    }, key === 'p' ? PREVIEW.p : (previewText.value || PREVIEW.default)),
                                    h('span', {
                                        class: 'text-[11px] font-semibold uppercase tracking-[0.05em] shrink-0 fluid-ft-tag',
                                    }, key.toUpperCase()),
                                    h('select', {
                                        class: 'cp-input rounded text-[12px] px-[5px] py-[2px] cursor-pointer shrink-0',
                                        onChange: e => { setSize(key, e.target.value); emit('focus'); },
                                        onFocus: () => emit('focus'),
                                        onBlur:  () => emit('blur'),
                                    }, [
                                        h('option', { value: '', selected: !currentHandle }, '— ingen —'),
                                        ...sizes.map(sz => h('option', {
                                            value:    sz.handle,
                                            selected: sz.handle === currentHandle,
                                        }, sz.handle)),
                                    ]),
                                ]),
                            ]);
                        }),
                    ]);
                };
            },
        });

    });

    // ── Font Family Selector fieldtype ───────────────────────────────────────
    Statamic.$components.register('font-family-selector-fieldtype', {
        props: {
            value:  { default: null },
            meta:   { type: Object, default: () => ({}) },
            config: { type: Object, default: () => ({}) },
        },
        emits: ['update:value'],
        setup(props, { emit }) {
            const { computed } = window.Vue;
            const fonts = props.meta.fonts || [];
            const toLabel = f => f.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const options = computed(() => {
                const list = (props.value && !fonts.includes(props.value))
                    ? [props.value, ...fonts]
                    : fonts;
                return list.map(f => ({ label: toLabel(f), value: f }));
            });
            return { options, emit };
        },
        template: `
            <ui-combobox
                :options="options"
                :model-value="value"
                :searchable="true"
                :clearable="true"
                placeholder="— Vælg font —"
                @update:modelValue="emit('update:value', $event)"
            />
        `
    });

    // ── Font Uploader fieldtype ───────────────────────────────────────────────
    Statamic.$components.register('font-uploader-fieldtype', {
        props: {
            value:  { default: null },
            meta:   { type: Object, default: () => ({}) },
            config: { type: Object, default: () => ({}) },
        },
        emits: ['update:value'],
        setup(props, { emit }) {
            const { ref, computed } = window.Vue;
            const error = ref(null);
            const fileInput = ref(null);

            function stemName(filename) {
                return filename
                    .replace(/\.[^.]+$/, '')
                    .replace(/\s*\(\d+\)$/, '')
                    .trim();
            }

            const displayName = computed(() => {
                if (!props.value) return null;
                if (props.value.startsWith('{')) {
                    try { return stemName(JSON.parse(props.value).filename ?? ''); } catch { return null; }
                }
                return stemName(props.value);
            });

            function selectFile(event) {
                const file = event.target.files[0];
                if (!file) return;
                event.target.value = '';
                const allowed = ['woff2', 'woff', 'ttf', 'otf'];
                const ext = file.name.split('.').pop()?.toLowerCase();
                if (!allowed.includes(ext)) {
                    error.value = 'Ugyldig filtype (.woff2 / .woff / .ttf / .otf)';
                    setTimeout(() => { error.value = null; }, 4000);
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    emit('update:value', JSON.stringify({ filename: file.name, data: e.target.result }));
                };
                reader.readAsDataURL(file);
            }

            return { error, selectFile, displayName, fileInput };
        },
        template: `
            <div class="flex items-center gap-2">
                <input ref="fileInput" type="file" class="sr-only" accept=".woff2,.woff,.ttf,.otf" @change="selectFile">
                <template v-if="displayName">
                    <span class="font-medium">{{ displayName }}</span>
                    <ui-button variant="ghost" size="sm" text="Erstat" @click="fileInput.click()" />
                </template>
                <ui-button v-else variant="primary" text="Vælg font-fil" @click="fileInput.click()" />
                <span v-if="error" class="text-sm text-red">{{ error }}</span>
            </div>
        `
    });

}());
