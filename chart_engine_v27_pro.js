class ChartPatternEngineV27 {
    constructor(containerId = 'chart-pattern-container') {
        // Configuración profesional
        this.config = {
            // Zoom y vista
            zoom: {
                min: 0.3,           // Zoom mínimo (30% - vista macro)
                max: 3.0,           // Zoom máximo (300% - detalle)
                current: 1.0,       // Zoom actual
                candleWidth: 12,    // Ancho base de vela en px
                spacing: 4          // Espacio entre velas
            },
            
            // Medias móviles
            movingAverages: {
                ema: [
                    { period: 9, color: '#00d4ff', width: 2, label: 'EMA9' },
                    { period: 21, color: '#ff00aa', width: 2, label: 'EMA21' },
                    { period: 55, color: '#ffb400', width: 2, label: 'EMA55' }
                ],
                sma: [
                    { period: 20, color: '#00ffaa', width: 1.5, label: 'SMA20', dashed: true }
                ]
            },
            
            // Soportes y resistencias
            supportResistance: {
                lookback: 50,         // Velas para analizar
                tolerance: 0.02,      // Tolerancia 2% para considerar mismo nivel
                minTouches: 2,        // Mínimo toques para validar línea
                maxLines: 4           // Máximo líneas mostradas por tipo
            },
            
            // Visual
            colors: {
                bg: '#0a0a1a',
                grid: 'rgba(0, 212, 255, 0.08)',
                gridText: '#444',
                bull: '#00ffaa',
                bear: '#ff4d82',
                bullShadow: 'rgba(0, 255, 170, 0.3)',
                bearShadow: 'rgba(255, 77, 130, 0.3)',
                crosshair: '#ffffff',
                projection: '#ff9f43'
            },
            
            // Patrones
            patterns: {
                enabled: true,
                minConfidence: 0.65,
                lookback: 30
            },
            
            // NUEVO: Configuración avanzada
            showFootprint: false,
            showAIPatterns: true,
            showMTF: false
        };
        
        // Estado del motor
        this.state = {
            data: [],              // Datos OHLCV
            visibleData: [],       // Datos visibles según zoom/pan
            maData: {},            // Caché de medias calculadas
            supportLevels: [],     // Niveles de soporte detectados
            resistanceLevels: [],  // Niveles de resistencia detectados
            detectedPatterns: [],  // Patrones detectados
            crossovers: [],        // Cruces de medias
            bounces: [],           // Rebotes en niveles
            projections: [],       // Proyecciones futuras
            
            // Interacción
            offset: 0,             // Desplazamiento horizontal (pan)
            hoverIndex: -1,        // Índice bajo el mouse
            isDragging: false,
            dragStartX: 0,
            dragStartOffset: 0,
            
            // Vista
            view: 'IA',            // 'IA' o 'TU'
            lastUpdate: 0
        };
        
        // Elementos DOM
        this.container = document.getElementById(containerId) || this.createContainer();
        this.canvas = null;
        this.ctx = null;
        this.overlayCanvas = null;  // Canvas para UI/interacción
        this.overlayCtx = null;
        
        // Dimensiones
        this.dimensions = {
            width: 0,
            height: 0,
            chartHeight: 0,
            padding: { top: 40, right: 80, bottom: 30, left: 10 }
        };
        
        // Inicialización
        this.isInitialized = false;
        this.animationFrame = null;
        
        // Iniciar
        this.init();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // INICIALIZACIÓN
    // ═══════════════════════════════════════════════════════════════════════════════
    
    init() {
        if (this.isInitialized) return;
        
        console.log('[ChartV27] Inicializando motor de patrones PRO...');
        
        this.setupContainer();
        this.setupCanvases();
        this.setupEventListeners();
        this.setupUI();
        
        // NUEVO: Inicializar módulos avanzados
        this.initAdvancedModules();
        
        this.isInitialized = true;
        
        // Loop de renderizado
        this.startRenderLoop();
        
        console.log('[ChartV27] Motor inicializado - Listo para datos');
    }
    
    createContainer() {
        const div = document.createElement('div');
        div.id = 'chart-pattern-container';
        div.className = 'v27-panel chart-pro-panel';
        div.style.cssText = `
            order: -1;
            margin-bottom: 15px;
            background: rgba(10, 10, 30, 0.95);
            border: 1px solid rgba(0, 212, 255, 0.3);
            border-radius: 16px;
            padding: 0;
            overflow: hidden;
            position: relative;
        `;
        
        // Insertar en dashboard
        const dashboard = document.querySelector('.v27-dashboard');
        if (dashboard) {
            dashboard.insertBefore(div, dashboard.firstChild);
        }
        
        return div;
    }
    
    setupContainer() {
        this.container.innerHTML = `
            <div class="chart-pro-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: linear-gradient(90deg, rgba(0,212,255,0.1), transparent);
                border-bottom: 1px solid rgba(0,212,255,0.2);
            ">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-family: 'Orbitron', monospace; font-size: 13px; color: #00d4ff; font-weight: 700;">
                        📊 CHART PATTERN PRO V27
                    </span>
                    <span id="chart-pattern-status" style="
                        font-size: 10px;
                        padding: 4px 10px;
                        background: rgba(0,255,170,0.15);
                        color: #00ffaa;
                        border-radius: 12px;
                        font-weight: 600;
                    ">ANALIZANDO</span>
                </div>
                
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="chart-view-toggle" style="
                        padding: 6px 12px;
                        font-size: 12px;
                        background: rgba(0,212,255,0.15);
                        border: 1px solid #00d4ff;
                        color: #e0f0ff;
                        border-radius: 6px;
                        cursor: pointer;
                        font-family: 'JetBrains Mono', monospace;
                    ">Ver: <strong>IA</strong></button>
                    
                    <div style="display: flex; gap: 4px;">
                        <button id="chart-zoom-out" style="
                            width: 32px; height: 32px;
                            background: rgba(100,100,100,0.2);
                            border: 1px solid #666;
                            color: #fff;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 18px;
                        ">−</button>
                        <button id="chart-zoom-in" style="
                            width: 32px; height: 32px;
                            background: rgba(0,212,255,0.2);
                            border: 1px solid #00d4ff;
                            color: #fff;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 18px;
                        ">+</button>
                    </div>
                    
                    <button id="chart-expand" style="
                        padding: 6px 12px;
                        font-size: 11px;
                        background: rgba(255,255,255,0.05);
                        border: 1px solid rgba(255,255,255,0.2);
                        color: #aaa;
                        border-radius: 6px;
                        cursor: pointer;
                    ">⛶ Expandir</button>
                </div>
            </div>
            
            <!-- TOOLBAR ACTUALIZADO CON CONTROLES AVANZADOS -->
            <div class="chart-pro-toolbar" style="
                display: flex;
                gap: 15px;
                padding: 8px 16px;
                background: rgba(0,0,0,0.3);
                border-bottom: 1px solid rgba(100,100,100,0.1);
                font-size: 11px;
                color: #888;
                align-items: center;
                flex-wrap: wrap;
            ">
                <!-- Controles originales de medias -->
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="checkbox" id="toggle-ema9" checked style="accent-color: #00d4ff;"> 
                    <span style="color: #00d4ff;">EMA9</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="checkbox" id="toggle-ema21" checked style="accent-color: #ff00aa;"> 
                    <span style="color: #ff00aa;">EMA21</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="checkbox" id="toggle-ema55" checked style="accent-color: #ffb400;"> 
                    <span style="color: #ffb400;">EMA55</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="checkbox" id="toggle-sr" checked> 
                    <span>S/R Auto</span>
                </label>
                
                <!-- NUEVOS: Controles avanzados -->
                <div style="
                    display: flex;
                    gap: 10px;
                    margin-left: 15px;
                    padding-left: 15px;
                    border-left: 1px solid rgba(100,100,100,0.3);
                    align-items: center;
                ">
                    <label style="display: flex; align-items: center; gap: 5px; color: #aaa; font-size: 11px; cursor: pointer;" title="Volumen Bid/Ask por nivel de precio">
                        <input type="checkbox" id="toggle-footprint" style="accent-color: #ff9f43;"> 
                        <span>👣 Footprint</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 5px; color: #aaa; font-size: 11px; cursor: pointer;" title="Detección automática de patrones de velas">
                        <input type="checkbox" id="toggle-ai-patterns" checked style="accent-color: #00d4ff;"> 
                        <span>🧠 IA</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 5px; color: #aaa; font-size: 11px; cursor: pointer;" title="Timeframes superiores superpuestos">
                        <input type="checkbox" id="toggle-mtf" style="accent-color: #ff00aa;"> 
                        <span>⏱️ MTF</span>
                    </label>
                </div>
                
                <!-- Info de zoom y precios (siempre al final) -->
                <span style="margin-left: auto; font-family: 'JetBrains Mono', monospace;">
                    Zoom: <span id="zoom-level">100%</span> | 
                    Velas: <span id="candle-count">0</span> | 
                    <span id="price-range">---</span>
                </span>
            </div>
            
            <div class="chart-canvas-wrapper" style="
                position: relative;
                height: 400px;
                width: 100%;
                overflow: hidden;
            ">
                <canvas id="chart-main-canvas" style="
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                "></canvas>
                <canvas id="chart-overlay-canvas" style="
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    pointer-events: none;
                "></canvas>
                
                <!-- Tooltip flotante -->
                <div id="chart-tooltip" style="
                    position: absolute;
                    display: none;
                    background: rgba(10, 10, 30, 0.95);
                    border: 1px solid #00d4ff;
                    border-radius: 8px;
                    padding: 12px;
                    font-size: 11px;
                    font-family: 'JetBrains Mono', monospace;
                    color: #e0e0ff;
                    z-index: 1000;
                    pointer-events: none;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                "></div>
            </div>
            
            <!-- Panel de información y recomendación -->
            <div class="chart-info-panel" style="
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 15px;
                padding: 15px;
                background: rgba(0,0,0,0.2);
                border-top: 1px solid rgba(100,100,100,0.1);
            ">
                <div class="info-section" id="pattern-info">
                    <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 8px;">
                        Patrón Detectado
                    </div>
                    <div style="font-size: 14px; color: #00d4ff; font-weight: 600;" id="current-pattern">
                        Analizando...
                    </div>
                    <div style="font-size: 11px; color: #888; margin-top: 4px;" id="pattern-confidence">
                        Esperando datos
                    </div>
                </div>
                
                <div class="info-section" id="technical-info">
                    <div style="font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 8px;">
                        Señales Técnicas
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;" id="tech-signals">
                        <span style="padding: 3px 8px; background: rgba(100,100,100,0.2); border-radius: 4px; font-size: 10px;">
                            Sin señales
                        </span>
                    </div>
                </div>
                
                <div class="info-section" id="recommendation-box" style="
                    background: linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,255,170,0.05));
                    border-radius: 8px;
                    padding: 12px;
                    border: 1px solid rgba(0,212,255,0.2);
                ">
                    <div style="font-size: 10px; color: #00d4ff; text-transform: uppercase; margin-bottom: 6px;">
                        🧠 RECOMENDACIÓN IA
                    </div>
                    <div style="font-size: 18px; font-weight: 700; color: #ffb400;" id="ia-recommendation">
                        ESPERAR
                    </div>
                    <div style="font-size: 10px; color: #888; margin-top: 4px;" id="recommendation-reason">
                        Datos insuficientes
                    </div>
                </div>
            </div>
        `;
    }
    
    setupCanvases() {
        this.canvas = document.getElementById('chart-main-canvas');
        this.overlayCanvas = document.getElementById('chart-overlay-canvas');
        
        if (!this.canvas || !this.overlayCanvas) {
            console.error('[ChartV27] Canvases no encontrados');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        
        this.resizeCanvases();
        
        // Observer para resize
        const resizeObserver = new ResizeObserver(() => {
            this.resizeCanvases();
            this.render();
        });
        resizeObserver.observe(this.container);
    }
    
    resizeCanvases() {
        const wrapper = this.container.querySelector('.chart-canvas-wrapper');
        if (!wrapper) return;
        
        const rect = wrapper.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.dimensions.width = rect.width;
        this.dimensions.height = rect.height;
        this.dimensions.chartHeight = rect.height - this.dimensions.padding.top - this.dimensions.padding.bottom;
        
        [this.canvas, this.overlayCanvas].forEach(canvas => {
            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
        });
        
        this.ctx.scale(dpr, dpr);
        this.overlayCtx.scale(dpr, dpr);
    }
    
    setupEventListeners() {
        // Zoom
        document.getElementById('chart-zoom-in')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('chart-zoom-out')?.addEventListener('click', () => this.zoomOut());
        
        // Toggle view
        document.getElementById('chart-view-toggle')?.addEventListener('click', () => this.toggleView());
        
        // Expandir
        document.getElementById('chart-expand')?.addEventListener('click', () => this.toggleExpand());
        
        // Toggles de medias
        ['ema9', 'ema21', 'ema55', 'sr'].forEach(id => {
            document.getElementById(`toggle-${id}`)?.addEventListener('change', () => this.render());
        });
        
        // Interacción con canvas
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // Touch para móvil
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.handleMouseUp());
    }
    
    setupUI() {
        // Inicializar estado visual
        this.updateZoomDisplay();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // CONTROL DE ZOOM Y PAN
    // ═══════════════════════════════════════════════════════════════════════════════
    
    zoomIn() {
        const newZoom = Math.min(this.config.zoom.max, this.config.zoom.current * 1.2);
        this.setZoom(newZoom);
    }
    
    zoomOut() {
        const newZoom = Math.max(this.config.zoom.min, this.config.zoom.current / 1.2);
        this.setZoom(newZoom);
    }
    
    setZoom(level) {
        this.config.zoom.current = level;
        this.updateVisibleData();
        this.updateZoomDisplay();
        this.render();
    }
    
    updateZoomDisplay() {
        const pct = Math.round(this.config.zoom.current * 100);
        const el = document.getElementById('zoom-level');
        if (el) el.textContent = pct + '%';
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.config.zoom.min, 
                          Math.min(this.config.zoom.max, this.config.zoom.current * delta));
        this.setZoom(newZoom);
    }
    
    handleMouseDown(e) {
        this.state.isDragging = true;
        this.state.dragStartX = e.clientX;
        this.state.dragStartOffset = this.state.offset;
        this.canvas.style.cursor = 'grabbing';
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calcular índice bajo el cursor
        const candleWidth = this.getCandleWidth();
        const chartX = x - this.dimensions.padding.left + this.state.offset;
        const index = Math.floor(chartX / candleWidth);
        
        if (index !== this.state.hoverIndex && index >= 0 && index < this.state.data.length) {
            this.state.hoverIndex = index;
            this.showTooltip(x, y, index);
            this.renderOverlay();
        }
        
        // Pan
        if (this.state.isDragging) {
            const deltaX = e.clientX - this.state.dragStartX;
            this.state.offset = Math.max(0, this.state.dragStartOffset - deltaX);
            this.updateVisibleData();
            this.render();
        }
    }
    
    handleMouseUp() {
        this.state.isDragging = false;
        this.canvas.style.cursor = 'crosshair';
    }
    
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            this.handleMouseDown({ clientX: e.touches[0].clientX });
        } else if (e.touches.length === 2) {
            this.lastTouchDistance = this.getTouchDistance(e.touches);
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.handleMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
        } else if (e.touches.length === 2) {
            const dist = this.getTouchDistance(e.touches);
            const scale = dist / this.lastTouchDistance;
            this.setZoom(Math.max(this.config.zoom.min, 
                          Math.min(this.config.zoom.max, this.config.zoom.current * scale)));
            this.lastTouchDistance = dist;
        }
    }
    
    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx*dx + dy*dy);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // CÁLCULO DE MEDIAS MÓVILES
    // ═══════════════════════════════════════════════════════════════════════════════
    
    calculateEMA(data, period) {
        if (data.length < period) return new Array(data.length).fill(null);
        
        const k = 2 / (period + 1);
        const ema = [data[0].close];
        
        for (let i = 1; i < data.length; i++) {
            ema.push(data[i].close * k + ema[i-1] * (1 - k));
        }
        
        return ema;
    }
    
    calculateSMA(data, period) {
        if (data.length < period) return new Array(data.length).fill(null);
        
        const sma = new Array(period - 1).fill(null);
        
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.close, 0);
            sma.push(sum / period);
        }
        
        return sma;
    }
    
    updateMovingAverages() {
        const data = this.state.data;
        if (data.length === 0) return;
        
        // Calcular todas las EMAs
        this.config.movingAverages.ema.forEach(ema => {
            this.state.maData[`ema${ema.period}`] = this.calculateEMA(data, ema.period);
        });
        
        // Calcular SMAs
        this.config.movingAverages.sma.forEach(sma => {
            this.state.maData[`sma${sma.period}`] = this.calculateSMA(data, sma.period);
        });
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // DETECCIÓN DE SOPORTES Y RESISTENCIAS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    detectSupportResistance() {
        const data = this.state.data;
        if (data.length < 20) return;
        
        const { lookback, tolerance, minTouches } = this.config.supportResistance;
        const recent = data.slice(-lookback);
        
        // Encontrar pivots (máximos y mínimos locales)
        const highs = [];
        const lows = [];
        
        for (let i = 2; i < recent.length - 2; i++) {
            const candle = recent[i];
            const prev1 = recent[i-1];
            const prev2 = recent[i-2];
            const next1 = recent[i+1];
            const next2 = recent[i+2];
            
            // Máximo local
            if (candle.high > prev1.high && candle.high > prev2.high && 
                candle.high > next1.high && candle.high > next2.high) {
                highs.push({ price: candle.high, index: data.length - lookback + i, touches: 1 });
            }
            
            // Mínimo local
            if (candle.low < prev1.low && candle.low < prev2.low && 
                candle.low < next1.low && candle.low < next2.low) {
                lows.push({ price: candle.low, index: data.length - lookback + i, touches: 1 });
            }
        }
        
        // Agrupar niveles similares
        this.state.resistanceLevels = this.clusterLevels(highs, tolerance, minTouches);
        this.state.supportLevels = this.clusterLevels(lows, tolerance, minTouches);
        
        console.log(`[ChartV27] S/R detectados: ${this.state.supportLevels.length} soportes, ${this.state.resistanceLevels.length} resistencias`);
    }
    
    clusterLevels(levels, tolerance, minTouches) {
        const clusters = [];
        
        levels.forEach(level => {
            let added = false;
            for (let cluster of clusters) {
                const diff = Math.abs(level.price - cluster.price) / cluster.price;
                if (diff < tolerance) {
                    cluster.price = (cluster.price * cluster.touches + level.price) / (cluster.touches + 1);
                    cluster.touches++;
                    cluster.indices.push(level.index);
                    added = true;
                    break;
                }
            }
            if (!added) {
                clusters.push({ 
                    price: level.price, 
                    touches: 1, 
                    indices: [level.index],
                    strength: 0 
                });
            }
        });
        
        // Calcular fuerza basada en toques y recencia
        clusters.forEach(c => {
            const recency = Math.max(...c.indices) / this.state.data.length;
            c.strength = Math.min(1, (c.touches / minTouches) * 0.7 + recency * 0.3);
        });
        
        // Filtrar por mínimo toques y ordenar por fuerza
        return clusters
            .filter(c => c.touches >= minTouches)
            .sort((a, b) => b.strength - a.strength)
            .slice(0, this.config.supportResistance.maxLines);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // ACTUALIZACIÓN DE DATOS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    updateData(sequence) {
        if (!sequence || sequence.length === 0) return;
        
        // Convertir secuencia a OHLCV real
        this.state.data = this.sequenceToOHLCV(sequence);
        
        // Actualizar cálculos
        this.updateMovingAverages();
        this.detectSupportResistance();
        this.detectCrossovers();
        this.detectBounces();
        this.detectPatterns();
        this.generateProjections();
        this.generateRecommendation();
        
        // Actualizar vista
        this.updateVisibleData();
        this.render();
        this.updateInfoPanel();
        
        console.log(`[ChartV27] Datos actualizados: ${this.state.data.length} velas`);
    }
    
    sequenceToOHLCV(sequence) {
        const ohlcv = [];
        let basePrice = 100;
        
        for (let i = 0; i < sequence.length; i++) {
            const item = sequence[i];
            const val = typeof item === 'string' ? item : item.val;
            const isA = val === 'A';
            
            // Generar OHLC realista basado en A/B
            const volatility = 0.015; // 1.5% volatilidad base
            const trend = isA ? 0.008 : -0.008; // Tendencia según dirección
            
            const open = basePrice;
            const close = open * (1 + trend + (Math.random() - 0.5) * volatility);
            const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
            const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
            const volume = 1000 + Math.random() * 2000;
            
            ohlcv.push({
                open, high, low, close, volume,
                val, index: i,
                timestamp: item.timestamp || Date.now() + i * 1000
            });
            
            basePrice = close;
        }
        
        return ohlcv;
    }
    
    updateVisibleData() {
        const candleWidth = this.getCandleWidth();
        const visibleCount = Math.ceil(this.dimensions.width / candleWidth);
        
        const startIdx = Math.floor(this.state.offset / candleWidth);
        const endIdx = Math.min(startIdx + visibleCount + 2, this.state.data.length);
        
        this.state.visibleData = this.state.data.slice(startIdx, endIdx);
        
        // Actualizar contador
        const countEl = document.getElementById('candle-count');
        if (countEl) countEl.textContent = this.state.data.length;
    }
    
    getCandleWidth() {
        return (this.config.zoom.candleWidth + this.config.zoom.spacing) * this.config.zoom.current;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // MÉTODOS DE DETECCIÓN (Parte 2 los implementará completamente)
    // ═══════════════════════════════════════════════════════════════════════════════
    
    detectCrossovers() {
        // Implementado en Parte 2
        this.state.crossovers = [];
    }
    
    detectBounces() {
        // Implementado en Parte 2
        this.state.bounces = [];
    }
    
    detectPatterns() {
        // Implementado en Parte 2
        this.state.detectedPatterns = [];
    }
    
    generateProjections() {
        // Implementado en Parte 2
        this.state.projections = [];
    }
    
    generateRecommendation() {
        // Implementado en Parte 2
        this.state.recommendation = { action: 'ESPERAR', confidence: 0, reason: 'Analizando...' };
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // RENDERIZADO
    // ═══════════════════════════════════════════════════════════════════════════════
    
    startRenderLoop() {
        const loop = () => {
            if (this.state.lastUpdate !== this.state.data.length) {
                this.render();
                this.state.lastUpdate = this.state.data.length;
            }
            this.animationFrame = requestAnimationFrame(loop);
        };
        loop();
    }
    
    render() {
        if (!this.ctx || this.state.visibleData.length === 0) return;
        
        const { width, height, padding, chartHeight } = this.dimensions;
        const ctx = this.ctx;
        
        // Limpiar
        ctx.clearRect(0, 0, width, height);
        
        // Fondo
        ctx.fillStyle = this.config.colors.bg;
        ctx.fillRect(0, 0, width, height);
        
        // Calcular rangos de precios
        const priceRange = this.calculatePriceRange();
        if (!priceRange) return;
        
        const { min, max } = priceRange;
        const priceScale = chartHeight / (max - min);
        
        // Dibujar grid
        this.drawGrid(ctx, min, max, priceScale);
        
        // Dibujar líneas S/R
        this.drawSupportResistance(ctx, min, max, priceScale);
        
        // Dibujar medias móviles
        this.drawMovingAverages(ctx, min, max, priceScale);
        
        // Dibujar velas
        this.drawCandles(ctx, min, max, priceScale);
        
        // Dibujar proyecciones
        this.drawProjections(ctx, min, max, priceScale);
        
        // Dibujar información de precios
        this.drawPriceLabels(ctx, min, max);
    }
    
    calculatePriceRange() {
        if (this.state.visibleData.length === 0) return null;
        
        let min = Infinity, max = -Infinity;
        
        this.state.visibleData.forEach(d => {
            min = Math.min(min, d.low);
            max = Math.max(max, d.high);
        });
        
        // Incluir niveles S/R visibles
        [...this.state.supportLevels, ...this.state.resistanceLevels].forEach(level => {
            if (level.price >= min * 0.9 && level.price <= max * 1.1) {
                min = Math.min(min, level.price);
                max = Math.max(max, level.price);
            }
        });
        
        // Padding
        const range = max - min;
        return { min: min - range * 0.05, max: max + range * 0.05 };
    }
    
    drawGrid(ctx, min, max, priceScale) {
        const { width, height, padding, chartHeight } = this.dimensions;
        const gridColor = this.config.colors.grid;
        
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        
        // Líneas horizontales de precio
        const priceStep = this.calculateNiceStep(max - min, 6);
        let price = Math.ceil(min / priceStep) * priceStep;
        
        ctx.font = '11px JetBrains Mono';
        ctx.textAlign = 'right';
        ctx.fillStyle = this.config.colors.gridText;
        
        while (price <= max) {
            const y = padding.top + chartHeight - ((price - min) * priceScale);
            
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
            
            ctx.fillText(price.toFixed(2), width - padding.right + 70, y + 4);
            
            price += priceStep;
        }
        
        // Líneas verticales de tiempo
        const candleWidth = this.getCandleWidth();
        const timeStep = Math.ceil(50 / candleWidth);
        
        for (let i = 0; i < this.state.visibleData.length; i += timeStep) {
            const x = this.dimensions.padding.left + i * candleWidth - (this.state.offset % candleWidth);
            
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + chartHeight);
            ctx.stroke();
        }
    }
    
    calculateNiceStep(range, targetCount) {
        const rough = range / targetCount;
        const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
        const normalized = rough / pow10;
        
        if (normalized <= 1) return pow10;
        if (normalized <= 2) return 2 * pow10;
        if (normalized <= 5) return 5 * pow10;
        return 10 * pow10;
    }
    
    drawSupportResistance(ctx, min, max, priceScale) {
        if (!document.getElementById('toggle-sr')?.checked) return;
        
        const { padding, chartHeight } = this.dimensions;
        const candleWidth = this.getCandleWidth();
        
        [...this.state.supportLevels, ...this.state.resistanceLevels].forEach(level => {
            const y = padding.top + chartHeight - ((level.price - min) * priceScale);
            const isSupport = this.state.supportLevels.includes(level);
            
            // Línea
            ctx.strokeStyle = isSupport ? this.config.colors.bull : this.config.colors.bear;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.3 + level.strength * 0.5;
            ctx.setLineDash([5, 5]);
            
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(this.dimensions.width - this.dimensions.padding.right, y);
            ctx.stroke();
            
            // Zona de influencia
            const zoneHeight = 8 * priceScale;
            ctx.fillStyle = isSupport ? this.config.colors.bullShadow : this.config.colors.bearShadow;
            ctx.fillRect(padding.left, y - zoneHeight/2, 
                        this.dimensions.width - padding.left - this.dimensions.padding.right, 
                        zoneHeight);
            
            // Etiqueta
            ctx.fillStyle = isSupport ? this.config.colors.bull : this.config.colors.bear;
            ctx.font = 'bold 11px JetBrains Mono';
            ctx.textAlign = 'left';
            ctx.fillText(
                `${isSupport ? 'S' : 'R'}${level.touches} ${level.price.toFixed(2)}`, 
                padding.left + 5, 
                y - 5
            );
            
            ctx.globalAlpha = 1;
            ctx.setLineDash([]);
        });
    }
    
    drawMovingAverages(ctx, min, max, priceScale) {
        const { padding, chartHeight } = this.dimensions;
        const candleWidth = this.getCandleWidth();
        
        // Dibujar EMAs
        this.config.movingAverages.ema.forEach(ema => {
            if (!document.getElementById(`toggle-ema${ema.period}`)?.checked) return;
            
            const data = this.state.maData[`ema${ema.period}`];
            if (!data) return;
            
            ctx.strokeStyle = ema.color;
            ctx.lineWidth = ema.width;
            ctx.beginPath();
            
            let started = false;
            this.state.visibleData.forEach((candle, i) => {
                const globalIdx = this.state.data.indexOf(candle);
                const value = data[globalIdx];
                
                if (value === null || isNaN(value)) return;
                
                const x = padding.left + i * candleWidth + candleWidth / 2 - (this.state.offset % candleWidth);
                const y = padding.top + chartHeight - ((value - min) * priceScale);
                
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        });
        
        // Dibujar SMAs
        this.config.movingAverages.sma.forEach(sma => {
            if (!document.getElementById(`toggle-sma${sma.period}`)?.checked) return;
            
            const data = this.state.maData[`sma${sma.period}`];
            if (!data) return;
            
            ctx.strokeStyle = sma.color;
            ctx.lineWidth = sma.width;
            if (sma.dashed) ctx.setLineDash([3, 3]);
            ctx.beginPath();
            
            let started = false;
            this.state.visibleData.forEach((candle, i) => {
                const globalIdx = this.state.data.indexOf(candle);
                const value = data[globalIdx];
                
                if (value === null || isNaN(value)) return;
                
                const x = padding.left + i * candleWidth + candleWidth / 2 - (this.state.offset % candleWidth);
                const y = padding.top + chartHeight - ((value - min) * priceScale);
                
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }
    
    drawCandles(ctx, min, max, priceScale) {
        const { padding, chartHeight } = this.dimensions;
        const candleWidth = this.config.zoom.candleWidth * this.config.zoom.current;
        const offset = this.state.offset % (candleWidth + this.config.zoom.spacing * this.config.zoom.current);
        
        this.state.visibleData.forEach((candle, i) => {
            const x = padding.left + i * (candleWidth + this.config.zoom.spacing * this.config.zoom.current) - offset;
            const isBull = candle.close >= candle.open;
            const color = isBull ? this.config.colors.bull : this.config.colors.bear;
            
            const yOpen = padding.top + chartHeight - ((candle.open - min) * priceScale);
            const yClose = padding.top + chartHeight - ((candle.close - min) * priceScale);
            const yHigh = padding.top + chartHeight - ((candle.high - min) * priceScale);
            const yLow = padding.top + chartHeight - ((candle.low - min) * priceScale);
            
            // Sombra
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.moveTo(x + candleWidth / 2, yHigh);
            ctx.lineTo(x + candleWidth / 2, yLow);
            ctx.stroke();
            
            // Cuerpo
            ctx.fillStyle = color;
            ctx.globalAlpha = 1;
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);
            ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
            
            // Brillo en velas recientes
            if (i > this.state.visibleData.length - 5) {
                ctx.shadowColor = color;
                ctx.shadowBlur = 10;
                ctx.strokeRect(x, bodyTop, candleWidth, bodyHeight);
                ctx.shadowBlur = 0;
            }
            
            // Indicador de valor A/B
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px JetBrains Mono';
            ctx.textAlign = 'center';
            ctx.globalAlpha = 0.7;
            ctx.fillText(candle.val, x + candleWidth / 2, yLow + 12);
            ctx.globalAlpha = 1;
        });
    }
    
    drawProjections(ctx, min, max, priceScale) {
        // Implementado completamente en Parte 2
    }
    
    drawPriceLabels(ctx, min, max) {
        const rangeEl = document.getElementById('price-range');
        if (rangeEl) {
            rangeEl.textContent = `${min.toFixed(2)} - ${max.toFixed(2)}`;
        }
    }
    
    renderOverlay() {
        // Crosshair y tooltip
        const ctx = this.overlayCtx;
        const { width, height, padding, chartHeight } = this.dimensions;
        
        ctx.clearRect(0, 0, width, height);
        
        if (this.state.hoverIndex < 0 || this.state.hoverIndex >= this.state.data.length) return;
        
        const candle = this.state.data[this.state.hoverIndex];
        const candleWidth = this.getCandleWidth();
        const localIdx = this.state.visibleData.indexOf(candle);
        
        if (localIdx < 0) return;
        
        const x = padding.left + localIdx * candleWidth + candleWidth / 2 - (this.state.offset % candleWidth);
        const priceRange = this.calculatePriceRange();
        const y = padding.top + chartHeight - ((candle.close - priceRange.min) * (chartHeight / (priceRange.max - priceRange.min)));
        
        // Crosshair
        ctx.strokeStyle = this.config.colors.crosshair;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.globalAlpha = 0.5;
        
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        
        // Punto central
        ctx.fillStyle = this.config.colors.crosshair;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    showTooltip(x, y, index) {
        const tooltip = document.getElementById('chart-tooltip');
        if (!tooltip || index < 0 || index >= this.state.data.length) return;
        
        const candle = this.state.data[index];
        
        tooltip.style.display = 'block';
        tooltip.style.left = Math.min(x + 15, this.dimensions.width - 150) + 'px';
        tooltip.style.top = Math.max(y - 50, 10) + 'px';
        
        tooltip.innerHTML = `
            <div style="font-weight: bold; color: ${candle.val === 'A' ? '#00ffaa' : '#ff4d82'}; margin-bottom: 6px;">
                Vela #${index + 1} [${candle.val}]
            </div>
            <div style="display: grid; grid-template-columns: auto auto; gap: 8px 12px;">
                <span style="color: #888;">Open:</span> <span>${candle.open.toFixed(4)}</span>
                <span style="color: #888;">High:</span> <span style="color: #00ffaa;">${candle.high.toFixed(4)}</span>
                <span style="color: #888;">Low:</span> <span style="color: #ff4d82;">${candle.low.toFixed(4)}</span>
                <span style="color: #888;">Close:</span> <span>${candle.close.toFixed(4)}</span>
            </div>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(100,100,100,0.3); font-size: 10px; color: #666;">
                ${new Date(candle.timestamp).toLocaleTimeString()}
            </div>
        `;
    }
    
    hideTooltip() {
        const tooltip = document.getElementById('chart-tooltip');
        if (tooltip) tooltip.style.display = 'none';
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // UI Y CONTROLES
    // ═══════════════════════════════════════════════════════════════════════════════
    
    toggleView() {
        this.state.view = this.state.view === 'IA' ? 'TU' : 'IA';
        const btn = document.getElementById('chart-view-toggle');
        if (btn) btn.innerHTML = `Ver: <strong>${this.state.view}</strong>`;
        
        // Actualizar datos según vista
        const sequence = this.state.view === 'IA' 
            ? (window.sequence || [])
            : (window.userManualSequence || []);
        
        this.updateData(sequence);
        
        console.log(`[ChartV27] Vista cambiada a: ${this.state.view}`);
    }
    
    toggleExpand() {
        this.container.classList.toggle('expanded');
        const wrapper = this.container.querySelector('.chart-canvas-wrapper');
        if (wrapper) {
            wrapper.style.height = this.container.classList.contains('expanded') ? '600px' : '400px';
        }
        setTimeout(() => this.resizeCanvases(), 100);
    }
    
    updateInfoPanel() {
        // Actualizar panel de información
        const patternEl = document.getElementById('current-pattern');
        const confEl = document.getElementById('pattern-confidence');
        const recEl = document.getElementById('ia-recommendation');
        const reasonEl = document.getElementById('recommendation-reason');
        
        if (this.state.detectedPatterns.length > 0) {
            const top = this.state.detectedPatterns[0];
            if (patternEl) patternEl.textContent = top.name;
            if (confEl) confEl.textContent = `Confianza: ${(top.confidence * 100).toFixed(1)}%`;
        }
        
        if (this.state.recommendation) {
            const rec = this.state.recommendation;
            if (recEl) {
                recEl.textContent = rec.action;
                recEl.style.color = rec.action === 'COMPRA' ? '#00ffaa' : 
                                   rec.action === 'VENTA' ? '#ff4d82' : '#ffb400';
            }
            if (reasonEl) reasonEl.textContent = rec.reason;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // API PÚBLICA
    // ═══════════════════════════════════════════════════════════════════════════════
    
    forceUpdate() {
        const sequence = this.state.view === 'IA' 
            ? (window.sequence || [])
            : (window.userManualSequence || []);
        this.updateData(sequence);
    }
    
    getCurrentSignal() {
        return {
            recommendation: this.state.recommendation,
            patterns: this.state.detectedPatterns,
            support: this.state.supportLevels,
            resistance: this.state.resistanceLevels,
            crossovers: this.state.crossovers,
            bounces: this.state.bounces
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN GLOBAL
// ═══════════════════════════════════════════════════════════════════════════════

window.ChartPatternEngineV27 = ChartPatternEngineV27;

// Bandera para evitar inicialización múltiple
window.chartV27Initialized = false;

// Inicializar cuando el DOM esté listo
function initChartPatternV27() {
    // EVITAR INICIALIZACIÓN MÚLTIPLE - Esto previene velas duplicadas
    if (window.chartV27Initialized) {
        console.log('[ChartV27] Ya inicializado, ignorando llamada duplicada');
        return;
    }

    console.log('[ChartV27] Preparando inicialización...');

    // Esperar a que exista el dashboard
    const checkAndInit = () => {
        const dashboard = document.querySelector('.v27-dashboard');
        if (dashboard && window.MarketBridgeV27) {
            // Marcar como inicializado INMEDIATAMENTE para evitar race conditions
            window.chartV27Initialized = true;

            window.chartEngine = new ChartPatternEngineV27();

            // Integrar con MarketBridgeV27 solo si no se ha hecho antes
            if (!window.MarketBridgeV27._chartV27Integrated) {
                window.MarketBridgeV27._chartV27Integrated = true;

                // Guardar referencia al método original solo una vez
                const originalProcess = window.MarketBridgeV27.processTradeResult.bind(window.MarketBridgeV27);

                window.MarketBridgeV27.processTradeResult = function(prediction) {
                    // Guardar en secuencia manual con verificación de duplicados por timestamp
                    if (prediction && (prediction === 'A' || prediction === 'B')) {
                        if (!window.userManualSequence) window.userManualSequence = [];

                        const now = Date.now();

                        // EVITAR DUPLICADOS: Verificar si la última vela tiene el mismo valor y timestamp muy cercano (< 500ms)
                        const lastCandle = window.userManualSequence.length > 0 
                            ? window.userManualSequence[window.userManualSequence.length - 1] 
                            : null;

                        const isDuplicate = lastCandle && 
                            lastCandle.val === prediction && 
                            (now - lastCandle.timestamp) < 500; // 500ms de protección

                        if (!isDuplicate) {
                            window.userManualSequence.push({
                                val: prediction,
                                prediction: prediction,
                                timestamp: now
                            });
                            if (window.userManualSequence.length > 40) window.userManualSequence.shift();

                            console.log(`[ChartV27] Vela manual agregada: ${prediction} (total: ${window.userManualSequence.length})`);
                        } else {
                            console.log(`[ChartV27] Vela duplicada ignorada: ${prediction}`);
                        }
                    }

                    // Llamar original
                    originalProcess(prediction);

                    // Actualizar chart
                    if (window.chartEngine) {
                        window.chartEngine.forceUpdate();
                    }
                };

                console.log('✅ ChartPatternEngineV27 integrado con MarketBridgeV27 (protección anti-duplicados activada)');
            }
        } else {
            setTimeout(checkAndInit, 500);
        }
    };

    checkAndInit();
}

// Iniciar solo si no se ha inicializado antes
if (!window.chartV27Initialized) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChartPatternV27);
    } else {
        setTimeout(initChartPatternV27, 1000);
    }
} else {
    console.log('[ChartV27] Sistema ya inicializado previamente');
}

console.log('✅ Parte 1/3 cargada: ChartPatternEngineV27 PRO - Core y Canvas Avanzado');









// Extensión de ChartPatternEngineV27 - Métodos de detección avanzada  Paso 2

ChartPatternEngineV27.prototype.detectCrossovers = function() {
    this.state.crossovers = [];
    
    const ema9 = this.state.maData['ema9'];
    const ema21 = this.state.maData['ema21'];
    const ema55 = this.state.maData['ema55'];
    
    if (!ema9 || !ema21 || !ema55) return;
    
    // Detectar cruces EMA9/EMA21 (rápido sobre lento)
    for (let i = 2; i < this.state.data.length; i++) {
        // Golden Cross (9 cruza 21 hacia arriba)
        if (ema9[i-1] <= ema21[i-1] && ema9[i] > ema21[i]) {
            this.state.crossovers.push({
                index: i,
                type: 'GOLDEN_CROSS',
                fastMA: 'EMA9',
                slowMA: 'EMA21',
                price: this.state.data[i].close,
                strength: this.calculateCrossoverStrength(i, 'bull')
            });
        }
        
        // Death Cross (9 cruza 21 hacia abajo)
        if (ema9[i-1] >= ema21[i-1] && ema9[i] < ema21[i]) {
            this.state.crossovers.push({
                index: i,
                type: 'DEATH_CROSS',
                fastMA: 'EMA9',
                slowMA: 'EMA21',
                price: this.state.data[i].close,
                strength: this.calculateCrossoverStrength(i, 'bear')
            });
        }
        
        // Cruce con EMA55 (tendencia mayor)
        if (ema21[i-1] <= ema55[i-1] && ema21[i] > ema55[i]) {
            this.state.crossovers.push({
                index: i,
                type: 'TREND_CHANGE_BULL',
                fastMA: 'EMA21',
                slowMA: 'EMA55',
                price: this.state.data[i].close,
                strength: 'HIGH'
            });
        }
        
        if (ema21[i-1] >= ema55[i-1] && ema21[i] < ema55[i]) {
            this.state.crossovers.push({
                index: i,
                type: 'TREND_CHANGE_BEAR',
                fastMA: 'EMA21',
                slowMA: 'EMA55',
                price: this.state.data[i].close,
                strength: 'HIGH'
            });
        }
    }
    
    // Mantener solo cruces recientes (últimas 20 velas)
    this.state.crossovers = this.state.crossovers.filter(c => 
        c.index >= this.state.data.length - 20
    );
};

ChartPatternEngineV27.prototype.calculateCrossoverStrength = function(index, direction) {
    const data = this.state.data;
    const candle = data[index];
    
    // Volumen relativo (simulado por rango de vela)
    const range = (candle.high - candle.low) / candle.open;
    const avgRange = this.calculateAverageRange(index - 5, index);
    const volumeFactor = range / avgRange;
    
    // Confirmación de cierre
    const closeConfirm = direction === 'bull' 
        ? candle.close > candle.open 
        : candle.close < candle.open;
    
    // Distancia del cruce
    const ema9 = this.state.maData['ema9'][index];
    const ema21 = this.state.maData['ema21'][index];
    const separation = Math.abs(ema9 - ema21) / candle.close;
    
    let strength = 'MEDIUM';
    if (volumeFactor > 1.3 && closeConfirm && separation > 0.001) strength = 'HIGH';
    else if (volumeFactor < 0.8 || !closeConfirm) strength = 'LOW';
    
    return strength;
};

ChartPatternEngineV27.prototype.calculateAverageRange = function(start, end) {
    let sum = 0;
    let count = 0;
    for (let i = Math.max(0, start); i < Math.min(this.state.data.length, end); i++) {
        sum += (this.state.data[i].high - this.state.data[i].low) / this.state.data[i].open;
        count++;
    }
    return count > 0 ? sum / count : 0.01;
};

ChartPatternEngineV27.prototype.detectBounces = function() {
    this.state.bounces = [];
    
    if (this.state.data.length < 5) return;
    
    const data = this.state.data;
    const supports = this.state.supportLevels;
    const resistances = this.state.resistanceLevels;
    
    // Analizar últimas 10 velas
    const lookback = Math.min(10, data.length);
    
    for (let i = data.length - lookback; i < data.length; i++) {
        const candle = data[i];
        
        // Rebotar en soporte
        supports.forEach(level => {
            const zone = level.price * 0.02; // 2% de zona
            
            // Tocó o penetró soporte y rebotó al alza
            if (candle.low <= level.price + zone && candle.close > candle.open) {
                // Confirmar que la vela anterior estaba por debajo o tocando
                const prev = data[i-1];
                if (prev && prev.close <= level.price + zone * 2) {
                    this.state.bounces.push({
                        index: i,
                        type: 'SUPPORT_BOUNCE',
                        level: level.price,
                        strength: level.strength,
                        candle: candle,
                        confirmation: this.checkBounceConfirmation(i, level.price, 'up')
                    });
                }
            }
        });
        
        // Rebotar en resistencia (rechazo)
        resistances.forEach(level => {
            const zone = level.price * 0.02;
            
            // Tocó resistencia y fue rechazado a la baja
            if (candle.high >= level.price - zone && candle.close < candle.open) {
                const prev = data[i-1];
                if (prev && prev.close >= level.price - zone * 2) {
                    this.state.bounces.push({
                        index: i,
                        type: 'RESISTANCE_REJECT',
                        level: level.price,
                        strength: level.strength,
                        candle: candle,
                        confirmation: this.checkBounceConfirmation(i, level.price, 'down')
                    });
                }
            }
        });
    }
    
    // Eliminar duplicados (misma vela, mismo tipo)
    this.state.bounces = this.state.bounces.filter((bounce, index, self) =>
        index === self.findIndex(b => b.index === bounce.index && b.type === bounce.type)
    );
};

ChartPatternEngineV27.prototype.checkBounceConfirmation = function(index, level, direction) {
    if (index >= this.state.data.length - 1) return 'PENDING';
    
    const nextCandle = this.state.data[index + 1];
    const expected = direction === 'up' 
        ? nextCandle.close > nextCandle.open 
        : nextCandle.close < nextCandle.open;
    
    return expected ? 'CONFIRMED' : 'FAILED';
};

ChartPatternEngineV27.prototype.detectPatterns = function() {
    this.state.detectedPatterns = [];
    
    if (this.state.data.length < 10) return;
    
    const data = this.state.data;
    
    // 1. DOBLE TECHO (Double Top)
    const doubleTop = this.detectDoubleTop(data);
    if (doubleTop.detected) {
        this.state.detectedPatterns.push(doubleTop);
    }
    
    // 2. DOBLE SUELO (Double Bottom)
    const doubleBottom = this.detectDoubleBottom(data);
    if (doubleBottom.detected) {
        this.state.detectedPatterns.push(doubleBottom);
    }
    
    // 3. TRIÁNGULO ASCENDENTE
    const ascTriangle = this.detectAscendingTriangle(data);
    if (ascTriangle.detected) {
        this.state.detectedPatterns.push(ascTriangle);
    }
    
    // 4. TRIÁNGULO DESCENDENTE
    const descTriangle = this.detectDescendingTriangle(data);
    if (descTriangle.detected) {
        this.state.detectedPatterns.push(descTriangle);
    }
    
    // 5. BANDERA ALCISTA (Bull Flag)
    const bullFlag = this.detectBullFlag(data);
    if (bullFlag.detected) {
        this.state.detectedPatterns.push(bullFlag);
    }
    
    // 6. BANDERA BAJISTA (Bear Flag)
    const bearFlag = this.detectBearFlag(data);
    if (bearFlag.detected) {
        this.state.detectedPatterns.push(bearFlag);
    }
    
    // 7. CUÑA ASCENDENTE (Rising Wedge - bearish)
    const risingWedge = this.detectRisingWedge(data);
    if (risingWedge.detected) {
        this.state.detectedPatterns.push(risingWedge);
    }
    
    // 8. CUÑA DESCENDENTE (Falling Wedge - bullish)
    const fallingWedge = this.detectFallingWedge(data);
    if (fallingWedge.detected) {
        this.state.detectedPatterns.push(fallingWedge);
    }
    
    // Ordenar por confianza
    this.state.detectedPatterns.sort((a, b) => b.confidence - a.confidence);
};

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTORES DE PATRONES ESPECÍFICOS
// ═══════════════════════════════════════════════════════════════════════════════

ChartPatternEngineV27.prototype.detectDoubleTop = function(data) {
    if (data.length < 15) return { detected: false };
    
    const recent = data.slice(-20);
    const highs = recent.map((d, i) => ({ price: d.high, index: data.length - 20 + i }))
                        .sort((a, b) => b.price - a.price);
    
    if (highs.length < 2) return { detected: false };
    
    const top1 = highs[0];
    const top2 = highs.find(h => Math.abs(h.price - top1.price) / top1.price < 0.03 && 
                                  Math.abs(h.index - top1.index) > 3);
    
    if (!top2) return { detected: false };
    
    // Verificar valle entre tops
    const between = data.slice(Math.min(top1.index, top2.index) + 1, Math.max(top1.index, top2.index));
    const valley = Math.min(...between.map(d => d.low));
    const neckline = valley;
    
    // Confirmar que estamos cerca del segundo tope o rompimos neckline
    const lastPrice = data[data.length - 1].close;
    const confirmation = lastPrice < neckline * 1.02;
    
    return {
        name: 'DOBLE TECHO',
        icon: '📉',
        detected: true,
        confidence: confirmation ? 0.85 : 0.70,
        type: 'REVERSAL_BEARISH',
        direction: 'SELL',
        tops: [top1, top2],
        neckline: neckline,
        target: neckline - (Math.max(top1.price, top2.price) - neckline),
        confirmation: confirmation,
        description: 'Patrón de reversión bajista. Dos máximos similares con valle entre ellos.'
    };
};

ChartPatternEngineV27.prototype.detectDoubleBottom = function(data) {
    if (data.length < 15) return { detected: false };
    
    const recent = data.slice(-20);
    const lows = recent.map((d, i) => ({ price: d.low, index: data.length - 20 + i }))
                       .sort((a, b) => a.price - b.price);
    
    if (lows.length < 2) return { detected: false };
    
    const bottom1 = lows[0];
    const bottom2 = lows.find(l => Math.abs(l.price - bottom1.price) / bottom1.price < 0.03 && 
                                   Math.abs(l.index - bottom1.index) > 3);
    
    if (!bottom2) return { detected: false };
    
    const between = data.slice(Math.min(bottom1.index, bottom2.index) + 1, Math.max(bottom1.index, bottom2.index));
    const peak = Math.max(...between.map(d => d.high));
    const neckline = peak;
    
    const lastPrice = data[data.length - 1].close;
    const confirmation = lastPrice > neckline * 0.98;
    
    return {
        name: 'DOBLE SUELO',
        icon: '📈',
        detected: true,
        confidence: confirmation ? 0.85 : 0.70,
        type: 'REVERSAL_BULLISH',
        direction: 'BUY',
        bottoms: [bottom1, bottom2],
        neckline: neckline,
        target: neckline + (neckline - Math.min(bottom1.price, bottom2.price)),
        confirmation: confirmation,
        description: 'Patrón de reversión alcista. Dos mínimos similares con pico entre ellos.'
    };
};

ChartPatternEngineV27.prototype.detectAscendingTriangle = function(data) {
    if (data.length < 15) return { detected: false };
    
    const recent = data.slice(-15);
    const highs = recent.map(d => d.high);
    const lows = recent.map(d => d.low);
    
    // Resistencia horizontal
    const resistance = Math.max(...highs.slice(0, 5));
    const touchesResistance = highs.filter(h => h > resistance * 0.995).length;
    
    // Soporte ascendente
    const firstLows = lows.slice(0, 5);
    const lastLows = lows.slice(-5);
    const avgFirst = firstLows.reduce((a,b) => a+b, 0) / firstLows.length;
    const avgLast = lastLows.reduce((a,b) => a+b, 0) / lastLows.length;
    const risingSupport = avgLast > avgFirst * 1.02;
    
    // Convergencia
    const startRange = resistance - avgFirst;
    const endRange = resistance - avgLast;
    const converging = endRange < startRange * 0.7;
    
    const detected = touchesResistance >= 2 && risingSupport && converging;
    const breakout = data[data.length - 1].close > resistance * 1.01;
    
    return {
        name: 'TRIÁNGULO ASCENDENTE',
        icon: '▲',
        detected,
        confidence: breakout ? 0.80 : 0.65,
        type: 'CONTINUATION_BULLISH',
        direction: 'BUY',
        resistance,
        support: avgLast,
        target: resistance + (resistance - avgFirst),
        breakout,
        description: 'Patrón de continuación alcista. Resistencia horizontal, soporte ascendente.'
    };
};

ChartPatternEngineV27.prototype.detectDescendingTriangle = function(data) {
    if (data.length < 15) return { detected: false };
    
    const recent = data.slice(-15);
    const highs = recent.map(d => d.high);
    const lows = recent.map(d => d.low);
    
    const support = Math.min(...lows.slice(0, 5));
    const touchesSupport = lows.filter(l => l < support * 1.005).length;
    
    const firstHighs = highs.slice(0, 5);
    const lastHighs = highs.slice(-5);
    const avgFirst = firstHighs.reduce((a,b) => a+b, 0) / firstHighs.length;
    const avgLast = lastHighs.reduce((a,b) => a+b, 0) / lastHighs.length;
    const fallingResistance = avgLast < avgFirst * 0.98;
    
    const detected = touchesSupport >= 2 && fallingResistance;
    const breakdown = data[data.length - 1].close < support * 0.99;
    
    return {
        name: 'TRIÁNGULO DESCENDENTE',
        icon: '▼',
        detected,
        confidence: breakdown ? 0.80 : 0.65,
        type: 'CONTINUATION_BEARISH',
        direction: 'SELL',
        support,
        resistance: avgLast,
        target: support - (avgFirst - support),
        breakdown,
        description: 'Patrón de continuación bajista. Soporte horizontal, resistencia descendente.'
    };
};

ChartPatternEngineV27.prototype.detectBullFlag = function(data) {
    if (data.length < 12) return { detected: false };
    
    const pole = data.slice(-12, -5);
    const flag = data.slice(-5);
    
    // Polo fuerte alcista
    const poleMove = (pole[pole.length - 1].close - pole[0].open) / pole[0].open;
    if (poleMove < 0.03) return { detected: false };
    
    // Bandera: consolidación descendente o lateral
    const flagHigh = Math.max(...flag.map(d => d.high));
    const flagLow = Math.min(...flag.map(d => d.low));
    const flagRange = (flagHigh - flagLow) / flag[0].close;
    const flagSlope = (flag[flag.length - 1].close - flag[0].open) / flag[0].open;
    
    const isFlag = flagRange < 0.04 && flagSlope < 0.01;
    const breakout = data[data.length - 1].close > flagHigh * 1.005;
    
    return {
        name: 'BANDERA ALCISTA',
        icon: '🏳️',
        detected: isFlag,
        confidence: breakout ? 0.85 : 0.70,
        type: 'CONTINUATION_BULLISH',
        direction: 'BUY',
        poleTarget: flag[flag.length - 1].close + (pole[pole.length - 1].close - pole[0].open),
        breakout,
        description: 'Continuación alcista tras movimiento fuerte (polo) y consolidación (bandera).'
    };
};

ChartPatternEngineV27.prototype.detectBearFlag = function(data) {
    if (data.length < 12) return { detected: false };
    
    const pole = data.slice(-12, -5);
    const flag = data.slice(-5);
    
    const poleMove = (pole[pole.length - 1].close - pole[0].open) / pole[0].open;
    if (poleMove > -0.03) return { detected: false };
    
    const flagHigh = Math.max(...flag.map(d => d.high));
    const flagLow = Math.min(...flag.map(d => d.low));
    const flagRange = (flagHigh - flagLow) / flag[0].close;
    const flagSlope = (flag[flag.length - 1].close - flag[0].open) / flag[0].open;
    
    const isFlag = flagRange < 0.04 && flagSlope > -0.01;
    const breakdown = data[data.length - 1].close < flagLow * 0.995;
    
    return {
        name: 'BANDERA BAJISTA',
        icon: '🏴',
        detected: isFlag,
        confidence: breakdown ? 0.85 : 0.70,
        type: 'CONTINUATION_BEARISH',
        direction: 'SELL',
        poleTarget: flag[flag.length - 1].close + (pole[pole.length - 1].close - pole[0].open),
        breakdown,
        description: 'Continuación bajista tras movimiento fuerte bajista y consolidación.'
    };
};

ChartPatternEngineV27.prototype.detectRisingWedge = function(data) {
    if (data.length < 15) return { detected: false };
    
    const recent = data.slice(-15);
    const highs = recent.map(d => d.high);
    const lows = recent.map(d => d.low);
    
    // Ambas líneas ascendentes pero convergentes
    const firstHighs = highs.slice(0, 5);
    const lastHighs = highs.slice(-5);
    const firstLows = lows.slice(0, 5);
    const lastLows = lows.slice(-5);
    
    const avgFirstHigh = firstHighs.reduce((a,b) => a+b, 0) / firstHighs.length;
    const avgLastHigh = lastHighs.reduce((a,b) => a+b, 0) / lastHighs.length;
    const avgFirstLow = firstLows.reduce((a,b) => a+b, 0) / firstLows.length;
    const avgLastLow = lastLows.reduce((a,b) => a+b, 0) / lastLows.length;
    
    const risingHighs = avgLastHigh > avgFirstHigh;
    const risingLows = avgLastLow > avgFirstLow;
    const converging = (avgLastHigh - avgLastLow) < (avgFirstHigh - avgFirstLow) * 0.8;
    
    const detected = risingHighs && risingLows && converging;
    const breakdown = data[data.length - 1].close < avgLastLow * 0.995;
    
    return {
        name: 'CUÑA ASCENDENTE',
        icon: '⚠️',
        detected,
        confidence: breakdown ? 0.80 : 0.65,
        type: 'REVERSAL_BEARISH',
        direction: 'SELL',
        target: avgLastLow - (avgLastHigh - avgLastLow),
        breakdown,
        description: 'Patrón de reversión bajista. Convergencia alcista que agota momentum.'
    };
};

ChartPatternEngineV27.prototype.detectFallingWedge = function(data) {
    if (data.length < 15) return { detected: false };
    
    const recent = data.slice(-15);
    const highs = recent.map(d => d.high);
    const lows = recent.map(d => d.low);
    
    const firstHighs = highs.slice(0, 5);
    const lastHighs = highs.slice(-5);
    const firstLows = lows.slice(0, 5);
    const lastLows = lows.slice(-5);
    
    const avgFirstHigh = firstHighs.reduce((a,b) => a+b, 0) / firstHighs.length;
    const avgLastHigh = lastHighs.reduce((a,b) => a+b, 0) / lastHighs.length;
    const avgFirstLow = firstLows.reduce((a,b) => a+b, 0) / firstLows.length;
    const avgLastLow = lastLows.reduce((a,b) => a+b, 0) / lastLows.length;
    
    const fallingHighs = avgLastHigh < avgFirstHigh;
    const fallingLows = avgLastLow < avgFirstLow;
    const converging = (avgLastHigh - avgLastLow) < (avgFirstHigh - avgFirstLow) * 0.8;
    
    const detected = fallingHighs && fallingLows && converging;
    const breakout = data[data.length - 1].close > avgLastHigh * 1.005;
    
    return {
        name: 'CUÑA DESCENDENTE',
        icon: '🚀',
        detected,
        confidence: breakout ? 0.80 : 0.65,
        type: 'REVERSAL_BULLISH',
        direction: 'BUY',
        target: avgLastHigh + (avgLastHigh - avgLastLow),
        breakout,
        description: 'Patrón de reversión alcista. Convergencia bajista que agota ventas.'
    };
};

// ═══════════════════════════════════════════════════════════════════════════════
// PROYECCIONES FUTURAS
// ═══════════════════════════════════════════════════════════════════════════════

ChartPatternEngineV27.prototype.generateProjections = function() {
    this.state.projections = [];
    
    if (this.state.detectedPatterns.length === 0 && this.state.crossovers.length === 0) {
        return;
    }
    
    const lastIndex = this.state.data.length - 1;
    const lastPrice = this.state.data[lastIndex].close;
    
    // Proyección basada en patrón activo
    const activePattern = this.state.detectedPatterns[0];
    if (activePattern && activePattern.target) {
        this.state.projections.push({
            type: 'PATTERN_TARGET',
            startIndex: lastIndex,
            startPrice: lastPrice,
            targetPrice: activePattern.target,
            direction: activePattern.direction,
            confidence: activePattern.confidence,
            pattern: activePattern.name,
            description: `Objetivo de ${activePattern.name}`,
            color: activePattern.direction === 'BUY' ? '#00ffaa' : '#ff4d82'
        });
    }
    
    // Proyección basada en tendencia de medias
    const ema9 = this.state.maData['ema9']?.[lastIndex];
    const ema21 = this.state.maData['ema21']?.[lastIndex];
    const ema55 = this.state.maData['ema55']?.[lastIndex];
    
    if (ema9 && ema21 && ema55) {
        const trend = ema9 > ema21 && ema21 > ema55 ? 'BULL' : 
                     ema9 < ema21 && ema21 < ema55 ? 'BEAR' : 'NEUTRAL';
        
        if (trend === 'BULL') {
            const distance = lastPrice - ema21;
            this.state.projections.push({
                type: 'MA_MOMENTUM',
                startIndex: lastIndex,
                startPrice: lastPrice,
                targetPrice: lastPrice + distance * 2,
                direction: 'BUY',
                confidence: 0.60,
                description: 'Momentum alcista (EMAs alineadas)',
                color: '#00d4ff'
            });
        } else if (trend === 'BEAR') {
            const distance = ema21 - lastPrice;
            this.state.projections.push({
                type: 'MA_MOMENTUM',
                startIndex: lastIndex,
                startPrice: lastPrice,
                targetPrice: lastPrice - distance * 2,
                direction: 'SELL',
                confidence: 0.60,
                description: 'Momentum bajista (EMAs alineadas)',
                color: '#ff00aa'
            });
        }
    }
    
    // Proyección basada en último cruce
    const lastCross = this.state.crossovers[this.state.crossovers.length - 1];
    if (lastCross && lastCross.index >= lastIndex - 3) {
        const isBull = lastCross.type.includes('GOLDEN') || lastCross.type.includes('BULL');
        const target = isBull ? lastPrice * 1.02 : lastPrice * 0.98;
        
        this.state.projections.push({
            type: 'CROSSOVER_FOLLOW',
            startIndex: lastIndex,
            startPrice: lastPrice,
            targetPrice: target,
            direction: isBull ? 'BUY' : 'SELL',
            confidence: lastCross.strength === 'HIGH' ? 0.70 : 0.55,
            description: `Seguimiento de cruce ${lastCross.type}`,
            color: isBull ? '#00ffaa' : '#ff4d82'
        });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// RENDERIZADO DE ELEMENTOS AVANZADOS
// ═══════════════════════════════════════════════════════════════════════════════

ChartPatternEngineV27.prototype.drawProjections = function(ctx, min, max, priceScale) {
    const { padding, chartHeight } = this.dimensions;
    const candleWidth = this.getCandleWidth();
    
    this.state.projections.forEach(proj => {
        const startX = padding.left + (this.state.data.length - 1) * candleWidth + candleWidth / 2 - (this.state.offset % candleWidth);
        const startY = padding.top + chartHeight - ((proj.startPrice - min) * priceScale);
        const targetY = padding.top + chartHeight - ((proj.targetPrice - min) * priceScale);
        
        // Línea de proyección punteada
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.globalAlpha = 0.6;
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + 100, targetY);
        ctx.stroke();
        
        // Zona de confianza (cono)
        ctx.fillStyle = proj.color;
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + 100, targetY - 20);
        ctx.lineTo(startX + 100, targetY + 20);
        ctx.closePath();
        ctx.fill();
        
        // Etiqueta
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = proj.color;
        ctx.font = 'bold 11px JetBrains Mono';
        ctx.textAlign = 'left';
        ctx.fillText(
            `🎯 ${proj.targetPrice.toFixed(2)} (${(proj.confidence * 100).toFixed(0)}%)`,
            startX + 105,
            targetY + 4
        );
        
        // Descripción
        ctx.font = '10px Inter';
        ctx.fillStyle = '#aaa';
        ctx.fillText(proj.description, startX + 105, targetY + 16);
        
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
    });
};

ChartPatternEngineV27.prototype.drawPatternOverlays = function(ctx, min, max, priceScale) {
    const { padding, chartHeight } = this.dimensions;
    const candleWidth = this.getCandleWidth();
    
    this.state.detectedPatterns.forEach(pattern => {
        if (pattern.tops) {
            // Dibujar líneas de doble techo
            pattern.tops.forEach((top, i) => {
                const x = padding.left + top.index * candleWidth + candleWidth / 2 - (this.state.offset % candleWidth);
                const y = padding.top + chartHeight - ((top.price - min) * priceScale);
                
                // Círculo en el tope
                ctx.fillStyle = '#ff4d82';
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
                
                // Línea de resistencia
                if (i === 0) {
                    ctx.strokeStyle = 'rgba(255, 77, 130, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(padding.left + this.dimensions.width - padding.right, y);
                    ctx.stroke();
                }
            });
            
            // Línea de neckline
            if (pattern.neckline) {
                const y = padding.top + chartHeight - ((pattern.neckline - min) * priceScale);
                ctx.strokeStyle = 'rgba(255, 180, 0, 0.5)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(padding.left + this.dimensions.width - padding.right, y);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        
        if (pattern.bottoms) {
            // Similar para doble suelo
            pattern.bottoms.forEach((bottom, i) => {
                const x = padding.left + bottom.index * candleWidth + candleWidth / 2 - (this.state.offset % candleWidth);
                const y = padding.top + chartHeight - ((bottom.price - min) * priceScale);
                
                ctx.fillStyle = '#00ffaa';
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
                
                if (i === 0) {
                    ctx.strokeStyle = 'rgba(0, 255, 170, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(padding.left + this.dimensions.width - padding.right, y);
                    ctx.stroke();
                }
            });
        }
    });
};

ChartPatternEngineV27.prototype.drawCrossoversAndBounces = function(ctx, min, max, priceScale) {
    const { padding, chartHeight } = this.dimensions;
    const candleWidth = this.getCandleWidth();
    
    // Dibujar cruces
    this.state.crossovers.forEach(cross => {
        const localIdx = cross.index - Math.floor(this.state.offset / candleWidth);
        if (localIdx < 0 || localIdx >= this.state.visibleData.length) return;
        
        const x = padding.left + localIdx * candleWidth + candleWidth / 2;
        const y = padding.top + chartHeight - ((cross.price - min) * priceScale);
        
        const isBull = cross.type.includes('GOLDEN') || cross.type.includes('BULL');
        const color = isBull ? '#00ffaa' : '#ff4d82';
        const symbol = isBull ? '▲' : '▼';
        
        // Fondo circular
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(x, y - 15, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Símbolo
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.font = 'bold 14px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText(symbol, x, y - 10);
        
        // Etiqueta de fuerza
        ctx.font = '9px Inter';
        ctx.fillStyle = '#fff';
        ctx.fillText(cross.strength, x, y + 5);
    });
    
    // Dibujar rebotes
    this.state.bounces.forEach(bounce => {
        const localIdx = bounce.index - Math.floor(this.state.offset / candleWidth);
        if (localIdx < 0 || localIdx >= this.state.visibleData.length) return;
        
        const x = padding.left + localIdx * candleWidth + candleWidth / 2;
        const y = padding.top + chartHeight - ((bounce.candle.close - min) * priceScale);
        
        const isSupport = bounce.type.includes('SUPPORT');
        const color = isSupport ? '#00ffaa' : '#ff4d82';
        const symbol = isSupport ? '↗' : '↘';
        
        // Línea de rebote
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        const levelY = padding.top + chartHeight - ((bounce.level - min) * priceScale);
        ctx.moveTo(x - 10, levelY);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        // Símbolo
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.font = 'bold 16px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText(symbol, x + 8, y - 5);
        
        // Confirmación
        if (bounce.confirmation === 'CONFIRMED') {
            ctx.fillStyle = '#00ffaa';
            ctx.font = '9px Inter';
            ctx.fillText('✓', x + 15, y + 5);
        } else if (bounce.confirmation === 'FAILED') {
            ctx.fillStyle = '#ff4d82';
            ctx.fillText('✗', x + 15, y + 5);
        }
    });
};

// Sobrescribir render para incluir nuevos elementos
const originalRender = ChartPatternEngineV27.prototype.render;
ChartPatternEngineV27.prototype.render = function() {
    if (!this.ctx || this.state.visibleData.length === 0) return;
    
    const { width, height, padding, chartHeight } = this.dimensions;
    const ctx = this.ctx;
    
    // Llamar render original (o reimplementar completo)
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = this.config.colors.bg;
    ctx.fillRect(0, 0, width, height);
    
    const priceRange = this.calculatePriceRange();
    if (!priceRange) return;
    
    const { min, max } = priceRange;
    const priceScale = chartHeight / (max - min);
    
    // Elementos base
    this.drawGrid(ctx, min, max, priceScale);
    this.drawSupportResistance(ctx, min, max, priceScale);
    this.drawMovingAverages(ctx, min, max, priceScale);
    
    // Nuevos elementos avanzados
    this.drawPatternOverlays(ctx, min, max, priceScale);
    this.drawProjections(ctx, min, max, priceScale);
    this.drawCrossoversAndBounces(ctx, min, max, priceScale);
    
    // Velas al frente
    this.drawCandles(ctx, min, max, priceScale);
    this.drawPriceLabels(ctx, min, max);
};

console.log('✅ Parte 2/3 cargada: Detección de patrones, cruces, rebotes y proyecciones');









// ═══════════════════════════════════════════════════════════════════════════════  Paso 3
// SISTEMA DE RECOMENDACIÓN IA AVANZADO
// ═══════════════════════════════════════════════════════════════════════════════

ChartPatternEngineV27.prototype.generateRecommendation = function() {
    const signals = this.aggregateAllSignals();
    const score = this.calculateCompositeScore(signals);
    
    // Determinar acción basada en score compuesto
    let action = 'ESPERAR';
    let confidence = 0;
    let reasons = [];
    let urgency = 'NORMAL';
    
    // Score > 70: COMPRA fuerte
    if (score.composite > 70) {
        action = 'COMPRA';
        confidence = Math.min(95, score.composite);
        urgency = score.composite > 85 ? 'ALTA' : 'NORMAL';
        reasons = this.generateBuyReasons(signals);
    }
    // Score < -70: VENTA fuerte
    else if (score.composite < -70) {
        action = 'VENTA';
        confidence = Math.min(95, Math.abs(score.composite));
        urgency = Math.abs(score.composite) > 85 ? 'ALTA' : 'NORMAL';
        reasons = this.generateSellReasons(signals);
    }
    // Score 40-70: COMPRA débil
    else if (score.composite > 40) {
        action = 'COMPRA DÉBIL';
        confidence = score.composite;
        urgency = 'BAJA';
        reasons = this.generateBuyReasons(signals);
        reasons.push('⚠️ Señal débil - confirmar con ruptura');
    }
    // Score -40 a -70: VENTA débil
    else if (score.composite < -40) {
        action = 'VENTA DÉBIL';
        confidence = Math.abs(score.composite);
        urgency = 'BAJA';
        reasons = this.generateSellReasons(signals);
        reasons.push('⚠️ Señal débil - confirmar con ruptura');
    }
    // Score -40 a 40: NEUTRAL/ESPERAR
    else {
        action = 'ESPERAR';
        confidence = 50 - Math.abs(score.composite);
        reasons = this.generateNeutralReasons(signals);
        
        // Detectar acumulación para posible breakout
        if (signals.patterns.some(p => p.type.includes('TRIANGLE') && !p.breakout && !p.breakdown)) {
            reasons.push('⏳ Acumulación detectada - esperar ruptura');
            urgency = 'PREPARAR';
        }
    }
    
    // Verificar conflictos críticos
    const conflicts = this.detectConflicts(signals);
    if (conflicts.length > 0) {
        reasons.push(...conflicts);
        confidence *= 0.8; // Reducir confianza por conflictos
    }
    
    this.state.recommendation = {
        action,
        confidence: Math.round(confidence),
        reasons,
        urgency,
        score: score.composite,
        signals: {
            pattern: signals.patterns[0]?.name || 'Ninguno',
            crossover: signals.crossovers[0]?.type || 'Ninguno',
            bounce: signals.bounces[0]?.type || 'Ninguno',
            trend: signals.trend
        },
        timestamp: Date.now()
    };
    
    // Log para debugging
    console.log('[ChartV27] Recomendación IA:', this.state.recommendation);
};

ChartPatternEngineV27.prototype.aggregateAllSignals = function() {
    const data = this.state.data;
    const lastIndex = data.length - 1;
    
    return {
        // Patrones detectados (más recientes primero)
        patterns: this.state.detectedPatterns.slice(0, 3),
        
        // Cruces recientes
        crossovers: this.state.crossovers.slice(-3),
        
        // Rebotes recientes
        bounces: this.state.bounces.slice(-3),
        
        // Estado de medias móviles
        ma: {
            ema9: this.state.maData['ema9']?.[lastIndex],
            ema21: this.state.maData['ema21']?.[lastIndex],
            ema55: this.state.maData['ema55']?.[lastIndex],
            trend9_21: this.state.maData['ema9']?.[lastIndex] > this.state.maData['ema21']?.[lastIndex] ? 'BULL' : 'BEAR',
            trend21_55: this.state.maData['ema21']?.[lastIndex] > this.state.maData['ema55']?.[lastIndex] ? 'BULL' : 'BEAR'
        },
        
        // Soportes/Resistencias cercanos
        nearbySupport: this.state.supportLevels.find(s => 
            Math.abs(s.price - data[lastIndex].close) / data[lastIndex].close < 0.03
        ),
        nearbyResistance: this.state.resistanceLevels.find(r => 
            Math.abs(r.price - data[lastIndex].close) / data[lastIndex].close < 0.03
        ),
        
        // Tendencia general
        trend: this.calculateOverallTrend(),
        
        // Momentum reciente (últimas 5 velas)
        momentum: this.calculateRecentMomentum(),
        
        // Volatilidad
        volatility: this.calculateVolatility()
    };
};

ChartPatternEngineV27.prototype.calculateCompositeScore = function(signals) {
    let score = 0;
    let weights = 0;
    
    // 1. Patrones (peso 40%)
    signals.patterns.forEach((p, i) => {
        const weight = 0.40 * (1 - i * 0.3); // Primer patrón pesa más
        const direction = p.direction === 'BUY' ? 1 : -1;
        const value = p.confidence * 100 * direction;
        score += value * weight;
        weights += weight;
    });
    
    // 2. Cruces de medias (peso 25%)
    signals.crossovers.forEach((c, i) => {
        const weight = 0.25 * (1 - i * 0.3);
        const isBull = c.type.includes('GOLDEN') || c.type.includes('BULL');
        const isBear = c.type.includes('DEATH') || c.type.includes('BEAR');
        const strength = c.strength === 'HIGH' ? 1 : c.strength === 'MEDIUM' ? 0.7 : 0.4;
        const value = (isBull ? 80 : isBear ? -80 : 0) * strength;
        score += value * weight;
        weights += weight;
    });
    
    // 3. Rebotes (peso 20%)
    signals.bounces.forEach((b, i) => {
        const weight = 0.20 * (1 - i * 0.3);
        const isBull = b.type.includes('SUPPORT');
        const isBear = b.type.includes('RESISTANCE');
        const confirmed = b.confirmation === 'CONFIRMED' ? 1 : 0.5;
        const value = (isBull ? 70 : isBear ? -70 : 0) * b.strength * confirmed;
        score += value * weight;
        weights += weight;
    });
    
    // 4. Tendencia de medias (peso 15%)
    if (signals.ma.trend9_21 === 'BULL') score += 30 * 0.15;
    else if (signals.ma.trend9_21 === 'BEAR') score -= 30 * 0.15;
    
    if (signals.ma.trend21_55 === 'BULL') score += 40 * 0.15;
    else if (signals.ma.trend21_55 === 'BEAR') score -= 40 * 0.15;
    weights += 0.15;
    
    // Normalizar si no hay suficientes señales
    if (weights < 0.5) {
        score = score / (weights || 1) * 0.5;
    }
    
    // Ajustar por momentum
    score += signals.momentum * 10;
    
    // Ajustar por proximidad a S/R
    if (signals.nearbySupport && score > 0) score += 15;
    if (signals.nearbyResistance && score < 0) score -= 15;
    
    return {
        composite: Math.max(-100, Math.min(100, score)),
        raw: score,
        weights: weights
    };
};

ChartPatternEngineV27.prototype.calculateOverallTrend = function() {
    if (this.state.data.length < 20) return 'NEUTRAL';
    
    const recent = this.state.data.slice(-20);
    const first = recent[0].close;
    const last = recent[recent.length - 1].close;
    const change = (last - first) / first;
    
    if (change > 0.05) return 'STRONG_UP';
    if (change > 0.02) return 'UP';
    if (change < -0.05) return 'STRONG_DOWN';
    if (change < -0.02) return 'DOWN';
    return 'NEUTRAL';
};

ChartPatternEngineV27.prototype.calculateRecentMomentum = function() {
    if (this.state.data.length < 5) return 0;
    
    const recent = this.state.data.slice(-5);
    let up = 0, down = 0;
    
    for (let i = 1; i < recent.length; i++) {
        if (recent[i].close > recent[i-1].close) up++;
        else if (recent[i].close < recent[i-1].close) down++;
    }
    
    return (up - down) / 4; // Normalizado -1 a 1
};

ChartPatternEngineV27.prototype.calculateVolatility = function() {
    if (this.state.data.length < 10) return 0;
    
    const recent = this.state.data.slice(-10);
    const ranges = recent.map(d => (d.high - d.low) / d.close);
    const avg = ranges.reduce((a,b) => a+b, 0) / ranges.length;
    
    return avg * 100; // Como porcentaje
};

ChartPatternEngineV27.prototype.generateBuyReasons = function(signals) {
    const reasons = [];
    
    // Patrón principal
    const topPattern = signals.patterns[0];
    if (topPattern) {
        reasons.push(`${topPattern.icon} ${topPattern.name} detectado (${(topPattern.confidence * 100).toFixed(0)}%)`);
        if (topPattern.breakout) reasons.push('🚀 Ruptura confirmada');
    }
    
    // Cruces
    const bullCross = signals.crossovers.find(c => c.type.includes('GOLDEN') || c.type.includes('BULL'));
    if (bullCross) {
        reasons.push(`✨ ${bullCross.type.replace('_', ' ')} reciente`);
    }
    
    // Rebotes
    const bounce = signals.bounces.find(b => b.type.includes('SUPPORT'));
    if (bounce && bounce.confirmation === 'CONFIRMED') {
        reasons.push(`↗️ Rebote confirmado en soporte ${bounce.level.toFixed(2)}`);
    }
    
    // Medias
    if (signals.ma.trend9_21 === 'BULL' && signals.ma.trend21_55 === 'BULL') {
        reasons.push('📈 EMAs alineadas alcista (9>21>55)');
    }
    
    // Soporte cercano
    if (signals.nearbySupport) {
        reasons.push(`🛡️ Soporte cercano en ${signals.nearbySupport.price.toFixed(2)}`);
    }
    
    return reasons;
};

ChartPatternEngineV27.prototype.generateSellReasons = function(signals) {
    const reasons = [];
    
    const topPattern = signals.patterns[0];
    if (topPattern) {
        reasons.push(`${topPattern.icon} ${topPattern.name} detectado (${(topPattern.confidence * 100).toFixed(0)}%)`);
        if (topPattern.breakdown) reasons.push('🔻 Ruptura bajista confirmada');
    }
    
    const bearCross = signals.crossovers.find(c => c.type.includes('DEATH') || c.type.includes('BEAR'));
    if (bearCross) {
        reasons.push(`⚠️ ${bearCross.type.replace('_', ' ')} reciente`);
    }
    
    const reject = signals.bounces.find(b => b.type.includes('RESISTANCE'));
    if (reject && reject.confirmation === 'CONFIRMED') {
        reasons.push(`↘️ Rechazo confirmado en resistencia ${reject.level.toFixed(2)}`);
    }
    
    if (signals.ma.trend9_21 === 'BEAR' && signals.ma.trend21_55 === 'BEAR') {
        reasons.push('📉 EMAs alineadas bajista (9<21<55)');
    }
    
    if (signals.nearbyResistance) {
        reasons.push(`⛔ Resistencia cercana en ${signals.nearbyResistance.price.toFixed(2)}`);
    }
    
    return reasons;
};

ChartPatternEngineV27.prototype.generateNeutralReasons = function(signals) {
    const reasons = [];
    
    if (signals.patterns.length === 0) {
        reasons.push('🔍 Sin patrones claros detectados');
    } else {
        reasons.push('⚖️ Patrones en formación - esperar confirmación');
    }
    
    if (signals.crossovers.length === 0) {
        reasons.push('📊 Sin cruces de medias recientes');
    }
    
    if (signals.volatility > 3) {
        reasons.push('⚡ Alta volatilidad - precaución');
    }
    
    // Detectar rango
    if (signals.nearbySupport && signals.nearbyResistance) {
        const range = signals.nearbyResistance.price - signals.nearbySupport.price;
        const mid = (signals.nearbyResistance.price + signals.nearbySupport.price) / 2;
        const current = this.state.data[this.state.data.length - 1].close;
        const position = (current - signals.nearbySupport.price) / range;
        
        if (position > 0.4 && position < 0.6) {
            reasons.push('🎯 Precio en zona media del rango');
        }
    }
    
    return reasons;
};

ChartPatternEngineV27.prototype.detectConflicts = function(signals) {
    const conflicts = [];
    
    // Patrón alcista pero medias bajistas
    const bullPattern = signals.patterns.find(p => p.direction === 'BUY');
    if (bullPattern && signals.ma.trend21_55 === 'BEAR') {
        conflicts.push('⚠️ CONFLICTO: Patrón alcista en tendencia bajista mayor');
    }
    
    // Patrón bajista pero medias alcistas
    const bearPattern = signals.patterns.find(p => p.direction === 'SELL');
    if (bearPattern && signals.ma.trend21_55 === 'BULL') {
        conflicts.push('⚠️ CONFLICTO: Patrón bajista en tendencia alcista mayor');
    }
    
    // Cruces contradictorios recientes
    const recentCrosses = signals.crossovers.slice(-2);
    if (recentCrosses.length === 2) {
        const c1 = recentCrosses[0].type.includes('BULL') || recentCrosses[0].type.includes('GOLDEN');
        const c2 = recentCrosses[1].type.includes('BEAR') || recentCrosses[1].type.includes('DEATH');
        if (c1 && c2) {
            conflicts.push('⚠️ CONFLICTO: Cruces contradictorios recientes (whipsaw)');
        }
    }
    
    return conflicts;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTUALIZACIÓN DE UI CON RECOMENDACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

ChartPatternEngineV27.prototype.updateInfoPanel = function() {
    const rec = this.state.recommendation;
    if (!rec) return;
    
    // Actualizar recomendación principal
    const recEl = document.getElementById('ia-recommendation');
    const reasonEl = document.getElementById('recommendation-reason');
    
    if (recEl) {
        recEl.textContent = rec.action;
        recEl.style.color = rec.action.includes('COMPRA') ? '#00ffaa' : 
                           rec.action.includes('VENTA') ? '#ff4d82' : '#ffb400';
        
        // Animación de urgencia
        if (rec.urgency === 'ALTA') {
            recEl.style.animation = 'pulse 1s infinite';
        } else {
            recEl.style.animation = 'none';
        }
    }
    
    if (reasonEl) {
        // Mostrar razones principales
        const mainReasons = rec.reasons.slice(0, 2).join(' | ');
        reasonEl.textContent = mainReasons;
        reasonEl.title = rec.reasons.join('\n'); // Tooltip completo
    }
    
    // Actualizar patrón detectado
    const patternEl = document.getElementById('current-pattern');
    const confEl = document.getElementById('pattern-confidence');
    
    if (rec.signals && rec.signals.pattern) {
        if (patternEl) patternEl.textContent = rec.signals.pattern;
        if (confEl) confEl.textContent = `Confianza: ${rec.confidence}%`;
    }
    
    // Actualizar señales técnicas
    const signalsEl = document.getElementById('tech-signals');
    if (signalsEl) {
        const badges = [];
        
        if (rec.signals.crossover && rec.signals.crossover !== 'Ninguno') {
            const isBull = rec.signals.crossover.includes('GOLDEN') || rec.signals.crossover.includes('BULL');
            badges.push(`<span style="padding: 3px 8px; background: ${isBull ? 'rgba(0,255,170,0.2)' : 'rgba(255,77,130,0.2)'}; border-radius: 4px; font-size: 10px; color: ${isBull ? '#00ffaa' : '#ff4d82'};">${rec.signals.crossover.replace('_', ' ')}</span>`);
        }
        
        if (rec.signals.bounce && rec.signals.bounce !== 'Ninguno') {
            const isBull = rec.signals.bounce.includes('SUPPORT');
            badges.push(`<span style="padding: 3px 8px; background: ${isBull ? 'rgba(0,255,170,0.2)' : 'rgba(255,77,130,0.2)'}; border-radius: 4px; font-size: 10px; color: ${isBull ? '#00ffaa' : '#ff4d82'};">${rec.signals.bounce.replace('_', ' ')}</span>`);
        }
        
        if (rec.signals.trend && rec.signals.trend !== 'NEUTRAL') {
            const color = rec.signals.trend.includes('UP') ? '#00ffaa' : '#ff4d82';
            badges.push(`<span style="padding: 3px 8px; background: rgba(100,100,100,0.2); border-radius: 4px; font-size: 10px; color: ${color};">TENDENCIA: ${rec.signals.trend}</span>`);
        }
        
        signalsEl.innerHTML = badges.join('') || '<span style="padding: 3px 8px; background: rgba(100,100,100,0.2); border-radius: 4px; font-size: 10px;">Sin señales activas</span>';
    }
    
    // Actualizar estado
    const statusEl = document.getElementById('chart-pattern-status');
    if (statusEl) {
        if (rec.action.includes('COMPRA')) {
            statusEl.textContent = 'SEÑAL ALCISTA';
            statusEl.style.background = 'rgba(0,255,170,0.2)';
            statusEl.style.color = '#00ffaa';
        } else if (rec.action.includes('VENTA')) {
            statusEl.textContent = 'SEÑAL BAJISTA';
            statusEl.style.background = 'rgba(255,77,130,0.2)';
            statusEl.style.color = '#ff4d82';
        } else {
            statusEl.textContent = 'ANALIZANDO';
            statusEl.style.background = 'rgba(255,180,0,0.15)';
            statusEl.style.color = '#ffb400';
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRACIÓN FINAL CON MARKETBRIDGEV27
// ═══════════════════════════════════════════════════════════════════════════════

function integrateWithMarketBridge() {
    console.log('[ChartV27] Integrando con MarketBridgeV27...');
    
    // Sobrescribir processTradeResult para capturar trades manuales
    if (window.MarketBridgeV27) {
        const originalProcess = window.MarketBridgeV27.processTradeResult;
        
        window.MarketBridgeV27.processTradeResult = function(prediction) {
            // Guardar en secuencia manual
            if (prediction && (prediction === 'A' || prediction === 'B')) {
                if (!window.userManualSequence) window.userManualSequence = [];
                
                window.userManualSequence.push({
                    val: prediction,
                    prediction: prediction,
                    timestamp: Date.now()
                });
                
                if (window.userManualSequence.length > 50) {
                    window.userManualSequence.shift();
                }
                
                console.log('[ChartV27] Trade manual agregado:', prediction);
            }
            
            // Llamar método original
            const result = originalProcess.call(this, prediction);
            
            // Actualizar chart
            if (window.chartEngine) {
                // Pequeño delay para que se procese el resultado
                setTimeout(() => {
                    window.chartEngine.forceUpdate();
                }, 100);
            }
            
            return result;
        };
        
        // Integrar con executeTrade para capturar antes del resultado
        const originalExecute = window.MarketBridgeV27.executeTrade;
        window.MarketBridgeV27.executeTrade = function(direction) {
            // Consultar chart engine para recomendación adicional
            if (window.chartEngine) {
                const signal = window.chartEngine.getCurrentSignal();
                console.log('[ChartV27] Consulta previa a trade:', signal.recommendation);
            }
            
            return originalExecute.call(this, direction);
        };
        
        console.log('✅ Integración con MarketBridgeV27 completada');
    }
    
    // Crear instancia global
    window.chartEngine = new ChartPatternEngineV27();
    
    // Exponer API global para debugging
    window.ChartAPI = {
        engine: window.chartEngine,
        
        // Forzar actualización
        update: () => window.chartEngine.forceUpdate(),
        
        // Cambiar vista
        viewIA: () => {
            window.chartEngine.state.view = 'IA';
            window.chartEngine.forceUpdate();
        },
        viewTU: () => {
            window.chartEngine.state.view = 'TU';
            window.chartEngine.forceUpdate();
        },
        
        // Obtener señal actual
        signal: () => window.chartEngine.getCurrentSignal(),
        
        // Zoom
        zoomIn: () => window.chartEngine.zoomIn(),
        zoomOut: () => window.chartEngine.zoomOut(),
        
        // Debug
        debug: () => ({
            data: window.chartEngine.state.data,
            patterns: window.chartEngine.state.detectedPatterns,
            ma: window.chartEngine.state.maData,
            recommendation: window.chartEngine.state.recommendation,
            crossovers: window.chartEngine.state.crossovers,
            bounces: window.chartEngine.state.bounces
        })
    };
    
    console.log('✅ ChartAPI global disponible. Usa ChartAPI.debug() para diagnóstico');
}

// ═══════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN AUTOMÁTICA
// ═══════════════════════════════════════════════════════════════════════════════

function initChartPatternPro() {
    console.log('[ChartV27] Iniciando Chart Pattern Engine PRO...');
    
    // Verificar que existan dependencias
    if (!window.MarketBridgeV27) {
        console.warn('[ChartV27] MarketBridgeV27 no encontrado, esperando...');
        setTimeout(initChartPatternPro, 500);
        return;
    }
    
    // Inicializar
    integrateWithMarketBridge();
    
    // Loop de actualización periódica (para sincronizar con secuencia IA)
    setInterval(() => {
        if (window.chartEngine && window.chartEngine.state.view === 'IA') {
            const currentLength = window.sequence?.length || 0;
            if (currentLength !== window.chartEngine.state.lastUpdate) {
                window.chartEngine.forceUpdate();
            }
        }
    }, 2000);
    
    console.log('✅ Chart Pattern Engine PRO V27 completamente inicializado');
    console.log('📊 Comandos disponibles:');
    console.log('   ChartAPI.update() - Forzar actualización');
    console.log('   ChartAPI.signal() - Obtener señal actual');
    console.log('   ChartAPI.viewIA() / viewTU() - Cambiar vista');
    console.log('   ChartAPI.debug() - Información de debug');
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initChartPatternPro, 1500); // Dar tiempo a que carguen otros scripts
    });
} else {
    setTimeout(initChartPatternPro, 1500);
}

// También exponer en window para acceso manual
window.initChartPatternPro = initChartPatternPro;
window.integrateWithMarketBridge = integrateWithMarketBridge;

console.log('✅ Parte 3/3 cargada: Sistema de recomendación IA e integración final');



// ═══════════════════════════════════════════════════════════════════════════════
// PARTE 4/4: MÓDULOS AVANZADOS - FOOTPRINT, AI PATTERNS, MULTI-TF, CONTROLES
// Agregar TODO esto al final de chart_engine_v27_pro.js
// ═══════════════════════════════════════════════════════════════════════════════

// 1. VOLUME FOOTPRINT RENDERER - Volumen Bid/Ask por nivel de precio
class VolumeFootprintRenderer {
    constructor(chartEngine) {
        this.engine = chartEngine;
        this.config = {
            rowHeight: 3,
            imbalanceThreshold: 2.5,
            showPOC: true,
            maxLevels: 8
        };
    }
    
    render(ctx, candle, x, width, priceMin, priceScale) {
        // Generar niveles de precio para esta vela
        const levels = this.generateFootprintLevels(candle);
        if (!levels || levels.length === 0) return;
        
        const maxVol = Math.max(...levels.map(l => l.volume));
        
        levels.forEach(level => {
            const y = this.engine.dimensions.padding.top + 
                     this.engine.dimensions.chartHeight - 
                     ((level.price - priceMin) * priceScale);
            
            const rowHeight = this.config.rowHeight;
            const intensity = level.volume / maxVol;
            
            // Volumen izquierdo (Bid/Venta) - Rojo
            const leftWidth = (level.bid / maxVol) * width * 0.35;
            if (leftWidth > 0.5) {
                ctx.fillStyle = `rgba(255, 77, 130, ${0.2 + intensity * 0.8})`;
                ctx.fillRect(x - leftWidth - 2, y - rowHeight/2, leftWidth, rowHeight);
            }
            
            // Volumen derecho (Ask/Compra) - Verde
            const rightWidth = (level.ask / maxVol) * width * 0.35;
            if (rightWidth > 0.5) {
                ctx.fillStyle = `rgba(0, 255, 170, ${0.2 + intensity * 0.8})`;
                ctx.fillRect(x + width + 2, y - rowHeight/2, rightWidth, rowHeight);
            }
            
            // Indicar imbalance fuerte
            if (level.imbalance > this.config.imbalanceThreshold) {
                ctx.strokeStyle = level.imbalanceDir === 'buy' ? '#00ffaa' : '#ff4d82';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x - 3, y);
                ctx.lineTo(x + width + 3, y);
                ctx.stroke();
            }
        });
        
        // Marcar POC (Point of Control - nivel con más volumen)
        if (this.config.showPOC && levels.poc) {
            const pocY = this.engine.dimensions.padding.top + 
                        this.engine.dimensions.chartHeight - 
                        ((levels.poc.price - priceMin) * priceScale);
            
            ctx.strokeStyle = '#ffb400';
            ctx.lineWidth = 2;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(x - 5, pocY);
            ctx.lineTo(x + width + 5, pocY);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    
    generateFootprintLevels(candle) {
        const levels = [];
        const range = candle.high - candle.low;
        const step = range / this.config.maxLevels;
        
        let maxVolume = 0;
        let poc = null;
        
        for (let i = 0; i < this.config.maxLevels; i++) {
            const price = candle.low + i * step;
            const isBullish = candle.close > candle.open;
            
            // Simular distribución de volumen basada en comportamiento realista
            const distanceFromClose = Math.abs(price - candle.close) / range;
            const volumeConcentration = 1 - (distanceFromClose * 0.5); // Más volumen cierre
            
            const baseVolume = Math.random() * 100 * volumeConcentration;
            const bidRatio = isBullish ? 
                0.3 + Math.random() * 0.3 : // Alcista: más compras
                0.5 + Math.random() * 0.4;  // Bajista: más ventas
            
            const bid = baseVolume * bidRatio;
            const ask = baseVolume * (1 - bidRatio);
            const volume = bid + ask;
            
            const level = {
                price,
                bid,
                ask,
                volume,
                imbalance: Math.max(bid, ask) / Math.min(bid, ask),
                imbalanceDir: bid > ask ? 'sell' : 'buy'
            };
            
            levels.push(level);
            
            if (volume > maxVolume) {
                maxVolume = volume;
                poc = level;
            }
        }
        
        levels.poc = poc;
        levels.maxVolume = maxVolume;
        
        return levels;
    }
}

// 2. AI PATTERN RECOGNITION - Detección de patrones de velas
class AIPatternRecognition {
    constructor() {
        this.patternDatabase = {
            'ENGULFING_BULL': { 
                name: 'Engulfing Alcista', 
                icon: '🐂', 
                accuracy: 0.72, 
                type: 'BULL',
                description: 'Vela alcista que engloba la anterior'
            },
            'ENGULFING_BEAR': { 
                name: 'Engulfing Bajista', 
                icon: '🐻', 
                accuracy: 0.70, 
                type: 'BEAR',
                description: 'Vela bajista que engloba la anterior'
            },
            'HAMMER': { 
                name: 'Martillo', 
                icon: '🔨', 
                accuracy: 0.68, 
                type: 'BULL',
                description: 'Sombra inferior larga, cuerpo pequeño'
            },
            'SHOOTING_STAR': { 
                name: 'Estrella Fugaz', 
                icon: '☄️', 
                accuracy: 0.66, 
                type: 'BEAR',
                description: 'Sombra superior larga, cuerpo pequeño'
            },
            'DOJI': { 
                name: 'Doji', 
                icon: '⚖️', 
                accuracy: 0.65, 
                type: 'NEUTRAL',
                description: 'Indecisión del mercado'
            },
            'MORNING_STAR': { 
                name: 'Estrella de la Mañana', 
                icon: '🌅', 
                accuracy: 0.78, 
                type: 'BULL',
                description: 'Patrón de 3 velas alcista'
            },
            'EVENING_STAR': { 
                name: 'Estrella de la Tarde', 
                icon: '🌇', 
                accuracy: 0.76, 
                type: 'BEAR',
                description: 'Patrón de 3 velas bajista'
            }
        };
    }
    
    analyze(candle, prevCandle, prevPrevCandle = null) {
        // 1. Engulfing
        const engulfing = this.detectEngulfing(candle, prevCandle);
        if (engulfing) return engulfing;
        
        // 2. Hammer/Shooting Star
        const singleCandle = this.detectSingleCandlePatterns(candle);
        if (singleCandle) return singleCandle;
        
        // 3. Doji
        const doji = this.detectDoji(candle);
        if (doji) return doji;
        
        // 4. Morning/Evening Star (requiere 3 velas)
        if (prevPrevCandle) {
            const star = this.detectStarPattern(candle, prevCandle, prevPrevCandle);
            if (star) return star;
        }
        
        return null;
    }
    
    detectEngulfing(current, prev) {
        if (!prev) return null;
        
        const currentBody = Math.abs(current.close - current.open);
        const prevBody = Math.abs(prev.close - prev.open);
        const currentRange = current.high - current.low;
        
        // Body debe ser significativo
        if (currentBody / currentRange < 0.5) return null;
        
        const isBullish = current.close > current.open;
        const wasBearish = prev.close < prev.open;
        const wasBullish = prev.close > prev.open;
        
        // Engulfing Alcista: actual alcista, anterior bajista, actual engloba anterior
        if (isBullish && wasBearish && 
            current.open <= prev.close && current.close >= prev.open &&
            currentBody > prevBody * 1.2) {
            return {
                pattern: 'ENGULFING_BULL',
                confidence: 0.7 + (currentBody / prevBody - 1) * 0.3,
                ...this.patternDatabase['ENGULFING_BULL']
            };
        }
        
        // Engulfing Bajista
        if (!isBullish && wasBullish && 
            current.open >= prev.close && current.close <= prev.open &&
            currentBody > prevBody * 1.2) {
            return {
                pattern: 'ENGULFING_BEAR',
                confidence: 0.7 + (currentBody / prevBody - 1) * 0.3,
                ...this.patternDatabase['ENGULFING_BEAR']
            };
        }
        
        return null;
    }
    
    detectSingleCandlePatterns(candle) {
        const body = Math.abs(candle.close - candle.open);
        const range = candle.high - candle.low;
        const upperShadow = candle.high - Math.max(candle.open, candle.close);
        const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
        
        if (range === 0) return null;
        
        const bodyRatio = body / range;
        const upperRatio = upperShadow / range;
        const lowerRatio = lowerShadow / range;
        
        // Hammer: sombra inferior larga (>2x cuerpo), cuerpo pequeño, cerca del mínimo
        if (lowerRatio > 0.6 && bodyRatio < 0.3 && 
            Math.abs(candle.close - candle.low) / range < 0.1) {
            return {
                pattern: 'HAMMER',
                confidence: 0.65 + lowerRatio * 0.2,
                ...this.patternDatabase['HAMMER']
            };
        }
        
        // Shooting Star: sombra superior larga, cuerpo pequeño, cerca del máximo
        if (upperRatio > 0.6 && bodyRatio < 0.3 &&
            Math.abs(candle.close - candle.high) / range < 0.1) {
            return {
                pattern: 'SHOOTING_STAR',
                confidence: 0.65 + upperRatio * 0.2,
                ...this.patternDatabase['SHOOTING_STAR']
            };
        }
        
        return null;
    }
    
    detectDoji(candle) {
        const body = Math.abs(candle.close - candle.open);
        const range = candle.high - candle.low;
        
        if (range === 0) return null;
        
        // Doji: cuerpo muy pequeño (< 10% del rango)
        if (body / range < 0.1) {
            return {
                pattern: 'DOJI',
                confidence: 0.9 - (body / range),
                ...this.patternDatabase['DOJI']
            };
        }
        
        return null;
    }
    
    detectStarPattern(current, prev, prevPrev) {
        // Morning Star: bajista larga, doji/pequeña, alcista que cierra en medio de 1ª
        const prevPrevBearish = prevPrev.close < prevPrev.open;
        const prevPrevBody = Math.abs(prevPrev.close - prevPrev.open);
        const currentBullish = current.close > current.open;
        const currentBody = Math.abs(current.close - current.open);
        
        if (prevPrevBearish && currentBullish && 
            current.close > (prevPrev.open + prevPrev.close) / 2 &&
            currentBody > prevPrevBody * 0.5) {
            
            const prevSmall = Math.abs(prev.close - prev.open) < prevPrevBody * 0.3;
            if (prevSmall) {
                return {
                    pattern: 'MORNING_STAR',
                    confidence: 0.75,
                    ...this.patternDatabase['MORNING_STAR']
                };
            }
        }
        
        // Evening Star: inversa
        const prevPrevBullish = prevPrev.close > prevPrev.open;
        const currentBearish = current.close < current.open;
        
        if (prevPrevBullish && currentBearish &&
            current.close < (prevPrev.open + prevPrev.close) / 2 &&
            currentBody > prevPrevBody * 0.5) {
            
            const prevSmall = Math.abs(prev.close - prev.open) < prevPrevBody * 0.3;
            if (prevSmall) {
                return {
                    pattern: 'EVENING_STAR',
                    confidence: 0.75,
                    ...this.patternDatabase['EVENING_STAR']
                };
            }
        }
        
        return null;
    }
}

// 3. MULTI-TIMEFRAME SYNC - Sincronización de timeframes superiores
class MultiTimeframeSync {
    constructor(chartEngine) {
        this.engine = chartEngine;
        this.timeframes = {
            '5m': { data: [], color: '#ff00aa', weight: 2, visible: false },
            '15m': { data: [], color: '#ffb400', weight: 3, visible: false }
        };
    }
    
    addData(tf, ohlcData) {
        if (this.timeframes[tf]) {
            this.timeframes[tf].data = ohlcData;
        }
    }
    
    render(ctx, min, max, priceScale) {
        Object.entries(this.timeframes).forEach(([tf, config]) => {
            if (!config.visible || config.data.length === 0) return;
            
            ctx.strokeStyle = config.color;
            ctx.lineWidth = config.weight;
            ctx.globalAlpha = 0.5;
            ctx.setLineDash([8, 4]);
            
            ctx.beginPath();
            let started = false;
            
            config.data.forEach((candle, i) => {
                // Mapear a posición X basada en timestamp
                const x = this.mapTimeToX(candle.timestamp);
                if (x === null) return;
                
                const y = this.engine.dimensions.padding.top + 
                         this.engine.dimensions.chartHeight - 
                         ((candle.close - min) * priceScale);
                
                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        });
    }
    
    mapTimeToX(timestamp) {
        // Simplificado - en producción mapearía el tiempo real
        const candleWidth = this.engine.getCandleWidth();
        const dataStart = this.engine.state.data[0]?.timestamp || timestamp;
        const timeDiff = timestamp - dataStart;
        const candlesDiff = Math.floor(timeDiff / 60000); // Asumiendo velas de 1m
        
        return this.engine.dimensions.padding.left + 
               candlesDiff * candleWidth - 
               (this.engine.state.offset % candleWidth);
    }
    
    toggle(tf) {
        if (this.timeframes[tf]) {
            this.timeframes[tf].visible = !this.timeframes[tf].visible;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENSIÓN DE ChartPatternEngineV27 - MÉTODOS AVANZADOS
// ═══════════════════════════════════════════════════════════════════════════════

// Inicializar módulos avanzados
ChartPatternEngineV27.prototype.initAdvancedModules = function() {
    this.footprintRenderer = new VolumeFootprintRenderer(this);
    this.aiPatterns = new AIPatternRecognition();
    this.mtfSync = new MultiTimeframeSync(this);
    
    // Configuración de visibilidad
    this.config.showFootprint = false;  // Desactivado por defecto
    this.config.showAIPatterns = true;  // Activado por defecto
    this.config.showMTF = false;
    
    // Agregar controles a la UI
    this.addAdvancedControls();
    
    console.log('✅ Módulos avanzados inicializados: Footprint, AI Patterns, Multi-TF');
};

// Agregar controles avanzados al toolbar
ChartPatternEngineV27.prototype.addAdvancedControls = function() {
    const toolbar = this.container.querySelector('.chart-pro-toolbar');
    if (!toolbar) return;
    
    const advancedControls = document.createElement('div');
    advancedControls.style.cssText = `
        display: flex;
        gap: 10px;
        margin-left: 15px;
        padding-left: 15px;
        border-left: 1px solid rgba(100,100,100,0.3);
        align-items: center;
    `;
    
    advancedControls.innerHTML = `
        <label style="display: flex; align-items: center; gap: 5px; color: #aaa; font-size: 11px; cursor: pointer;">
            <input type="checkbox" id="toggle-footprint" style="accent-color: #ff9f43;"> 
            <span title="Volumen Bid/Ask por nivel">👣 Footprint</span>
        </label>
        <label style="display: flex; align-items: center; gap: 5px; color: #aaa; font-size: 11px; cursor: pointer;">
            <input type="checkbox" id="toggle-ai-patterns" checked style="accent-color: #00d4ff;"> 
            <span title="Patrones de velas con IA">🧠 IA</span>
        </label>
        <label style="display: flex; align-items: center; gap: 5px; color: #aaa; font-size: 11px; cursor: pointer;">
            <input type="checkbox" id="toggle-mtf" style="accent-color: #ff00aa;"> 
            <span title="Timeframes superiores">⏱️ MTF</span>
        </label>
    `;
    
    toolbar.appendChild(advancedControls);
    
    // Event listeners
    document.getElementById('toggle-footprint')?.addEventListener('change', (e) => {
        this.config.showFootprint = e.target.checked;
        this.render();
    });
    
    document.getElementById('toggle-ai-patterns')?.addEventListener('change', (e) => {
        this.config.showAIPatterns = e.target.checked;
        this.render();
    });
    
    document.getElementById('toggle-mtf')?.addEventListener('change', (e) => {
        this.config.showMTF = e.target.checked;
        this.render();
    });
};

// Extender render para incluir elementos avanzados
const originalRenderV27 = ChartPatternEngineV27.prototype.render;
ChartPatternEngineV27.prototype.render = function() {
    // Llamar render original primero
    originalRenderV27.call(this);
    
    if (!this.ctx || this.state.visibleData.length === 0) return;
    
    const priceRange = this.calculatePriceRange();
    if (!priceRange) return;
    
    const { min, max } = priceRange;
    const priceScale = this.dimensions.chartHeight / (max - min);
    
    // Renderizar Footprint si está activo
    if (this.config.showFootprint && this.footprintRenderer) {
        this.renderFootprintOverlay(min, max, priceScale);
    }
    
    // Renderizar AI Patterns si está activo
    if (this.config.showAIPatterns && this.aiPatterns) {
        this.renderAIPatternsOverlay(min, max, priceScale);
    }
    
    // Renderizar Multi-Timeframe si está activo
    if (this.config.showMTF && this.mtfSync) {
        this.mtfSync.render(this.ctx, min, max, priceScale);
    }
};

// Renderizar Footprint
ChartPatternEngineV27.prototype.renderFootprintOverlay = function(min, max, priceScale) {
    const candleWidth = this.getCandleWidth();
    const offset = this.state.offset % (candleWidth + this.config.zoom.spacing * this.config.zoom.current);
    
    this.state.visibleData.forEach((candle, i) => {
        const x = this.dimensions.padding.left + 
                 i * (candleWidth + this.config.zoom.spacing * this.config.zoom.current) - 
                 offset;
        
        // Solo renderizar footprint en velas visibles con espacio
        if (candleWidth > 15) {
            this.footprintRenderer.render(this.ctx, candle, x + candleWidth/2, candleWidth, min, priceScale);
        }
    });
};

// Renderizar patrones de IA
ChartPatternEngineV27.prototype.renderAIPatternsOverlay = function(min, max, priceScale) {
    const candleWidth = this.getCandleWidth();
    const offset = this.state.offset % (candleWidth + this.config.zoom.spacing * this.config.zoom.current);
    
    this.state.visibleData.forEach((candle, i) => {
        if (i === 0) return; // Necesitamos vela anterior
        
        const prev = this.state.visibleData[i - 1];
        const prevPrev = i > 1 ? this.state.visibleData[i - 2] : null;
        
        const pattern = this.aiPatterns.analyze(candle, prev, prevPrev);
        
        if (pattern && pattern.confidence > 0.6) {
            const x = this.dimensions.padding.left + 
                     i * (candleWidth + this.config.zoom.spacing * this.config.zoom.current) - 
                     offset;
            const y = this.dimensions.padding.top + 
                     this.dimensions.chartHeight - 
                     ((candle.high - min) * priceScale);
            
            // Fondo del emoji
            const isBull = pattern.type === 'BULL';
            ctx.fillStyle = isBull ? 'rgba(0, 255, 170, 0.2)' : 
                           pattern.type === 'BEAR' ? 'rgba(255, 77, 130, 0.2)' : 
                           'rgba(255, 180, 0, 0.2)';
            
            ctx.beginPath();
            ctx.arc(x + candleWidth/2, y - 15, 12, 0, Math.PI * 2);
            ctx.fill();
            
            // Emoji del patrón
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pattern.icon, x + candleWidth/2, y - 15);
            
            // Línea conectora
            ctx.strokeStyle = isBull ? '#00ffaa' : 
                             pattern.type === 'BEAR' ? '#ff4d82' : 
                             '#ffb400';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + candleWidth/2, y - 5);
            ctx.lineTo(x + candleWidth/2, y);
            ctx.stroke();
            
            // Tooltip en hover (simplificado)
            if (i === this.state.hoverIndex) {
                this.showPatternTooltip(x, y, pattern);
            }
        }
    });
};

// Mostrar tooltip de patrón
ChartPatternEngineV27.prototype.showPatternTooltip = function(x, y, pattern) {
    const ctx = this.ctx;
    const text = `${pattern.name} (${(pattern.confidence * 100).toFixed(0)}%)`;
    const desc = pattern.description;
    
    ctx.font = '11px JetBrains Mono';
    const textWidth = ctx.measureText(text).width;
    const padding = 8;
    
    // Fondo
    ctx.fillStyle = 'rgba(10, 10, 30, 0.95)';
    ctx.strokeStyle = pattern.type === 'BULL' ? '#00ffaa' : 
                      pattern.type === 'BEAR' ? '#ff4d82' : '#ffb400';
    ctx.lineWidth = 1;
    
    const boxX = x - textWidth/2 - padding;
    const boxY = y - 50;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 35;
    
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    
    // Texto
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, boxY + 12);
    
    ctx.font = '9px Inter';
    ctx.fillStyle = '#aaa';
    ctx.fillText(desc.substring(0, 30), x, boxY + 25);
};

// Método para togglear features desde código
ChartPatternEngineV27.prototype.toggleFeature = function(feature, value) {
    const key = 'show' + feature.charAt(0).toUpperCase() + feature.slice(1);
    if (value !== undefined) {
        this.config[key] = value;
    } else {
        this.config[key] = !this.config[key];
    }
    
    // Sincronizar checkbox
    const checkbox = document.getElementById('toggle-' + feature.toLowerCase());
    if (checkbox) checkbox.checked = this.config[key];
    
    this.render();
    return this.config[key];
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODIFICAR INICIALIZACIÓN PARA INCLUIR MÓDULOS AVANZADOS
// ═══════════════════════════════════════════════════════════════════════════════

// Guardar referencia al initChartPatternPro original
const originalInitChartPatternPro = initChartPatternPro;

// Reemplazar con versión extendida
initChartPatternPro = function() {
    console.log('[ChartV27] Iniciando Chart Pattern Engine PRO con módulos avanzados...');
    
    // Verificar dependencias
    if (!window.MarketBridgeV27) {
        console.warn('[ChartV27] MarketBridgeV27 no encontrado, reintentando...');
        setTimeout(initChartPatternPro, 500);
        return;
    }
    
    // Ejecutar inicialización original
    originalInitChartPatternPro();
    
    // Inicializar módulos avanzados si el engine existe
    if (window.chartEngine) {
        window.chartEngine.initAdvancedModules();
        
        // Activar algunos por defecto
        window.chartEngine.toggleFeature('aiPatterns', true);
        
        console.log('✅ Módulos avanzados activados y listos');
        console.log('📊 Controles disponibles:');
        console.log('   - 👣 Footprint: Volumen Bid/Ask por nivel');
        console.log('   - 🧠 IA Patterns: Detección automática de patrones');
        console.log('   - ⏱️ Multi-TF: Sincronización de timeframes');
    }
};

// Exponer API extendida
window.ChartAPIExtended = {
    // Heredar métodos base
    ...window.ChartAPI,
    
    // Nuevos métodos avanzados
    toggleFootprint: () => window.chartEngine?.toggleFeature('footprint'),
    toggleAIPatterns: () => window.chartEngine?.toggleFeature('aiPatterns'),
    toggleMTF: () => window.chartEngine?.toggleFeature('mtf'),
    
    // Información de patrones detectados
    getAIPatterns: () => {
        if (!window.chartEngine) return [];
        return window.chartEngine.state.visibleData.map((c, i) => {
            if (i === 0) return null;
            const prev = window.chartEngine.state.visibleData[i-1];
            const prevPrev = i > 1 ? window.chartEngine.state.visibleData[i-2] : null;
            return window.chartEngine.aiPatterns.analyze(c, prev, prevPrev);
        }).filter(p => p !== null);
    },
    
    // Debug extendido
    debugAdvanced: () => ({
        config: window.chartEngine?.config,
        footprint: window.chartEngine?.footprintRenderer?.config,
        aiPatterns: window.chartEngine?.aiPatterns?.patternDatabase,
        mtf: window.chartEngine?.mtfSync?.timeframes
    })
};

console.log('✅ Parte 4/4 cargada: Módulos Avanzados integrados - Footprint, AI Patterns, Multi-TF');
console.log('🚀 Chart Engine V27 PRO MAX está listo');






























