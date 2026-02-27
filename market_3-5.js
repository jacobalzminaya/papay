
/**
 * MARKET BRIDGE QUANTUM MACRO V27 UNIFIED - PARTE 3/5
 * Sistema de Machine Learning: LSTM, Ensemble, Regímenes, Bayesian
 */

class FrozenBackbone {
    constructor() {
        this.model = null;
        this.isFrozen = false;
        this.inputShape = null;
    }
    
    async loadOrBuild(inputShape, weightsUrl = null) {
        this.inputShape = inputShape;
        
        if (weightsUrl && window.tf) {
            try {
                this.model = await tf.loadLayersModel(weightsUrl);
                this.freeze();
                console.log('🧠 [LSTM] Modelo cargado desde URL');
                return this.model;
            } catch (e) {
                console.warn('🧠 [LSTM] No se pudo cargar modelo, construyendo nuevo...');
            }
        }
        
        if (!window.tf) {
            console.warn('🧠 [LSTM] TensorFlow no disponible');
            return null;
        }
        
        console.log('🧠 [LSTM] Construyendo arquitectura LSTM...');
        
        const inputs = tf.input({shape: inputShape});
        
const encoder = tf.layers.lstm({
    units: 32,  // ← Reducido de 128 a 32
    returnState: true,
    name: 'encoder_lstm',
    kernelInitializer: 'glorotUniform',  // ← Más rápido que orthogonal
    recurrentInitializer: 'orthogonal'   // ← Necesario pero con menos unidades
}).apply(inputs);
        
        const [encoderOutput, stateH, stateC] = encoder;
        
const decoder = tf.layers.lstm({
    units: 32,  // ← Reducido de 128 a 32
    returnSequences: true,
    name: 'decoder_lstm'
}).apply(encoderOutput, {initialState: [stateH, stateC]});
        
        const attention = tf.layers.attention().apply([decoder, encoderOutput]);
        
        const dense1 = tf.layers.dense({
            units: 64, 
            activation: 'relu',
            name: 'dense_1'
        }).apply(attention);
        
        const dropout = tf.layers.dropout({
            rate: V27_CONFIG.ML.LSTM.DROPOUT
        }).apply(dense1);
        
        const direction = tf.layers.dense({
            units: 1,
            activation: 'sigmoid',
            name: 'direction'
        }).apply(dropout);
        
        const projection = tf.layers.dense({
            units: 4,
            activation: 'linear',
            name: 'projection'
        }).apply(dropout);
        
        this.model = tf.model({inputs, outputs: [direction, projection]});
        
        this.model.compile({
            optimizer: tf.train.adam(V27_CONFIG.ML.LSTM.LEARNING_RATE),
            loss: {
                direction: 'binaryCrossentropy',
                projection: 'meanSquaredError'
            },
            lossWeights: { direction: 0.7, projection: 0.3 },
            metrics: ['accuracy']
        });
        
        this.freeze();
        console.log('🧠 [LSTM] Modelo construido y congelado');
        return this.model;
    }
    
    freeze() {
        if (!this.model) return;
        this.model.layers.forEach(layer => {
            if (!['direction', 'projection'].includes(layer.name)) {
                layer.trainable = false;
            }
        });
        this.isFrozen = true;
        console.log('🧠 [LSTM] Backbone congelado');
    }
    
    /**
     * Método predict adaptado para BayesianEnsemble
     * Devuelve un número simple (probabilidad 0-1) en lugar de tensores
     */
    predict(input) {
        if (!this.model) {
            console.warn('🧠 [LSTM] Modelo no inicializado, devolviendo 0.5');
            return 0.5;
        }
        
        try {
            console.log('🧠 [LSTM] Prediciendo...');
            
            // Hacer predicción - devuelve [direction, projection]
            const outputs = this.model.predict(input);
            
            // Extraer direction (primera salida)
            const directionTensor = Array.isArray(outputs) ? outputs[0] : outputs;
            
            // Convertir a número
            let probability;
            if (directionTensor && typeof directionTensor.dataSync === 'function') {
                probability = directionTensor.dataSync()[0];
            } else if (typeof directionTensor === 'number') {
                probability = directionTensor;
            } else if (Array.isArray(directionTensor)) {
                probability = directionTensor[0];
            } else {
                probability = 0.5;
            }
            
            console.log('🧠 [LSTM] Probabilidad:', (probability * 100).toFixed(1) + '%');
            
            // Limpiar memoria de tensores
            if (Array.isArray(outputs)) {
                outputs.forEach(t => t && t.dispose && t.dispose());
            } else if (outputs && outputs.dispose) {
                outputs.dispose();
            }
            
            return probability;
            
        } catch (e) {
            console.error('🧠 [LSTM] Error en predict:', e);
            return 0.5;
        }
    }
}

