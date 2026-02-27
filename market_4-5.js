/**
 * MARKET BRIDGE QUANTUM MACRO V27 UNIFIED - PARTE 4/5
 * Detección de Trampas MANUAL (Basada en TU INPUT), Adversarial Shield, Microestructura
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTOR DE SEMILLA - Analiza TU secuencia de A/B que introduces manualmente
// ═══════════════════════════════════════════════════════════════════════════════

class SeedChangeDetector {
    constructor() {
        this.historyAnalysis = [];
        this.patterns = new Map();
        this.lastSequenceHash = null;
        this.manipulationScore = 0;
    }
    
    detect(sequence) {
        if (!sequence || sequence.length < 15) return { score: 0, isManipulated: false, details: {} };
        
        const binarySeq = sequence.map(s => s.val === 'A' ? 1 : 0);
        const vals = sequence.map(s => s.val);
        
        // 1. Frecuencia esperada vs real (Chi-square test simplificado)
        const counts = { A: 0, B: 0 };
        vals.forEach(v => { if (v) counts[v]++; });
        const total = vals.length;
        const expected = total / 2;
        const chiSquare = Math.pow(counts.A - expected, 2) / expected + Math.pow(counts.B - expected, 2) / expected;
        const freqAnomaly = chiSquare > 3.84; // p < 0.05
        
        // 2. Test de rachas (Runs Test)
        let runs = 1;
        let maxRun = 1;
        let currentRun = 1;
        for (let i = 1; i < vals.length; i++) {
            if (vals[i] === vals[i-1]) {
                currentRun++;
                maxRun = Math.max(maxRun, currentRun);
            } else {
                runs++;
                currentRun = 1;
            }
        }
        
        const expectedRuns = (2 * counts.A * counts.B) / total + 1;
        const runsVariance = (2 * counts.A * counts.B * (2 * counts.A * counts.B - total)) / (total * total * (total - 1));
        const runsZScore = Math.abs(runs - expectedRuns) / Math.sqrt(runsVariance || 1);
        const runsAnomaly = runsZScore > 1.96 || maxRun > 7; // |z| > 1.96 o racha > 7
        
        // 3. Detección de ciclos (periodicidad en tu secuencia)
        const cycles = this._detectCycles(binarySeq);
        
        // 4. Entropía de Shannon (aleatoriedad)
        const pA = counts.A / total;
        const pB = counts.B / total;
        const entropy = -(pA * Math.log2(pA || 0.001) + pB * Math.log2(pB || 0.001));
        const normalizedEntropy = entropy / 1; // Max entropy = 1 para binario
        const lowEntropy = normalizedEntropy < 0.75;
        
        // 5. Repetición de patrones históricos (¿esta secuencia ya ocurrió?)
        const currentHash = vals.slice(-10).join('');
        const patternRepeat = this._checkPatternRepeat(vals, currentHash);
        
        // Score compuesto (0-1)
        let score = 0;
        if (freqAnomaly) score += 0.20;
        if (runsAnomaly) score += 0.25;
        if (cycles.detected) score += 0.25;
        if (lowEntropy) score += 0.15;
        if (patternRepeat.isRepeating) score += 0.15;
        
        this.manipulationScore = score;
        
        return {
            score: Math.min(1, score),
            isManipulated: score > 0.60,
            details: {
                chiSquare: chiSquare.toFixed(2),
                runsZScore: runsZScore.toFixed(2),
                maxConsecutive: maxRun,
                cycles: cycles.periods.map(p => `P${p.period}(${p.strength.toFixed(2)})`).join(', '),
                entropy: normalizedEntropy.toFixed(3),
                patternRepeat: patternRepeat.repetitionRate.toFixed(2)
            }
        };
    }
    
    _detectCycles(seq) {
        const periods = [];
        const maxPeriod = Math.min(15, Math.floor(seq.length / 3));
        
        for (let p = 2; p <= maxPeriod; p++) {
            let matches = 0;
            for (let i = p; i < seq.length; i++) {
                if (seq[i] === seq[i - p]) matches++;
            }
            const strength = matches / (seq.length - p);
            if (strength > 0.60) periods.push({ period: p, strength });
        }
        
        return {
            detected: periods.length > 0,
            periods: periods.sort((a, b) => b.strength - a.strength).slice(0, 2)
        };
    }
    
    _checkPatternRepeat(fullSeq, currentHash) {
        if (fullSeq.length < 20) return { isRepeating: false, repetitionRate: 0 };
        
        const historical = fullSeq.slice(0, -10).join('');
        const matches = (historical.match(new RegExp(currentHash, 'g')) || []).length;
        
        return {
            isRepeating: matches > 0,
            repetitionRate: matches / (historical.length / 10)
        };
    }
    
    learn(sequence, wasTrap) {
        if (!sequence || sequence.length < 10) return;
        const hash = sequence.slice(-10).map(s => s.val).join('');
        const existing = this.patterns.get(hash) || { count: 0, traps: 0 };
        existing.count++;
        if (wasTrap) existing.traps++;
        this.patterns.set(hash, existing);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTOR DE TEMPO - Analiza TUS tiempos entre clicks (sin WebSocket externo)
// ═══════════════════════════════════════════════════════════════════════════════

class BrokerTempoDetector {
    constructor() {
        this.userTimestamps = [];      // Cuándo hiciste clicks
        this.intervals = [];           // Intervalos entre tus acciones
        this.resultDelays = [];        // "Delay" simulado entre tu click y resultado
        this.patternRegularity = 0;
    }
    
    recordUserAction(timestamp = Date.now()) {
        this.userTimestamps.push(timestamp);
        if (this.userTimestamps.length > 30) this.userTimestamps.shift();
        
        // Calcular intervalo desde última acción
        if (this.userTimestamps.length > 1) {
            const interval = timestamp - this.userTimestamps[this.userTimestamps.length - 2];
            this.intervals.push(interval);
            if (this.intervals.length > 20) this.intervals.shift();
        }
    }
    
    recordResult(timestamp = Date.now()) {
        // En modo manual, simulamos que el resultado "llega" inmediatamente
        // pero registramos el tiempo para análisis de patrón
        this.resultDelays.push(0);
        if (this.resultDelays.length > 20) this.resultDelays.shift();
    }
    
    check() {
        if (this.intervals.length < 5) return { score: 0, isSuspicious: false, details: {} };
        
        const recent = this.intervals.slice(-10);
        
        // 1. Coeficiente de variación (CV) - ¿siempre tardas lo mismo?
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const variance = recent.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recent.length;
        const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
        
        // CV < 0.1 = muy regular (sospechoso para humano)
        // CV > 0.5 = irregular (normal para humano)
        const roboticPattern = cv < 0.15 && mean > 500; // Si tardas >500ms y siempre igual
        
        // 2. Detección de "burst" (rápido lento rápido)
        const acceleration = [];
        for (let i = 2; i < recent.length; i++) {
            const prevChange = recent[i-1] - recent[i-2];
            const currChange = recent[i] - recent[i-1];
            if (Math.sign(prevChange) !== Math.sign(currChange)) {
                acceleration.push(Math.abs(currChange));
            }
        }
        const erratic = acceleration.length > recent.length * 0.6;
        
        // 3. Tiempo absoluto muy corto (< 200ms = posiblemente automatizado)
        const tooFast = recent.some(i => i < 200);
        
        let score = 0;
        if (roboticPattern) score += 0.5;
        if (erratic) score += 0.3;
        if (tooFast) score += 0.2;
        
        return {
            score: Math.min(1, score),
            isSuspicious: score > 0.5,
            details: {
                avgInterval: Math.round(mean),
                cv: cv.toFixed(3),
                robotic: roboticPattern ? 'SI' : 'NO',
                tooFast: tooFast ? 'SI' : 'NO',
                pattern: erratic ? 'ERRATICO' : 'ESTABLE'
            }
        };
    }
    
    reset() {
        this.userTimestamps = [];
        this.intervals = [];
        this.resultDelays = [];
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MICROESTRUCTURA BASADA EN TUS TRADES - Analiza TU comportamiento de trading
// ═══════════════════════════════════════════════════════════════════════════════

class MicrostructureAnalyzer {
    constructor() {
        this.yourTrades = [];          // Tus operaciones: { direction, stake, result, time }
        this.virtualImbalance = 0;     // Sesgo de tus operaciones
        this.trapPatterns = [];        // Patrones donde perdiste
    }
    
    recordYourTrade(direction, stake, timestamp = Date.now()) {
        this.yourTrades.push({
            direction, // 'A' o 'B'
            stake,
            timestamp,
            result: null, // Se llena después con processTradeResult
            wasInverted: false
        });
        
        if (this.yourTrades.length > 50) this.yourTrades.shift();
        this._updateImbalance();
    }
    
    recordResult(result, wasInverted = false) {
        if (this.yourTrades.length === 0) return;
        const last = this.yourTrades[this.yourTrades.length - 1];
        last.result = result;
        last.wasInverted = wasInverted;
        
        // Si perdiste, guardar patrón de trampa
        if (last.direction !== result) {
            this.trapPatterns.push({
                direction: last.direction,
                stake: last.stake,
                time: last.timestamp,
                recentSequence: window.sequence ? window.sequence.slice(-5).map(s => s.val).join('') : ''
            });
            if (this.trapPatterns.length > 20) this.trapPatterns.shift();
        }
    }
    
    _updateImbalance() {
        const recent = this.yourTrades.slice(-10);
        const buyVol = recent.filter(t => t.direction === 'A').reduce((a, b) => a + b.stake, 0);
        const sellVol = recent.filter(t => t.direction === 'B').reduce((a, b) => a + b.stake, 0);
        const total = buyVol + sellVol;
        this.virtualImbalance = total > 0 ? (buyVol - sellVol) / total : 0;
    }
    
    calculateOBI() {
        const recent = this.yourTrades.slice(-10);
        const buyVol = recent.filter(t => t.direction === 'A').reduce((a, b) => a + b.stake, 0);
        const sellVol = recent.filter(t => t.direction === 'B').reduce((a, b) => a + b.stake, 0);
        
        return {
            obi: parseFloat(this.virtualImbalance.toFixed(3)),
            yourBuyVolume: buyVol,
            yourSellVolume: sellVol,
            ratio: sellVol > 0 ? (buyVol / sellVol).toFixed(2) : '∞',
            signal: this.virtualImbalance > 0.3 ? 'TU_BIAS_COMPRA' : 
                    this.virtualImbalance < -0.3 ? 'TU_BIAS_VENTA' : 'EQUILIBRADO'
        };
    }
    
    // DETECCIÓN DE TRAMPA basada en TU historial
    detectSpoofing() {
        const completed = this.yourTrades.filter(t => t.result !== null);
        if (completed.length < 5) return { detected: false, confidence: 0, details: {} };
        
        const recent = completed.slice(-10);
        
        // 1. Tasa de trampas (operaciones que perdiste)
        const traps = recent.filter(t => t.direction !== t.result);
        const trapRate = traps.length / recent.length;
        
        // 2. ¿Tus operaciones grandes siempre pierden? (Cebo)
        const bigTrades = recent.filter(t => t.stake >= 20);
        const bigTraps = bigTrades.filter(t => t.direction !== t.result);
        const bigTrapRate = bigTrades.length > 0 ? bigTraps.length / bigTrades.length : 0;
        
        // 3. ¿Tus últimas operaciones fueron todas contrarias al mercado?
        const last5 = recent.slice(-5);
        const wrongDirection = last5.filter(t => t.direction !== t.result).length;
        const consistentTrap = wrongDirection >= 4;
        
        // 4. Análisis de "cebo": ¿ganas pequeño, pierdes grande?
        const wins = recent.filter(t => t.direction === t.result);
        const losses = recent.filter(t => t.direction !== t.result);
        const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b.stake, 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b.stake, 0) / losses.length : 0;
        const baitPattern = avgLoss > avgWin * 1.5 && wins.length > 0;
        
        // 5. ¿Estás en racha de pérdidas consecutivas?
        let consecutiveLosses = 0;
        for (let i = recent.length - 1; i >= 0; i--) {
            if (recent[i].direction !== recent[i].result) consecutiveLosses++;
            else break;
        }
        
        let score = 0;
        if (trapRate > 0.60) score += 0.30;
        if (bigTrapRate > 0.70) score += 0.25;
        if (consistentTrap) score += 0.25;
        if (baitPattern) score += 0.15;
        if (consecutiveLosses >= 3) score += 0.15;
        
        return {
            detected: score > 0.60,
            confidence: score,
            type: score > 0.80 ? 'CEBO_AGRESIVO' : score > 0.60 ? 'MANIPULACION' : 'NORMAL',
            details: {
                trapRate: (trapRate * 100).toFixed(0) + '%',
                bigTrapRate: (bigTrapRate * 100).toFixed(0) + '%',
                consecutiveLosses: consecutiveLosses,
                baitPattern: baitPattern ? 'SI' : 'NO',
                yourBias: this.virtualImbalance > 0.2 ? 'COMPRADOR' : 
                         this.virtualImbalance < -0.2 ? 'VENDEDOR' : 'NEUTRO'
            }
        };
    }
    
    getImbalanceTrend() {
        if (this.yourTrades.length < 6) return 'INSUFICIENTE';
        
        const firstHalf = this.yourTrades.slice(0, Math.floor(this.yourTrades.length / 2));
        const secondHalf = this.yourTrades.slice(Math.floor(this.yourTrades.length / 2));
        
        const buy1 = firstHalf.filter(t => t.direction === 'A').length;
        const buy2 = secondHalf.filter(t => t.direction === 'A').length;
        
        if (buy2 > buy1 * 1.5) return 'AUMENTANDO_COMPRA';
        if (buy2 < buy1 * 0.5) return 'AUMENTANDO_VENTA';
        return 'ESTABLE';
    }
    
    reset() {
        this.yourTrades = [];
        this.virtualImbalance = 0;
        this.trapPatterns = [];
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXTUAL LABELING ENGINE (existente, optimizado para modo manual)
// ═══════════════════════════════════════════════════════════════════════════════

class ContextualLabelingEngine {
    constructor() {
        this.trapDatabase = [];
        this.normalDatabase = [];
        this.thresholds = { anomaly: 2.0, contextual: 0.7 }; // Umbral ajustado para datos manuales
    }
    
    extractFeatures(window) {
        const vals = window.map(w => w.val);
        const binary = vals.map(v => v === 'A' ? 1 : 0);
        
        // Features basados en tu secuencia manual
        return {
            // Frecuencia relativa
            freqA: vals.filter(v => v === 'A').length / vals.length,
            
            // Racha máxima
            maxStreak: this._maxConsecutive(vals),
            
            // Cambios de dirección
            reversals: this._countReversals(binary),
            
            // "Volatilidad" de tu secuencia (cambios frecuentes)
            volatility: this._calculateVolatility(binary),
            
            // Últimos 3 vs primeros 3 (tendencia)
            trend: this._calculateTrend(binary),
            
            // Timestamp features
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay()
        };
    }
    
    _maxConsecutive(vals) {
        if (vals.length < 2) return 1;
        let max = 1, current = 1;
        for (let i = 1; i < vals.length; i++) {
            if (vals[i] === vals[i-1]) {
                current++;
                max = Math.max(max, current);
            } else {
                current = 1;
            }
        }
        return max;
    }
    
    _countReversals(binary) {
        let count = 0;
        for (let i = 1; i < binary.length; i++) {
            if (binary[i] !== binary[i-1]) count++;
        }
        return count;
    }
    
    _calculateVolatility(binary) {
        if (binary.length < 2) return 0;
        const changes = [];
        for (let i = 1; i < binary.length; i++) {
            changes.push(Math.abs(binary[i] - binary[i-1]));
        }
        const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
        const variance = changes.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / changes.length;
        return Math.sqrt(variance);
    }
    
    _calculateTrend(binary) {
        if (binary.length < 6) return 0;
        const first = binary.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const last = binary.slice(-3).reduce((a, b) => a + b, 0) / 3;
        return last - first;
    }
    
    isAnomaly(features) {
        // Para modo manual, comparamos con distribución esperada de binario aleatorio
        const zScores = {};
        
        // Frecuencia A esperada: 0.5, desviación esperada para n=20: ~0.11
        if (typeof features.freqA === 'number') {
            zScores.freqA = Math.abs(features.freqA - 0.5) / 0.11;
        }
        
        // Racha máxima esperada en secuencia aleatoria: ~log2(n) + 1
        const expectedMaxStreak = Math.log2(20) + 1;
        if (typeof features.maxStreak === 'number') {
            zScores.maxStreak = Math.max(0, features.maxStreak - expectedMaxStreak) / 2;
        }
        
        // Volatilidad esperada para binario: ~0.5
        if (typeof features.volatility === 'number') {
            zScores.volatility = Math.abs(features.volatility - 0.5) / 0.2;
        }
        
        const maxZ = Math.max(...Object.values(zScores));
        return maxZ > this.thresholds.anomaly;
    }
    
    _calculateZScores(features) {
        // Versión simplificada para modo manual
        return {
            freqA: Math.abs((features.freqA || 0.5) - 0.5) * 10,
            maxStreak: (features.maxStreak || 3) / 3,
            volatility: Math.abs((features.volatility || 0.5) - 0.5) * 5
        };
    }
    
    label(window, actualOutcome) {
        const features = this.extractFeatures(window);
        
        // En modo manual, una "trampa" es: predicción ≠ resultado + features anómalos
        const isTrap = actualOutcome === 'LOSS' && this.isAnomaly(features);
        
        if (isTrap) {
            this.trapDatabase.push({ features, timestamp: Date.now() });
        } else {
            this.normalDatabase.push({ features, timestamp: Date.now() });
        }
        
        // Limitar tamaño
        if (this.trapDatabase.length > 200) this.trapDatabase.shift();
        if (this.normalDatabase.length > 500) this.normalDatabase.shift();
        
        return { isTrap, features };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADVERSARIAL SHIELD V27 COMPLETO - MODO MANUAL (funciona con TU INPUT)
// ═══════════════════════════════════════════════════════════════════════════════

class AdversarialShield {
    constructor() {
        console.log('🛡️ [Shield] Constructor llamado - Cargando estado...');
        
        // Intentar cargar estado previo
        const savedState = this._loadState();
        
        this.detectors = {
            anomaly: new ContextualLabelingEngine(),
            seedChange: new SeedChangeDetector(),
            brokerTempo: new BrokerTempoDetector(),
            microstructure: new MicrostructureAnalyzer()
        };
        
        this.votingThreshold = 0.50;
        this.inversionThreshold = 0.65;
        this.lastProjections = [];
        
        // ========== NUEVO: Sistema de Standby Manual ==========
        this.isStandby = false;              // Estado de espera manual
        this.requiresManualReset = false;  // Flag para reset obligatorio
        this.lastTriggerReason = null;       // Razón del último bloqueo
        this.standbyHistory = [];            // Historial de entradas a standby
        
        // Restaurar estado persistido o inicializar nuevo
        if (savedState) {
            console.log('🛡️ [Shield] Estado previo encontrado:', savedState);
            this.inversionHistory = savedState.inversionHistory || [];
            this.consecutiveTraps = savedState.consecutiveTraps || 0;
            this.adaptiveThreshold = savedState.adaptiveThreshold || 0.60;
            this.totalChecks = savedState.totalChecks || 0;
            this.totalTrapsDetected = savedState.totalTrapsDetected || 0;
            this.totalInversions = savedState.totalInversions || 0;
            this.successfulInversions = savedState.successfulInversions || 0;
            
            // ========== NUEVO: Restaurar estado de standby ==========
            this.isStandby = savedState.isStandby || false;
            this.requiresManualReset = savedState.requiresManualReset || false;
            this.lastTriggerReason = savedState.lastTriggerReason || null;
            this.standbyHistory = savedState.standbyHistory || [];
            
            // Restaurar patrones aprendidos del seedChangeDetector
            if (savedState.learnedPatterns) {
                this._restoreLearnedPatterns(savedState.learnedPatterns);
            }
            
            if (this.isStandby) {
                console.log('🛡️ [Shield] ⚠️ Sistema estaba en STANDBY - Requiere reset manual');
            }
        } else {
            console.log('🛡️ [Shield] No hay estado previo, iniciando nuevo');
            this.inversionHistory = [];
            this.consecutiveTraps = 0;
            this.adaptiveThreshold = 0.60;
            this.totalChecks = 0;
            this.totalTrapsDetected = 0;
            this.totalInversions = 0;
            this.successfulInversions = 0;
        }
        
        console.log(`🛡️ [Shield] Inicializado - Inversiones históricas: ${this.inversionHistory.length}, Umbral: ${this.adaptiveThreshold.toFixed(3)}, Standby: ${this.isStandby ? 'SÍ' : 'NO'}`);
    }
    
    /**
     * ========== NUEVO MÉTODO: Entrar en Standby ==========
     * Activa el modo de espera manual después de detección crítica
     */
    enterStandby(reason, details = {}) {
        this.isStandby = true;
        this.requiresManualReset = true;
        
        const triggerInfo = {
            reason: reason,
            details: details,
            timestamp: Date.now(),
            consecutiveTrapsAtTrigger: this.consecutiveTraps,
            confidenceAtTrigger: details.confidence || 0,
            thresholdAtTrigger: this.adaptiveThreshold
        };
        
        this.lastTriggerReason = triggerInfo;
        this.standbyHistory.push(triggerInfo);
        
        // Limitar historial
        if (this.standbyHistory.length > 10) {
            this.standbyHistory.shift();
        }
        
        console.log('🛡️ [Shield] 🔒 STANDBY ACTIVADO');
        console.log('   Razón:', reason);
        console.log('   Confianza:', `${(details.confidence * 100).toFixed(1)}%`);
        console.log('   Trampas consecutivas:', this.consecutiveTraps);
        console.log('   Esperando reset manual...');
        
        this._saveState();
        
        return {
            status: 'STANDBY',
            reason: reason,
            canReset: true,
            requiresManualReset: true,
            timestamp: Date.now(),
            details: triggerInfo
        };
    }
    
    /**
     * ========== NUEVO MÉTODO: Reset Manual ==========
     * Permite al usuario reactivar el escudo manualmente
     */
    manualReset(userConfirmation = {}) {
        // Verificar que realmente se necesita reset
        if (!this.requiresManualReset && !this.isStandby) {
            console.log('🛡️ [Shield] ℹ️ No se requiere reset manual - Sistema activo');
            return { 
                success: false, 
                message: 'No hay standby activo',
                alreadyActive: true 
            };
        }
        
        // Validar confirmación del usuario (opcional pero recomendado)
        if (userConfirmation.confirmed !== true) {
            console.log('🛡️ [Shield] ⚠️ Reset requiere confirmación explícita');
            return {
                success: false,
                message: 'Se requiere confirmación explícita del usuario',
                needsConfirmation: true,
                lastReason: this.lastTriggerReason
            };
        }
        
        // Guardar info del standby que estamos cerrando
        const previousStandby = this.lastTriggerReason;
        
        // Reactivar sistema
        this.isStandby = false;
        this.requiresManualReset = false;
        this.consecutiveTraps = 0; // Resetear contador de trampas
        
        // Ajustar umbral temporalmente para ser más conservador después del reset
        const previousThreshold = this.adaptiveThreshold;
        this.adaptiveThreshold = Math.min(0.75, this.adaptiveThreshold + 0.05);
        
        console.log('🛡️ [Shield] ✅ RESET MANUAL EJECUTADO');
        console.log('   Sistema reactivado');
        console.log('   Umbral ajustado:', `${previousThreshold.toFixed(3)} → ${this.adaptiveThreshold.toFixed(3)}`);
        console.log('   Contador de trampas reseteado a 0');
        
        // Guardar estado
        this._saveState();
        
        return {
            success: true,
            message: 'Escudo reactivado manualmente',
            previousReason: previousStandby,
            newThreshold: this.adaptiveThreshold,
            timestamp: Date.now(),
            recoveryMode: true, // Indica que estamos en modo recuperación
            recoveryDuration: 30000 // 30 segundos de precaución aumentada
        };
    }
    
    /**
     * ========== NUEVO MÉTODO: Verificar necesidad de reset ==========
     */
    needsManualReset() {
        return this.requiresManualReset || this.isStandby;
    }
    
    /**
     * ========== NUEVO MÉTODO: Obtener estado de standby ==========
     */
    getStandbyStatus() {
        if (!this.isStandby) {
            return {
                isStandby: false,
                canOperate: true
            };
        }
        
        return {
            isStandby: true,
            canOperate: false,
            requiresManualReset: this.requiresManualReset,
            reason: this.lastTriggerReason?.reason || 'Desconocido',
            details: this.lastTriggerReason?.details || {},
            triggeredAt: this.lastTriggerReason?.timestamp,
            timeInStandby: Date.now() - (this.lastTriggerReason?.timestamp || Date.now()),
            standbyCount: this.standbyHistory.length,
            history: this.standbyHistory.slice(-5) // Últimos 5 standby
        };
    }
    
    /**
     * ========== MÉTODO MODIFICADO: check() con soporte Standby ==========
     */
    check(prediction, context = {}) {
        this.totalChecks++;
        
        // ========== PRIORIDAD 1: Verificar si estamos en Standby ==========
        if (this.isStandby) {
            console.log(`🛡️ [Shield] Check #${this.totalChecks} - 🔒 STANDBY ACTIVO - Operación bloqueada`);
            
            return {
                isAdversarial: true,
                confidence: 1.0,
                votes: { standby: 1 },
                details: {
                    standby: true,
                    reason: this.lastTriggerReason?.reason || 'Esperando reset manual',
                    triggeredAt: this.lastTriggerReason?.timestamp
                },
                recommendation: 'STANDBY',
                finalDirection: null,
                originalDirection: prediction,
                wasInverted: false,
                reason: `🔒 STANDBY: ${this.lastTriggerReason?.reason || 'Esperando reset manual'}`,
                needsManualReset: true,
                canProceed: false,
                standbyStatus: this.getStandbyStatus(),
                timestamp: Date.now()
            };
        }
        
        const sequence = window.sequence || [];
        
        console.log(`🛡️ [Shield] Check #${this.totalChecks} - Predicción: ${prediction}, Historial inversiones: ${this.inversionHistory.length}`);
        
        // Registrar tu intención de acción
        this.detectors.brokerTempo.recordUserAction();
        
        const votes = { anomaly: 0, seedChange: 0, brokerTempo: 0, microstructure: 0 };
        const details = {};
        
        // 1. DETECTOR ANOMALÍAS
        if (sequence.length >= 10) {
            const window = sequence.slice(-10);
            const features = this.detectors.anomaly.extractFeatures(window);
            if (this.detectors.anomaly.isAnomaly(features)) {
                votes.anomaly = 1;
                details.anomaly = { reason: 'Secuencia anómala detectada', features };
            }
        }
        
        // 2. DETECTOR SEMILLA
        const seedCheck = this.detectors.seedChange.detect(sequence);
        if (seedCheck.isManipulated) {
            votes.seedChange = 1;
            details.seedChange = seedCheck.details;
        }
        
        // 3. DETECTOR TEMPO
        const tempoCheck = this.detectors.brokerTempo.check();
        if (tempoCheck.isSuspicious) {
            votes.brokerTempo = 1;
            details.tempoCheck = tempoCheck.details;
        }
        
        // 4. MICROESTRUCTURA
        const spoofCheck = this.detectors.microstructure.detectSpoofing();
        if (spoofCheck.detected) {
            votes.microstructure = 1;
            details.microstructure = spoofCheck.details;
        }
        
        // Calcular confianza
        const activeDetectors = Object.values(votes).filter(v => v === 1).length;
        const totalDetectors = 4;
        const confidence = activeDetectors / totalDetectors;
        
        console.log(`🛡️ [Shield] Votos: A=${votes.anomaly}, S=${votes.seedChange}, T=${votes.brokerTempo}, M=${votes.microstructure} | Confianza: ${(confidence*100).toFixed(1)}%`);
        
        // ========== LÓGICA DE DECISIÓN CON STANDBY ==========
        
        // CRITERIO PARA STANDBY: 2+ trampas consecutivas con alta confianza
        const shouldEnterStandby = (confidence >= this.adaptiveThreshold && this.consecutiveTraps >= 2) ||
                                   (confidence >= 0.80 && this.consecutiveTraps >= 1);
        
        if (shouldEnterStandby) {
            this.totalTrapsDetected++;
            this.consecutiveTraps++;
            
            console.log(`🛡️ [Shield] 🚨 CRITERIO DE STANDBY ALCANZADO`);
            console.log(`   Confianza: ${(confidence*100).toFixed(1)}%`);
            console.log(`   Trampas consecutivas: ${this.consecutiveTraps}`);
            
            // Entrar en standby en lugar de solo bloquear
            return this.enterStandby(
                `Trampa crítica detectada (${(confidence*100).toFixed(0)}% confianza, ${this.consecutiveTraps} consecutivas)`,
                { 
                    confidence: confidence, 
                    votes: votes, 
                    consecutiveTraps: this.consecutiveTraps,
                    context: context 
                }
            );
        }
        
        // Lógica normal de decisión (sin standby)
        let recommendation = 'PROCEED';
        let finalDirection = prediction;
        let reason = 'Sin indicios de trampa';
        let wasInverted = false;
        
        if (confidence >= this.adaptiveThreshold) {
            this.totalTrapsDetected++;
            this.consecutiveTraps++;
            
            const inversionSuccess = this._calculateInversionSuccess();
            console.log(`🛡️ [Shield] ¡TRAMPA DETECTADA! Éxito histórico inversiones: ${(inversionSuccess*100).toFixed(1)}%, Trampas seguidas: ${this.consecutiveTraps}`);
            
            if (inversionSuccess > 0.55 && this.consecutiveTraps < 2) { // Cambiado a < 2 para entrar en standby antes
                recommendation = 'INVERT';
                finalDirection = prediction === 'A' ? 'B' : 'A';
                wasInverted = true;
                this.totalInversions++;
                reason = `🛡️ TRAMPA ${(confidence*100).toFixed(0)}% - INVIRTIENDO`;
                console.log(`🛡️ [Shield] → DECISIÓN: INVERTIR a ${finalDirection}`);
            } else {
                recommendation = 'BLOCK';
                finalDirection = null;
                reason = `🚫 TRAMPA ${(confidence*100).toFixed(0)}% - BLOQUEADO`;
                console.log(`🛡️ [Shield] → DECISIÓN: BLOQUEAR`);
            }
        } else {
            this.consecutiveTraps = Math.max(0, this.consecutiveTraps - 1);
            console.log(`🛡️ [Shield] → DECISIÓN: PROCEDER`);
        }
        
        // Guardar para aprendizaje
        this.lastProjections.push({
            originalPrediction: prediction,
            finalDirection,
            recommendation,
            confidence,
            votes,
            timestamp: Date.now()
        });
        if (this.lastProjections.length > 30) this.lastProjections.shift();
        
        // Guardar estado automáticamente
        this._saveState();
        
        return {
            isAdversarial: confidence >= this.adaptiveThreshold,
            confidence,
            votes,
            details,
            recommendation,
            finalDirection,
            originalDirection: prediction,
            wasInverted,
            reason,
            consecutiveTraps: this.consecutiveTraps,
            adaptiveThreshold: this.adaptiveThreshold,
            stats: this.getStats(),
            isStandby: false,
            canProceed: recommendation !== 'BLOCK',
            timestamp: Date.now()
        };
    }
    
    /**
     * ========== MÉTODO MODIFICADO: _saveState con standby ==========
     */
    _saveState() {
        try {
            const state = {
                inversionHistory: this.inversionHistory,
                consecutiveTraps: this.consecutiveTraps,
                adaptiveThreshold: this.adaptiveThreshold,
                totalChecks: this.totalChecks,
                totalTrapsDetected: this.totalTrapsDetected,
                totalInversions: this.totalInversions,
                successfulInversions: this.successfulInversions,
                learnedPatterns: this._getLearnedPatterns(),
                
                // ========== NUEVO: Guardar estado de standby ==========
                isStandby: this.isStandby,
                requiresManualReset: this.requiresManualReset,
                lastTriggerReason: this.lastTriggerReason,
                standbyHistory: this.standbyHistory,
                
                timestamp: Date.now()
            };
            localStorage.setItem('v27_shield_state', JSON.stringify(state));
            console.log('🛡️ [Shield] Estado guardado:', {
                inversiones: this.inversionHistory.length,
                trampasConsecutivas: this.consecutiveTraps,
                umbral: this.adaptiveThreshold.toFixed(3),
                standby: this.isStandby ? 'SÍ 🔒' : 'NO ✅'
            });
        } catch (e) {
            console.error('🛡️ [Shield] Error guardando estado:', e);
        }
    }
    
    /**
     * ========== MÉTODO MODIFICADO: reset con standby ==========
     */
    reset() {
        console.log('🛡️ [Shield] REINICIO COMPLETO - Borrando todo el historial incluyendo standby');
        localStorage.removeItem('v27_shield_state');
        
        // Resetear todo incluyendo standby
        this.inversionHistory = [];
        this.consecutiveTraps = 0;
        this.adaptiveThreshold = 0.60;
        this.totalChecks = 0;
        this.totalTrapsDetected = 0;
        this.totalInversions = 0;
        this.successfulInversions = 0;
        this.lastProjections = [];
        
        // ========== NUEVO: Resetear standby ==========
        this.isStandby = false;
        this.requiresManualReset = false;
        this.lastTriggerReason = null;
        this.standbyHistory = [];
        
        // Resetear detectores
        this.detectors.seedChange = new SeedChangeDetector();
        this.detectors.brokerTempo.reset();
        this.detectors.microstructure.reset();
        
        console.log('🛡️ [Shield] ✅ Sistema completamente reseteado y listo para operar');
    }
    
    // ========== MÉTODOS EXISTENTES (sin cambios) ==========
    
    learnResult(originalPrediction, actualResult, wasInverted) {
        console.log(`🛡️ [Shield] Aprendizaje: Pred=${originalPrediction}, Real=${actualResult}, Invertido=${wasInverted}`);
        
        // No aprender si estamos en standby (esperando reset manual)
        if (this.isStandby) {
            console.log('🛡️ [Shield] ℹ️ En standby - Aprendizaje pospuesto hasta reactivación');
            return;
        }
        
        // Enseñar a detector de semilla
        const wasTrap = originalPrediction !== actualResult;
        this.detectors.seedChange.learn(window.sequence || [], wasTrap);
        
        // Registrar en microestructura
        this.detectors.microstructure.recordResult(actualResult, wasInverted);
        
        // Actualizar histórico de inversiones
        if (wasInverted) {
            const success = originalPrediction !== actualResult;
            this.inversionHistory.push(success ? 1 : 0);
            if (this.inversionHistory.length > 20) this.inversionHistory.shift();
            
            if (success) this.successfulInversions++;
            
            console.log(`🛡️ [Shield] Inversión ${success ? 'EXITOSA' : 'FALLIDA'} - Historial: ${this._calculateInversionSuccess().toFixed(2)}`);
            
            this._updateAdaptiveThreshold();
        }
        
        // Enseñar a anomaly detector
        if (window.sequence && window.sequence.length >= 10) {
            this.detectors.anomaly.label(window.sequence.slice(-10), wasTrap ? 'LOSS' : 'WIN');
        }
        
        this._saveState();
    }
    
    _calculateInversionSuccess() {
        if (this.inversionHistory.length < 5) return 0.5;
        const recent = this.inversionHistory.slice(-10);
        return recent.reduce((a, b) => a + b, 0) / recent.length;
    }
    
    _updateAdaptiveThreshold() {
        const success = this._calculateInversionSuccess();
        const oldThreshold = this.adaptiveThreshold;
        this.adaptiveThreshold = 0.50 + (0.20 * (1 - success));
        this.adaptiveThreshold = Math.max(0.45, Math.min(0.75, this.adaptiveThreshold));
        console.log(`🛡️ [Shield] Umbral adaptativo: ${oldThreshold.toFixed(3)} → ${this.adaptiveThreshold.toFixed(3)}`);
    }
    
    recordTrade(direction, stake) {
        // No registrar trades si estamos en standby
        if (this.isStandby) {
            console.log('🛡️ [Shield] ⚠️ Intento de trade en STANDBY - Ignorando');
            return;
        }
        this.detectors.microstructure.recordYourTrade(direction, stake);
        this.detectors.brokerTempo.recordResult();
    }
    
    getStats() {
        const micro = this.detectors.microstructure.calculateOBI();
        return {
            totalChecks: this.totalChecks,
            totalTrapsDetected: this.totalTrapsDetected,
            totalInversions: this.totalInversions,
            successfulInversions: this.successfulInversions,
            inversionSuccessRate: this.inversionHistory.length > 0 ? 
                (this.inversionHistory.reduce((a,b)=>a+b,0) / this.inversionHistory.length) : 0,
            currentThreshold: this.adaptiveThreshold,
            consecutiveTraps: this.consecutiveTraps,
            inversionHistoryLength: this.inversionHistory.length,
            yourBias: micro.signal,
            yourImbalance: micro.obi,
            tempoStatus: this.detectors.brokerTempo.check().isSuspicious ? 'SOSPECHOSO' : 'NORMAL',
            
            // ========== NUEVO: Estadísticas de standby ==========
            isStandby: this.isStandby,
            requiresManualReset: this.requiresManualReset,
            standbyCount: this.standbyHistory.length,
            lastStandbyReason: this.lastTriggerReason?.reason || null,
            
            lastSave: new Date(localStorage.getItem('v27_shield_state') ? 
                JSON.parse(localStorage.getItem('v27_shield_state')).timestamp : Date.now()).toLocaleTimeString()
        };
    }
    
    _loadState() {
        try {
            const saved = localStorage.getItem('v27_shield_state');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Verificar que no sea muy viejo (más de 7 días)
                const age = Date.now() - (parsed.timestamp || 0);
                if (age < 7 * 24 * 60 * 60 * 1000) {
                    return parsed;
                } else {
                    console.log('🛡️ [Shield] Estado muy antiguo, ignorando');
                }
            }
        } catch (e) {
            console.error('🛡️ [Shield] Error cargando estado:', e);
        }
        return null;
    }
    
    _getLearnedPatterns() {
        const patterns = [];
        if (this.detectors && this.detectors.seedChange && this.detectors.seedChange.patterns) {
            for (const [hash, data] of this.detectors.seedChange.patterns.entries()) {
                patterns.push([hash, data]);
            }
        }
        return patterns;
    }
    
    _restoreLearnedPatterns(patterns) {
        if (this.detectors && this.detectors.seedChange && this.detectors.seedChange.patterns) {
            patterns.forEach(([hash, data]) => {
                this.detectors.seedChange.patterns.set(hash, data);
            });
            console.log(`🛡️ [Shield] ${patterns.length} patrones restaurados`);
        }
    }

    
    /**
     * Método principal: Consultar escudo ANTES de operar
     */
    check(prediction, context = {}) {
        this.totalChecks++;
        const sequence = window.sequence || [];
        
        console.log(`🛡️ [Shield] Check #${this.totalChecks} - Predicción: ${prediction}, Historial inversiones: ${this.inversionHistory.length}`);
        
        // Registrar tu intención de acción
        this.detectors.brokerTempo.recordUserAction();
        
        const votes = { anomaly: 0, seedChange: 0, brokerTempo: 0, microstructure: 0 };
        const details = {};
        
        // 1. DETECTOR ANOMALÍAS
        if (sequence.length >= 10) {
            const window = sequence.slice(-10);
            const features = this.detectors.anomaly.extractFeatures(window);
            if (this.detectors.anomaly.isAnomaly(features)) {
                votes.anomaly = 1;
                details.anomaly = { reason: 'Secuencia anómala detectada', features };
            }
        }
        
        // 2. DETECTOR SEMILLA
        const seedCheck = this.detectors.seedChange.detect(sequence);
        if (seedCheck.isManipulated) {
            votes.seedChange = 1;
            details.seedChange = seedCheck.details;
        }
        
        // 3. DETECTOR TEMPO
        const tempoCheck = this.detectors.brokerTempo.check();
        if (tempoCheck.isSuspicious) {
            votes.brokerTempo = 1;
            details.brokerTempo = tempoCheck.details;
        }
        
        // 4. MICROESTRUCTURA
        const spoofCheck = this.detectors.microstructure.detectSpoofing();
        if (spoofCheck.detected) {
            votes.microstructure = 1;
            details.microstructure = spoofCheck.details;
        }
        
        // Calcular confianza
        const activeDetectors = Object.values(votes).filter(v => v === 1).length;
        const totalDetectors = 4;
        const confidence = activeDetectors / totalDetectors;
        
        console.log(`🛡️ [Shield] Votos: A=${votes.anomaly}, S=${votes.seedChange}, T=${votes.brokerTempo}, M=${votes.microstructure} | Confianza: ${(confidence*100).toFixed(1)}%`);
        
        // LÓGICA DE DECISIÓN
        let recommendation = 'PROCEED';
        let finalDirection = prediction;
        let reason = 'Sin indicios de trampa';
        let wasInverted = false;
        
        if (confidence >= this.adaptiveThreshold) {
            this.totalTrapsDetected++;
            this.consecutiveTraps++;
            
            const inversionSuccess = this._calculateInversionSuccess();
            console.log(`🛡️ [Shield] ¡TRAMPA DETECTADA! Éxito histórico inversiones: ${(inversionSuccess*100).toFixed(1)}%, Trampas seguidas: ${this.consecutiveTraps}`);
            
            if (inversionSuccess > 0.55 && this.consecutiveTraps < 3) {
                recommendation = 'INVERT';
                finalDirection = prediction === 'A' ? 'B' : 'A';
                wasInverted = true;
                this.totalInversions++;
                reason = `🛡️ TRAMPA ${(confidence*100).toFixed(0)}% - INVIRTIENDO`;
                console.log(`🛡️ [Shield] → DECISIÓN: INVERTIR a ${finalDirection}`);
            } else {
                recommendation = 'BLOCK';
                finalDirection = null;
                reason = `🚫 TRAMPA ${(confidence*100).toFixed(0)}% - BLOQUEADO`;
                console.log(`🛡️ [Shield] → DECISIÓN: BLOQUEAR`);
            }
        } else {
            this.consecutiveTraps = Math.max(0, this.consecutiveTraps - 1);
            console.log(`🛡️ [Shield] → DECISIÓN: PROCEDER`);
        }
        
        // Guardar para aprendizaje
        this.lastProjections.push({
            originalPrediction: prediction,
            finalDirection,
            recommendation,
            confidence,
            votes,
            timestamp: Date.now()
        });
        if (this.lastProjections.length > 30) this.lastProjections.shift();
        
        // Guardar estado automáticamente
        this._saveState();
        
        return {
            isAdversarial: confidence >= this.adaptiveThreshold,
            confidence,
            votes,
            details,
            recommendation,
            finalDirection,
            originalDirection: prediction,
            wasInverted,
            reason,
            consecutiveTraps: this.consecutiveTraps,
            adaptiveThreshold: this.adaptiveThreshold,
            stats: this.getStats(),
            timestamp: Date.now()
        };
    }
    
    /**
     * Método para llamar DESPUÉS de saber el resultado (aprendizaje)
     */
    learnResult(originalPrediction, actualResult, wasInverted) {
        console.log(`🛡️ [Shield] Aprendizaje: Pred=${originalPrediction}, Real=${actualResult}, Invertido=${wasInverted}`);
        
        // Enseñar a detector de semilla
        const wasTrap = originalPrediction !== actualResult;
        this.detectors.seedChange.learn(window.sequence || [], wasTrap);
        
        // Registrar en microestructura
        this.detectors.microstructure.recordResult(actualResult, wasInverted);
        
        // Actualizar histórico de inversiones
        if (wasInverted) {
            const success = originalPrediction !== actualResult;
            this.inversionHistory.push(success ? 1 : 0);
            if (this.inversionHistory.length > 20) this.inversionHistory.shift();
            
            if (success) this.successfulInversions++;
            
            console.log(`🛡️ [Shield] Inversión ${success ? 'EXITOSA' : 'FALLIDA'} - Historial: ${this._calculateInversionSuccess().toFixed(2)}`);
            
            this._updateAdaptiveThreshold();
        }
        
        // Enseñar a anomaly detector
        if (window.sequence && window.sequence.length >= 10) {
            this.detectors.anomaly.label(window.sequence.slice(-10), wasTrap ? 'LOSS' : 'WIN');
        }
        
        this._saveState();
    }
    
    _calculateInversionSuccess() {
        if (this.inversionHistory.length < 5) return 0.5;
        const recent = this.inversionHistory.slice(-10);
        return recent.reduce((a, b) => a + b, 0) / recent.length;
    }
    
    _updateAdaptiveThreshold() {
        const success = this._calculateInversionSuccess();
        const oldThreshold = this.adaptiveThreshold;
        this.adaptiveThreshold = 0.50 + (0.20 * (1 - success));
        this.adaptiveThreshold = Math.max(0.45, Math.min(0.75, this.adaptiveThreshold));
        console.log(`🛡️ [Shield] Umbral adaptativo: ${oldThreshold.toFixed(3)} → ${this.adaptiveThreshold.toFixed(3)}`);
    }
    
    recordTrade(direction, stake) {
        this.detectors.microstructure.recordYourTrade(direction, stake);
        this.detectors.brokerTempo.recordResult();
    }
    
    getStats() {
        const micro = this.detectors.microstructure.calculateOBI();
        return {
            totalChecks: this.totalChecks,
            totalTrapsDetected: this.totalTrapsDetected,
            totalInversions: this.totalInversions,
            successfulInversions: this.successfulInversions,
            inversionSuccessRate: this.inversionHistory.length > 0 ? 
                (this.inversionHistory.reduce((a,b)=>a+b,0) / this.inversionHistory.length) : 0,
            currentThreshold: this.adaptiveThreshold,
            consecutiveTraps: this.consecutiveTraps,
            inversionHistoryLength: this.inversionHistory.length,
            yourBias: micro.signal,
            yourImbalance: micro.obi,
            tempoStatus: this.detectors.brokerTempo.check().isSuspicious ? 'SOSPECHOSO' : 'NORMAL',
            lastSave: new Date(localStorage.getItem('v27_shield_state') ? 
                JSON.parse(localStorage.getItem('v27_shield_state')).timestamp : Date.now()).toLocaleTimeString()
        };
    }
    
    reset() {
        console.log('🛡️ [Shield] REINICIO COMPLETO - Borrando todo el historial');
        localStorage.removeItem('v27_shield_state');
        this.inversionHistory = [];
        this.consecutiveTraps = 0;
        this.adaptiveThreshold = 0.60;
        this.totalChecks = 0;
        this.totalTrapsDetected = 0;
        this.totalInversions = 0;
        this.successfulInversions = 0;
        this.lastProjections = [];
        this.detectors.seedChange = new SeedChangeDetector();
        this.detectors.brokerTempo.reset();
        this.detectors.microstructure.reset();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISK OVERLAY (existente, sin cambios)
// ═══════════════════════════════════════════════════════════════════════════════

class RiskOverlay {
    constructor() {
        this.ledger = new ImmutableLedger();
        this.metrics = new MetricsExporter();
        this.circuitBreakers = { 
            consecutiveLosses: 0, 
            dailyLoss: 0, 
            lastReset: Date.now(),
            tradeCount: 0
        };
        this.isHalted = false;
        this.firstTrade = true;
        this.initialized = false;
    }
    
    evaluate(position, marketState, portfolio) {
        if (this.firstTrade || !this.initialized) {
            this.initialized = true;
            return { 
                approved: true, 
                checks: this.getDefaultChecks(), 
                halt: false, 
                timestamp: Date.now(),
                reason: 'INITIALIZING'
            };
        }
        
        if (!portfolio || typeof portfolio.equity !== 'number' || isNaN(portfolio.equity)) {
            return { 
                approved: true, 
                checks: this.getDefaultChecks(), 
                halt: false, 
                timestamp: Date.now(),
                reason: 'NO_DATA'
            };
        }
        
        const checks = {
            drawdown: this._checkDrawdown(portfolio),
            volatility: this._checkVolatility(marketState),
            latency: { passed: true, value: 0, limit: 500 },
            exposure: this._checkExposure(position, portfolio),
            circuitBreaker: this._checkCircuitBreakers(),
            minTrades: { passed: this.circuitBreakers.tradeCount >= 3, value: this.circuitBreakers.tradeCount, limit: 3 }
        };
        
        const isSafe = Object.values(checks).every(c => c.passed);
        
        if (!isSafe && !this.isHalted) {
            this._triggerHalt(checks);
        }
        
        this.ledger.append({ position, checks, isSafe, timestamp: Date.now() });
        
        return { approved: isSafe, checks, halt: this.isHalted, timestamp: Date.now() };
    }
    
    getDefaultChecks() {
        return {
            drawdown: { passed: true, value: 0, limit: 0.15 },
            volatility: { passed: true, value: 0, limit: 40 },
            latency: { passed: true, value: 0, limit: 500 },
            exposure: { passed: true, value: 0, limit: 1.0 },
            circuitBreaker: { passed: true, consecutiveLosses: 0, dailyLoss: 0 },
            minTrades: { passed: true, value: 0, limit: 3 }
        };
    }
    
    _checkDrawdown(portfolio) {
        if (!portfolio || !portfolio.peak || portfolio.peak === 0 || !portfolio.equity || isNaN(portfolio.equity)) {
            return { passed: true, value: 0, limit: V27_CONFIG.RISK.MAX_DRAWDOWN };
        }
        
        const peak = portfolio.peak || portfolio.equity || 1000;
        const current = portfolio.equity || 1000;
        const drawdown = peak > 0 ? (peak - current) / peak : 0;
        
        return {
            passed: drawdown < V27_CONFIG.RISK.MAX_DRAWDOWN,
            value: Math.max(0, drawdown),
            limit: V27_CONFIG.RISK.MAX_DRAWDOWN
        };
    }
    
    _checkVolatility(marketState) {
        if (!marketState || typeof marketState.volatility !== 'number' || isNaN(marketState.volatility) || marketState.volatility < 0) {
            return { passed: true, value: 0, limit: V27_CONFIG.RISK.CRISIS_VOL_THRESHOLD, isCrisis: false };
        }
        
        const vol = marketState.volatility;
        
        return {
            passed: vol < V27_CONFIG.RISK.CRISIS_VOL_THRESHOLD,
            value: vol,
            limit: V27_CONFIG.RISK.CRISIS_VOL_THRESHOLD,
            isCrisis: vol >= V27_CONFIG.RISK.CRISIS_VOL_THRESHOLD
        };
    }
    
    _checkExposure(position, portfolio) {
        if (!portfolio || !portfolio.positions || !portfolio.equity || portfolio.equity === 0 || isNaN(portfolio.equity)) {
            return { passed: true, value: 0, limit: V27_CONFIG.RISK.EXPOSURE_MAX };
        }
        
        const totalExposure = portfolio.positions.reduce((sum, p) => sum + Math.abs(p.size || 0), 0);
        const exposureRatio = totalExposure / portfolio.equity;
        
        return {
            passed: exposureRatio < V27_CONFIG.RISK.EXPOSURE_MAX,
            value: exposureRatio,
            limit: V27_CONFIG.RISK.EXPOSURE_MAX
        };
    }
    
    _checkCircuitBreakers() {
        const now = Date.now();
        
        if (now - this.circuitBreakers.lastReset > 86400000) {
            this.circuitBreakers.dailyLoss = 0;
            this.circuitBreakers.consecutiveLosses = 0;
            this.circuitBreakers.lastReset = now;
        }
        
        if (this.circuitBreakers.tradeCount < 3) {
            return {
                passed: true,
                consecutiveLosses: this.circuitBreakers.consecutiveLosses,
                dailyLoss: this.circuitBreakers.dailyLoss,
                reason: 'INSUFFICIENT_TRADES'
            };
        }
        
        const passed = this.circuitBreakers.consecutiveLosses < V27_CONFIG.RISK.CIRCUIT_BREAKER.CONSECUTIVE_LOSSES &&
                      this.circuitBreakers.dailyLoss < V27_CONFIG.RISK.CIRCUIT_BREAKER.DAILY_LOSS_LIMIT;
        
        return {
            passed: passed,
            consecutiveLosses: this.circuitBreakers.consecutiveLosses,
            dailyLoss: this.circuitBreakers.dailyLoss
        };
    }
    
    _triggerHalt(checks) {
        this.isHalted = true;
        console.error('🛑 RISK HALT TRIGGERED:', checks);
        
        setTimeout(() => {
            this.isHalted = false;
            console.log('✅ Risk halt auto-reset');
        }, 5000);
    }
    
    recordOutcome(profit) {
        this.circuitBreakers.tradeCount++;
        this.firstTrade = false;
        
        if (profit < 0) {
            this.circuitBreakers.consecutiveLosses++;
            this.circuitBreakers.dailyLoss += Math.abs(profit);
        } else {
            this.circuitBreakers.consecutiveLosses = 0;
        }
    }
    
    reset() {
        this.circuitBreakers = { 
            consecutiveLosses: 0, 
            dailyLoss: 0, 
            lastReset: Date.now(),
            tradeCount: 0
        };
        this.isHalted = false;
        this.firstTrade = true;
        this.initialized = false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BAYESIAN KELLY (existente)
// ═══════════════════════════════════════════════════════════════════════════════

class BayesianKellyCriterion {
    constructor() {
        this.edgeHistory = [];
        this.payout = V27_CONFIG.TRADING.PAYOUT_DEFAULT;
    }
    
    calculate(edge, variance, confidence = 0.5) {
        const q = 1 - edge;
        const b = this.payout;
        const kellyFull = (edge * b - q) / b;
        const variancePenalty = 1 / (1 + variance * 10);
        const kellyFractional = kellyFull * V27_CONFIG.RISK.KELLY_FRACTION * variancePenalty * confidence;
        
        return {
            full: kellyFull,
            fractional: kellyFractional,
            recommended: Math.max(0, Math.min(kellyFractional, 1.0)),
            variancePenalty,
            confidenceWeight: confidence
        };
    }
    
    updateEdge(outcome, prediction) {
        const wasCorrect = outcome === prediction;
        this.edgeHistory.push(wasCorrect ? 1 : 0);
        if (this.edgeHistory.length > 100) this.edgeHistory.shift();
    }
    
    getCurrentEdge() {
        if (this.edgeHistory.length < 20) return 0.5;
        return this.edgeHistory.reduce((a, b) => a + b, 0) / this.edgeHistory.length;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

window.SeedChangeDetector = SeedChangeDetector;
window.BrokerTempoDetector = BrokerTempoDetector;
window.MicrostructureAnalyzer = MicrostructureAnalyzer;
window.ContextualLabelingEngine = ContextualLabelingEngine;
window.AdversarialShield = AdversarialShield;
window.RiskOverlay = RiskOverlay;
window.BayesianKellyCriterion = BayesianKellyCriterion;

console.log('✅ Parte 4/5 cargada: Escudo Anti-Trampas MANUAL (funciona con TU INPUT)');


