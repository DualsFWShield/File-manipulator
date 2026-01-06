export class Recorder {
    constructor(canvas, audioNode = null) {
        this.canvas = canvas;
        this.mediaRecorder = null;
        this.chunks = [];
        this.isRecording = false;
        this.stream = null;
    }

    start() {
        this.chunks = [];
        const canvasStream = this.canvas.captureStream(30); // 30 FPS

        // Merge Audio if exists (future)
        this.stream = canvasStream;

        // Codecs: try 'video/webm;codecs=vp9' or 'video/webm;codecs=vp8'
        const options = { mimeType: 'video/webm;codecs=vp9' };

        try {
            this.mediaRecorder = new MediaRecorder(this.stream, options);
        } catch (e) {
            console.warn("VP9 not supported, falling back to default");
            this.mediaRecorder = new MediaRecorder(this.stream);
        }

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.chunks.push(e.data);
        };

        this.mediaRecorder.start();
        this.isRecording = true;
        console.log("Recording started...");
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) return resolve(null);

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: 'video/webm' });
                this.isRecording = false;
                this.stream.getTracks().forEach(track => track.stop()); // Stop stream
                resolve(blob);
            };

            this.mediaRecorder.stop();
        });
    }
}