class BayesianEnsemble {
    constructor() {
        this.models = new Map();
        this.priors = new Map();
        this.performances = new Map();
        this.uncertainties = new Map();
    }
    
    addModel(name, model, priorWeight = 1.0) {
        this.models.set(name, model);
        this.priors.set(name, priorWeight);
        this.performances.set(name, { hits: 0, total: 0, recentErrors: [] });
        this.uncertainties.set(name, 1.0);
    }
    
    async predict(data) {
    const predictions = new Map();
    
    for (const [name, model] of this.models) {
        try {
            let prob = 0.5;
            
            if (model && typeof model.predict === 'function') {
                console.log(`🧠 [Ensemble] Llamando modelo ${name}...`);
                
                const rawPred = model.predict(data);
                
                // Manejar diferentes tipos de retorno de forma segura
                if (typeof rawPred === 'number') {
                    prob = rawPred;
                    console.log(`🧠 [Ensemble] ${name} devolvió número: ${prob.toFixed(3)}`);
                } else if (rawPred && typeof rawPred.then === 'function') {
                    // Es una promesa
                    const resolved = await rawPred;
                    prob = typeof resolved === 'number' ? resolved : 
                           (resolved && resolved[0]) || 0.5;
                    console.log(`🧠 [Ensemble] ${name} promesa resuelta: ${prob.toFixed(3)}`);
                } else if (Array.isArray(rawPred)) {
                    prob = rawPred[0];
                    console.log(`🧠 [Ensemble] ${name} array: ${prob.toFixed(3)}`);
                } else if (rawPred && typeof rawPred.dataSync === 'function') {
                    // Es un tensor de TensorFlow
                    const values = rawPred.dataSync();
                    prob = values[0];
                    console.log(`🧠 [Ensemble] ${name} tensor: ${prob.toFixed(3)}`);
                    // Limpiar tensor si es necesario
                    if (rawPred.dispose) rawPred.dispose();
                } else {
                    console.warn(`🧠 [Ensemble] ${name} formato desconocido:`, rawPred);
                    prob = 0.5;
                }
            }
            
            // Asegurar que prob es un número válido
            prob = isNaN(prob) ? 0.5 : Math.max(0, Math.min(1, prob));
            
            const uncertainty = this._calculateUncertainty(prob);
            predictions.set(name, { prob, uncertainty });
            this.uncertainties.set(name, uncertainty);
            
        } catch (e) {
            console.error(`🧠 [Ensemble] Error en modelo ${name}:`, e);
            predictions.set(name, { prob: 0.5, uncertainty: 1.0 });
        }
    }
    
    const weights = this.getWeights();
    
    let ensembleProb = 0;
    let totalWeight = 0;
    
    for (const [name, { prob, uncertainty }] of predictions) {
        const weight = weights.get(name) || 0;
        const precisionWeight = weight * (1 / (1 + uncertainty));
        ensembleProb += prob * precisionWeight;
        totalWeight += precisionWeight;
    }
    
    ensembleProb = totalWeight > 0 ? ensembleProb / totalWeight : 0.5;
    const variance = this._calculateEnsembleVariance(predictions, weights, ensembleProb);
    const calibratedProb = this._temperatureScaling(ensembleProb, V27_CONFIG.ML.ENSEMBLE.TEMPERATURE_BETA);
    
    console.log(`🧠 [Ensemble] Resultado final: ${(calibratedProb*100).toFixed(1)}%`);
    
    return {
        probability: calibratedProb,
        direction: calibratedProb > 0.68 ? 'BUY' : calibratedProb < 0.32 ? 'SELL' : 'NEUTRAL',
        confidence: 1 - Math.sqrt(variance),
        uncertainty: Math.sqrt(variance),
        modelContributions: Object.fromEntries(weights),
        rawPredictions: Object.fromEntries(predictions),
        timestamp: Date.now()
    };
}
    
    getWeights() {
        const weights = new Map();
        let totalPrecision = 0;
        
        for (const [name, performance] of this.performances) {
            const accuracy = performance.total > 0 ? performance.hits / performance.total : 0.5;
            const uncertainty = this.uncertainties.get(name) || 1.0;
            const prior = this.priors.get(name) || 1.0;
            const precision = (accuracy + 0.01) / (uncertainty + 0.01) * prior;
            weights.set(name, precision);
            totalPrecision += precision;
        }
        
        for (const name of weights.keys()) {
            weights.set(name, totalPrecision > 0 ? weights.get(name) / totalPrecision : 1 / weights.size);
        }
        
        return weights;
    }
    
