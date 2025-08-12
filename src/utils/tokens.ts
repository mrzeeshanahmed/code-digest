export class TokenEstimator {
    estimate(text: string): string {
        // Simple heuristic: tokens ≈ words * 1.3
        const words = text.split(/\s+/).filter(word => word.length > 0).length;
        const tokens = Math.floor(words * 1.3);
        
        return this.humanizeNumber(tokens);
    }

    private humanizeNumber(num: number): string {
        if (num >= 1_000_000) {
            return `${(num / 1_000_000).toFixed(1)}M`;
        } else if (num >= 1_000) {
            return `${(num / 1_000).toFixed(1)}k`;
        } else {
            return num.toString();
        }
    }
}
