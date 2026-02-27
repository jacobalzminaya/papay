/**
 * MARKET BRIDGE QUANTUM MACRO V27 UNIFIED - PARTE 1/5
 * Configuración, Utilidades y Clases Base
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN INMUTABLE V27 (Object.freeze)
// ═══════════════════════════════════════════════════════════════════════════════
const V27_CONFIG = Object.freeze({
    VERSION: '27.0.0-ULTIMATE',
    BUILD_DATE: '2026-02-20',
    SECURITY: {
        FLASH_CRASH_THRESHOLD: 0.005, // 0.5% de movimiento en milisegundos
        TIME_WINDOW_MS: 300,          // Ventana de tiempo de detección (muy rápida)
        LOCKOUT_DURATION: 10000       // Si detecta trampa, bloquea 10 segundos
    },

    ML: {
        LSTM: {
            UNITS: 128,
            LAYERS: 3,
            DROPOUT: 0.3,
            LEARNING_RATE: 0.0005,
            WINDOW_SIZE: 30,
            MAX_EPOCHS: 150,
            PATIENCE: 10,
            VALIDATION_SPLIT: 0.2
        },
        CNN: {
            FILTERS: [64, 32, 16],
            KERNEL_SIZE: 3,
            POOL_SIZE: 2
        },
        ENSEMBLE: {
            MODELS: ['lstm', 'cnn', 'technical'],
            WEIGHT_METHOD: 'bayesian',
            TEMPERATURE_BETA: 1.5
        },
        REGIMES: ['TREND', 'RANGE', 'HIGH_VOL', 'CRISIS'],
        BUFFER_SIZE: 10000,
        RETRAIN_THRESHOLD: 500
    },
    
    TECHNICAL: {
        RSI: { PERIOD: 14, OVERBOUGHT: 70, OVERSOLD: 30, DYNAMIC: true },
        MACD: { FAST: 12, SLOW: 26, SIGNAL: 9 },
        BOLLINGER: { PERIOD: 20, STD_DEV: 2 },
        ADX: { PERIOD: 14 },
        ATR: { PERIOD: 14 },
        VWAP: { ENABLED: true }
    },
    
    RISK: {
        MAX_DRAWDOWN: 0.15,
        CRISIS_VOL_THRESHOLD: 40,
        MAX_LATENCY_MS: 500,
        KELLY_FRACTION: 0.5,
        MIN_EDGE: 0.02,
        EXPOSURE_MAX: 1.0,
        EXPOSURE_MIN: 0.05,
        CIRCUIT_BREAKER: {
            CONSECUTIVE_LOSSES: 5,
            DAILY_LOSS_LIMIT: 0.10,
            VOLATILITY_SPIKE: 3.0
        }
    },
    
    TRADING: {
        MIN_BET: 10,
        MAX_MARTINGALE: 2,
        MARTINGALE_MULTIPLIER: 2.2,
        PAYOUT_DEFAULT: 0.85,
        TRAP_THRESHOLD_BASE: 0.65,
        TRAP_THRESHOLD_MIN: 0.45,
        TRAP_THRESHOLD_MAX: 0.85
    },
    
    HEDGE: {
        ENABLED: false,
        ASSETS: ["EURUSD", "BTCUSD", "XAUUSD", "GBPUSD", "USDJPY"],
        RISK_BUDGET: 0.02,
        REBALANCE_FREQ: 24,
        PPO: {
            GAMMA: 0.99,
            LAMBDA: 0.95,
            CLIP_EPSILON: 0.2,
            LEARNING_RATE: 0.0003
        }
    },
    
    INFRA: {
        WORKER_ENABLED: true,
        PROMETHEUS_PORT: 8080,
        LOG_LEVEL: 'INFO',
        LEDGER_HASH_ALGO: 'SHA-256'
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CLASES UTILITARIAS BASE
// ═══════════════════════════════════════════════════════════════════════════════

class ImmutableLedger {
    constructor() {
        this.entries = [];
        this.lastHash = '0'.repeat(64);
    }
    
    append(entry) {
        const timestamp = Date.now();
        const data = JSON.stringify(entry);
        const hash = this._hash(`${this.lastHash}${timestamp}${data}`);
        
        const record = {
            index: this.entries.length,
            timestamp,
            hash,
            previousHash: this.lastHash,
            data: entry
        };
        
        this.entries.push(record);
        this.lastHash = hash;
        return record;
    }
    
    _hash(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).padStart(64, '0');
    }
    
    verify() {
        for (let i = 1; i < this.entries.length; i++) {
            if (this.entries[i].previousHash !== this.entries[i-1].hash) {
                return false;
            }
        }
        return true;
    }
    
    getHistory() {
        return [...this.entries];
    }
}

class MetricsExporter {
    constructor() {
        this.metrics = new Map();
        this.counters = new Map();
        this.histograms = new Map();
    }
    
    counter(name, labels = {}) {
        const key = this._key(name, labels);
        this.counters.set(key, (this.counters.get(key) || 0) + 1);
    }
    
    gauge(name, value, labels = {}) {
        const key = this._key(name, labels);
        this.metrics.set(key, value);
    }
    
    histogram(name, value, labels = {}) {
        const key = this._key(name, labels);
        if (!this.histograms.has(key)) {
            this.histograms.set(key, []);
        }
        this.histograms.get(key).push(value);
    }
    
    _key(name, labels) {
        const labelStr = Object.entries(labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
        return labelStr ? `${name}{${labelStr}}` : name;
    }
}

const MathUtils = {
    sma: (data, period) => {
        if (data.length < period) return null;
        const sum = data.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    },
    
    ema: (data, period) => {
        if (data.length < period) return null;
        const k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    },
    
    stdDev: (data, period) => {
        if (data.length < period) return 0;
        const mean = data.slice(-period).reduce((a, b) => a + b, 0) / period;
        const variance = data.slice(-period).reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        return Math.sqrt(variance);
    },
    
    percentile: (data, p) => {
        const sorted = [...data].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * p);
        return sorted[index];
    },
    
    zScore: (value, mean, std) => {
        return std === 0 ? 0 : (value - mean) / std;
    },
    
    correlation: (x, y) => {
        const n = Math.min(x.length, y.length);
        const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
        const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
        const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
        const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
    },
    
    ksTest: (sample1, sample2) => {
        const all = [...sample1, ...sample2].sort((a, b) => a - b);
        let maxDiff = 0;
        
        for (const point of all) {
            const cdf1 = sample1.filter(x => x <= point).length / sample1.length;
            const cdf2 = sample2.filter(x => x <= point).length / sample2.length;
            maxDiff = Math.max(maxDiff, Math.abs(cdf1 - cdf2));
        }
        
        return maxDiff;
    },
    
    entropy: (probabilities) => {
        return probabilities.reduce((sum, p) => {
            return p > 0 ? sum - p * Math.log2(p) : sum;
        }, 0);
    }
};

window.V27_CONFIG = V27_CONFIG;
window.ImmutableLedger = ImmutableLedger;
window.MetricsExporter = MetricsExporter;
window.MathUtils = MathUtils;

console.log('✅ Parte 1/5 cargada: Configuración y Utilidades Base');

