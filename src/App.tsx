/**
 * Quant-AI OS — Production Trading Bot Monitoring Dashboard
 * Theme: "Cosmic Slate"
 * Database: Neon Postgres via @neondatabase/serverless HTTP driver
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { neon } from '@neondatabase/serverless';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Flame,
  Key,
  Layers,
  Play,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface Trade {
  id: string | number;
  symbol: string;
  side: 'buy' | 'sell' | 'long' | 'short';
  lots: number;
  entry_price: number;
  sl?: number | null;
  tp?: number | null;
  exit_price?: number | null;
  pnl?: number | null;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string | null;
}

export interface EquityLog {
  id: string | number;
  equity: number;
  recorded_at: string;
}

export interface BotEvent {
  id: string | number;
  event_type: 'signal' | 'trade' | 'error' | 'kill';
  message: string;
  created_at: string;
}

type TradeFilter = 'all' | 'open' | 'wins' | 'losses';
type EventFilter = 'all' | 'signal' | 'trade' | 'error' | 'kill';

const STORAGE_KEY = 'quant_ai_neon_connection_string';
const DEMO_MODE_KEY = 'quant_ai_demo_mode_active';

// ==========================================
// REALISTIC MOCK / DEMO DATA GENERATOR
// ==========================================

function generateDemoData() {
  const now = new Date();
  
  // 30 days of equity data (snapshotted every 4-6 hours for smooth 30-day curve)
  const equityLogs: EquityLog[] = [];
  let baseEquity = 100000;
  const days = 30;
  const stepsPerDay = 4;
  const totalSteps = days * stepsPerDay;

  for (let i = totalSteps; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 6 * 3600 * 1000);
    // Introduce market cycles: bullish trending with realistic drawdowns
    const trendFactor = (totalSteps - i) / totalSteps;
    const sineWave = Math.sin(trendFactor * 4) * 3500;
    const noise = (Math.random() - 0.44) * 1200;
    baseEquity += (Math.random() > 0.42 ? 350 : -220) + noise * 0.15;
    
    // Ensure steady overall growth to ~142,800
    const calculatedEquity = Math.round(baseEquity + sineWave);
    equityLogs.push({
      id: `eq-${i}`,
      equity: Math.max(95000, calculatedEquity),
      recorded_at: timestamp.toISOString(),
    });
  }

  // Trades
  const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'NVDA', 'EUR/USD', 'NQ1!', 'AAPL'];
  const trades: Trade[] = [
    {
      id: 1042,
      symbol: 'BTC/USDT',
      side: 'long',
      lots: 1.25,
      entry_price: 64120.50,
      sl: 62800.00,
      tp: 67500.00,
      exit_price: null,
      pnl: 1480.20,
      status: 'open',
      opened_at: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
      closed_at: null,
    },
    {
      id: 1041,
      symbol: 'ETH/USDT',
      side: 'long',
      lots: 8.50,
      entry_price: 3410.80,
      sl: 3340.00,
      tp: 3580.00,
      exit_price: null,
      pnl: 645.00,
      status: 'open',
      opened_at: new Date(now.getTime() - 85 * 60 * 1000).toISOString(),
      closed_at: null,
    },
    {
      id: 1040,
      symbol: 'SOL/USDT',
      side: 'short',
      lots: 45.00,
      entry_price: 154.20,
      sl: 159.00,
      tp: 144.00,
      exit_price: null,
      pnl: -128.50,
      status: 'open',
      opened_at: new Date(now.getTime() - 140 * 60 * 1000).toISOString(),
      closed_at: null,
    },
    {
      id: 1039,
      symbol: 'NVDA',
      side: 'buy',
      lots: 120,
      entry_price: 124.50,
      sl: 121.00,
      tp: 132.00,
      exit_price: 131.80,
      pnl: 876.00,
      status: 'closed',
      opened_at: new Date(now.getTime() - 5 * 3600 * 1000).toISOString(),
      closed_at: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: 1038,
      symbol: 'BTC/USDT',
      side: 'short',
      lots: 0.95,
      entry_price: 63800.00,
      sl: 64500.00,
      tp: 62400.00,
      exit_price: 62550.00,
      pnl: 1187.50,
      status: 'closed',
      opened_at: new Date(now.getTime() - 10 * 3600 * 1000).toISOString(),
      closed_at: new Date(now.getTime() - 6 * 3600 * 1000).toISOString(),
    },
    {
      id: 1037,
      symbol: 'EUR/USD',
      side: 'sell',
      lots: 2.50,
      entry_price: 1.0895,
      sl: 1.0930,
      tp: 1.0820,
      exit_price: 1.0925,
      pnl: -750.00,
      status: 'closed',
      opened_at: new Date(now.getTime() - 18 * 3600 * 1000).toISOString(),
      closed_at: new Date(now.getTime() - 12 * 3600 * 1000).toISOString(),
    },
    {
      id: 1036,
      symbol: 'NQ1!',
      side: 'long',
      lots: 2.00,
      entry_price: 19820.00,
      sl: 19740.00,
      tp: 20050.00,
      exit_price: 20010.00,
      pnl: 3800.00,
      status: 'closed',
      opened_at: new Date(now.getTime() - 26 * 3600 * 1000).toISOString(),
      closed_at: new Date(now.getTime() - 21 * 3600 * 1000).toISOString(),
    },
    {
      id: 1035,
      symbol: 'ETH/USDT',
      side: 'long',
      lots: 6.00,
      entry_price: 3340.00,
      sl: 3280.00,
      tp: 3450.00,
      exit_price: 3445.00,
      pnl: 630.00,
      status: 'closed',
      opened_at: new Date(now.getTime() - 32 * 3600 * 1000).toISOString(),
      closed_at: new Date(now.getTime() - 28 * 3600 * 1000).toISOString(),
    },
    {
      id: 1034,
      symbol: 'SOL/USDT',
      side: 'buy',
      lots: 60.00,
      entry_price: 148.80,
      sl: 144.00,
      tp: 158.00,
      exit_price: 145.20,
      pnl: -216.00,
      status: 'closed',
      opened_at: new Date(now.getTime() - 40 * 3600 * 1000).toISOString(),
      closed_at: new Date(now.getTime() - 36 * 3600 * 1000).toISOString(),
    },
    {
      id: 1033,
      symbol: 'BTC/USDT',
      side: 'long',
      lots: 1.50,
      entry_price: 61950.00,
      sl: 60800.00,
      tp: 63800.00,
      exit_price: 63780.00,
      pnl: 2745.00,
      status: 'closed',
      opened_at: new Date(now.getTime() - 52 * 3600 * 1000).toISOString(),
      closed_at: new Date(now.getTime() - 44 * 3600 * 1000).toISOString(),
    },
  ];

  // Bot events
  const botEvents: BotEvent[] = [
    {
      id: 504,
      event_type: 'signal',
      message: 'Alpha-Momentum: Bullish confluence verified on BTC/USDT 15m. Volume delta +240%.',
      created_at: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
    },
    {
      id: 503,
      event_type: 'trade',
      message: 'ORDER_FILLED: Limit Buy 1.25 lots BTC/USDT @ $64,120.50 (Slippage: 0.004%).',
      created_at: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
    },
    {
      id: 502,
      event_type: 'signal',
      message: 'Alpha-Reversal: RSI 14 divergence on ETH/USDT 30m. Volatility target met.',
      created_at: new Date(now.getTime() - 88 * 60 * 1000).toISOString(),
    },
    {
      id: 501,
      event_type: 'trade',
      message: 'ORDER_FILLED: Market Buy 8.50 lots ETH/USDT @ $3,410.80.',
      created_at: new Date(now.getTime() - 85 * 60 * 1000).toISOString(),
    },
    {
      id: 500,
      event_type: 'error',
      message: 'API latency spike warning: Binance REST ping 242ms (threshold: 200ms). Routing to Tokyo backup.',
      created_at: new Date(now.getTime() - 110 * 60 * 1000).toISOString(),
    },
    {
      id: 499,
      event_type: 'signal',
      message: 'Resistance rejection flagged on SOL/USDT at $154.50. Short criteria matched.',
      created_at: new Date(now.getTime() - 145 * 60 * 1000).toISOString(),
    },
    {
      id: 498,
      event_type: 'trade',
      message: 'TAKE_PROFIT_TRIGGERED: NVDA 120 lots closed @ $131.80 (+876.00 USD).',
      created_at: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: 497,
      event_type: 'signal',
      message: 'Daily risk audit passed: Drawdown within safe bounds (<10%). Sharpe ratio 2.84.',
      created_at: new Date(now.getTime() - 4 * 3600 * 1000).toISOString(),
    },
  ];

  return { equityLogs, trades, botEvents };
}

// ==========================================
// HELPERS
// ==========================================

function formatCurrency(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatISTTime(dateStr: string | Date): string {
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '--:--:--';
  }
}

function formatISTDateTime(dateStr: string | Date): string {
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return 'Invalid Date';
  }
}

function getMinutesAgo(dateStr: string): number {
  try {
    const then = new Date(dateStr).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - then) / 60000));
  } catch {
    return 0;
  }
}

// ==========================================
// COMPONENT: AREA CHART (CANVAS-BASED)
// ==========================================

interface EquityChartProps {
  data: EquityLog[];
}

const EquityChart: React.FC<EquityChartProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  }, [data]);

  const stats = useMemo(() => {
    if (!sortedData.length) return { min: 0, max: 0, change: 0, percentChange: 0 };
    const equities = sortedData.map(d => d.equity);
    const min = Math.min(...equities);
    const max = Math.max(...equities);
    const first = sortedData[0].equity;
    const last = sortedData[sortedData.length - 1].equity;
    const change = last - first;
    const percentChange = first > 0 ? (change / first) * 100 : 0;
    return { min, max, change, percentChange };
  }, [sortedData]);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || sortedData.length < 2) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Padding
    const pt = 24;
    const pb = 32;
    const pl = 16;
    const pr = 16;
    const chartW = width - pl - pr;
    const chartH = height - pt - pb;

    const equities = sortedData.map(d => d.equity);
    const minVal = Math.min(...equities) * 0.995;
    const maxVal = Math.max(...equities) * 1.005;
    const valRange = Math.max(1, maxVal - minVal);

    // Draw horizontal grid lines
    ctx.strokeStyle = '#1E2A3A';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = pt + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(pl + chartW, y);
      ctx.stroke();

      // Grid labels
      const lineVal = maxVal - (valRange / gridLines) * i;
      ctx.fillStyle = '#8B98A9';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`$${Math.round(lineVal).toLocaleString()}`, width - pr - 4, y - 4);
    }
    ctx.setLineDash([]);

    // Map points
    const points: { x: number; y: number; data: EquityLog }[] = sortedData.map((d, i) => {
      const x = pl + (i / (sortedData.length - 1)) * chartW;
      const y = pt + chartH - ((d.equity - minVal) / valRange) * chartH;
      return { x, y, data: d };
    });

    // Draw gradient area
    const gradient = ctx.createLinearGradient(0, pt, 0, pt + chartH);
    gradient.addColorStop(0, 'rgba(200, 241, 53, 0.28)');
    gradient.addColorStop(0.7, 'rgba(200, 241, 53, 0.06)');
    gradient.addColorStop(1, 'rgba(200, 241, 53, 0.0)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, pt + chartH);
    points.forEach((ptCoord, idx) => {
      if (idx === 0) {
        ctx.lineTo(ptCoord.x, ptCoord.y);
      } else {
        // Smooth bezier curve
        const prev = points[idx - 1];
        const cx = (prev.x + ptCoord.x) / 2;
        ctx.bezierCurveTo(cx, prev.y, cx, ptCoord.y, ptCoord.x, ptCoord.y);
      }
    });
    ctx.lineTo(points[points.length - 1].x, pt + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw main line
    ctx.beginPath();
    points.forEach((ptCoord, idx) => {
      if (idx === 0) {
        ctx.moveTo(ptCoord.x, ptCoord.y);
      } else {
        const prev = points[idx - 1];
        const cx = (prev.x + ptCoord.x) / 2;
        ctx.bezierCurveTo(cx, prev.y, cx, ptCoord.y, ptCoord.x, ptCoord.y);
      }
    });
    ctx.strokeStyle = '#C8F135';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = 'rgba(200, 241, 53, 0.5)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // Draw hover indicator if any
    if (hoverIndex !== null && points[hoverIndex]) {
      const activePt = points[hoverIndex];

      // Vertical guide line
      ctx.strokeStyle = 'rgba(200, 241, 53, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(activePt.x, pt);
      ctx.lineTo(activePt.x, pt + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point circle
      ctx.beginPath();
      ctx.arc(activePt.x, activePt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#0B0F19';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#C8F135';
      ctx.stroke();

      // Outer glow
      ctx.beginPath();
      ctx.arc(activePt.x, activePt.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200, 241, 53, 0.2)';
      ctx.fill();
    }
  }, [sortedData, hoverIndex]);

  useEffect(() => {
    drawChart();

    const handleResize = () => {
      drawChart();
    };

    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => {
      drawChart();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [drawChart]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || sortedData.length < 2) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const pl = 16;
    const pr = 16;
    const chartW = rect.width - pl - pr;

    const relativeX = Math.max(0, Math.min(chartW, mouseX - pl));
    const ratio = relativeX / chartW;
    const idx = Math.min(sortedData.length - 1, Math.max(0, Math.round(ratio * (sortedData.length - 1))));

    setHoverIndex(idx);
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || sortedData.length < 2 || !e.touches[0]) return;

    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const pl = 16;
    const pr = 16;
    const chartW = rect.width - pl - pr;

    const relativeX = Math.max(0, Math.min(chartW, touchX - pl));
    const ratio = relativeX / chartW;
    const idx = Math.min(sortedData.length - 1, Math.max(0, Math.round(ratio * (sortedData.length - 1))));

    setHoverIndex(idx);
    setTooltipPos({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setTooltipPos(null);
  };

  const activePoint = hoverIndex !== null ? sortedData[hoverIndex] : null;

  return (
    <div
      ref={containerRef}
      id="equity-chart-container"
      className="relative w-full h-56 sm:h-64 select-none touch-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchMove}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseLeave}
    >
      <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />

      {/* Floating Tooltip */}
      {activePoint && tooltipPos && (
        <div
          className="absolute z-20 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${Math.max(80, Math.min(containerRef.current ? containerRef.current.clientWidth - 80 : tooltipPos.x, tooltipPos.x))}px`,
            top: `${Math.max(48, tooltipPos.y - 12)}px`,
          }}
        >
          <div className="bg-[#121824] border border-[#C8F135]/40 rounded-xl px-3 py-2 shadow-2xl backdrop-blur-md text-xs font-mono glow-lime">
            <div className="text-[#8B98A9] text-[10px] mb-0.5">
              {formatISTDateTime(activePoint.recorded_at)} (IST)
            </div>
            <div className="text-[#C8F135] font-bold text-sm">
              {formatCurrency(activePoint.equity)}
            </div>
          </div>
        </div>
      )}

      {/* Chart Footer Badges */}
      <div className="absolute bottom-1 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-[#8B98A9] pointer-events-none">
        <span>30D START: {formatCurrency(sortedData[0]?.equity)}</span>
        <span className="flex items-center gap-1.5 text-[#C8F135]">
          <TrendingUp className="w-3 h-3" />
          {stats.percentChange >= 0 ? '+' : ''}{stats.percentChange.toFixed(2)}%
        </span>
        <span>PEAK: {formatCurrency(stats.max)}</span>
      </div>
    </div>
  );
};

