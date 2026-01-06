/**
 * VOID - Main Controller
 * Handles application state, file loading, and UI orchestration.
 */

import { ImageProcessor } from './imageProcessor.js';
import { AudioProcessor } from './audioProcessor.js';

const STATE = {
    file: null,
    type: null, // 'image' | 'audio' | 'video'
    activeProcessor: null
};

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const exportBtn = document.getElementById('export-btn');
const activeToolStatus = document.getElementById('active-tool-status');
const fileInfoDisplay = document.getElementById('file-info');

// Samples Logic
function loadSample(filename) {
    const path = `samples/${filename}`;
    console.log("Loading sample:", path);

    fetch(path)
        .then(res => res.blob())
        .then(blob => {
            const file = new File([blob], filename, { type: blob.type });
            handleFile(file);
        })
        .catch(err => console.error("Sample not found:", err));
}

// Add Sample Selector to Header
const headerControls = document.querySelector('.header-controls');
const sampleSelect = document.createElement('select');
sampleSelect.innerHTML = `<option value="">LOAD SAMPLE...</option>`;
// Hardcoded list since we can't scan dir client-side easily without server
const samples = [
    'imagesample.png',
    'imagesample.jpg',
    'videosample.mp4',
    'videosample.gif',
    'audiosample.wav',
    'audiosample.mp3'
];
samples.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sampleSelect.appendChild(opt);
});
sampleSelect.style.marginRight = '10px';
sampleSelect.addEventListener('change', (e) => {
    if (e.target.value) loadSample(e.target.value);
});
headerControls.insertBefore(sampleSelect, headerControls.firstChild);


// === Event Listeners ===

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

// Export
exportBtn.addEventListener('click', () => {
    if (STATE.activeProcessor && STATE.activeProcessor.exportResult) {
        STATE.activeProcessor.exportResult();
    }
});

// File Input
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

/**
 * Main File Handler
 * @param {File} file 
 */
function handleFile(file) {
    console.log("Loading file:", file.name, file.type);

    STATE.file = file;
    fileInfoDisplay.textContent = `${file.name} (${formatBytes(file.size)})`; // Helper needed

    // Determine type
    if (file.type.startsWith('image/')) {
        initImageMode(file);
    } else if (file.type.startsWith('audio/')) {
        initAudioMode(file);
    } else if (file.type.startsWith('video/')) {
        initVideoMode(file); // Future implementation
    } else {
        alert("Unsupported file type.");
    }
}

function initImageMode(file) {
    STATE.type = 'image';
    activeToolStatus.textContent = "IMAGE_PROCESSOR_V1";

    // Hide upload prompt
    document.querySelector('.upload-prompt').hidden = true;
    document.getElementById('main-canvas').hidden = false;
    document.getElementById('audio-visualizer').hidden = true;

    console.log("Initializing Image Processor...");

    // Cleanup previous processor if exists
    if (STATE.activeProcessor) {
        // Potential cleanup method call
    }

    STATE.activeProcessor = new ImageProcessor(document.getElementById('main-canvas'));
    STATE.activeProcessor.loadImage(file);
    document.getElementById('export-btn').style.display = 'inline-block';
}

function initAudioMode(file) {
    STATE.type = 'audio';
    activeToolStatus.textContent = "AUDIO_CRUSHER_V1";

    // UI Update
    document.querySelector('.upload-prompt').hidden = true;
    document.getElementById('main-canvas').hidden = true;
    document.getElementById('audio-visualizer').hidden = false;

    // Remove Image-specific buttons if they exist
    ['record-btn', 'quick-btn', 'video-full-btn', 'video-quick-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    // Reset Export Btn Text for Audio context (it gets hidden/replaced? no Main Controller has export-btn)
    // Actually AudioProcessor creates its own Export in UI. 
    // The main header export button is for Image. We should hide it in Audio mode?
    document.getElementById('export-btn').style.display = 'none';

    console.log("Initializing Audio Processor...");

    // Cleanup
    if (STATE.activeProcessor && STATE.activeProcessor.stop) {
        STATE.activeProcessor.stop();
    }

    STATE.activeProcessor = new AudioProcessor();
    STATE.activeProcessor.loadAudio(file);
}

function initVideoMode(file) {
    STATE.type = 'video';
    activeToolStatus.textContent = "VIDEO_PROCESSOR_V1";

    // Hide upload prompt
    document.querySelector('.upload-prompt').hidden = true;
    document.getElementById('main-canvas').hidden = false;
    document.getElementById('audio-visualizer').hidden = true;

    console.log("Initializing Video Processor (via ImageProcessor core)...");

    // Cleanup previous processor
    if (STATE.activeProcessor && STATE.activeProcessor.stop) {
        // Stop audio if running
    }

    // Reuse ImageProcessor but in Video Mode
    STATE.activeProcessor = new ImageProcessor(document.getElementById('main-canvas'));
    STATE.activeProcessor.loadVideo(file);
    document.getElementById('export-btn').style.display = 'inline-block';
}

// === Utilities ===

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

console.log("VOID System Initialized.");
