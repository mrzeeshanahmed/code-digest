"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenEstimator = void 0;
class TokenEstimator {
    estimate(text) {
        // Simple heuristic: tokens ≈ words * 1.3
        const words = text.split(/\s+/).filter(word => word.length > 0).length;
        const tokens = Math.floor(words * 1.3);
        return this.humanizeNumber(tokens);
    }
    humanizeNumber(num) {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        }
        else if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}k`;
        }
        else {
            return num.toString();
        }
    }
}
exports.TokenEstimator = TokenEstimator;
//# sourceMappingURL=tokens.js.map