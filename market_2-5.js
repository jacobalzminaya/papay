
/**
 * MARKET BRIDGE QUANTUM MACRO V27 UNIFIED - PARTE 2/5
 * Indicadores Técnicos: Bollinger, MACD, RSI, ADX, ATR, VWAP
 */

class TechnicalIndicators {
    constructor(config = V27_CONFIG.TECHNICAL) {
        this.config = config;
        this.history = {
            prices: [],
            volumes: [],
            highs: [],
            lows: [],
            closes: []
        };
    }
    
    update(ohlcv) {
        this.history.prices.push(ohlcv.close);
        this.history.volumes.push(ohlcv.volume || 0);
        this.history.highs.push(ohlcv.high || ohlcv.close);
        this.history.lows.push(ohlcv.low || ohlcv.close);
        this.history.closes.push(ohlcv.close);
        
        const maxWindow = 200;
        if (this.history.prices.length > maxWindow) {
            this.history.prices.shift();
            this.history.volumes.shift();
            this.history.highs.shift();
            this.history.lows.shift();
            this.history.closes.shift();
        }
    }
    
    calculateBollinger(period = this.config.BOLLINGER.PERIOD, 
                       stdDev = this.config.BOLLINGER.STD_DEV) {
        const prices = this.history.closes;
        if (prices.length < period) {
            return { upper: null, middle: null, lower: null, bandwidth: null, squeeze: false, position: 0.5 };
        }
        
        const middle = MathUtils.sma(prices, period);
        const std = MathUtils.stdDev(prices, period);
        
        const upper = middle + (std * stdDev);
        const lower = middle - (std * stdDev);
        const bandwidth = ((upper - lower) / middle) * 100;
        const position = (prices[prices.length - 1] - lower) / (upper - lower);
        
        const bandwidthHistory = this._getBandwidthHistory(period);
        const squeeze = bandwidthHistory.length > 20 && 
                       bandwidth < MathUtils.percentile(bandwidthHistory, 0.25);
        
        const lastPrice = prices[prices.length - 1];
        const prevPrice = prices[prices.length - 2] || lastPrice;
        
        let signal = 'NEUTRAL';
        if (lastPrice > upper && prevPrice <= upper) signal = 'BREAKOUT_UP';
        else if (lastPrice < lower && prevPrice >= lower) signal = 'BREAKOUT_DOWN';
        else if (lastPrice > upper) signal = 'OVERBOUGHT';
        else if (lastPrice < lower) signal = 'OVERSOLD';
        
        return {
            upper: parseFloat(upper.toFixed(5)),
            middle: parseFloat(middle.toFixed(5)),
            lower: parseFloat(lower.toFixed(5)),
            bandwidth: parseFloat(bandwidth.toFixed(2)),
            squeeze,
            position: parseFloat(position.toFixed(4)),
            signal,
            stdDev: parseFloat(std.toFixed(5))
        };
    }
    
    _getBandwidthHistory(period) {
        const bandwidths = [];
        const prices = this.history.closes;
        for (let i = period; i < prices.length; i++) {
            const slice = prices.slice(i - period, i);
            const middle = slice.reduce((a, b) => a + b, 0) / period;
            const std = Math.sqrt(slice.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period);
            bandwidths.push((std * 4) / middle * 100);
        }
        return bandwidths;
    }
    
    calculateMACD(fast = this.config.MACD.FAST, 
                  slow = this.config.MACD.SLOW, 
                  signalPeriod = this.config.MACD.SIGNAL) {
        const prices = this.history.closes;
        if (prices.length < slow + signalPeriod) {
            return { macd: 0, signal: 0, histogram: 0, trend: 'NEUTRAL', cross: null, divergence: null };
        }
        
        const emaFast = this._calculateEMASeries(prices, fast);
        const emaSlow = this._calculateEMASeries(prices, slow);
        
        const macdLine = emaFast.map((v, i) => v - emaSlow[i]).filter(v => !isNaN(v));
        const signalLine = this._calculateEMASeries(macdLine, signalPeriod);
        const histogram = macdLine.slice(-signalLine.length).map((v, i) => v - signalLine[i]);
        
        const currentMACD = macdLine[macdLine.length - 1] || 0;
        const currentSignal = signalLine[signalLine.length - 1] || 0;
        const currentHist = histogram[histogram.length - 1] || 0;
        const prevHist = histogram[histogram.length - 2] || 0;
        
        let trend = 'NEUTRAL';
        if (currentMACD > currentSignal && currentHist > 0) trend = 'BULLISH';
        else if (currentMACD < currentSignal && currentHist < 0) trend = 'BEARISH';
        
        let cross = null;
        if (prevHist <= 0 && currentHist > 0) cross = 'BULLISH_CROSS';
        else if (prevHist >= 0 && currentHist < 0) cross = 'BEARISH_CROSS';
        
        const divergence = this._detectMACDDivergence(prices, macdLine);
        
        return {
            macd: parseFloat(currentMACD.toFixed(5)),
            signal: parseFloat(currentSignal.toFixed(5)),
            histogram: parseFloat(currentHist.toFixed(5)),
            trend,
            cross,
            divergence,
            momentum: currentHist > prevHist ? 'INCREASING' : 'DECREASING'
        };
    }
    
