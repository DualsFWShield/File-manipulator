/**
 * Animator - Handles automation of parameters.
 */
export class Animator {
    constructor(imageProcessor) {
        this.processor = imageProcessor;
        this.automations = []; // { target: 'effectId.paramName', type: 'sine', speed: 1, min: 0, max: 1 }
        this.startTime = Date.now();
        this.isPlaying = false;

        // Hook into the render loop
        // We override the requestRender or just loop ourselves

        this.setupUI();
    }

    setupUI() {
        const ui = this.processor.ui;
        const group = ui.createModuleGroup("ANIMATION STATION", (enabled) => {
            this.isPlaying = enabled;
            if (enabled) this.loop();
        });

        // Add "Add Automation" button
        const btn = document.createElement('button');
        btn.innerHTML = "+ ADD LFO";
        btn.className = "btn btn-secondary";
        btn.style.width = "100%";
        btn.onclick = () => this.addLFO(group.content);
        group.content.appendChild(btn);
    }

    addLFO(container) {
        // Create a mini form to bind an LFO to a parameter
        const div = document.createElement('div');
        div.className = "control-item";
        div.style.border = "1px solid var(--border-light)";
        div.style.padding = "5px";
        div.style.marginTop = "5px";

        // 1. Select Target Effect
        // We need to flatten parameters: "dither_v1.contrast", "glitch_v1.rgbShift"
        const targets = [];
        this.processor.pipeline.forEach(eff => {
            for (let key in this.processor.state[eff.id]) {
                targets.push({ label: `${eff.name} > ${key}`, value: `${eff.id}.${key}` });
            }
        });

        const select = document.createElement('select');
        targets.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.value;
            opt.textContent = t.label;
            select.appendChild(opt);
        });
        div.appendChild(select);

        // 2. Waveform
        const wave = document.createElement('select');
        ['sine', 'triangle', 'saw', 'noise'].forEach(w => {
            const o = document.createElement('option');
            o.value = w; o.textContent = w.toUpperCase();
            wave.appendChild(o);
        });
        div.appendChild(wave);

        // 3. Speed Slider
        const speed = document.createElement('input');
        speed.type = 'range'; speed.min = 0.1; speed.max = 5; speed.step = 0.1; speed.value = 1;
        div.appendChild(speed);

        // 4. Intensity (Min/Max would be better, but let's do Amplitude)
        const amp = document.createElement('input');
        amp.type = 'range'; amp.min = 0; amp.max = 100; amp.value = 10;
        div.appendChild(amp);

        // Save automation config
        const auto = {
            id: Date.now(),
            target: select.value,
            type: wave.value,
            speed: parseFloat(speed.value),
            amp: parseFloat(amp.value),
            baseValue: 0 // Will be set on first run
        };

        // Listeners to update
        select.onchange = (e) => auto.target = e.target.value;
        wave.onchange = (e) => auto.type = e.target.value;
        speed.oninput = (e) => auto.speed = parseFloat(e.target.value);
        amp.oninput = (e) => auto.amp = parseFloat(e.target.value);

        this.automations.push(auto);
        container.appendChild(div);

        if (!this.isPlaying) {
            this.isPlaying = true;
            this.loop();
        }
    }

    loop() {
        if (!this.isPlaying) return;

        const now = (Date.now() - this.startTime) / 1000;

        this.automations.forEach(auto => {
            const [effId, param] = auto.target.split('.');

            // Get current base value? No, LFO usually oscillates AROUND a base, or 0->1
            // Let's assume the current UI value is the base.
            // Actually, writing BACK to the parameters will move the sliders if bound properly?
            // If we access processor state directly

            let val = 0;
            const s = auto.speed;
            const a = auto.amp;

            if (auto.type === 'sine') val = Math.sin(now * s) * a;
            else if (auto.type === 'triangle') val = Math.abs((now * s) % 2 - 1) * a;
            else if (auto.type === 'noise') val = (Math.random() - 0.5) * a;

            // Apply to param
            // Issue: We need the BASE value.
            // Hack: Just ADD to the base value found in State?
            // If we just add, it will explode because we add to the PREVIOUS frame's value.
            // We need to store an "initial" value or assume the Slider value is the center.
            // Let's grab the value that was set by the User (which effectively *is* the state).
            // Complex. Simplified approach: LFO replaces value.

            let base = 0; // Default
            // Ideally we read the 'default' or 'center' from the UI slider, but we don't have access easily.
            // Let's just oscillate between 0 and Amp.

            const finalVal = Math.abs(val); // Unipolar for now easier

            if (this.processor.state[effId]) {
                this.processor.state[effId][param] = finalVal;
            }
        });

        this.processor.render();
        requestAnimationFrame(() => this.loop());
    }
}