    update(name, predicted, actual) {
        const perf = this.performances.get(name);
        if (!perf) return;
        
        perf.total++;
        const isHit = (predicted === 'BUY' && actual === 'A') || (predicted === 'SELL' && actual === 'B');
        if (isHit) perf.hits++;
        
        perf.recentErrors.push(isHit ? 0 : 1);
        if (perf.recentErrors.length > 50) perf.recentErrors.shift();
        
        if (perf.recentErrors.length > 10) {
            const mean = perf.recentErrors.reduce((a, b) => a + b, 0) / perf.recentErrors.length;
            const variance = perf.recentErrors.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / perf.recentErrors.length;
            this.uncertainties.set(name, Math.sqrt(variance) + 0.1);
        }
    }
    
    _calculateUncertainty(prediction) {
        const p = prediction;
        if (p <= 0 || p >= 1) return 0;
        return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
    }
    
    _calculateEnsembleVariance(predictions, weights, ensembleMean) {
        let variance = 0;
        for (const [name, { prob }] of predictions) {
            const w = weights.get(name) || 0;
            variance += w * Math.pow(prob - ensembleMean, 2);
        }
        return variance;
    }
    
    _temperatureScaling(prob, temperature) {
        const logit = Math.log(prob / (1 - prob));
        const scaledLogit = logit / temperature;
        return 1 / (1 + Math.exp(-scaledLogit));
    }
}

class RegimeDetector {
    constructor() {
        this.currentRegime = 'RANGE';
        this.volatilityHistory = [];
        this.trendHistory = [];
    }
    
    detect(volatility, trend, adx) {
        this.volatilityHistory.push(volatility);
        this.trendHistory.push(trend);
        
        if (this.volatilityHistory.length > 100) {
            this.volatilityHistory.shift();
            this.trendHistory.shift();
        }
        
        const avgVol = this.volatilityHistory.reduce((a, b) => a + b, 0) / this.volatilityHistory.length;
        const volPercentile = this._calculatePercentile(this.volatilityHistory, volatility);
        
        let newRegime = 'RANGE';
        
        if (volPercentile > 0.9 || volatility > V27_CONFIG.RISK.CRISIS_VOL_THRESHOLD) {
            newRegime = 'CRISIS';
        } else if (volPercentile > 0.7) {
            newRegime = 'HIGH_VOL';
        } else if (adx > 30 && Math.abs(trend) > 0.5) {
            newRegime = 'TREND';
        }
        
        if (newRegime !== this.currentRegime) {
            this.currentRegime = newRegime;
        }
        
        return {
            regime: this.currentRegime,
            confidence: this._calculateRegimeConfidence(),
            volatility: avgVol,
            trendStrength: adx,
            timestamp: Date.now()
        };
    }
    
    _calculatePercentile(data, value) {
        const sorted = [...data].sort((a, b) => a - b);
        const index = sorted.findIndex(v => v >= value);
        return index / sorted.length;
    }
    
    _calculateRegimeConfidence() {
        if (this.volatilityHistory.length < 20) return 0.5;
        const recent = this.volatilityHistory.slice(-20);
        const variance = MathUtils.stdDev(recent, recent.length);
        return Math.max(0, Math.min(1, 1 - (variance / 10)));
    }
}

class ProjectionDriftDetector {
    constructor(windowSize = 100, alpha = 0.05) {
        this.errors = [];
        this.windowSize = windowSize;
        this.alpha = alpha;
    }
    
    addError(error) {
        this.errors.push(error);
        if (this.errors.length > this.windowSize * 2) {
            this.errors.shift();
        }
    }
    
    detect() {
        if (this.errors.length < this.windowSize) return false;
        
        const recent = this.errors.slice(-this.windowSize);
        const baseline = this.errors.slice(-this.windowSize * 2, -this.windowSize);
        
        if (baseline.length < this.windowSize) return false;
        
        const ksStatistic = MathUtils.ksTest(recent, baseline);
        const criticalValue = 1.36 / Math.sqrt(this.windowSize);
        
        return ksStatistic > criticalValue;
    }
    
    reset() {
        this.errors = [];
    }
}

window.FrozenBackbone = FrozenBackbone;
window.BayesianEnsemble = BayesianEnsemble;
window.RegimeDetector = RegimeDetector;
window.ProjectionDriftDetector = ProjectionDriftDetector;

console.log('✅ Parte 3/5 cargada: Sistema ML Avanzado');