    _calculateEMASeries(data, period) {
        const k = 2 / (period + 1);
        const emas = [data[0]];
        for (let i = 1; i < data.length; i++) {
            emas.push(data[i] * k + emas[i - 1] * (1 - k));
        }
        return emas;
    }
    
    _detectMACDDivergence(prices, macdLine) {
        if (prices.length < 20) return null;
        
        const priceLows = prices.slice(-20);
        const macdLows = macdLine.slice(-20);
        
        const priceMin = Math.min(...priceLows);
        const priceMinIdx = priceLows.indexOf(priceMin);
        const macdAtPriceMin = macdLows[priceMinIdx];
        
        const prevPriceMin = Math.min(...prices.slice(-40, -20));
        const prevMacdMin = Math.min(...macdLine.slice(-40, -20));
        
        if (priceMin < prevPriceMin * 0.99 && macdAtPriceMin > prevMacdMin * 1.01) {
            return 'BULLISH_DIVERGENCE';
        }
        
        const priceMax = Math.max(...priceLows);
        const priceMaxIdx = priceLows.indexOf(priceMax);
        const macdAtPriceMax = macdLows[priceMaxIdx];
        
        const prevPriceMax = Math.max(...prices.slice(-40, -20));
        const prevMacdMax = Math.max(...macdLine.slice(-40, -20));
        
        if (priceMax > prevPriceMax * 1.01 && macdAtPriceMax < prevMacdMax * 0.99) {
            return 'BEARISH_DIVERGENCE';
        }
        
        return null;
    }
    
    calculateRSI(period = this.config.RSI.PERIOD) {
        const prices = this.history.closes;
        if (prices.length < period + 1) {
            return { value: 50, state: 'NEUTRAL', overbought: 70, oversold: 30, dynamic: this.config.RSI.DYNAMIC };
        }
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = prices[prices.length - i] - prices[prices.length - i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        let rs = avgGain / avgLoss;
        for (let i = period + 1; i < Math.min(prices.length, period * 2); i++) {
            const change = prices[prices.length - i] - prices[prices.length - i - 1];
            const gain = change > 0 ? change : 0;
            const loss = change < 0 ? -change : 0;
            rs = ((rs * (period - 1)) + (gain / Math.max(loss, 0.0001))) / period;
        }
        
        const rsi = 100 - (100 / (1 + rs));
        
        let overbought = this.config.RSI.OVERBOUGHT;
        let oversold = this.config.RSI.OVERSOLD;
        
        if (this.config.RSI.DYNAMIC) {
            const atr = this.calculateATR(14);
            const atrPercent = atr ? (atr / prices[prices.length - 1]) * 100 : 1;
            overbought = Math.min(80, 70 + atrPercent * 2);
            oversold = Math.max(20, 30 - atrPercent * 2);
        }
        
        let state = 'NEUTRAL';
        if (rsi > overbought) state = 'OVERBOUGHT';
        else if (rsi < oversold) state = 'OVERSOLD';
        
        return {
            value: parseFloat(rsi.toFixed(2)),
            state,
            overbought: parseFloat(overbought.toFixed(1)),
            oversold: parseFloat(oversold.toFixed(1)),
            dynamic: this.config.RSI.DYNAMIC
        };
    }
    
    calculateADX(period = this.config.ADX.PERIOD) {
        const highs = this.history.highs;
        const lows = this.history.lows;
        const closes = this.history.closes;
        
        if (highs.length < period * 2) {
            return { adx: 25, diPlus: 50, diMinus: 50, trend: 'RANGE', strength: 'MODERATE' };
        }
        
        const tr = [];
        const plusDM = [];
        const minusDM = [];
        
        for (let i = 1; i < highs.length; i++) {
            const tr1 = highs[i] - lows[i];
            const tr2 = Math.abs(highs[i] - closes[i - 1]);
            const tr3 = Math.abs(lows[i] - closes[i - 1]);
            tr.push(Math.max(tr1, tr2, tr3));
            
            const upMove = highs[i] - highs[i - 1];
            const downMove = lows[i - 1] - lows[i];
            
            if (upMove > downMove && upMove > 0) plusDM.push(upMove);
            else plusDM.push(0);
            
            if (downMove > upMove && downMove > 0) minusDM.push(downMove);
            else minusDM.push(0);
        }
        
        const atr = MathUtils.sma(tr, period) || 1;
        const plusDI = 100 * MathUtils.sma(plusDM, period) / atr;
        const minusDI = 100 * MathUtils.sma(minusDM, period) / atr;
        const dx = 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI + 0.001);
        const adx = MathUtils.sma([dx], period) || 25;
        
        let trend = 'RANGE';
        if (adx > 25) trend = plusDI > minusDI ? 'STRONG_UP' : 'STRONG_DOWN';
        else if (adx > 20) trend = plusDI > minusDI ? 'UP' : 'DOWN';
        
        return {
            adx: parseFloat(adx.toFixed(2)),
            diPlus: parseFloat(plusDI.toFixed(2)),
            diMinus: parseFloat(minusDI.toFixed(2)),
            trend,
            strength: adx > 40 ? 'VERY_STRONG' : adx > 25 ? 'STRONG' : adx > 20 ? 'MODERATE' : 'WEAK'
        };
    }
    
