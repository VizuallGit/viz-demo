(function () {
    'use strict';

    Statamic.booting(() => {
        Statamic.$components.register('section-preview-fieldtype', {
            props: {
                value:  { default: null },
                meta:   { type: Object, default: () => ({}) },
                config: { type: Object, default: () => ({}) },
            },
            emits: ['update:value', 'update:meta', 'focus', 'blur'],
            template: `
                <div class="sprev-wrap">
                    <img v-if="meta.image_url" :src="meta.image_url" :alt="meta.label" class="sprev-img" />
                    <div v-else class="sprev-empty">Intet preview</div>
                </div>
            `,
        });

        Statamic.$components.register('section-manager-fieldtype', {
            props: {
                value:  { default: null },
                meta:   { type: Object, default: () => ({}) },
                config: { type: Object, default: () => ({}) },
            },
            emits: ['update:value', 'update:meta', 'focus', 'blur'],
            setup(props, { emit }) {
                const { ref, watch, onMounted } = window.Vue;

                const sets = ref((props.meta.sets || []).map(s => ({ ...s })));

                function buildValue() {
                    const val = {};
                    sets.value.forEach(s => {
                        val[s.handle] = { display: s.display, hidden: s.hidden };
                    });
                    return val;
                }

                onMounted(() => emit('update:value', buildValue()));

                watch(sets, () => emit('update:value', buildValue()), { deep: true });

                return { sets };
            },
            template: `
                <div>
                    <div v-for="set in sets" :key="set.handle" class="smgr-item">
                        <div class="smgr-thumb">
                            <img v-if="set.image_url" :src="set.image_url" :alt="set.display" class="smgr-thumb-img" />
                            <div v-else class="smgr-thumb-empty">Intet billede</div>
                        </div>
                        <div class="smgr-meta">
                            <input v-model="set.display" type="text" class="smgr-name-input" :placeholder="set.handle" />
                            <div class="smgr-handle">{{ set.handle }}</div>
                        </div>
                        <div class="smgr-controls">
                            <div
                                @click="set.hidden = !set.hidden"
                                class="smgr-toggle"
                                :style="{background: set.hidden ? 'rgba(128,128,128,0.35)' : '#635bff'}"
                            >
                                <div class="smgr-toggle-knob" :style="{left: set.hidden ? '2px' : '20px'}"></div>
                            </div>
                            <span class="smgr-label">{{ set.hidden ? 'Skjult' : 'Synlig' }}</span>
                        </div>
                    </div>
                </div>
            `,
        });
    });
}());
