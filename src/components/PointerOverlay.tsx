import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

// Trail point stored outside React state to avoid re-renders on every mousemove
interface TrailPoint { x: number; y: number; opacity: number; }

export default function PointerOverlay() {
  const { pointerMode, pointerPosition, settings } = useStore();

  // Canvas ref for laser trail — drawn imperatively, zero React re-renders per frame
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);
  const trailPointsRef = useRef<TrailPoint[]>([]);

  const trailLengths = { short: 5, medium: 10, long: 18 };

  // Draw trail on canvas imperatively
  useEffect(() => {
    if (pointerMode !== 'laser' || !settings.laserTrail) {
      // Clear trail canvas when not in laser mode
      const canvas = trailCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      trailPointsRef.current = [];
      return;
    }

    const maxTrails = trailLengths[settings.laserTrailLength];
    const { x, y } = pointerPosition;
    const laserColor = settings.laserColor;
    const laserSize = settings.laserSize;
    const glowIntensity = settings.laserGlow / 100;

    // Add new point
    trailPointsRef.current = [
      { x, y, opacity: 1 },
      ...trailPointsRef.current.slice(0, maxTrails - 1),
    ].map((p, i, arr) => ({ ...p, opacity: 1 - i / arr.length }));

    // Draw on canvas
    const canvas = trailCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    trailPointsRef.current.slice(1).forEach((point) => {
      const size = laserSize * point.opacity * 0.8;
      ctx.beginPath();
      ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = laserColor;
      ctx.globalAlpha = point.opacity * 0.6;
      if (glowIntensity > 0) ctx.filter = `blur(${2 * glowIntensity}px)`;
      ctx.fill();
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointerPosition, pointerMode, settings.laserTrail, settings.laserTrailLength,
      settings.laserColor, settings.laserSize, settings.laserGlow]);

  // Keep trail canvas sized to viewport
  useEffect(() => {
    const canvas = trailCanvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  if (pointerMode === 'normal') return null;

  const { x, y } = pointerPosition;
  const laserColor = settings.laserColor;
  const laserSize = settings.laserSize;
  const glowIntensity = settings.laserGlow / 100;

  if (pointerMode === 'laser') {
    return (
      <div className="pointer-events-none fixed inset-0 z-[9999]" style={{ cursor: 'none' }}>
        {/* Trail rendered on canvas — no React state, no re-renders per frame */}
        {settings.laserTrail && (
          <canvas
            ref={trailCanvasRef}
            className="fixed inset-0"
            style={{ width: '100%', height: '100%' }}
          />
        )}
        {/* Main dot */}
        <div
          className="fixed rounded-full"
          style={{
            left: x,
            top: y,
            width: laserSize,
            height: laserSize,
            transform: 'translate(-50%, -50%)',
            background: laserColor,
            boxShadow: `0 0 ${4 * glowIntensity}px ${2 * glowIntensity}px ${laserColor}cc, 0 0 ${10 * glowIntensity}px ${5 * glowIntensity}px ${laserColor}66, 0 0 ${20 * glowIntensity}px ${8 * glowIntensity}px ${laserColor}33`,
          }}
        />
        {/* Pulse ring */}
        <div
          className="fixed rounded-full animate-ping"
          style={{
            left: x,
            top: y,
            width: laserSize * 2,
            height: laserSize * 2,
            transform: 'translate(-50%, -50%)',
            border: `2px solid ${laserColor}`,
            opacity: 0.4,
            animationDuration: '1s',
          }}
        />
      </div>
    );
  }

  if (pointerMode === 'spotlight') {
    const size = settings.spotlightSize;
    const dim = settings.spotlightDimLevel / 100;
    const dimColor = settings.spotlightDimColor;
    const softEdge = settings.spotlightSoftEdge;
    return (
      <div className="pointer-events-none fixed inset-0 z-[9990]" style={{ cursor: 'none' }}>
        <svg width="100%" height="100%" className="fixed inset-0">
          <defs>
            <radialGradient id="spotlight-grad" cx="50%" cy="50%" r="50%">
              {softEdge ? (
                <>
                  <stop offset="0%" stopColor="transparent" stopOpacity="0" />
                  <stop offset="60%" stopColor="transparent" stopOpacity="0" />
                  <stop offset="100%" stopColor={dimColor} stopOpacity={dim} />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="transparent" stopOpacity="0" />
                  <stop offset="99%" stopColor="transparent" stopOpacity="0" />
                  <stop offset="100%" stopColor={dimColor} stopOpacity={dim} />
                </>
              )}
            </radialGradient>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {settings.spotlightShape === 'rectangle' ? (
                <rect x={x - size} y={y - size * 0.6} width={size * 2} height={size * 1.2} rx="8" fill="black" />
              ) : (
                <ellipse cx={x} cy={y} rx={size / 2} ry={settings.spotlightShape === 'oval' ? size * 0.35 : size / 2} fill="black" />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill={dimColor} fillOpacity={dim} mask="url(#spotlight-mask)" />
          {softEdge && (
            <ellipse
              cx={x} cy={y}
              rx={size / 2}
              ry={settings.spotlightShape === 'oval' ? size * 0.35 : size / 2}
              fill="url(#spotlight-grad)"
              style={{ transform: `scale(1.3)`, transformOrigin: `${x}px ${y}px` }}
            />
          )}
        </svg>
      </div>
    );
  }

  if (pointerMode === 'squarelight') {
    const size = settings.spotlightSize;
    const dim = settings.spotlightDimLevel / 100;
    const dimColor = settings.spotlightDimColor;
    return (
      <div className="pointer-events-none fixed inset-0 z-[9990]" style={{ cursor: 'none' }}>
        <svg width="100%" height="100%" className="fixed inset-0">
          <defs>
            <mask id="squarelight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect x={x - size} y={y - size * 0.4} width={size * 2} height={size * 0.8} rx="4" fill="black" />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill={dimColor} fillOpacity={dim} mask="url(#squarelight-mask)" />
        </svg>
      </div>
    );
  }

  if (pointerMode === 'magnifier') {
    const magSize = 180;
    const zoom = 2.5;
    return (
      <div className="pointer-events-none fixed inset-0 z-[9999]" style={{ cursor: 'none' }}>
        <div
          className="fixed rounded-full border-[3px] border-white/90 shadow-2xl"
          style={{
            left: x - magSize / 2,
            top: y - magSize / 2,
            width: magSize,
            height: magSize,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.6)',
            background: 'rgba(255,255,255,0.05)',
          }}
        />
        {/* Crosshair */}
        <div className="fixed bg-white/70" style={{ left: x - 0.5, top: y - 8, width: 1, height: 16, transform: 'translateX(-50%)' }} />
        <div className="fixed bg-white/70" style={{ left: x - 8, top: y - 0.5, width: 16, height: 1, transform: 'translateY(-50%)' }} />
        <div
          className="fixed px-1.5 py-0.5 rounded text-[10px] font-mono text-white/80 bg-black/60"
          style={{ left: x + magSize / 2 - 28, top: y + magSize / 2 + 6 }}
        >
          {zoom}x
        </div>
      </div>
    );
  }

  if (pointerMode === 'crosshair') {
    return (
      <div className="pointer-events-none fixed inset-0 z-[9999]" style={{ cursor: 'none' }}>
        <div className="fixed bg-red-500" style={{ left: x, top: 0, width: 1, height: '100%', opacity: 0.6, transform: 'translateX(-50%)' }} />
        <div className="fixed bg-red-500" style={{ left: 0, top: y, width: '100%', height: 1, opacity: 0.6, transform: 'translateY(-50%)' }} />
        <div className="fixed w-4 h-4 rounded-full border-2 border-red-500" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }} />
      </div>
    );
  }

  return null;
}