// ==========================================
// COMPONENT: RISK METER (RADIAL GAUGE)
// ==========================================

interface RiskMeterProps {
  currentEquity: number;
  peakEquity: number;
}

const RiskMeter: React.FC<RiskMeterProps> = ({ currentEquity, peakEquity }) => {
  const peak = Math.max(peakEquity, currentEquity, 1);
  const drawdown = Math.max(0, ((peak - currentEquity) / peak) * 100);

  // Status tiers
  let color = '#C8F135'; // green under 20%
  let label = 'LOW RISK';
  let zoneBg = 'bg-[#C8F135]/10 text-[#C8F135] border-[#C8F135]/30';

  if (drawdown >= 50) {
    color = '#FF4D4D'; // red above 50%
    label = 'CRITICAL MARGIN';
    zoneBg = 'bg-[#FF4D4D]/15 text-[#FF4D4D] border-[#FF4D4D]/40 glow-danger';
  } else if (drawdown >= 20) {
    color = '#FFB020'; // amber 20-50%
    label = 'ELEVATED RISK';
    zoneBg = 'bg-[#FFB020]/15 text-[#FFB020] border-[#FFB020]/40 glow-warning';
  }

  // Radial Gauge Calculations
  const radius = 64;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  // We show a semi-circle or 240 degree arc (let's do 220 degree arc for gauge)
  const arcLength = circumference * 0.72;
  const strokeDashoffset = arcLength - (Math.min(100, drawdown) / 100) * arcLength;

  return (
    <div id="risk-meter-card" className="bg-[#121824] border border-[#1E2A3A] rounded-2xl p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#8B98A9]" />
          <h3 className="text-xs uppercase tracking-wider font-semibold text-[#8B98A9]">
            Risk & Drawdown Gauge
          </h3>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${zoneBg}`}>
          {label}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
        {/* SVG Radial Gauge */}
        <div className="relative flex items-center justify-center w-36 h-36">
          <svg height={radius * 2} width={radius * 2} className="rotate-[140deg] overflow-visible">
            {/* Background Arc */}
            <circle
              stroke="#1E2A3A"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            {/* Colored Active Arc */}
            <circle
              stroke={color}
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={`${arcLength} ${circumference}`}
              style={{
                strokeDashoffset,
                transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease',
              }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
          </svg>

          {/* Center readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono text-2xl font-black tracking-tight" style={{ color }}>
              {drawdown.toFixed(1)}%
            </span>
            <span className="text-[10px] text-[#8B98A9] font-mono uppercase">
              Drawdown
            </span>
          </div>
        </div>

        {/* Metrics Breakdown */}
        <div className="w-full sm:w-auto flex-1 space-y-2.5 text-xs font-mono">
          <div className="flex justify-between items-center bg-[#0B0F19] px-3 py-2 rounded-xl border border-[#1E2A3A]">
            <span className="text-[#8B98A9]">Peak Equity:</span>
            <span className="text-[#E6EDF3] font-semibold">{formatCurrency(peak)}</span>
          </div>
          <div className="flex justify-between items-center bg-[#0B0F19] px-3 py-2 rounded-xl border border-[#1E2A3A]">
            <span className="text-[#8B98A9]">Current Equity:</span>
            <span className="text-[#E6EDF3] font-semibold">{formatCurrency(currentEquity)}</span>
          </div>
          <div className="flex justify-between items-center bg-[#0B0F19] px-3 py-2 rounded-xl border border-[#1E2A3A]">
            <span className="text-[#8B98A9]">Stop-out Buffer:</span>
            <span className="font-semibold" style={{ color }}>
              {(Math.max(0, 50 - drawdown)).toFixed(1)}% to Margin Call
            </span>
          </div>
        </div>
      </div>

      {/* Threshold indicator bar */}
      <div className="pt-2 border-t border-[#1E2A3A]/60 flex items-center justify-between text-[10px] font-mono text-[#8B98A9]">
        <span className="flex items-center gap-1 text-[#C8F135]">
          <span className="w-2 h-2 rounded-full bg-[#C8F135]" /> Safe (&lt;20%)
        </span>
        <span className="flex items-center gap-1 text-[#FFB020]">
          <span className="w-2 h-2 rounded-full bg-[#FFB020]" /> Caution (20–50%)
        </span>
        <span className="flex items-center gap-1 text-[#FF4D4D]">
          <span className="w-2 h-2 rounded-full bg-[#FF4D4D]" /> Red (&gt;50%)
        </span>
      </div>
    </div>
  );
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================

export default function App() {
  // Database & Connection State
  const [connectionString, setConnectionString] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || (import.meta.env.VITE_NEON_DATABASE_URL as string) || '';
  });
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    // If no connection string provided, default to demo mode initially so preview is rich immediately
    const saved = localStorage.getItem(DEMO_MODE_KEY);
    if (saved !== null) return saved === 'true';
    return !localStorage.getItem(STORAGE_KEY) && !(import.meta.env.VITE_NEON_DATABASE_URL as string);
  });

  const [dbStatus, setDbStatus] = useState<'connected' | 'connecting' | 'error' | 'disconnected'>('disconnected');
  const [dbError, setDbError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState<boolean>(false);

  // Settings & Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [tempConnString, setTempConnString] = useState<string>(connectionString);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Data states
  const [trades, setTrades] = useState<Trade[]>([]);
  const [equityLogs, setEquityLogs] = useState<EquityLog[]>([]);
  const [botEvents, setBotEvents] = useState<BotEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [nextRefreshSec, setNextRefreshSec] = useState<number>(30);

  // Filtering & Search
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');
  const [tradeSearch, setTradeSearch] = useState<string>('');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');

  // Live IST Clock state
  const [istTimeStr, setIstTimeStr] = useState<string>(() => formatISTTime(new Date()));
  const [istDateStr, setIstDateStr] = useState<string>(() => {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date());
  });

  // IST Clock tick and secondsAgo counter
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setIstTimeStr(formatISTTime(now));
      setIstDateStr(
        new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(now)
      );
      setSecondsAgo(Math.floor((now.getTime() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdated]);

  // ==========================================
  // DATA FETCHING: NEON POSTGRES OR DEMO
  // ==========================================

  const loadData = useCallback(async (manual = false) => {
    if (manual) setIsLoading(true);

    if (isDemoMode || !connectionString.trim()) {
      // Use Demo Generator
      setDbStatus('connected');
      setDbError(null);
      setTableMissing(false);
      const demo = generateDemoData();
      setEquityLogs(demo.equityLogs);
      setTrades(demo.trades);
      setBotEvents(demo.botEvents);
      setLastUpdated(new Date());
      setIsLoading(false);
      setNextRefreshSec(30);
      return;
    }

    // Connect to real Neon Postgres via HTTP driver
    try {
      setDbStatus('connecting');
      const sql = neon(connectionString.trim());

      // Query tables in parallel
      const [equityRes, tradesRes, eventsRes] = await Promise.all([
        sql`SELECT id, equity, recorded_at FROM equity_log ORDER BY recorded_at ASC LIMIT 1000;`,
        sql`SELECT id, symbol, side, lots, entry_price, sl, tp, exit_price, pnl, status, opened_at, closed_at FROM trades ORDER BY opened_at DESC LIMIT 200;`,
        sql`SELECT id, event_type, message, created_at FROM bot_events ORDER BY created_at DESC LIMIT 200;`,
      ]);

      const parsedEquity: EquityLog[] = (equityRes as any[]).map(r => ({
        id: r.id,
        equity: Number(r.equity) || 0,
        recorded_at: r.recorded_at,
      }));

      const parsedTrades: Trade[] = (tradesRes as any[]).map(r => ({
        id: r.id,
        symbol: r.symbol,
        side: r.side?.toLowerCase(),
        lots: Number(r.lots) || 0,
        entry_price: Number(r.entry_price) || 0,
        sl: r.sl ? Number(r.sl) : null,
        tp: r.tp ? Number(r.tp) : null,
        exit_price: r.exit_price ? Number(r.exit_price) : null,
        pnl: r.pnl !== null && r.pnl !== undefined ? Number(r.pnl) : null,
        status: r.status?.toLowerCase() === 'open' ? 'open' : 'closed',
        opened_at: r.opened_at,
        closed_at: r.closed_at,
      }));

      const parsedEvents: BotEvent[] = (eventsRes as any[]).map(r => ({
        id: r.id,
        event_type: r.event_type?.toLowerCase(),
        message: r.message,
        created_at: r.created_at,
      }));

      setEquityLogs(parsedEquity);
      setTrades(parsedTrades);
      setBotEvents(parsedEvents);
      setDbStatus('connected');
      setDbError(null);
      setTableMissing(false);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Neon DB Query Error:', err);
      setDbStatus('error');
      const errMsg = err?.message || String(err);
      setDbError(errMsg);

      // Check if table missing
      if (errMsg.toLowerCase().includes('relation') && errMsg.toLowerCase().includes('does not exist')) {
        setTableMissing(true);
      }
    } finally {
      setIsLoading(false);
      setNextRefreshSec(30);
    }
  }, [connectionString, isDemoMode]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 30-second Auto-Refresh Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setNextRefreshSec(prev => {
        if (prev <= 1) {
          loadData();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [loadData]);

  // ==========================================
  // INITIALIZE TABLES & SEED SCRIPT (FOR REAL NEON DB)
  // ==========================================

  const handleInitializeTables = async () => {
    if (!connectionString.trim()) return;
    setIsSeeding(true);
    try {
      const sql = neon(connectionString.trim());

      // Create trades table
      await sql`
        CREATE TABLE IF NOT EXISTS trades (
          id SERIAL PRIMARY KEY,
          symbol VARCHAR(20) NOT NULL,
          side VARCHAR(10) NOT NULL,
          lots NUMERIC(10,4) NOT NULL,
          entry_price NUMERIC(14,4) NOT NULL,
          sl NUMERIC(14,4),
          tp NUMERIC(14,4),
          exit_price NUMERIC(14,4),
          pnl NUMERIC(14,2),
          status VARCHAR(10) NOT NULL DEFAULT 'open',
          opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          closed_at TIMESTAMP WITH TIME ZONE
        );
      `;

      // Create equity_log table
      await sql`
        CREATE TABLE IF NOT EXISTS equity_log (
          id SERIAL PRIMARY KEY,
          equity NUMERIC(14,2) NOT NULL,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // Create bot_events table
      await sql`
        CREATE TABLE IF NOT EXISTS bot_events (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // Seed initial bootstrap events and equity if empty
      const existingEquity = await sql`SELECT count(*) FROM equity_log;`;
      if (Number(existingEquity[0]?.count) === 0) {
        await sql`
          INSERT INTO equity_log (equity, recorded_at) VALUES 
          (100000.00, NOW() - INTERVAL '30 days'),
          (108500.00, NOW() - INTERVAL '20 days'),
          (116200.00, NOW() - INTERVAL '10 days'),
          (129400.00, NOW() - INTERVAL '2 days'),
          (134250.00, NOW() - INTERVAL '1 hour'),
          (135890.00, NOW());
        `;

        await sql`
          INSERT INTO bot_events (event_type, message, created_at) VALUES
          ('signal', 'Quant-AI OS Engine initialized. Ready to execute Alpha-Momentum.', NOW() - INTERVAL '3 hours'),
          ('trade', 'Initial test lot executed on BTC/USDT @ 63,400.00', NOW() - INTERVAL '2 hours'),
          ('signal', 'Heartbeat check passed. Latency: 18ms.', NOW() - INTERVAL '5 minutes');
        `;

        await sql`
          INSERT INTO trades (symbol, side, lots, entry_price, sl, tp, pnl, status, opened_at) VALUES
          ('BTC/USDT', 'long', 1.0, 63400.00, 62000.00, 66000.00, 850.00, 'open', NOW() - INTERVAL '2 hours');
        `;
      }

      setTableMissing(false);
      setDbError(null);
      await loadData();
    } catch (err: any) {
      alert(`Error initializing tables: ${err?.message || err}`);
    } finally {
      setIsSeeding(false);
    }
  };

  // ==========================================
  // HERO BOT STATUS LOGIC
  // ==========================================

  const latestEvent = useMemo(() => {
    if (!botEvents.length) return null;
    return botEvents[0];
  }, [botEvents]);

  const isBotDead = latestEvent?.event_type === 'kill';
  const lastHeartbeatMinutes = latestEvent ? getMinutesAgo(latestEvent.created_at) : 0;

  // Toggle Bot Kill in Demo Mode for testing
  const handleToggleKillDemo = () => {
    if (isBotDead) {
      // Revive
      const reviveEvent: BotEvent = {
        id: Date.now(),
        event_type: 'signal',
        message: 'SYSTEM_RESTORE: Circuit breaker reset by administrator. Trading algorithms operational.',
        created_at: new Date().toISOString(),
      };
      setBotEvents(prev => [reviveEvent, ...prev]);
    } else {
      // Kill
      const killEvent: BotEvent = {
        id: Date.now(),
        event_type: 'kill',
        message: 'CRITICAL_KILL_SWITCH_ENGAGED: Drawdown limit triggered or manual emergency kill executed.',
        created_at: new Date().toISOString(),
      };
      setBotEvents(prev => [killEvent, ...prev]);
    }
  };

  // ==========================================
  // EQUITY COMPUTATIONS
  // ==========================================

  const currentEquity = useMemo(() => {
    if (!equityLogs.length) return 100000;
    return equityLogs[equityLogs.length - 1].equity;
  }, [equityLogs]);

  const peakEquity = useMemo(() => {
    if (!equityLogs.length) return currentEquity;
    return Math.max(...equityLogs.map(l => l.equity));
  }, [equityLogs, currentEquity]);

  // Today's PnL & All-time PnL
  const todayPnL = useMemo(() => {
    if (!trades.length) return { pnl: 0, percent: 0 };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Sum PnL of closed trades today + open trades
    let sum = 0;
    trades.forEach(t => {
      const opened = new Date(t.opened_at).getTime();
      const closed = t.closed_at ? new Date(t.closed_at).getTime() : 0;
      if (opened >= todayStart || closed >= todayStart) {
        sum += (t.pnl || 0);
      }
    });

    const percent = currentEquity > 0 ? (sum / currentEquity) * 100 : 0;
    return { pnl: sum, percent };
  }, [trades, currentEquity]);

  const allTimePnL = useMemo(() => {
    if (!equityLogs.length) return { pnl: 0, percent: 0 };
    const startEquity = equityLogs[0].equity;
    const diff = currentEquity - startEquity;
    const percent = startEquity > 0 ? (diff / startEquity) * 100 : 0;
    return { pnl: diff, percent };
  }, [equityLogs, currentEquity]);

  // ==========================================
  // TRADES FILTERING
  // ==========================================

  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      // Filter tab
      if (tradeFilter === 'open' && t.status !== 'open') return false;
      if (tradeFilter === 'wins' && ((t.pnl || 0) <= 0 || t.status === 'open')) return false;
      if (tradeFilter === 'losses' && ((t.pnl || 0) >= 0 || t.status === 'open')) return false;

      // Symbol search
      if (tradeSearch.trim()) {
        const query = tradeSearch.toLowerCase();
        return (
          t.symbol.toLowerCase().includes(query) ||
          t.side.toLowerCase().includes(query) ||
          String(t.id).includes(query)
        );
      }
      return true;
    });
  }, [trades, tradeFilter, tradeSearch]);

  const counts = useMemo(() => {
    return {
      all: trades.length,
      open: trades.filter(t => t.status === 'open').length,
      wins: trades.filter(t => t.status === 'closed' && (t.pnl || 0) > 0).length,
      losses: trades.filter(t => t.status === 'closed' && (t.pnl || 0) < 0).length,
    };
  }, [trades]);

  // ==========================================
  // BOT EVENTS FILTERING
  // ==========================================

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'all') return botEvents;
    return botEvents.filter(e => e.event_type === eventFilter);
  }, [botEvents, eventFilter]);

  // Save connection string handler
  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tempConnString.trim();
    setConnectionString(clean);
    localStorage.setItem(STORAGE_KEY, clean);
    setIsDemoMode(false);
    localStorage.setItem(DEMO_MODE_KEY, 'false');
    setIsSettingsOpen(false);
    loadData(true);
  };

  const handleUseDemo = () => {
    setIsDemoMode(true);
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    setIsSettingsOpen(false);
    loadData(true);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#E6EDF3] flex flex-col selection:bg-[#C8F135]/20 selection:text-[#C8F135]">
      {/* ==================================================== */}
      {/* 1. HEADER SECTION */}
      {/* ==================================================== */}
      <header
        id="header-bar"
        className="sticky top-0 z-30 bg-[#0B0F19]/90 backdrop-blur-md border-b border-[#1E2A3A] px-4 py-3 sm:px-6"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand Wordmark & Mode */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#121824] border border-[#1E2A3A] flex items-center justify-center glow-lime">
              <Terminal className="w-4 h-4 text-[#C8F135]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-wider text-base sm:text-lg font-mono text-[#E6EDF3]">
                  QUANT<span className="text-[#C8F135]">-AI</span> OS
                </span>
                <span className="text-[10px] font-mono uppercase bg-[#121824] border border-[#1E2A3A] text-[#8B98A9] px-1.5 py-0.5 rounded">
                  v4.8
                </span>
                {isDemoMode && (
                  <span className="text-[10px] font-mono uppercase bg-[#FFB020]/15 text-[#FFB020] border border-[#FFB020]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> DEMO SIM
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#8B98A9] hidden sm:block font-mono">
                Institutional Algorithmic Telemetry Core
              </p>
            </div>
          </div>

          {/* Center / Right: Live Clock (IST) & Connection Status */}
          <div className="flex items-center flex-wrap gap-2.5 sm:gap-4 text-xs font-mono">
            {/* Live Clock (IST) */}
            <div
              id="ist-live-clock"
              className="bg-[#121824] border border-[#1E2A3A] px-2.5 py-1.5 rounded-xl flex items-center gap-2"
              title="Indian Standard Time (IST - UTC+5:30)"
            >
              <Clock className="w-3.5 h-3.5 text-[#8B98A9]" />
              <div className="flex items-center gap-1.5">
                <span className="text-[#E6EDF3] font-semibold">{istTimeStr}</span>
                <span className="text-[#8B98A9] text-[10px]">IST</span>
                <span className="text-[#8B98A9] hidden md:inline text-[10px]">({istDateStr})</span>
              </div>
            </div>

            {/* Connection Status Dot */}
            <div
              id="db-connection-status"
              className="bg-[#121824] border border-[#1E2A3A] px-2.5 py-1.5 rounded-xl flex items-center gap-2"
            >
              {dbStatus === 'connected' ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8F135] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#C8F135]"></span>
                  </span>
                  <span className="text-[#C8F135] font-semibold text-[11px] hidden sm:inline">
                    {isDemoMode ? 'SIMULATOR ACTIVE' : 'NEON CONNECTED'}
                  </span>
                </>
              ) : dbStatus === 'connecting' ? (
                <>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FFB020] animate-pulse"></span>
                  <span className="text-[#FFB020] text-[11px] hidden sm:inline">CONNECTING...</span>
                </>
              ) : (
                <>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF4D4D]"></span>
                  <span className="text-[#FF4D4D] font-semibold text-[11px] hidden sm:inline">DISCONNECTED</span>
                </>
              )}
            </div>

            {/* Subtle "Updated just now" indicator */}
            <div
              id="subtle-updated-indicator"
              className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-[#8B98A9] bg-[#121824] border border-[#1E2A3A] px-2.5 py-1.5 rounded-xl"
              title="Telemetry auto-refresh sync indicator"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${secondsAgo < 5 ? 'bg-[#C8F135] animate-ping' : 'bg-[#8B98A9]'}`} />
              <span>{secondsAgo < 5 ? 'updated just now' : `updated ${secondsAgo}s ago`}</span>
            </div>

            {/* Refresh countdown & manual sync button */}
            <button
              id="manual-refresh-btn"
              onClick={() => loadData(true)}
              disabled={isLoading}
              title="Auto-refreshes every 30s. Click to refresh immediately."
              className="bg-[#121824] hover:bg-[#1A2334] active:bg-[#101520] border border-[#1E2A3A] text-[#8B98A9] hover:text-[#C8F135] px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#C8F135]' : ''}`} />
              <span className="text-[11px] hidden md:inline">
                {isLoading ? 'SYNCING...' : `${nextRefreshSec}s`}
              </span>
            </button>

            {/* Settings button */}
            <button
              id="settings-modal-toggle"
              onClick={() => {
                setTempConnString(connectionString);
                setIsSettingsOpen(true);
              }}
              className="bg-[#121824] hover:bg-[#1A2334] border border-[#1E2A3A] text-[#8B98A9] hover:text-[#E6EDF3] p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Database Connection Settings"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">DB Setup</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* ONE-TIME SETUP SCREEN (If DB connection string is missing and not in demo mode) */}
        {!connectionString.trim() && !isDemoMode ? (
          <section
            id="one-time-setup-screen"
            className="my-8 sm:my-16 max-w-2xl mx-auto bg-[#121824] border border-[#1E2A3A] rounded-2xl p-6 sm:p-8 shadow-2xl glow-lime/20 font-mono space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#C8F135]/15 border border-[#C8F135]/30 flex items-center justify-center glow-lime">
                <Database className="w-6 h-6 text-[#C8F135]" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#E6EDF3] tracking-tight">
                  CONNECT NEON DATABASE
                </h2>
                <p className="text-xs text-[#8B98A9] mt-0.5">
                  Serverless HTTP Postgres Telemetry Core
                </p>
              </div>
            </div>

            <p className="text-xs text-[#8B98A9] leading-relaxed">
              Quant-AI OS connects directly from your browser to your Neon Postgres database using the
              serverless HTTP driver (<code className="text-[#C8F135]">@neondatabase/serverless</code>). No TCP connection limits.
              Enter your database connection string below to stream live telemetry.
            </p>

            <form onSubmit={handleSaveConnection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#E6EDF3] mb-1.5">
                  Neon Postgres Connection String:
                </label>
                <input
                  type="text"
                  placeholder="postgresql://user:password@ep-cool-snowflake-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
                  value={tempConnString}
                  onChange={e => setTempConnString(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1E2A3A] focus:border-[#C8F135] rounded-xl px-3.5 py-3 text-xs text-[#E6EDF3] placeholder-[#8B98A9]/40 outline-none transition-colors"
                />
                <span className="text-[10px] text-[#8B98A9] mt-1 block">
                  Stored securely in your local browser storage. Never sent to any third-party intermediary.
                </span>
              </div>

              <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-xl p-4 text-xs space-y-2 text-[#8B98A9]">
                <div className="text-[#E6EDF3] font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#C8F135]" /> Expected Read-Only Tables:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="bg-[#121824] p-2 rounded-lg border border-[#1E2A3A]">
                    <span className="text-[#C8F135] font-bold">trades</span>
                    <p className="text-[10px] text-[#8B98A9] mt-0.5">symbol, side, lots, entry, exit, pnl, status</p>
                  </div>
                  <div className="bg-[#121824] p-2 rounded-lg border border-[#1E2A3A]">
                    <span className="text-[#C8F135] font-bold">equity_log</span>
                    <p className="text-[10px] text-[#8B98A9] mt-0.5">equity, recorded_at (5-min intervals)</p>
                  </div>
                  <div className="bg-[#121824] p-2 rounded-lg border border-[#1E2A3A]">
                    <span className="text-[#C8F135] font-bold">bot_events</span>
                    <p className="text-[10px] text-[#8B98A9] mt-0.5">event_type (signal/trade/error/kill)</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!tempConnString.trim()}
                  className="w-full sm:w-auto flex-1 bg-[#C8F135] hover:bg-[#B5DC2E] disabled:opacity-40 disabled:hover:bg-[#C8F135] text-[#0B0F19] font-black text-xs py-3 px-6 rounded-xl cursor-pointer glow-lime transition-all text-center"
                >
                  Connect Database
                </button>
                <button
                  type="button"
                  onClick={handleUseDemo}
                  className="w-full sm:w-auto bg-[#1E2A3A] hover:bg-[#2A3B52] text-[#E6EDF3] text-xs py-3 px-5 rounded-xl cursor-pointer transition-colors text-center"
                >
                  Or Launch Demo Simulator
                </button>
              </div>
            </form>
          </section>
        ) : (
          <>
            {/* Connection Error / Setup Banner */}
            {dbStatus === 'error' && (
              <div
                id="db-error-alert"
                className="bg-[#121824] border border-[#FF4D4D]/50 rounded-2xl p-4 glow-danger flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-3">
                  <AlertOctagon className="w-5 h-5 text-[#FF4D4D] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[#FF4D4D] text-sm">Neon Database Connection Error</div>
                    <div className="text-[#8B98A9] font-mono mt-0.5 break-all">{dbError}</div>
                    {tableMissing && (
                      <div className="text-[#FFB020] font-mono mt-1">
                        Database tables (`trades`, `equity_log`, `bot_events`) do not exist yet.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tableMissing && (
                    <button
                      id="init-tables-btn"
                      onClick={handleInitializeTables}
                      disabled={isSeeding}
                      className="bg-[#C8F135] hover:bg-[#B5DC2E] text-[#0B0F19] font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
                    >
                      {isSeeding ? 'Creating...' : 'Initialize Tables Now'}
                    </button>
                  )}
                  <button
                    id="switch-demo-btn"
                    onClick={handleUseDemo}
                    className="bg-[#1E2A3A] hover:bg-[#2A3B52] text-[#E6EDF3] px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
                  >
                    Use Demo Mode
                  </button>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="bg-[#121824] border border-[#1E2A3A] hover:border-[#8B98A9] text-[#8B98A9] px-3 py-1.5 rounded-xl cursor-pointer"
                  >
                    Edit Config
                  </button>
                </div>
              </div>
            )}

        {/* ==================================================== */}
        {/* 2. BOT STATUS CARD (HERO) */}
        {/* ==================================================== */}
        <section
          id="bot-status-hero"
          className={`rounded-2xl border p-4 sm:p-5 transition-all ${
            isBotDead
              ? 'bg-[#121824] border-[#FF4D4D]/60 glow-danger'
              : 'bg-[#121824] border-[#1E2A3A]'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status State & Pill */}
            <div className="flex items-start sm:items-center gap-4">
              {isBotDead ? (
                <div className="w-14 h-14 rounded-2xl bg-[#FF4D4D]/15 border border-[#FF4D4D]/40 flex items-center justify-center shrink-0 glow-danger animate-pulse">
                  <ShieldAlert className="w-7 h-7 text-[#FF4D4D]" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[#C8F135]/15 border border-[#C8F135]/40 flex items-center justify-center shrink-0 glow-lime">
                  <Flame className="w-7 h-7 text-[#C8F135]" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className={`font-mono text-xl sm:text-2xl font-black tracking-tight ${
                      isBotDead ? 'text-[#FF4D4D]' : 'text-[#C8F135]'
                    }`}
                  >
                    {isBotDead ? 'AI IS DEAD' : 'BOT ALIVE'}
                  </span>

                  <span
                    className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                      isBotDead
                        ? 'bg-[#FF4D4D]/20 text-[#FF4D4D] border-[#FF4D4D]/40'
                        : 'bg-[#C8F135]/15 text-[#C8F135] border-[#C8F135]/40'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isBotDead ? 'bg-[#FF4D4D]' : 'bg-[#C8F135] animate-ping'
                      }`}
                    />
                    {isBotDead ? 'EMERGENCY HALT' : 'AUTONOMOUS EXECUTION'}
                  </span>

                  {isDemoMode && (
                    <button
                      onClick={handleToggleKillDemo}
                      className="text-[10px] font-mono text-[#8B98A9] hover:text-[#C8F135] underline cursor-pointer ml-1"
                      title="Test the alive/dead hero UI state"
                    >
                      (Toggle {isBotDead ? 'Revive' : 'Kill'} Test)
                    </button>
                  )}
                </div>

                <div className="text-xs text-[#8B98A9] font-mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    Last Heartbeat:{' '}
                    <strong className="text-[#E6EDF3]">
                      {lastHeartbeatMinutes === 0 ? 'just now' : `${lastHeartbeatMinutes}m ago`}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Strategy: <strong className="text-[#E6EDF3]">ALPHA-MOMENTUM V4</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Signals Processed: <strong className="text-[#E6EDF3]">{botEvents.length}</strong>
                  </span>
                </div>

                {isBotDead && latestEvent && (
                  <div className="mt-2.5 text-xs font-mono bg-[#0B0F19] border border-[#FF4D4D]/30 text-[#FF4D4D] p-2.5 rounded-xl">
                    <span className="font-bold">KILL TRIGGER:</span> {latestEvent.message} (at{' '}
                    {formatISTTime(latestEvent.created_at)} IST)
                  </div>
                )}
              </div>
            </div>

            {/* Quick Hero Telemetry Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#1E2A3A]">
              <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-xl px-3 py-2 text-center">
                <div className="text-[10px] uppercase font-mono text-[#8B98A9]">Active Orders</div>
                <div className="font-mono text-base font-bold text-[#C8F135]">{counts.open}</div>
              </div>

              <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-xl px-3 py-2 text-center">
                <div className="text-[10px] uppercase font-mono text-[#8B98A9]">Win Rate</div>
                <div className="font-mono text-base font-bold text-[#E6EDF3]">
                  {counts.wins + counts.losses > 0
                    ? `${((counts.wins / (counts.wins + counts.losses)) * 100).toFixed(0)}%`
                    : '100%'}
                </div>
              </div>

              <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-xl px-3 py-2 text-center">
                <div className="text-[10px] uppercase font-mono text-[#8B98A9]">Execution Mode</div>
                <div className="font-mono text-base font-bold text-[#E6EDF3]">HFT-5M</div>
              </div>

              <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-xl px-3 py-2 text-center">
                <div className="text-[10px] uppercase font-mono text-[#8B98A9]">Kill Protection</div>
                <div className="font-mono text-base font-bold text-[#C8F135]">ARMED</div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 3. EQUITY PANEL & 6. RISK METER GRID */}
        {/* ==================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Equity Panel (spans 2 columns on lg) */}
          <section
            id="equity-panel"
            className="lg:col-span-2 bg-[#121824] border border-[#1E2A3A] rounded-2xl p-4 flex flex-col justify-between"
          >
            {/* Header & Metrics */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#C8F135]" />
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-[#8B98A9]">
                    Portfolio Equity (Last 30 Days)
                  </h3>
                </div>
                <div className="font-mono text-2xl sm:text-3xl font-black text-[#E6EDF3] mt-1">
                  {formatCurrency(currentEquity)}
                </div>
              </div>

              {/* Today's PnL & All-Time PnL Badges */}
              <div className="flex items-center gap-2 sm:gap-3 font-mono text-xs">
                {/* Today's PnL */}
                <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-xl px-3 py-1.5">
                  <div className="text-[10px] text-[#8B98A9] uppercase">Today's P&L</div>
                  <div
                    className={`font-bold flex items-center gap-1 ${
                      todayPnL.pnl >= 0 ? 'text-[#C8F135]' : 'text-[#FF4D4D]'
                    }`}
                  >
                    {todayPnL.pnl >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>{todayPnL.pnl >= 0 ? '+' : ''}{formatCurrency(todayPnL.pnl)}</span>
                    <span className="text-[10px]">({todayPnL.percent >= 0 ? '+' : ''}{todayPnL.percent.toFixed(2)}%)</span>
                  </div>
                </div>

                {/* All-time PnL */}
                <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-xl px-3 py-1.5">
                  <div className="text-[10px] text-[#8B98A9] uppercase">All-Time P&L</div>
                  <div
                    className={`font-bold flex items-center gap-1 ${
                      allTimePnL.pnl >= 0 ? 'text-[#C8F135]' : 'text-[#FF4D4D]'
                    }`}
                  >
                    {allTimePnL.pnl >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    <span>{allTimePnL.pnl >= 0 ? '+' : ''}{formatCurrency(allTimePnL.pnl)}</span>
                    <span className="text-[10px]">({allTimePnL.percent >= 0 ? '+' : ''}{allTimePnL.percent.toFixed(2)}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Canvas Area Chart */}
            {equityLogs.length > 0 ? (
              <EquityChart data={equityLogs} />
            ) : (
              <div className="h-56 flex flex-col items-center justify-center text-[#8B98A9] font-mono text-xs">
                <Activity className="w-8 h-8 text-[#1E2A3A] animate-pulse mb-2" />
                Waiting for first equity snapshot...
              </div>
            )}
          </section>

          {/* Risk Meter (Radial Gauge) */}
          <RiskMeter currentEquity={currentEquity} peakEquity={peakEquity} />
        </div>

        {/* ==================================================== */}
        {/* 4. TRADES TABLE & 5. TERMINAL EVENTS FEED */}
        {/* ==================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* TRADES TABLE (Spans 2 columns) */}
          <section
            id="trades-ledger-section"
            className="lg:col-span-2 bg-[#121824] border border-[#1E2A3A] rounded-2xl p-4 flex flex-col"
          >
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#C8F135]" />
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#8B98A9]">
                  Live Trades Ledger
                </h3>
                <span className="text-[10px] font-mono text-[#8B98A9] bg-[#0B0F19] px-2 py-0.5 rounded border border-[#1E2A3A]">
                  {trades.length} Total
                </span>
              </div>

              {/* Filter Tabs & Search */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B98A9]" />
                  <input
                    type="text"
                    placeholder="Filter symbol..."
                    value={tradeSearch}
                    onChange={e => setTradeSearch(e.target.value)}
                    className="bg-[#0B0F19] border border-[#1E2A3A] focus:border-[#C8F135] text-xs font-mono pl-8 pr-2.5 py-1 rounded-xl text-[#E6EDF3] placeholder-[#8B98A9]/60 outline-none w-28 sm:w-36 transition-colors"
                  />
                </div>

                {/* Filter buttons */}
                <div className="flex items-center bg-[#0B0F19] border border-[#1E2A3A] rounded-xl p-0.5 text-[11px] font-mono">
                  {(['all', 'open', 'wins', 'losses'] as TradeFilter[]).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setTradeFilter(tab)}
                      className={`px-2 py-1 rounded-lg capitalize transition-colors cursor-pointer ${
                        tradeFilter === tab
                          ? 'bg-[#121824] text-[#C8F135] font-semibold border border-[#1E2A3A]'
                          : 'text-[#8B98A9] hover:text-[#E6EDF3]'
                      }`}
                    >
                      {tab} ({counts[tab]})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Cards (Phone View) */}
            <div className="sm:hidden space-y-2.5 overflow-y-auto max-h-[380px] pr-0.5">
              {isLoading && trades.length === 0 ? (
                // Skeleton loading state
                Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={`skeleton-mobile-${idx}`}
                    className="bg-[#0B0F19] border border-[#1E2A3A] rounded-xl p-3 animate-pulse space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-20 bg-[#1E2A3A] rounded" />
                      <div className="h-4 w-14 bg-[#1E2A3A] rounded-full" />
                    </div>
                    <div className="h-10 bg-[#121824] rounded-lg" />
                    <div className="flex justify-between">
                      <div className="h-3 w-16 bg-[#1E2A3A] rounded" />
                      <div className="h-4 w-12 bg-[#1E2A3A] rounded" />
                    </div>
                  </div>
                ))
              ) : filteredTrades.length > 0 ? (
                filteredTrades.map(trade => {
                  const isWin = (trade.pnl || 0) > 0;
                  const isOpen = trade.status === 'open';

                  return (
                    <div
                      key={`mob-${trade.id}`}
                      className="bg-[#0B0F19] border border-[#1E2A3A] hover:border-[#2E3C4E] rounded-xl p-3 font-mono text-xs space-y-2 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#E6EDF3]">{trade.symbol}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              trade.side === 'buy' || trade.side === 'long'
                                ? 'bg-[#C8F135]/15 text-[#C8F135]'
                                : 'bg-[#FF4D4D]/15 text-[#FF4D4D]'
                            }`}
                          >
                            {trade.side}
                          </span>
                        </div>
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C8F135]/15 text-[#C8F135] ring-1 ring-[#C8F135]/40 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#C8F135]" />
                            OPEN
                          </span>
                        ) : isWin ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C8F135]/10 text-[#C8F135] border border-[#C8F135]/30">
                            CLOSED-WIN
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF4D4D]/10 text-[#FF4D4D] border border-[#FF4D4D]/30">
                            CLOSED-LOSS
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-[11px] text-[#8B98A9] bg-[#121824] p-2 rounded-lg">
                        <div>
                          <span className="text-[9px] block text-[#8B98A9]/70 uppercase">Lots</span>
                          <span className="text-[#E6EDF3] font-semibold">{trade.lots}</span>
                        </div>
                        <div>
                          <span className="text-[9px] block text-[#8B98A9]/70 uppercase">Entry</span>
                          <span className="text-[#E6EDF3] font-semibold">
                            ${Number(trade.entry_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] block text-[#8B98A9]/70 uppercase">Exit / TP</span>
                          <span className="text-[#E6EDF3] font-semibold">
                            {trade.exit_price ? (
                              `$${Number(trade.exit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            ) : trade.tp ? (
                              `TP: $${trade.tp}`
                            ) : (
                              '--'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1E2A3A]/60">
                        <span className="text-[10px] text-[#8B98A9]">{formatISTDateTime(trade.opened_at)}</span>
                        <div className="font-bold text-sm">
                          {trade.pnl !== null && trade.pnl !== undefined ? (
                            <span className={trade.pnl >= 0 ? 'text-[#C8F135]' : 'text-[#FF4D4D]'}>
                              {trade.pnl >= 0 ? '+' : ''}${Number(trade.pnl).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[#8B98A9]">--</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-[#8B98A9]">
                  <Activity className="w-6 h-6 text-[#1E2A3A] mx-auto mb-2" />
                  <p className="text-xs">Waiting for first trade…</p>
                </div>
              )}
            </div>

            {/* Desktop / Tablet Table Container */}
            <div className="hidden sm:block overflow-x-auto flex-1 rounded-xl border border-[#1E2A3A]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0E1420] text-[#8B98A9] text-[10px] uppercase border-b border-[#1E2A3A] select-none sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Side</th>
                    <th className="py-2.5 px-3">Lots</th>
                    <th className="py-2.5 px-3">Entry</th>
                    <th className="py-2.5 px-3">Exit / TP</th>
                    <th className="py-2.5 px-3 text-right">P&L (USD)</th>
                    <th className="py-2.5 px-3 text-right">Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2A3A]/60">
                  {isLoading && trades.length === 0 ? (
                    // Skeleton loading rows
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={`skeleton-row-${idx}`} className="animate-pulse">
                        <td className="py-3 px-3"><div className="h-4 w-16 bg-[#1E2A3A] rounded-full" /></td>
                        <td className="py-3 px-3"><div className="h-4 w-20 bg-[#1E2A3A] rounded" /></td>
                        <td className="py-3 px-3"><div className="h-4 w-10 bg-[#1E2A3A] rounded" /></td>
                        <td className="py-3 px-3"><div className="h-4 w-8 bg-[#1E2A3A] rounded" /></td>
                        <td className="py-3 px-3"><div className="h-4 w-16 bg-[#1E2A3A] rounded" /></td>
                        <td className="py-3 px-3"><div className="h-4 w-16 bg-[#1E2A3A] rounded" /></td>
                        <td className="py-3 px-3 text-right"><div className="h-4 w-14 bg-[#1E2A3A] rounded ml-auto" /></td>
                        <td className="py-3 px-3 text-right"><div className="h-4 w-20 bg-[#1E2A3A] rounded ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredTrades.length > 0 ? (
                    filteredTrades.map(trade => {
                      const isWin = (trade.pnl || 0) > 0;
                      const isOpen = trade.status === 'open';

                      return (
                        <tr
                          key={trade.id}
                          className="hover:bg-[#161E2D] transition-colors group"
                        >
                          {/* Status Badge */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            {isOpen ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C8F135]/15 text-[#C8F135] ring-1 ring-[#C8F135]/40 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#C8F135]" />
                                OPEN
                              </span>
                            ) : isWin ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C8F135]/10 text-[#C8F135] border border-[#C8F135]/30">
                                CLOSED-WIN
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF4D4D]/10 text-[#FF4D4D] border border-[#FF4D4D]/30">
                                CLOSED-LOSS
                              </span>
                            )}
                          </td>

                          {/* Symbol */}
                          <td className="py-2 px-3 font-bold text-[#E6EDF3] whitespace-nowrap">
                            {trade.symbol}
                          </td>

                          {/* Side */}
                          <td className="py-2 px-3 whitespace-nowrap uppercase">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                trade.side === 'buy' || trade.side === 'long'
                                  ? 'bg-[#C8F135]/15 text-[#C8F135]'
                                  : 'bg-[#FF4D4D]/15 text-[#FF4D4D]'
                              }`}
                            >
                              {trade.side}
                            </span>
                          </td>

                          {/* Lots */}
                          <td className="py-2 px-3 text-[#E6EDF3] whitespace-nowrap">
                            {trade.lots}
                          </td>

                          {/* Entry Price */}
                          <td className="py-2 px-3 text-[#8B98A9] whitespace-nowrap">
                            ${Number(trade.entry_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>

                          {/* Exit Price */}
                          <td className="py-2 px-3 text-[#8B98A9] whitespace-nowrap">
                            {trade.exit_price ? (
                              `$${Number(trade.exit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            ) : trade.tp ? (
                              <span className="text-[#8B98A9]/70 text-[10px]">TP: ${trade.tp}</span>
                            ) : (
                              '--'
                            )}
                          </td>

                          {/* PnL */}
                          <td className="py-2 px-3 text-right whitespace-nowrap font-bold">
                            {trade.pnl !== null && trade.pnl !== undefined ? (
                              <span className={trade.pnl >= 0 ? 'text-[#C8F135]' : 'text-[#FF4D4D]'}>
                                {trade.pnl >= 0 ? '+' : ''}${Number(trade.pnl).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-[#8B98A9]">--</span>
                            )}
                          </td>

                          {/* Opened At Time */}
                          <td className="py-2 px-3 text-right text-[#8B98A9] whitespace-nowrap text-[11px]">
                            {formatISTDateTime(trade.opened_at)}
                          </td>
                        </tr>
                      );
                    })
                  ) : isLoading ? (
                    // Skeleton rows when loading
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={`skeleton-trade-${idx}`} className="animate-pulse">
                        <td className="py-3 px-3">
                          <div className="h-4 w-16 bg-[#1E2A3A] rounded-full" />
                        </td>
                        <td className="py-3 px-3">
                          <div className="h-4 w-20 bg-[#1E2A3A] rounded" />
                        </td>
                        <td className="py-3 px-3">
                          <div className="h-4 w-12 bg-[#1E2A3A] rounded" />
                        </td>
                        <td className="py-3 px-3">
                          <div className="h-4 w-10 bg-[#1E2A3A] rounded" />
                        </td>
                        <td className="py-3 px-3">
                          <div className="h-4 w-16 bg-[#1E2A3A] rounded" />
                        </td>
                        <td className="py-3 px-3">
                          <div className="h-4 w-16 bg-[#1E2A3A] rounded" />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="h-4 w-16 bg-[#1E2A3A] rounded ml-auto" />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="h-4 w-24 bg-[#1E2A3A] rounded ml-auto" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#8B98A9]">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Activity className="w-7 h-7 text-[#1E2A3A]" />
                          <p className="font-semibold text-sm text-[#E6EDF3]">Waiting for first trade…</p>
                          <p className="text-[11px] text-[#8B98A9]">No active orders or closed positions recorded yet.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* 5. EVENTS FEED (Terminal Style Log) */}
          <section
            id="bot-events-terminal"
            className="bg-[#121824] border border-[#1E2A3A] rounded-2xl p-4 flex flex-col h-[420px]"
          >
            {/* Terminal Header */}
            <div className="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-[#1E2A3A]">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#C8F135]" />
                <h3 className="text-xs uppercase tracking-wider font-semibold text-[#8B98A9]">
                  Events Feed
                </h3>
              </div>

              {/* Event Type Filter */}
              <select
                value={eventFilter}
                onChange={e => setEventFilter(e.target.value as EventFilter)}
                className="bg-[#0B0F19] border border-[#1E2A3A] text-[10px] font-mono text-[#E6EDF3] rounded-lg px-2 py-1 outline-none cursor-pointer"
              >
                <option value="all">ALL EVENTS ({botEvents.length})</option>
                <option value="signal">SIGNALS</option>
                <option value="trade">TRADES</option>
                <option value="error">ERRORS</option>
                <option value="kill">KILL</option>
              </select>
            </div>

            {/* Terminal Body */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={`sk-ev-${idx}`}
                    className="bg-[#0B0F19] border border-[#1E2A3A] rounded-xl p-3 animate-pulse space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <div className="h-3 w-16 bg-[#1E2A3A] rounded" />
                      <div className="h-3 w-20 bg-[#1E2A3A] rounded" />
                    </div>
                    <div className="h-3 w-3/4 bg-[#1E2A3A] rounded" />
                  </div>
                ))
              ) : filteredEvents.length > 0 ? (
                filteredEvents.map(event => {
                  let badgeColor = 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30'; // signal: cyan
                  let icon = <Zap className="w-3 h-3 text-[#38BDF8]" />;

                  if (event.event_type === 'trade') {
                    badgeColor = 'bg-[#C8F135]/15 text-[#C8F135] border-[#C8F135]/30';
                    icon = <Activity className="w-3 h-3 text-[#C8F135]" />;
                  } else if (event.event_type === 'error') {
                    badgeColor = 'bg-[#FFB020]/15 text-[#FFB020] border-[#FFB020]/30';
                    icon = <AlertTriangle className="w-3 h-3 text-[#FFB020]" />;
                  } else if (event.event_type === 'kill') {
                    badgeColor = 'bg-[#FF4D4D]/20 text-[#FF4D4D] border-[#FF4D4D]/40 glow-danger';
                    icon = <AlertOctagon className="w-3 h-3 text-[#FF4D4D]" />;
                  }

                  return (
                    <div
                      key={event.id}
                      className="bg-[#0B0F19] border border-[#1E2A3A] hover:border-[#2D3F54] rounded-xl p-2.5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 ${badgeColor}`}
                        >
                          {icon}
                          {event.event_type}
                        </span>
                        <span className="text-[10px] text-[#8B98A9]">
                          {formatISTTime(event.created_at)} IST
                        </span>
                      </div>
                      <p className="text-[#E6EDF3] leading-relaxed break-words text-[11px]">
                        {event.message}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-[#8B98A9] text-xs">
                  <Terminal className="w-8 h-8 text-[#1E2A3A] mb-2" />
                  <p className="font-semibold text-[#E6EDF3]">Waiting for bot events…</p>
                  <p className="text-[10px] text-[#8B98A9] mt-0.5">Listening on telemetry stream socket</p>
                </div>
              )}
            </div>

            {/* Terminal Status Bar */}
            <div className="pt-2 mt-2 border-t border-[#1E2A3A] flex items-center justify-between text-[10px] font-mono text-[#8B98A9]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C8F135] animate-pulse" />
                Live socket listening
              </span>
              <span>{filteredEvents.length} items logged</span>
            </div>
          </section>
        </div>
      </>
    )}
  </main>

      {/* ==================================================== */}
      {/* SETTINGS / DATABASE SETUP MODAL */}
      {/* ==================================================== */}
      {isSettingsOpen && (
        <div
          id="settings-modal-backdrop"
          className="fixed inset-0 z-50 bg-[#0B0F19]/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            id="settings-modal"
            className="bg-[#121824] border border-[#1E2A3A] w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-4 font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-[#1E2A3A] pb-3">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-[#C8F135]" />
                <h2 className="text-sm font-bold text-[#E6EDF3]">Neon Postgres Connection</h2>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-[#8B98A9] hover:text-[#E6EDF3] p-1 rounded-lg hover:bg-[#1E2A3A] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConnection} className="space-y-4">
              <div>
                <label className="block text-[#8B98A9] text-xs mb-1.5">
                  Neon Serverless Database URL (Postgres HTTP):
                </label>
                <input
                  type="password"
                  placeholder="postgresql://user:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require"
                  value={tempConnString}
                  onChange={e => setTempConnString(e.target.value)}
                  className="w-full bg-[#0B0F19] border border-[#1E2A3A] focus:border-[#C8F135] rounded-xl px-3 py-2.5 text-[#E6EDF3] placeholder-[#8B98A9]/50 outline-none text-xs"
                />
                <p className="text-[11px] text-[#8B98A9] mt-1.5 leading-relaxed">
                  Connects directly from your browser via Neon's serverless HTTP driver. 
                  Stored locally in browser state.
                </p>
              </div>

              <div className="bg-[#0B0F19] border border-[#1E2A3A] rounded-xl p-3 space-y-2 text-[11px] text-[#8B98A9]">
                <div className="text-[#E6EDF3] font-semibold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#C8F135]" /> Neon DB Schema Expectations:
                </div>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong className="text-[#C8F135]">trades:</strong> id, symbol, side, lots, entry_price, sl, tp, exit_price, pnl, status, opened_at</li>
                  <li><strong className="text-[#C8F135]">equity_log:</strong> id, equity, recorded_at</li>
                  <li><strong className="text-[#C8F135]">bot_events:</strong> id, event_type, message, created_at</li>
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleUseDemo}
                  className="bg-[#1E2A3A] hover:bg-[#2A3B52] text-[#E6EDF3] px-3 py-2 rounded-xl cursor-pointer transition-colors"
                >
                  Use Demo Simulator
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="text-[#8B98A9] hover:text-[#E6EDF3] px-3 py-2 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-[#C8F135] hover:bg-[#B5DC2E] text-[#0B0F19] font-bold px-4 py-2 rounded-xl cursor-pointer glow-lime transition-colors"
                  >
                    Connect Database
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#1E2A3A] py-3 px-4 text-center text-[10px] font-mono text-[#8B98A9]">
        <span>Quant-AI OS • Cosmic Slate Theme • Auto-syncing every 30 seconds</span>
      </footer>
    </div>
  );
}
