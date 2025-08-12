export class BinaryDetector {
    isBinary(buffer: Buffer): boolean {
        // Check first 1KB for binary indicators
        const sampleSize = Math.min(1024, buffer.length);
        const sample = buffer.subarray(0, sampleSize);

        // Check for null bytes
        if (sample.includes(0)) {
            return true;
        }

        // Check for high ratio of control characters
        let controlChars = 0;
        for (let i = 0; i < sample.length; i++) {
            const byte = sample[i];
            // Control characters (excluding common whitespace: \t, \n, \r)
            if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte === 127) {
                controlChars++;
            }
        }

        const controlRatio = controlChars / sample.length;
        return controlRatio > 0.3; // More than 30% control chars = binary
    }
}
