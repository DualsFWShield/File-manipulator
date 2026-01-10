/**
 * ColorQuantizer.js
 * Algorithms: K-Means (Iterative) & Median Cut (Recursive).
 * Use: Reduce 16 million colors to N distinct colors for "Grade" mode.
 */

export class ColorQuantizer {
    constructor() { }

    /**
     * Extract Palette from ImageData
     * @param {ImageData} imageData 
     * @param {number} colorCount (2-256)
     * @param {string} method 'kmeans' or 'mediancut'
     * @returns {Array} Array of [r,g,b]
     */
    static extract(imageData, colorCount, method = 'kmeans') {
        const pixels = ColorQuantizer.samplePixels(imageData, 20000); // 20k samples max for speed

        if (method === 'mediancut') {
            return ColorQuantizer.medianCut(pixels, colorCount);
        } else {
            return ColorQuantizer.kMeans(pixels, colorCount);
        }
    }

    static samplePixels(imageData, maxSamples) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const len = data.length;
        const step = Math.max(1, Math.floor(len / 4 / maxSamples)) * 4;

        const pixels = [];
        for (let i = 0; i < len; i += step) {
            if (data[i + 3] < 128) continue; // Skip transparency
            pixels.push([data[i], data[i + 1], data[i + 2]]);
        }
        return pixels;
    }

    /**
     * K-Means Clustering Algorithm
     * V1: Simple random init, fixed iterations.
     */
    static kMeans(pixels, k) {
        if (pixels.length < k) return pixels;

        // 1. Initialize Centroids (Randomly pick k pixels)
        let centroids = [];
        for (let i = 0; i < k; i++) {
            const idx = Math.floor(Math.random() * pixels.length);
            centroids.push([...pixels[idx]]);
        }

        const iterations = 5; // Low count for realtime performance

        for (let iter = 0; iter < iterations; iter++) {
            // Assign pixels to closest centroid
            const clusters = Array(k).fill().map(() => []);

            for (let i = 0; i < pixels.length; i++) {
                const p = pixels[i];
                let minDist = Infinity;
                let closestIdx = 0;

                for (let c = 0; c < k; c++) {
                    const cent = centroids[c];
                    // Euclidean squared
                    const dist = (p[0] - cent[0]) ** 2 + (p[1] - cent[1]) ** 2 + (p[2] - cent[2]) ** 2;
                    if (dist < minDist) {
                        minDist = dist;
                        closestIdx = c;
                    }
                }
                clusters[closestIdx].push(p);
            }

            // Recalculate Centroids
            let moved = false;
            for (let c = 0; c < k; c++) {
                const cluster = clusters[c];
                if (cluster.length === 0) continue;

                let rSum = 0, gSum = 0, bSum = 0;
                for (let i = 0; i < cluster.length; i++) {
                    rSum += cluster[i][0];
                    gSum += cluster[i][1];
                    bSum += cluster[i][2];
                }

                const newR = Math.round(rSum / cluster.length);
                const newG = Math.round(gSum / cluster.length);
                const newB = Math.round(bSum / cluster.length);

                if (newR !== centroids[c][0] || newG !== centroids[c][1] || newB !== centroids[c][2]) {
                    centroids[c] = [newR, newG, newB];
                    moved = true;
                }
            }
            if (!moved) break;
        }

        return centroids;
    }

    /**
     * Median Cut Algorithm
     * Recursive box splitting. Better for preserving diverse color ranges.
     */
    static medianCut(pixels, k) {
        let buckets = [pixels];

        while (buckets.length < k) {
            // Find bucket with largest channel range
            let maxRange = -1;
            let splitBucketIdx = -1;
            let splitChannel = 0; // 0=R, 1=G, 2=B

            for (let i = 0; i < buckets.length; i++) {
                const bucket = buckets[i];
                if (bucket.length === 0) continue;

                let min = [255, 255, 255], max = [0, 0, 0];
                for (let p of bucket) {
                    for (let c = 0; c < 3; c++) {
                        if (p[c] < min[c]) min[c] = p[c];
                        if (p[c] > max[c]) max[c] = p[c];
                    }
                }

                const rangeR = max[0] - min[0];
                const rangeG = max[1] - min[1];
                const rangeB = max[2] - min[2];

                const bestRange = Math.max(rangeR, rangeG, rangeB);

                if (bestRange > maxRange) {
                    maxRange = bestRange;
                    splitBucketIdx = i;
                    if (rangeR >= rangeG && rangeR >= rangeB) splitChannel = 0;
                    else if (rangeG >= rangeR && rangeG >= rangeB) splitChannel = 1;
                    else splitChannel = 2;
                }
            }

            if (splitBucketIdx === -1) break; // Couldn't split

            // Split
            const bucketToSplit = buckets.splice(splitBucketIdx, 1)[0];

            // Sort by split channel
            bucketToSplit.sort((a, b) => a[splitChannel] - b[splitChannel]);

            const mid = Math.floor(bucketToSplit.length / 2);
            buckets.push(bucketToSplit.slice(0, mid));
            buckets.push(bucketToSplit.slice(mid));
        }

        // Average colors in buckets
        return buckets.map(bucket => {
            if (!bucket || bucket.length === 0) return [0, 0, 0];
            let r = 0, g = 0, b = 0;
            for (let p of bucket) { r += p[0]; g += p[1]; b += p[2]; }
            return [
                Math.round(r / bucket.length),
                Math.round(g / bucket.length),
                Math.round(b / bucket.length)
            ];
        });
    }

    static findClosest(rgb, palette) {
        let min = Infinity;
        let idx = 0;
        // Simple Euclidean
        for (let i = 0; i < palette.length; i++) {
            const p = palette[i];
            const d = (rgb[0] - p[0]) ** 2 + (rgb[1] - p[1]) ** 2 + (rgb[2] - p[2]) ** 2;
            if (d < min) {
                min = d;
                idx = i;
            }
        }
        return palette[idx];
    }
}
