export const BlurEffect = {
    name: "LENS BLUR",
    id: "blur_v1",

    params: {
        enabled: false,
        amount: 0 // 0 - 20px
    },

    getControls: (builder, params, onUpdate) => {
        const group = builder.createModuleGroup("OPTICAL BLUR", (enabled) => onUpdate('enabled', enabled));
        group.addSlider("STRENGTH", 0, 20, params.amount, 0.5, (v) => onUpdate('amount', v));
    },

    process: (ctx, width, height, params) => {
        if (!params.enabled || params.amount <= 0) return;

        // Use CSS Filter or Context Filter for speed!
        // Note: 'filter' property is supported in modern canvas

        ctx.save();
        ctx.filter = `blur(${params.amount}px)`;
        // Convert to temp, clear, draw back
        // Actually, filter applies to DRAWING commands.
        // So we need to redraw the canvas content onto itself?

        const temp = document.createElement('canvas');
        temp.width = width;
        temp.height = height;
        temp.getContext('2d').drawImage(ctx.canvas, 0, 0);

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(temp, 0, 0);

        ctx.restore();
    }
};
