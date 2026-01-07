/**
 * VOID - Corruption Suite Logic
 */

// === FAKE FILE MAKER ===
const btnFake = document.getElementById('btn-fake-gen');
const statusFake = document.getElementById('fake-status');

btnFake.addEventListener('click', () => {
    try {
        const sizeVal = parseFloat(document.getElementById('fake-size').value);
        const unit = document.getElementById('fake-unit').value;
        const name = document.getElementById('fake-name').value || 'fake.bin';

        let bytes = 0;
        if (unit === 'KB') bytes = sizeVal * 1024;
        else if (unit === 'MB') bytes = sizeVal * 1024 * 1024;
        else if (unit === 'GB') bytes = sizeVal * 1024 * 1024 * 1024;

        if (bytes <= 0) {
            alert("Size must be positive.");
            return;
        }

        // Limit for browser safety? 
        // 1GB Blob might crash some tabs, but user asked for it.
        // We can create it via chunks if needed, but simple Array/Blob is easiest for V1.
        // Creating a 1GB buffer array is heavy.

        statusFake.textContent = "Generating buffer...";

        // Use a simpler approach for large files: repeat a small buffer?
        // Or just new Blob([new Uint8Array(bytes)])? 
        // Allocating huge array might fail.
        // Better: Array of chunks.

        const chunkSize = 1024 * 1024 * 10; // 10MB chunks
        const chunks = [];
        let remaining = bytes;

        while (remaining > 0) {
            const currentSize = Math.min(remaining, chunkSize);
            // Filled with zeros is fine for "fake corrupt file" (headers missing = corrupt)
            // Or we can fill with random garbage if we want "noise".
            // Since it's "Fake File Maker" (corrupted), random is cooler but specific pattern works too.
            // Zeros are fast.
            const chunk = new Uint8Array(currentSize);
            // Optional: Randomize start to kill header
            if (chunks.length === 0 && currentSize > 100) {
                for (let i = 0; i < 100; i++) chunk[i] = Math.floor(Math.random() * 255);
            }
            chunks.push(chunk);
            remaining -= currentSize;
        }

        const blob = new Blob(chunks, { type: 'application/octet-stream' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);

        statusFake.textContent = `Generated ${name} (${formatBytes(bytes)})`;

    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
        statusFake.textContent = "Error";
    }
});


// === CORRUPTOR ===
const btnCorrupt = document.getElementById('btn-corrupt-gen');
const inputCorrupt = document.getElementById('corrupt-input');
const inputAmt = document.getElementById('corrupt-amt');
const labelAmt = document.getElementById('corrupt-val');
const statusCorrupt = document.getElementById('corrupt-status');

inputAmt.addEventListener('input', (e) => {
    labelAmt.textContent = e.target.value + '%';
});

btnCorrupt.addEventListener('click', () => {
    if (!inputCorrupt.files.length) {
        alert("Please select a file first.");
        return;
    }

    const file = inputCorrupt.files[0];
    const percentage = parseFloat(inputAmt.value); // 0.1 to 5

    statusCorrupt.textContent = "Reading file...";

    const reader = new FileReader();
    reader.onload = (e) => {
        statusCorrupt.textContent = "Corrupting bytes...";

        const buffer = e.target.result;
        const view = new Uint8Array(buffer);
        const len = view.length;

        // Calculate number of bytes to screw up
        const targetCount = Math.floor(len * (percentage / 100));

        // Random replacement
        for (let i = 0; i < targetCount; i++) {
            const idx = Math.floor(Math.random() * len);
            view[idx] = Math.floor(Math.random() * 255);
        }

        // Create Blob
        statusCorrupt.textContent = "Packing...";
        const blob = new Blob([view], { type: file.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "CORRUPTED_" + file.name;
        a.click();
        URL.revokeObjectURL(url);

        statusCorrupt.textContent = "Done.";
    };
    reader.readAsArrayBuffer(file);
});


// Utility
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
