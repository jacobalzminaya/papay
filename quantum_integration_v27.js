// ═══════════════════════════════════════════════════════════════════════════════
// QUANTUM MACRO V27 - INTEGRACIÓN COMPLETA CON SISTEMA EXISTENTE
// Conecta MacroEngine + ChartEngine + MarketBridgeV27
// ═══════════════════════════════════════════════════════════════════════════════

class QuantumMacroIntegratorV27 {
    constructor() {
        this.components = {
            macro: null,
            chart: null,
            bridge: null,
            ml: null
        };
        
        this.state = {
            unifiedSignal: 'NEUTRAL',
            confidence: 0,
            lastUpdate: Date.now(),
            convergenceMatrix: [],
            activeStrategies: []
        };
        
        this.config = {
            // Pesos para consenso entre sistemas
            weights: {
                macro: 0.35,      // Análisis macro estructural
                technical: 0.25,  // Indicadores técnicos clásicos
                ml: 0.25,         // ML Ensemble (LSTM + Trap Detect)
                genetic: 0.15     // Análisis genético de patrones
            },
            
            // Umbrales de decisión
            thresholds: {
                strongSignal: 75,
                moderateSignal: 60,
                weakSignal: 45,
                minConfluence: 2  // Mínimo sistemas de acuerdo
            },
            
            // Gestión de riesgo integrada
            riskManagement: {
                maxPositionSize: 0.1,        // 10% máximo por trade
                maxDailyLoss: 0.05,          // 5% pérdida diaria máxima
                volatilityAdjustment: true,  // Ajustar por volatilidad
                correlationFilter: true      // Filtrar por correlación
            }
        };
        
        this.init();
    }
    
    init() {
        console.log('[QuantumV27] Inicializando Integrador Macro Completo...');
        this.waitForComponents();
    }
    
    waitForComponents() {
        const check = () => {
            let ready = true;
            
            if (window.MacroV27 && !this.components.macro) {
                this.components.macro = window.MacroV27.engine;
                console.log('✅ MacroEngine conectado');
            }
            
            if (window.chartEngine && !this.components.chart) {
                this.components.chart = window.chartEngine;
                console.log('✅ ChartEngine conectado');
            }
            
            if (window.MarketBridgeV27 && !this.components.bridge) {
                this.components.bridge = window.MarketBridgeV27;
                this.integrateWithBridge();
                console.log('✅ MarketBridge conectado');
            }
            
            if (window.MLEnsembleV27 && !this.components.ml) {
                this.components.ml = window.MLEnsembleV27;
                console.log('✅ ML Ensemble conectado');
            }
            
            if (!this.components.macro || !this.components.bridge) {
                ready = false;
                setTimeout(check, 500);
            }
            
            if (ready) {
                this.startUnifiedAnalysis();
            }
        };
        
        check();
    }
    
    integrateWithBridge() {
        const bridge = this.components.bridge;
        const originalDecide = bridge.decideTrade || bridge.processSignal;
        
        // Interceptar decisiones de trading
        bridge.decideTrade = (signal) => {
            // Enriquecer con análisis macro
            const macroAnalysis = this.components.macro.getCurrentAnalysis();
            const macroRec = this.components.macro.getTradeRecommendation();
            
            // Calcular señal unificada
            const unified = this.calculateUnifiedSignal(signal, macroAnalysis, macroRec);
            
            // Log de decisión
            this.logDecision({
                original: signal,
                macro: macroRec,
                unified: unified,
                timestamp: Date.now()
            });
            
            // Ejecutar solo si hay consenso suficiente
            if (unified.execute) {
                return originalDecide.call(bridge, unified.finalSignal);
            } else {
                console.log('[QuantumV27] Trade bloqueado por falta de consenso:', unified.reason);
                return { action: 'BLOCKED', reason: unified.reason };
            }
        };
    }
    
