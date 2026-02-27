
// ═══════════════════════════════════════════════════════════════════════════════
// QUANTUM MACRO V27 - SISTEMA DE ANÁLISIS MACRO INTEGRAL
// Microestructura + Order Flow + Volume Profile + Flujos Institucionales
// ═══════════════════════════════════════════════════════════════════════════════

class MacroAnalysisEngineV27 {
    constructor() {
        // Configuración del motor macro
        this.config = {
            // Análisis de Microestructura
            microstructure: {
                orderFlowWindow: 20,        // Velas para análisis de flujo
                imbalanceThreshold: 0.65,   // Umbral de desequilibrio compra/venta
                absorptionThreshold: 3,     // Múltiplo de volumen para absorción
                icebergDetection: true,     // Detectar órdenes ocultas
                deltaAnalysis: true         // Análisis de delta (compra - venta)
            },
            
            // Volume Profile
            volumeProfile: {
                rows: 24,                   // Filas del perfil
                valueAreaPercent: 70,       // Porcentaje del área de valor
                pocLookback: 50,           // Velas para calcular POC dinámico
                vwapEnabled: true           // VWAP anclado
            },
            
            // Flujos Institucionales
            institutional: {
                largeOrderThreshold: 100000, // Umbral orden grande (simulado)
                accumulationThreshold: 0.6,  // Umbral de acumulación/distribución
                smartMoneyWindow: 15,        // Ventana para rastrear "smart money"
                ctaTrendThreshold: 0.7       // Umbral para señales CTA/trend-following
            },
            
            // Régimen Macro
            macroRegime: {
                volatilityLookback: 20,
                trendStrengthThreshold: 0.65,
                correlationAssets: ['SPY', 'QQQ', 'IWM', 'VIX', 'DXY', 'GLD']
            },
            
            // Timeframes múltiples
            timeframes: {
                micro: 1,    // 1 tick/vela
                fast: 5,     // 5 velas
                tactical: 15, // 15 velas
                strategic: 30 // 30 velas
            }
        };
        
        // Estado del motor
        this.state = {
            // Datos de microestructura
            orderFlow: {
                bidVolume: [],
                askVolume: [],
                delta: [],
                cumulativeDelta: 0,
                imbalances: [],
                absorptions: [],
                icebergHints: []
            },
            
            // Volume Profile dinámico
            volumeProfile: {
                histogram: new Map(),        // Precio -> Volumen
                poc: null,                   // Point of Control
                valueAreaHigh: null,
                valueAreaLow: null,
                vwap: null,
                highVolumeNodes: [],
                lowVolumeNodes: []
            },
            
            // Flujos institucionales
            institutional: {
                largeOrders: [],
                accumulationScore: 0,        // -100 a 100
                distributionScore: 0,
                smartMoneyIndex: 50,         // 0-100
                ctaPositioning: 'NEUTRAL',   // LONG/SHORT/NEUTRAL
                hedgeFlow: 0                 // Flujo de cobertura
            },
            
            // Régimen actual
            regime: {
                type: 'UNKNOWN',             // TREND_UP, TREND_DOWN, RANGE, HIGH_VOL, CRISIS
                strength: 0,
                volatility: 0,
                liquidity: 0,
                correlation: 0,
                lastChange: Date.now()
            },
            
            // Señales compuestas
            signals: {
                primary: 'NEUTRAL',
                confidence: 0,
                urgency: 'LOW',
                confluence: [],
                contradictions: [],
                expectedMove: null,
                timeHorizon: 'SHORT'
            },
            
            // Historial para ML
            history: []
        };
        
        // Datos OHLCV
        this.data = [];
        
        // Callbacks para integración
        this.onSignalUpdate = null;
        this.onRegimeChange = null;
        
        console.log('[MacroV27] Motor de Análisis Macro Integral inicializado');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // PROCESAMIENTO DE DATOS ENTRANTES
    // ═══════════════════════════════════════════════════════════════════════════════
    
    processTick(ohlcv) {
        if (!ohlcv || !ohlcv.close) return;
        
        // Agregar a dataset
        this.data.push({
            ...ohlcv,
            timestamp: Date.now(),
            id: this.data.length
        });
        
        // Mantener ventana deslizante
        const maxLookback = Math.max(
            this.config.microstructure.orderFlowWindow,
            this.config.volumeProfile.pocLookback,
            this.config.institutional.smartMoneyWindow
        ) * 2;
        
        if (this.data.length > maxLookback) {
            this.data.shift();
        }
        
        // Actualizar todos los módulos
        this.updateOrderFlow();
        this.updateVolumeProfile();
        this.updateInstitutionalFlow();
        this.updateMacroRegime();
        this.generateCompositeSignal();
        
        return this.getCurrentAnalysis();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // MÓDULO 1: ANÁLISIS DE MICROESTRUCTURA Y ORDER FLOW
    // ═══════════════════════════════════════════════════════════════════════════════
    
    updateOrderFlow() {
        if (this.data.length < 3) return;
        
        const recent = this.data.slice(-this.config.microstructure.orderFlowWindow);
        const current = this.data[this.data.length - 1];
        const previous = this.data[this.data.length - 2];
        
        // Calcular delta (presión compradora vs vendedora)
        // Simulado basado en posición del cierre dentro del rango + volumen
        const range = current.high - current.low;
        const position = range > 0 ? (current.close - current.low) / range : 0.5;
        
        // Volumen estimado de compra vs venta
        const buyVolume = current.volume * position;
        const sellVolume = current.volume * (1 - position);
        const delta = buyVolume - sellVolume;
        
        this.state.orderFlow.bidVolume.push(sellVolume);
        this.state.orderFlow.askVolume.push(buyVolume);
        this.state.orderFlow.delta.push(delta);
        this.state.orderFlow.cumulativeDelta += delta;
        
        // Detectar desequilibrios
        const totalVolume = buyVolume + sellVolume;
        const buyRatio = buyVolume / totalVolume;
        
        if (buyRatio > this.config.microstructure.imbalanceThreshold) {
            this.state.orderFlow.imbalances.push({
                type: 'BUY_IMBALANCE',
                strength: (buyRatio - 0.5) * 2, // Normalizar 0-1
                price: current.close,
                volume: buyVolume,
                timestamp: current.timestamp
            });
        } else if (buyRatio < (1 - this.config.microstructure.imbalanceThreshold)) {
            this.state.orderFlow.imbalances.push({
                type: 'SELL_IMBALANCE',
                strength: (0.5 - buyRatio) * 2,
                price: current.close,
                volume: sellVolume,
                timestamp: current.timestamp
            });
        }
        
        // Detectar absorción (volumen alto sin movimiento)
        const avgVolume = recent.slice(0, -1).reduce((a, b) => a + b.volume, 0) / (recent.length - 1);
        const priceChange = Math.abs(current.close - previous.close) / previous.close;
        
        if (current.volume > avgVolume * this.config.microstructure.absorptionThreshold && 
            priceChange < 0.001) {
            this.state.orderFlow.absorptions.push({
                price: current.close,
                volume: current.volume,
                type: delta > 0 ? 'BUY_ABSORPTION' : 'SELL_ABSORPTION',
                timestamp: current.timestamp
            });
        }
        
        // Detectar pistas de iceberg (movimientos repentinos tras consolidación)
        if (this.config.microstructure.icebergDetection && this.data.length > 10) {
            const last10 = this.data.slice(-10);
            const avgRange = last10.slice(0, -1).reduce((a, b) => a + (b.high - b.low), 0) / 9;
            const currentRange = current.high - current.low;
            
            if (currentRange > avgRange * 2 && current.volume < avgVolume * 0.8) {
                this.state.orderFlow.icebergHints.push({
                    price: current.close,
                    direction: current.close > previous.close ? 'UP' : 'DOWN',
                    timestamp: current.timestamp
                });
            }
        }
        
        // Limpiar histórico
        const cutoff = Date.now() - 60000; // 1 minuto
        this.state.orderFlow.imbalances = this.state.orderFlow.imbalances.filter(i => i.timestamp > cutoff);
        this.state.orderFlow.absorptions = this.state.orderFlow.absorptions.filter(a => a.timestamp > cutoff);
        this.state.orderFlow.icebergHints = this.state.orderFlow.icebergHints.filter(h => h.timestamp > cutoff);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // MÓDULO 2: VOLUME PROFILE DINÁMICO
    // ═══════════════════════════════════════════════════════════════════════════════
    
    updateVolumeProfile() {
        if (this.data.length < this.config.volumeProfile.pocLookback) return;
        
        const lookback = this.data.slice(-this.config.volumeProfile.pocLookback);
        
        // Construir histograma de volumen por precio
        const histogram = new Map();
        let totalVolume = 0;
        let vwapNumerator = 0;
        
        // Discretizar precios en niveles
        const priceLevels = new Set();
        lookback.forEach(candle => {
            const levels = [
                this.roundPrice(candle.open),
                this.roundPrice(candle.high),
                this.roundPrice(candle.low),
                this.roundPrice(candle.close)
            ];
            levels.forEach(l => priceLevels.add(l));
        });
        
        // Distribuir volumen en niveles
        lookback.forEach(candle => {
            const typicalPrice = (candle.high + candle.low + candle.close) / 3;
            const level = this.roundPrice(typicalPrice);
            
            const currentVol = histogram.get(level) || 0;
            histogram.set(level, currentVol + candle.volume);
            
            totalVolume += candle.volume;
            vwapNumerator += typicalPrice * candle.volume;
        });
        
        // Encontrar POC (Point of Control)
        let maxVolume = 0;
        let poc = null;
        histogram.forEach((vol, price) => {
            if (vol > maxVolume) {
                maxVolume = vol;
                poc = price;
            }
        });
        
        // Calcular Value Area (70% del volumen)
        const sortedPrices = Array.from(histogram.entries()).sort((a, b) => b[1] - a[1]);
        let volumeSum = 0;
        const valueAreaPrices = [];
        
        for (const [price, vol] of sortedPrices) {
            volumeSum += vol;
            valueAreaPrices.push(price);
            if (volumeSum >= totalVolume * (this.config.volumeProfile.valueAreaPercent / 100)) {
                break;
            }
        }
        
        const valueAreaHigh = Math.max(...valueAreaPrices);
        const valueAreaLow = Math.min(...valueAreaPrices);
        
        // Identificar High/Low Volume Nodes
        const avgVolumePerLevel = totalVolume / histogram.size;
        const highVolumeNodes = [];
        const lowVolumeNodes = [];
        
        histogram.forEach((vol, price) => {
            if (vol > avgVolumePerLevel * 1.5) {
                highVolumeNodes.push({ price, volume: vol, ratio: vol / avgVolumePerLevel });
            } else if (vol < avgVolumePerLevel * 0.3) {
                lowVolumeNodes.push({ price, volume: vol, ratio: vol / avgVolumePerLevel });
            }
        });
        
        // Actualizar estado
        this.state.volumeProfile = {
            histogram,
            poc,
            valueAreaHigh,
            valueAreaLow,
            vwap: vwapNumerator / totalVolume,
            highVolumeNodes: highVolumeNodes.sort((a, b) => b.volume - a.volume).slice(0, 5),
            lowVolumeNodes: lowVolumeNodes.sort((a, b) => a.volume - b.volume).slice(0, 5),
            totalVolume
        };
    }
    
    roundPrice(price) {
        // Redondear a 2 decimales para índices/forex, ajustable
        return Math.round(price * 100) / 100;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // MÓDULO 3: ANÁLISIS DE FLUJOS INSTITUCIONALES
    // ═══════════════════════════════════════════════════════════════════════════════
    
    updateInstitutionalFlow() {
        if (this.data.length < this.config.institutional.smartMoneyWindow) return;
        
        const recent = this.data.slice(-this.config.institutional.smartMoneyWindow);
        const current = this.data[this.data.length - 1];
        
        // Detectar órdenes grandes (simulado por volumen anómalo)
        const avgVolume = recent.slice(0, -1).reduce((a, b) => a + b.volume, 0) / (recent.length - 1);
        const stdVolume = this.calculateStd(recent.slice(0, -1).map(d => d.volume));
        
        if (current.volume > avgVolume + 2 * stdVolume) {
            const direction = current.close > current.open ? 'BUY' : 'SELL';
            this.state.institutional.largeOrders.push({
                volume: current.volume,
                price: current.close,
                direction,
                timestamp: current.timestamp,
                significance: (current.volume - avgVolume) / stdVolume
            });
        }
        
        // Calcular índice de acumulación/distribución
        // Basado en posición del cierre y volumen
        let accumulation = 0;
        let distribution = 0;
        
        recent.forEach(candle => {
            const range = candle.high - candle.low;
            const position = range > 0 ? (candle.close - candle.low) / range : 0.5;
            
            if (position > 0.6 && candle.volume > avgVolume) {
                accumulation += candle.volume * position;
            } else if (position < 0.4 && candle.volume > avgVolume) {
                distribution += candle.volume * (1 - position);
            }
        });
        
        const total = accumulation + distribution;
        if (total > 0) {
            this.state.institutional.accumulationScore = (accumulation / total) * 100;
            this.state.institutional.distributionScore = (distribution / total) * 100;
        }
        
        // Smart Money Index (0-100)
        // Combina delta, volumen relativo y eficiencia de precio
        const deltaFlow = this.state.orderFlow.cumulativeDelta;
        const volumeEfficiency = Math.abs(current.close - recent[0].open) / 
                                (recent.reduce((a, b) => a + (b.high - b.low), 0) / recent.length);
        
        this.state.institutional.smartMoneyIndex = Math.min(100, Math.max(0, 
            50 + (deltaFlow / Math.abs(deltaFlow || 1)) * 30 + 
            (volumeEfficiency - 1) * 20
        ));
        
        // Posicionamiento CTA (trend-following)
        const trend = this.calculateTrend(recent);
        const momentum = this.calculateMomentum(recent);
        
        if (trend > this.config.institutional.ctaTrendThreshold && momentum > 0) {
            this.state.institutional.ctaPositioning = 'LONG';
        } else if (trend < -this.config.institutional.ctaTrendThreshold && momentum < 0) {
            this.state.institutional.ctaPositioning = 'SHORT';
        } else {
            this.state.institutional.ctaPositioning = 'NEUTRAL';
        }
        
        // Flujo de cobertura (hedge flow)
        // Detecta movimientos contrarios al trend principal con alto volumen
        const hedgeSignals = recent.filter((c, i, arr) => {
            if (i === 0) return false;
            const prev = arr[i-1];
            const trendUp = c.close > prev.close;
            const volumeSpike = c.volume > avgVolume * 1.3;
            const againstTrend = (trend > 0 && !trendUp) || (trend < 0 && trendUp);
            return volumeSpike && againstTrend;
        });
        
        this.state.institutional.hedgeFlow = hedgeSignals.length / recent.length;
        
        // Limpiar órdenes antiguas
        const cutoff = Date.now() - 300000; // 5 minutos
        this.state.institutional.largeOrders = this.state.institutional.largeOrders.filter(
            o => o.timestamp > cutoff
        );
    }
    
    calculateTrend(data) {
        if (data.length < 2) return 0;
        const first = data[0].close;
        const last = data[data.length - 1].close;
        return (last - first) / first;
    }
    
    calculateMomentum(data) {
        if (data.length < 5) return 0;
        const short = data.slice(-3).reduce((a, b) => a + b.close, 0) / 3;
        const long = data.slice(-10).reduce((a, b) => a + b.close, 0) / 10;
        return (short - long) / long;
    }
    
    calculateStd(values) {
        if (values.length < 2) return 0;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const squareDiffs = values.map(v => Math.pow(v - avg, 2));
        return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // MÓDULO 4: DETECCIÓN DE RÉGIMEN MACRO
    // ═══════════════════════════════════════════════════════════════════════════════
    
    updateMacroRegime() {
        if (this.data.length < this.config.macroRegime.volatilityLookback) return;
        
        const recent = this.data.slice(-this.config.macroRegime.volatilityLookback);
        
        // Calcular volatilidad (ATR simplificado)
        const ranges = recent.map(d => d.high - d.low);
        const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
        const volatility = avgRange / recent[recent.length - 1].close;
        
        // Calcular fuerza de tendencia (ADX simplificado)
        const dmPlus = [];
        const dmMinus = [];
        
        for (let i = 1; i < recent.length; i++) {
            const up = recent[i].high - recent[i-1].high;
            const down = recent[i-1].low - recent[i].low;
            dmPlus.push(up > down && up > 0 ? up : 0);
            dmMinus.push(down > up && down > 0 ? down : 0);
        }
        
        const avgDmPlus = dmPlus.reduce((a, b) => a + b, 0) / dmPlus.length;
        const avgDmMinus = dmMinus.reduce((a, b) => a + b, 0) / dmMinus.length;
        
        const trendStrength = Math.abs(avgDmPlus - avgDmMinus) / (avgDmPlus + avgDmMinus || 1);
        const trendDirection = avgDmPlus > avgDmMinus ? 1 : -1;
        
        // Calcular liquidez (basado en volumen relativo)
        const volumes = recent.map(d => d.volume);
        const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const currentVolume = recent[recent.length - 1].volume;
        const liquidity = currentVolume / avgVolume;
        
        // Determinar régimen
        let regime = this.state.regime.type;
        let strength = trendStrength;
        
        if (volatility > 0.02) { // Alta volatilidad (>2%)
            if (trendStrength > 0.5) {
                regime = trendDirection > 0 ? 'CRISIS_RECOVERY' : 'CRISIS';
            } else {
                regime = 'HIGH_VOL';
            }
        } else if (trendStrength > this.config.macroRegime.trendStrengthThreshold) {
            regime = trendDirection > 0 ? 'TREND_UP' : 'TREND_DOWN';
        } else if (volatility < 0.005) {
            regime = 'LOW_VOL';
        } else {
            regime = 'RANGE';
        }
        
        // Detectar cambio de régimen
        if (regime !== this.state.regime.type) {
            this.state.regime.lastChange = Date.now();
            if (this.onRegimeChange) {
                this.onRegimeChange(regime, this.state.regime.type);
            }
        }
        
        this.state.regime = {
            type: regime,
            strength: trendStrength,
            volatility,
            liquidity,
            trendDirection,
            lastChange: this.state.regime.lastChange
        };
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // MÓDULO 5: GENERACIÓN DE SEÑAL COMPUESTA MACRO
    // ═══════════════════════════════════════════════════════════════════════════════
    
    generateCompositeSignal() {
        const signals = [];
        const contradictions = [];
        
        // 1. Señal de Order Flow
        const recentImbalances = this.state.orderFlow.imbalances.slice(-3);
        const buyImbalances = recentImbalances.filter(i => i.type === 'BUY_IMBALANCE').length;
        const sellImbalances = recentImbalances.filter(i => i.type === 'SELL_IMBALANCE').length;
        
        if (buyImbalances > sellImbalances + 1) {
            signals.push({ source: 'ORDER_FLOW', signal: 'BUY', strength: 0.7, confidence: 75 });
        } else if (sellImbalances > buyImbalances + 1) {
            signals.push({ source: 'ORDER_FLOW', signal: 'SELL', strength: 0.7, confidence: 75 });
        }
        
        // Absorciones
        const absorptions = this.state.orderFlow.absorptions.slice(-2);
        absorptions.forEach(abs => {
            if (abs.type === 'SELL_ABSORPTION') {
                signals.push({ source: 'ABSORPTION', signal: 'BUY', strength: 0.8, confidence: 80 });
            } else if (abs.type === 'BUY_ABSORPTION') {
                signals.push({ source: 'ABSORPTION', signal: 'SELL', strength: 0.8, confidence: 80 });
            }
        });
        
        // 2. Señal de Volume Profile
        const currentPrice = this.data[this.data.length - 1]?.close;
        const vp = this.state.volumeProfile;
        
        if (currentPrice && vp.poc) {
            const distanceToPOC = Math.abs(currentPrice - vp.poc) / vp.poc;
            
            if (currentPrice > vp.valueAreaHigh && distanceToPOC < 0.01) {
                signals.push({ source: 'VOLUME_PROFILE', signal: 'SELL', strength: 0.6, confidence: 65 });
            } else if (currentPrice < vp.valueAreaLow && distanceToPOC < 0.01) {
                signals.push({ source: 'VOLUME_PROFILE', signal: 'BUY', strength: 0.6, confidence: 65 });
            }
            
            // Rechazo en HVN
            const nearHVN = vp.highVolumeNodes.some(node => 
                Math.abs(currentPrice - node.price) / node.price < 0.002
            );
            if (nearHVN && this.state.orderFlow.delta.slice(-1)[0] < 0) {
                signals.push({ source: 'HVN_REJECTION', signal: 'SELL', strength: 0.65, confidence: 70 });
            }
        }
        
        // 3. Señal Institucional
        const inst = this.state.institutional;
        if (inst.accumulationScore > 70) {
            signals.push({ source: 'INSTITUTIONAL', signal: 'BUY', strength: 0.85, confidence: 85 });
        } else if (inst.distributionScore > 70) {
            signals.push({ source: 'INSTITUTIONAL', signal: 'SELL', strength: 0.85, confidence: 85 });
        }
        
        if (inst.smartMoneyIndex > 70) {
            signals.push({ source: 'SMART_MONEY', signal: 'BUY', strength: 0.75, confidence: 78 });
        } else if (inst.smartMoneyIndex < 30) {
            signals.push({ source: 'SMART_MONEY', signal: 'SELL', strength: 0.75, confidence: 78 });
        }
        
        if (inst.ctaPositioning === 'LONG' && inst.hedgeFlow < 0.3) {
            signals.push({ source: 'CTA_FLOW', signal: 'BUY', strength: 0.7, confidence: 72 });
        } else if (inst.ctaPositioning === 'SHORT' && inst.hedgeFlow < 0.3) {
            signals.push({ source: 'CTA_FLOW', signal: 'SELL', strength: 0.7, confidence: 72 });
        }
        
        // 4. Señal de Régimen
        const regime = this.state.regime;
        if (regime.type === 'TREND_UP' && regime.strength > 0.6) {
            signals.push({ source: 'REGIME', signal: 'BUY', strength: 0.8, confidence: 80 });
        } else if (regime.type === 'TREND_DOWN' && regime.strength > 0.6) {
            signals.push({ source: 'REGIME', signal: 'SELL', strength: 0.8, confidence: 80 });
        } else if (regime.type === 'RANGE') {
            // En rango, buscar reversión a POC
            if (currentPrice > vp.valueAreaHigh) {
                signals.push({ source: 'REGIME_RANGE', signal: 'SELL', strength: 0.5, confidence: 60 });
            } else if (currentPrice < vp.valueAreaLow) {
                signals.push({ source: 'REGIME_RANGE', signal: 'BUY', strength: 0.5, confidence: 60 });
            }
        }
        
        // Detectar contradicciones
        const buySignals = signals.filter(s => s.signal === 'BUY');
        const sellSignals = signals.filter(s => s.signal === 'SELL');
        
        if (buySignals.length > 0 && sellSignals.length > 0) {
            contradictions.push({
                type: 'DIRECT',
                buySources: buySignals.map(s => s.source),
                sellSources: sellSignals.map(s => s.source),
                severity: 'HIGH'
            });
        }
        
        // Calcular señal compuesta ponderada
        const buyScore = buySignals.reduce((a, s) => a + s.strength * s.confidence, 0);
        const sellScore = sellSignals.reduce((a, s) => a + s.strength * s.confidence, 0);
        
        let primarySignal = 'NEUTRAL';
        let confidence = 50;
        let urgency = 'LOW';
        
        if (buyScore > sellScore * 1.5 && buyScore > 50) {
            primarySignal = 'STRONG_BUY';
            confidence = Math.min(95, buyScore / (buySignals.length || 1));
            urgency = confidence > 80 ? 'HIGH' : 'MEDIUM';
        } else if (sellScore > buyScore * 1.5 && sellScore > 50) {
            primarySignal = 'STRONG_SELL';
            confidence = Math.min(95, sellScore / (sellSignals.length || 1));
            urgency = confidence > 80 ? 'HIGH' : 'MEDIUM';
        } else if (buyScore > sellScore && buyScore > 30) {
            primarySignal = 'BUY';
            confidence = buyScore / (buySignals.length || 1);
            urgency = 'MEDIUM';
        } else if (sellScore > buyScore && sellScore > 30) {
            primarySignal = 'SELL';
            confidence = sellScore / (sellSignals.length || 1);
            urgency = 'MEDIUM';
        }
        
        // Ajustar por régimen
        if (regime.type === 'HIGH_VOL' || regime.type === 'CRISIS') {
            confidence *= 0.8; // Reducir confianza en alta volatilidad
            urgency = 'HIGH';
        }
        
        // Calcular movimiento esperado
        const atr = this.calculateATR(10);
        const expectedMove = primarySignal.includes('BUY') ? atr : primarySignal.includes('SELL') ? -atr : 0;
        
        this.state.signals = {
            primary: primarySignal,
            confidence: Math.round(confidence),
            urgency,
            confluence: signals,
            contradictions,
            expectedMove,
            timeHorizon: this.determineTimeHorizon(signals),
            timestamp: Date.now()
        };
        
        // Guardar historial
        this.state.history.push({
            signal: primarySignal,
            confidence,
            price: currentPrice,
            regime: regime.type,
            timestamp: Date.now()
        });
        
        if (this.state.history.length > 100) this.state.history.shift();
        
        // Notificar
        if (this.onSignalUpdate) {
            this.onSignalUpdate(this.state.signals);
        }
    }
    
    calculateATR(period) {
        if (this.data.length < period) return 0;
        const ranges = this.data.slice(-period).map(d => d.high - d.low);
        return ranges.reduce((a, b) => a + b, 0) / ranges.length;
    }
    
    determineTimeHorizon(signals) {
        const hasOrderFlow = signals.some(s => s.source === 'ORDER_FLOW');
        const hasInstitutional = signals.some(s => s.source.includes('INSTITUTIONAL'));
        const hasRegime = signals.some(s => s.source === 'REGIME');
        
        if (hasOrderFlow && !hasRegime) return 'SCALP';
        if (hasInstitutional) return 'SWING';
        if (hasRegime) return 'POSITION';
        return 'INTRADAY';
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // API PÚBLICA
    // ═══════════════════════════════════════════════════════════════════════════════
    
    getCurrentAnalysis() {
        return {
            signal: this.state.signals,
            regime: this.state.regime,
            orderFlow: {
                cumulativeDelta: this.state.orderFlow.cumulativeDelta,
                recentImbalances: this.state.orderFlow.imbalances.slice(-5),
                absorptions: this.state.orderFlow.absorptions.slice(-3),
                icebergHints: this.state.orderFlow.icebergHints.slice(-3)
            },
            volumeProfile: {
                poc: this.state.volumeProfile.poc,
                valueArea: {
                    high: this.state.volumeProfile.valueAreaHigh,
                    low: this.state.volumeProfile.valueAreaLow
                },
                vwap: this.state.volumeProfile.vwap,
                highVolumeNodes: this.state.volumeProfile.highVolumeNodes,
                currentPosition: this.getVolumeProfilePosition()
            },
            institutional: {
                accumulationScore: this.state.institutional.accumulationScore,
                distributionScore: this.state.institutional.distributionScore,
                smartMoneyIndex: this.state.institutional.smartMoneyIndex,
                ctaPositioning: this.state.institutional.ctaPositioning,
                recentLargeOrders: this.state.institutional.largeOrders.slice(-3)
            },
            timestamp: Date.now()
        };
    }
    
    getVolumeProfilePosition() {
        const current = this.data[this.data.length - 1]?.close;
        if (!current || !this.state.volumeProfile.valueAreaHigh) return 'UNKNOWN';
        
        if (current > this.state.volumeProfile.valueAreaHigh) return 'ABOVE_VA';
        if (current < this.state.volumeProfile.valueAreaLow) return 'BELOW_VA';
        if (Math.abs(current - this.state.volumeProfile.poc) / this.state.volumeProfile.poc < 0.005) {
            return 'AT_POC';
        }
        return 'INSIDE_VA';
    }
    
    getTradeRecommendation() {
        const analysis = this.getCurrentAnalysis();
        const signal = analysis.signal;
        
        if (signal.primary === 'NEUTRAL') {
            return {
                action: 'WAIT',
                reason: 'Sin señales claras de confluencia',
                risk: 'MEDIUM'
            };
        }
        
        const isBuy = signal.primary.includes('BUY');
        const entry = this.data[this.data.length - 1]?.close;
        const stopLoss = isBuy ? 
            this.state.volumeProfile.valueAreaLow || entry * 0.995 : 
            this.state.volumeProfile.valueAreaHigh || entry * 1.005;
        const takeProfit = entry + (signal.expectedMove * 2);
        
        return {
            action: isBuy ? 'BUY' : 'SELL',
            entry,
            stopLoss,
            takeProfit,
            position: signal.timeHorizon,
            confidence: signal.confidence,
            urgency: signal.urgency,
            rationale: this.generateRationale(analysis),
            riskReward: Math.abs(takeProfit - entry) / Math.abs(entry - stopLoss)
        };
    }
    
    generateRationale(analysis) {
        const parts = [];
        
        if (analysis.signal.confluence.length > 0) {
            const topSignals = analysis.signal.confluence
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 3);
            parts.push(`Confluencia: ${topSignals.map(s => s.source).join(', ')}`);
        }
        
        parts.push(`Régimen: ${analysis.regime.type} (${(analysis.regime.strength * 100).toFixed(0)}% fuerza)`);
        parts.push(`Posición VP: ${analysis.volumeProfile.currentPosition}`);
        
        if (analysis.institutional.smartMoneyIndex > 60) {
            parts.push('Smart Money alcista');
        } else if (analysis.institutional.smartMoneyIndex < 40) {
            parts.push('Smart Money bajista');
        }
        
        return parts.join(' | ');
    }
    
    // Integración con tu sistema existente
    integrateWithV27(marketBridge) {
        console.log('[MacroV27] Integrando con MarketBridgeV27...');
        
        // Sobrescribir método de procesamiento de ticks
        const originalProcess = marketBridge.processTick;
        marketBridge.processTick = (tick) => {
            // Procesar en motor macro
            this.processTick(tick);
            
            // Obtener recomendación
            const macroSignal = this.getTradeRecommendation();
            
            // Enriquecer el tick con análisis macro
            tick.macroAnalysis = this.getCurrentAnalysis();
            tick.macroRecommendation = macroSignal;
            
            // Llamar original
            return originalProcess.call(marketBridge, tick);
        };
        
        // Callbacks para UI
        this.onSignalUpdate = (signal) => {
            if (window.updateMacroUI) {
                window.updateMacroUI(signal);
            }
        };
        
        this.onRegimeChange = (newRegime, oldRegime) => {
            console.log(`[MacroV27] Cambio de régimen: ${oldRegime} -> ${newRegime}`);
            if (window.onMacroRegimeChange) {
                window.onMacroRegimeChange(newRegime, oldRegime);
            }
        };
        
        console.log('✅ MacroAnalysisEngineV27 integrado exitosamente');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISUALIZACIÓN MACRO EN TU DASHBOARD V27
// ═══════════════════════════════════════════════════════════════════════════════

class MacroDashboardV27 {
    constructor(containerId = 'macro-dashboard') {
        this.container = document.getElementById(containerId) || this.createContainer();
        this.engine = null;
        this.render();
    }
    
    createContainer() {
        const div = document.createElement('div');
        div.id = 'macro-dashboard';
        div.className = 'v27-panel macro-panel';
        div.style.cssText = `
            grid-column: 1 / -1;
            background: linear-gradient(135deg, rgba(10,10,30,0.95), rgba(20,10,40,0.9));
            border: 2px solid rgba(0,212,255,0.3);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 20px;
        `;
        
        const dashboard = document.querySelector('.v27-dashboard');
        if (dashboard) {
            dashboard.insertBefore(div, dashboard.firstChild);
        }
        
        return div;
    }
    
    render() {
        this.container.innerHTML = `
            <div class="macro-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid rgba(0,212,255,0.2);
            ">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-family: 'Orbitron', monospace; font-size: 16px; color: #00d4ff; font-weight: 700;">
                        🌐 QUANTUM MACRO V27
                    </span>
                    <span id="macro-regime-badge" style="
                        padding: 6px 12px;
                        background: rgba(100,100,100,0.3);
                        border-radius: 20px;
                        font-size: 11px;
                        font-weight: 600;
                        text-transform: uppercase;
                    ">ANALIZANDO</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span id="macro-confidence" style="font-size: 24px; font-weight: 700; color: #ffb400;">--%</span>
                    <span style="font-size: 11px; color: #888;">CONFIANZA</span>
                </div>
            </div>
            
            <div class="macro-grid" style="
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 15px;
                margin-bottom: 20px;
            ">
                <!-- Order Flow -->
                <div class="macro-card" style="
                    background: rgba(0,0,0,0.3);
                    border-radius: 12px;
                    padding: 15px;
                    border-left: 3px solid #00d4ff;
                ">
                    <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 8px;">
                        Order Flow
                    </div>
                    <div id="macro-delta" style="font-size: 28px; font-weight: 700; color: #00d4ff; margin-bottom: 5px;">
                        0
                    </div>
                    <div id="macro-imbalances" style="font-size: 11px; color: #888;">
                        Sin desequilibrios
                    </div>
                    <div id="macro-absorptions" style="margin-top: 8px; font-size: 10px; color: #ffb400;">
                        
                    </div>
                </div>
                
                <!-- Volume Profile -->
                <div class="macro-card" style="
                    background: rgba(0,0,0,0.3);
                    border-radius: 12px;
                    padding: 15px;
                    border-left: 3px solid #ff00aa;
                ">
                    <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 8px;">
                        Volume Profile
                    </div>
                    <div id="macro-poc" style="font-size: 20px; font-weight: 700; color: #ff00aa; margin-bottom: 5px;">
                        --
                    </div>
                    <div id="macro-va" style="font-size: 11px; color: #888;">
                        VA: -- / --
                    </div>
                    <div id="macro-position" style="margin-top: 8px; font-size: 10px; color: #00ffaa;">
                        Posición: --
                    </div>
                </div>
                
                <!-- Institucional -->
                <div class="macro-card" style="
                    background: rgba(0,0,0,0.3);
                    border-radius: 12px;
                    padding: 15px;
                    border-left: 3px solid #00ffaa;
                ">
                    <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 8px;">
                        Flujo Institucional
                    </div>
                    <div id="macro-smart-money" style="font-size: 28px; font-weight: 700; color: #00ffaa; margin-bottom: 5px;">
                        50
                    </div>
                    <div id="macro-accumulation" style="font-size: 11px; color: #888;">
                        Acumulación: --%
                    </div>
                    <div id="macro-cta" style="margin-top: 8px; font-size: 10px; color: #00d4ff;">
                        CTA: NEUTRAL
                    </div>
                </div>
                
                <!-- Señal Principal -->
                <div class="macro-card" style="
                    background: linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,255,170,0.1));
                    border-radius: 12px;
                    padding: 15px;
                    border: 2px solid rgba(0,212,255,0.3);
                    text-align: center;
                ">
                    <div style="font-size: 10px; color: #00d4ff; text-transform: uppercase; margin-bottom: 8px;">
                        Señal Macro
                    </div>
                    <div id="macro-signal" style="font-size: 24px; font-weight: 900; color: #ffb400; margin-bottom: 5px; letter-spacing: 1px;">
                        ESPERAR
                    </div>
                    <div id="macro-urgency" style="font-size: 11px; color: #888;">
                        Urgencia: BAJA
                    </div>
                    <div id="macro-horizon" style="margin-top: 8px; font-size: 10px; color: #ff00aa;">
                        Horizonte: --
                    </div>
                </div>
            </div>
            
            <!-- Barra de Confluencia -->
            <div class="macro-confluence" style="
                background: rgba(0,0,0,0.3);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 15px;
            ">
                <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 8px;">
                    Confluencia de Señales
                </div>
                <div id="macro-confluence-bars" style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <span style="padding: 4px 8px; background: rgba(100,100,100,0.2); border-radius: 4px; font-size: 10px; color: #666;">
                        Esperando datos...
                    </span>
                </div>
            </div>
            
            <!-- Recomendación de Trading -->
            <div class="macro-recommendation" style="
                background: linear-gradient(90deg, rgba(0,0,0,0.4), rgba(0,212,255,0.05));
                border-radius: 12px;
                padding: 15px;
                border-left: 4px solid #ffb400;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 10px; color: #ffb400; text-transform: uppercase; margin-bottom: 6px;">
                            Recomendación de Trading
                        </div>
                        <div id="macro-rationale" style="font-size: 13px; color: #e0e0ff; line-height: 1.4;">
                            Inicializando análisis macro...
                        </div>
                    </div>
                    <div id="macro-expected-move" style="text-align: right;">
                        <div style="font-size: 11px; color: #888;">Movimiento Esperado</div>
                        <div style="font-size: 20px; font-weight: 700; color: #00ffaa;">--</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    update(analysis) {
        if (!analysis) return;
        
        // Actualizar régimen
        const regimeBadge = document.getElementById('macro-regime-badge');
        if (regimeBadge) {
            const regimeColors = {
                'TREND_UP': { bg: 'rgba(0,255,170,0.2)', color: '#00ffaa', text: 'TENDENCIA ALCISTA' },
                'TREND_DOWN': { bg: 'rgba(255,77,130,0.2)', color: '#ff4d82', text: 'TENDENCIA BAJISTA' },
                'RANGE': { bg: 'rgba(255,180,0,0.2)', color: '#ffb400', text: 'RANGO' },
                'HIGH_VOL': { bg: 'rgba(255,159,67,0.2)', color: '#ff9f43', text: 'ALTA VOLATILIDAD' },
                'CRISIS': { bg: 'rgba(255,0,0,0.3)', color: '#ff0000', text: 'CRISIS' },
                'UNKNOWN': { bg: 'rgba(100,100,100,0.2)', color: '#888', text: 'ANALIZANDO' }
            };
            const style = regimeColors[analysis.regime.type] || regimeColors['UNKNOWN'];
            regimeBadge.style.background = style.bg;
            regimeBadge.style.color = style.color;
            regimeBadge.textContent = style.text;
        }
        
        // Confianza
        const confEl = document.getElementById('macro-confidence');
        if (confEl) {
            confEl.textContent = analysis.signal.confidence + '%';
            confEl.style.color = analysis.signal.confidence > 70 ? '#00ffaa' : 
                                analysis.signal.confidence > 50 ? '#ffb400' : '#ff4d82';
        }
        
        // Order Flow
        const deltaEl = document.getElementById('macro-delta');
        if (deltaEl) {
            const delta = analysis.orderFlow.cumulativeDelta;
            deltaEl.textContent = delta > 0 ? '+' + delta.toFixed(0) : delta.toFixed(0);
            deltaEl.style.color = delta > 0 ? '#00ffaa' : delta < 0 ? '#ff4d82' : '#888';
        }
        
        const imbEl = document.getElementById('macro-imbalances');
        if (imbEl && analysis.orderFlow.recentImbalances) {
            const buyImb = analysis.orderFlow.recentImbalances.filter(i => i.type === 'BUY_IMBALANCE').length;
            const sellImb = analysis.orderFlow.recentImbalances.filter(i => i.type === 'SELL_IMBALANCE').length;
            imbEl.innerHTML = `
                <span style="color: #00ffaa;">▲ ${buyImb}</span> | 
                <span style="color: #ff4d82;">▼ ${sellImb}</span> desequilibrios
            `;
        }
        
        // Volume Profile
        const pocEl = document.getElementById('macro-poc');
        if (pocEl && analysis.volumeProfile.poc) {
            pocEl.textContent = analysis.volumeProfile.poc.toFixed(2);
        }
        
        const vaEl = document.getElementById('macro-va');
        if (vaEl && analysis.volumeProfile.valueArea) {
            vaEl.textContent = `VA: ${analysis.volumeProfile.valueArea.low?.toFixed(2) || '--'} / ${analysis.volumeProfile.valueArea.high?.toFixed(2) || '--'}`;
        }
        
        const posEl = document.getElementById('macro-position');
        if (posEl) {
            const pos = analysis.volumeProfile.currentPosition;
            const posText = {
                'ABOVE_VA': 'Por encima VA ⚠️',
                'BELOW_VA': 'Por debajo VA ✅',
                'INSIDE_VA': 'Dentro VA',
                'AT_POC': 'En POC 🎯',
                'UNKNOWN': '--'
            };
            posEl.textContent = 'Posición: ' + (posText[pos] || pos);
            posEl.style.color = pos === 'AT_POC' ? '#ff00aa' : pos === 'INSIDE_VA' ? '#00ffaa' : '#ffb400';
        }
        
        // Institucional
        const smEl = document.getElementById('macro-smart-money');
        if (smEl) {
            smEl.textContent = analysis.institutional.smartMoneyIndex.toFixed(0);
            smEl.style.color = analysis.institutional.smartMoneyIndex > 60 ? '#00ffaa' : 
                              analysis.institutional.smartMoneyIndex < 40 ? '#ff4d82' : '#888';
        }
        
        const accEl = document.getElementById('macro-accumulation');
        if (accEl) {
            accEl.innerHTML = `
                <span style="color: #00ffaa;">Acc: ${analysis.institutional.accumulationScore.toFixed(0)}%</span> | 
                <span style="color: #ff4d82;">Dist: ${analysis.institutional.distributionScore.toFixed(0)}%</span>
            `;
        }
        
        const ctaEl = document.getElementById('macro-cta');
        if (ctaEl) {
            ctaEl.textContent = 'CTA: ' + analysis.institutional.ctaPositioning;
            ctaEl.style.color = analysis.institutional.ctaPositioning === 'LONG' ? '#00ffaa' :
                               analysis.institutional.ctaPositioning === 'SHORT' ? '#ff4d82' : '#888';
        }
        
        // Señal Principal
        const sigEl = document.getElementById('macro-signal');
        if (sigEl) {
            sigEl.textContent = analysis.signal.primary.replace('_', ' ');
            sigEl.style.color = analysis.signal.primary.includes('BUY') ? '#00ffaa' :
                               analysis.signal.primary.includes('SELL') ? '#ff4d82' : '#ffb400';
        }
        
        const urgEl = document.getElementById('macro-urgency');
        if (urgEl) {
            urgEl.textContent = 'Urgencia: ' + analysis.signal.urgency;
            urgEl.style.color = analysis.signal.urgency === 'HIGH' ? '#ff4d82' :
                               analysis.signal.urgency === 'MEDIUM' ? '#ffb400' : '#00ffaa';
        }
        
        const horEl = document.getElementById('macro-horizon');
        if (horEl) {
            horEl.textContent = 'Horizonte: ' + analysis.signal.timeHorizon;
        }
        
        // Confluencia
        const confBar = document.getElementById('macro-confluence-bars');
        if (confBar && analysis.signal.confluence) {
            confBar.innerHTML = analysis.signal.confluence.map(s => {
                const color = s.signal === 'BUY' ? '#00ffaa' : s.signal === 'SELL' ? '#ff4d82' : '#ffb400';
                return `<span style="padding: 4px 8px; background: ${color}20; border: 1px solid ${color}; border-radius: 4px; font-size: 10px; color: ${color};">
                    ${s.source} ${s.confidence}%
                </span>`;
            }).join('');
        }
        
        // Rationale
        const ratEl = document.getElementById('macro-rationale');
        if (ratEl) {
            ratEl.textContent = this.engine ? this.engine.generateRationale(analysis) : 'Analizando...';
        }
        
        // Expected Move
        const moveEl = document.getElementById('macro-expected-move');
        if (moveEl && analysis.signal.expectedMove) {
            const move = analysis.signal.expectedMove;
            moveEl.innerHTML = `
                <div style="font-size: 11px; color: #888;">Movimiento Esperado</div>
                <div style="font-size: 20px; font-weight: 700; color: ${move > 0 ? '#00ffaa' : move < 0 ? '#ff4d82' : '#888'};">
                    ${move > 0 ? '+' : ''}${move.toFixed(2)}
                </div>
            `;
        }
    }
    
    setEngine(engine) {
        this.engine = engine;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════════════════════

window.MacroAnalysisEngineV27 = MacroAnalysisEngineV27;
window.MacroDashboardV27 = MacroDashboardV27;

function initMacroV27() {
    console.log('[MacroV27] Iniciando sistema Macro Integral...');
    
    // Crear motor
    const macroEngine = new MacroAnalysisEngineV27();
    
    // Crear dashboard
    const macroDashboard = new MacroDashboardV27();
    macroDashboard.setEngine(macroEngine);
    
    // Exponer actualización global
    window.updateMacroUI = (signal) => {
        macroDashboard.update(macroEngine.getCurrentAnalysis());
    };
    
    // Integrar con MarketBridgeV27 cuando esté disponible
    const checkAndIntegrate = () => {
        if (window.MarketBridgeV27) {
            macroEngine.integrateWithV27(window.MarketBridgeV27);
            console.log('✅ MacroV27 completamente integrado');
        } else {
            setTimeout(checkAndIntegrate, 500);
        }
    };
    checkAndIntegrate();
    
    // Exponer API
    window.MacroV27 = {
        engine: macroEngine,
        dashboard: macroDashboard,
        getAnalysis: () => macroEngine.getCurrentAnalysis(),
        getRecommendation: () => macroEngine.getTradeRecommendation(),
        forceUpdate: () => {
            if (macroEngine.data.length > 0) {
                macroEngine.generateCompositeSignal();
                macroDashboard.update(macroEngine.getCurrentAnalysis());
            }
        }
    };
    
    console.log('✅ MacroV27 listo - Usa MacroV27.getRecommendation() para señales');
}

// Iniciar
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initMacroV27, 2000); // Esperar a que cargue el sistema base
});

console.log('✅ macro_engine_v27.js cargado - Sistema Macro Integral V27');
