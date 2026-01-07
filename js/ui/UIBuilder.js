/**
 * UIBuilder - Generates HTML controls for Effect Parameters.
 */
export class UIBuilder {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    clear() {
        this.container.innerHTML = '';
    }

    /**
     * Create a group of controls for a specific effect/module
     * @param {string} title 
     * @param {Function} onToggle - Optional callback for enable/disable
     */
    addDescription(parent, text) {
        if (!text) return;
        const desc = document.createElement('div');
        desc.className = 'module-description';
        desc.textContent = text;
        desc.style.fontSize = '0.75rem';
        desc.style.color = 'var(--text-dim)';
        desc.style.marginBottom = '10px';
        desc.style.fontStyle = 'italic';
        parent.appendChild(desc);
    }

    createModuleGroup(title, onToggle = null, description = "") {
        const group = document.createElement('div');
        group.className = 'module-group';

        const header = document.createElement('div');
        header.className = 'module-header';

        // Title
        const label = document.createElement('h3');
        label.textContent = title;
        header.appendChild(label);

        // Toggle Switch (CheckBox)
        if (onToggle) {
            const toggle = document.createElement('input');
            toggle.type = 'checkbox';
            toggle.checked = true; // Default ON? Or check params?
            // Issue: if state is OFF, this should be off. 
            // We assume caller handles initial state or we enable by default and let caller sync.
            // Ideally, we pass initial state here.

            toggle.addEventListener('change', (e) => onToggle(e.target.checked));
            header.appendChild(toggle);
        }

        group.appendChild(header);

        const content = document.createElement('div');
        content.className = 'module-content';

        if (description) {
            this.addDescription(content, description);
        }

        group.appendChild(content);
        this.container.appendChild(group);

        return {
            content: content,
            addSlider: (label, min, max, value, step, onChange) => this.addSlider(content, label, min, max, value, step, onChange),
            addSelect: (label, options, value, onChange) => this.addSelect(content, label, options, value, onChange),
            addToggle: (label, value, onChange) => this.addToggle(content, label, value, onChange),
            addColor: (label, value, onChange) => this.addColor(content, label, value, onChange),
            addNumber: (label, value, onChange) => this.addNumber(content, label, value, onChange),
            addDescription: (text) => this.addDescription(content, text)
        };
    }

    addSlider(parent, labelText, min, max, value, step, onChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'control-item control-slider';

        const info = document.createElement('div');
        info.className = 'control-info';

        const label = document.createElement('label');
        label.textContent = labelText;

        const valDisplay = document.createElement('span');
        valDisplay.className = 'control-value';
        valDisplay.textContent = value;

        info.appendChild(label);
        info.appendChild(valDisplay);

        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.value = value;
        input.step = step;

        input.addEventListener('input', (e) => {
            valDisplay.textContent = e.target.value;
            onChange(parseFloat(e.target.value));
        });

        wrapper.appendChild(info);
        wrapper.appendChild(input);
        parent.appendChild(wrapper);
    }

    addSelect(parent, labelText, options, value, onChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'control-item control-select';

        const label = document.createElement('label');
        label.textContent = labelText;

        const select = document.createElement('select');
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label; // || opt.value
            if (opt.value === value) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            onChange(e.target.value);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(select);
        parent.appendChild(wrapper);
    }

    addToggle(parent, labelText, value, onChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'control-item control-toggle';

        const label = document.createElement('label');
        label.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = value;

        input.addEventListener('change', (e) => {
            onChange(e.target.checked);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        parent.appendChild(wrapper);
    }

    addColor(parent, labelText, value, onChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'control-item control-color';

        const label = document.createElement('label');
        label.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'color';
        input.value = value;
        input.style.width = '50px';
        input.style.height = '30px';
        input.style.border = 'none';
        input.style.cursor = 'pointer';

        input.addEventListener('input', (e) => {
            onChange(e.target.value);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        parent.appendChild(wrapper);
    }

    addNumber(parent, labelText, value, onChange) {
        const wrapper = document.createElement('div');
        wrapper.className = 'control-item control-number';

        const label = document.createElement('label');
        label.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'number';
        input.value = value;
        input.style.width = '80px';
        input.className = 'btn-secondary'; // Recycle style
        input.style.padding = '5px';

        input.addEventListener('change', (e) => {
            onChange(parseFloat(e.target.value));
        });

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        parent.appendChild(wrapper);
    }
}