    calculateUnifiedSignal(originalSignal, macroAnalysis, macroRec) {
        const scores = {
            buy: 0,
            sell: 0,
            confidence: 0
        };
        
        const confluence = [];
        const contradictions = [];
        
        // 1. Señal Macro (35%)
        if (macroRec.action === 'BUY') {
            scores.buy += this.config.weights.macro * macroRec.confidence;
            confluence.push('MACRO_BUY');
        } else if (macroRec.action === 'SELL') {
            scores.sell += this.config.weights.macro * macroRec.confidence;
            confluence.push('MACRO_SELL');
        }
        
        // 2. Señal Técnica Original (25%)
        if (originalSignal.side === 'BUY' || originalSignal.signal === 'CALL') {
            scores.buy += this.config.weights.technical * (originalSignal.confidence || 50);
            confluence.push('TECH_BUY');
        } else if (originalSignal.side === 'SELL' || originalSignal.signal === 'PUT') {
            scores.sell += this.config.weights.technical * (originalSignal.confidence || 50);
            confluence.push('TECH_SELL');
        }
        
        // 3. ML Ensemble (25%) - si está disponible
        if (this.components.ml && this.components.ml.getCurrentPrediction) {
            const mlPred = this.components.ml.getCurrentPrediction();
            if (mlPred.direction === 'UP') {
                scores.buy += this.config.weights.ml * (mlPred.confidence * 100);
                confluence.push('ML_BUY');
            } else if (mlPred.direction === 'DOWN') {
                scores.sell += this.config.weights.ml * (mlPred.confidence * 100);
                confluence.push('ML_SELL');
            }
        }
        
        // 4. Chart Patterns (15%)
        if (this.components.chart && this.components.chart.state) {
            const chartRec = this.components.chart.state.recommendation;
            if (chartRec) {
                if (chartRec.action === 'COMPRA') {
                    scores.buy += this.config.weights.genetic * chartRec.confidence;
                    confluence.push('CHART_BUY');
                } else if (chartRec.action === 'VENTA') {
                    scores.sell += this.config.weights.genetic * chartRec.confidence;
                    confluence.push('CHART_SELL');
                }
            }
        }
        
        // Detectar contradicciones
        if (scores.buy > 20 && scores.sell > 20) {
            contradictions.push('CONFLICTO_DIRECTO');
        }
        
        // Calcular decisión final
        const totalBuy = scores.buy;
        const totalSell = scores.sell;
        const diff = Math.abs(totalBuy - totalSell);
        const dominantSide = totalBuy > totalSell ? 'BUY' : 'SELL';
        const dominantScore = Math.max(totalBuy, totalSell);
        
        // Determinar si ejecutar
        let execute = false;
        let reason = '';
        
        if (contradictions.length > 0 && diff < 30) {
            execute = false;
            reason = 'Contradicción entre sistemas sin claridad';
        } else if (dominantScore >= this.config.thresholds.strongSignal && confluence.length >= 2) {
            execute = true;
            reason = 'Señal fuerte con confluencia';
        } else if (dominantScore >= this.config.thresholds.moderateSignal && confluence.length >= 3) {
            execute = true;
            reason = 'Señal moderada con alta confluencia';
        } else if (dominantScore >= this.config.thresholds.weakSignal && confluence.length >= 4) {
            execute = true;
            reason = 'Señal débil pero máxima confluencia';
        } else {
            execute = false;
            reason = `Score ${dominantScore.toFixed(1)}% insuficiente (${confluence.length} sistemas)`;
        }
        
        // Ajustar por régimen macro
        if (macroAnalysis.regime.type === 'CRISIS' || macroAnalysis.regime.type === 'HIGH_VOL') {
            execute = false;
            reason = 'Bloqueado por régimen de alta volatilidad/crisis';
        }
        
        return {
            execute,
            reason,
            finalSignal: {
                side: dominantSide,
                confidence: Math.min(95, dominantScore),
                confluence,
                contradictions,
                macroContext: {
                    regime: macroAnalysis.regime.type,
                    smartMoney: macroAnalysis.institutional.smartMoneyIndex,
                    position: macroAnalysis.volumeProfile.currentPosition
                },
                timestamp: Date.now()
            },
            scores
        };
    }
    
    startUnifiedAnalysis() {
        // Loop de análisis unificado cada 2 segundos
        setInterval(() => {
            this.updateUnifiedDashboard();
        }, 2000);
        
        console.log('[QuantumV27] Análisis unificado iniciado');
    }
    
    updateUnifiedDashboard() {
        if (!this.components.macro) return;
        
        const macro = this.components.macro.getCurrentAnalysis();
        const macroRec = this.components.macro.getTradeRecommendation();
        
        // Crear o actualizar panel unificado
        let panel = document.getElementById('quantum-unified-panel');
        if (!panel) {
            panel = this.createUnifiedPanel();
        }
        
        this.updatePanelContent(panel, macro, macroRec);
    }
    