    calculateATR(period = this.config.ATR.PERIOD) {
        const highs = this.history.highs;
        const lows = this.history.lows;
        const closes = this.history.closes;
        
        if (highs.length < period + 1) return 0.001;
        
        const tr = [];
        for (let i = 1; i < highs.length; i++) {
            const tr1 = highs[i] - lows[i];
            const tr2 = Math.abs(highs[i] - closes[i - 1]);
            const tr3 = Math.abs(lows[i] - closes[i - 1]);
            tr.push(Math.max(tr1, tr2, tr3));
        }
        
        return parseFloat((MathUtils.sma(tr, period) || 0.001).toFixed(5));
    }
    
    calculateVWAP() {
        const prices = this.history.closes;
        const volumes = this.history.volumes;
        
        if (prices.length === 0 || volumes.length === 0) return { value: prices[prices.length - 1] || 100, position: 'ABOVE', deviation: 0 };
        
        let cumulativeTPV = 0;
        let cumulativeVol = 0;
        
        for (let i = 0; i < prices.length; i++) {
            cumulativeTPV += prices[i] * volumes[i];
            cumulativeVol += volumes[i];
        }
        
        const vwap = cumulativeVol > 0 ? cumulativeTPV / cumulativeVol : prices[prices.length - 1];
        const currentPrice = prices[prices.length - 1];
        
        return {
            value: parseFloat(vwap.toFixed(5)),
            position: currentPrice > vwap ? 'ABOVE' : 'BELOW',
            deviation: parseFloat(((currentPrice - vwap) / vwap * 100).toFixed(2))
        };
    }
    
    getAllSignals() {
        const bollinger = this.calculateBollinger();
        const macd = this.calculateMACD();
        const rsi = this.calculateRSI();
        const adx = this.calculateADX();
        const atr = this.calculateATR();
        const vwap = this.calculateVWAP();
        
        const signals = [];
        
        if (macd.cross === 'BULLISH_CROSS') signals.push('MACD_BULL_CROSS');
        if (macd.cross === 'BEARISH_CROSS') signals.push('MACD_BEAR_CROSS');
        if (macd.divergence === 'BULLISH_DIVERGENCE') signals.push('MACD_BULL_DIV');
        if (macd.divergence === 'BEARISH_DIVERGENCE') signals.push('MACD_BEAR_DIV');
        
        if (rsi.state === 'OVERSOLD') signals.push('RSI_OVERSOLD');
        if (rsi.state === 'OVERBOUGHT') signals.push('RSI_OVERBOUGHT');
        
        if (bollinger.squeeze) signals.push('BOLLINGER_SQUEEZE');
        if (bollinger.signal === 'BREAKOUT_UP') signals.push('BB_BREAKOUT_UP');
        if (bollinger.signal === 'BREAKOUT_DOWN') signals.push('BB_BREAKOUT_DOWN');
        
        if (adx.trend.includes('STRONG')) signals.push(`ADX_${adx.trend}`);
        
        let momentumScore = 0;
        if (macd.trend === 'BULLISH') momentumScore += 25;
        if (macd.trend === 'BEARISH') momentumScore -= 25;
        if (rsi.state === 'OVERSOLD') momentumScore += 20;
        if (rsi.state === 'OVERBOUGHT') momentumScore -= 20;
        if (bollinger.position > 0.8) momentumScore -= 15;
        if (bollinger.position < 0.2) momentumScore += 15;
        if (adx.trend === 'STRONG_UP') momentumScore += 20;
        if (adx.trend === 'STRONG_DOWN') momentumScore -= 20;
        
        return {
            bollinger,
            macd,
            rsi,
            adx,
            atr,
            vwap,
            signals,
            momentumScore: Math.max(-100, Math.min(100, momentumScore)),
            timestamp: Date.now()
        };
    }
}

window.TechnicalIndicators = TechnicalIndicators;
console.log('✅ Parte 2/5 cargada: Indicadores Técnicos Avanzados');