    createUnifiedPanel() {
        const panel = document.createElement('div');
        panel.id = 'quantum-unified-panel';
        panel.className = 'v27-panel unified-panel';
        panel.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 320px;
            background: linear-gradient(135deg, rgba(10,10,30,0.98), rgba(20,10,40,0.95));
            border: 2px solid rgba(0,212,255,0.4);
            border-radius: 16px;
            padding: 20px;
            z-index: 10000;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            backdrop-filter: blur(10px);
        `;
        
        document.body.appendChild(panel);
        return panel;
    }
    
    updatePanelContent(panel, macro, macroRec) {
        const signal = macro.signal;
        const regime = macro.regime;
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="font-family: 'Orbitron', monospace; font-size: 14px; color: #00d4ff; font-weight: 700;">
                    ⚛️ QUANTUM CONSENSO
                </span>
                <span id="unified-status" style="
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: 600;
                    background: ${signal.primary.includes('BUY') ? 'rgba(0,255,170,0.2)' : signal.primary.includes('SELL') ? 'rgba(255,77,130,0.2)' : 'rgba(255,180,0,0.2)'};
                    color: ${signal.primary.includes('BUY') ? '#00ffaa' : signal.primary.includes('SELL') ? '#ff4d82' : '#ffb400'};
                ">
                    ${signal.primary}
                </span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 10px; color: #666; margin-bottom: 4px;">Confianza</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${signal.confidence > 70 ? '#00ffaa' : signal.confidence > 50 ? '#ffb400' : '#ff4d82'};">
                        ${signal.confidence}%
                    </div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 10px; color: #666; margin-bottom: 4px;">Régimen</div>
                    <div style="font-size: 14px; font-weight: 600; color: #00d4ff;">
                        ${regime.type.replace('_', ' ')}
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="font-size: 10px; color: #666; margin-bottom: 8px; text-transform: uppercase;">
                    Confluencia de Sistemas
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${signal.confluence.map(c => `
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
                            <span style="color: #00ffaa;">✓</span>
                            <span style="color: #e0e0ff;">${c.replace('_', ' ')}</span>
                        </div>
                    `).join('') || '<span style="color: #666; font-size: 11px;">Sin confluencia detectada</span>'}
                </div>
            </div>
            
            <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 12px; border-left: 3px solid #ffb400;">
                <div style="font-size: 10px; color: #ffb400; margin-bottom: 4px;">RECOMENDACIÓN</div>
                <div style="font-size: 13px; color: #e0e0ff; line-height: 1.4;">
                    ${macroRec.rationale || 'Esperando análisis completo...'}
                </div>
            </div>
            
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(100,100,100,0.2);">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666;">
                    <span>Smart Money: ${macro.institutional.smartMoneyIndex.toFixed(0)}/100</span>
                    <span>Δ Delta: ${macro.orderFlow.cumulativeDelta > 0 ? '+' : ''}${macro.orderFlow.cumulativeDelta.toFixed(0)}</span>
                </div>
            </div>
        `;
    }
    
    logDecision(decision) {
        // Enviar a sistema de logs si existe
        if (window.MarketBridgeV27 && window.MarketBridgeV27.addLog) {
            window.MarketBridgeV27.addLog(
                `[Quantum] Decisión: ${decision.unified.execute ? 'EJECUTAR' : 'BLOQUEAR'} ${decision.unified.finalSignal.side} | ${decision.unified.reason}`,
                decision.unified.execute ? '#00ffaa' : '#ff4d82',
                'quantum'
            );
        }
        
        // Guardar en historial
        this.state.convergenceMatrix.push(decision);
        if (this.state.convergenceMatrix.length > 50) {
            this.state.convergenceMatrix.shift();
        }
    }
    
    // API Pública
    getUnifiedSignal() {
        if (!this.components.macro) return null;
        
        const macro = this.components.macro.getCurrentAnalysis();
        const macroRec = this.components.macro.getTradeRecommendation();
        
        return this.calculateUnifiedSignal(
            { side: 'NEUTRAL', confidence: 50 },
            macro,
            macroRec
        );
    }
    
    getSystemStatus() {
        return {
            components: {
                macro: !!this.components.macro,
                chart: !!this.components.chart,
                bridge: !!this.components.bridge,
                ml: !!this.components.ml
            },
            lastUpdate: this.state.lastUpdate,
            activeStrategies: this.state.activeStrategies
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

window.QuantumMacroIntegratorV27 = QuantumMacroIntegratorV27;

function initQuantumIntegration() {
    console.log('[QuantumV27] Iniciando integración completa...');
    window.QuantumV27 = new QuantumMacroIntegratorV27();
}

// Iniciar cuando todo esté listo
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initQuantumIntegration, 3000);
});

console.log('✅ quantum_integration_v27.js cargado - Integrador Macro Completo');