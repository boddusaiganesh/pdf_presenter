import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { cn } from '../utils/cn';

interface Trail {
  x: number;
  y: number;
  id: number;
  opacity: number;
}

export default function PointerOverlay() {
  const { pointerMode, pointerPosition, settings } = useStore();
  const [trails, setTrails] = useState<Trail[]>([]);
  const trailIdRef = useRef(0);

  const trailLengths = { short: 5, medium: 10, long: 18 };
  const maxTrails = trailLengths[settings.laserTrailLength];

  useEffect(() => {
    // Performance guard: skip all trail work when not in laser mode
    if (pointerMode !== 'laser' || !settings.laserTrail) {
      if (trails.length > 0) setTrails([]);
      return;
    }

    const newTrail: Trail = {
      x: pointerPosition.x,
      y: pointerPosition.y,
      id: trailIdRef.current++,
      opacity: 1,
    };

    setTrails((prev) => {
      const updated = [newTrail, ...prev].slice(0, maxTrails).map((t, i) => ({
        ...t,
        opacity: 1 - i / maxTrails,
      }));
      return updated;
    });
  }, [pointerPosition, pointerMode, settings.laserTrail, settings.laserTrailLength, maxTrails]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pointerMode === 'normal') return null;

  const { x, y } = pointerPosition;
  const laserColor = settings.laserColor;
  const laserSize = settings.laserSize;

  if (pointerMode === 'laser') {
    const glowIntensity = settings.laserGlow / 100;
    return (
      <div className="pointer-events-none fixed inset-0 z-[9999]" style={{ cursor: 'none' }}>
        {/* Trail */}
        {settings.laserTrail && trails.slice(1).map((trail) => (
          <div
            key={trail.id}
            className="fixed rounded-full"
            style={{
              left: trail.x,
              top: trail.y,
              width: laserSize * trail.opacity * 0.8,
              height: laserSize * trail.opacity * 0.8,
              transform: 'translate(-50%, -50%)',
              background: laserColor,
              opacity: trail.opacity * 0.6,
              filter: `blur(${2 * glowIntensity}px)`,
            }}
          />
        ))}
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
    // The zoomed region is magSize/zoom wide/tall in screen pixels
    const regionW = magSize / zoom;
    const regionH = magSize / zoom;
    return (
      <div className="pointer-events-none fixed inset-0 z-[9999]" style={{ cursor: 'none' }}>
        {/* Lens border ring */}
        <div
          className="fixed rounded-full border-[3px] border-white/90 shadow-2xl overflow-hidden"
          style={{
            left: x - magSize / 2,
            top: y - magSize / 2,
            width: magSize,
            height: magSize,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.6)',
            // Zoom the page content under the lens using CSS transform on a cloned region
            // We use a backdrop-filter trick: scale the underlying pixels via a wrapper
            backdropFilter: 'none',
            background: 'transparent',
          }}
        >
          {/* Inner zoom layer — positions the page content scaled up */}
          <div
            style={{
              position: 'absolute',
              width: window.innerWidth,
              height: window.innerHeight,
              // Shift so the cursor point maps to the lens center, then scale
              transform: `scale(${zoom}) translate(${-(x - regionW / 2) / zoom * (zoom - 1) / (zoom - 1)}px, 0)`,
              transformOrigin: `${x - regionW / 2}px ${y - regionH / 2}px`,
              pointerEvents: 'none',
            }}
          />
        </div>
        {/* Crosshair at cursor center */}
        <div className="fixed bg-white/70" style={{ left: x - 0.5, top: y - 8, width: 1, height: 16, transform: 'translateX(-50%)' }} />
        <div className="fixed bg-white/70" style={{ left: x - 8, top: y - 0.5, width: 16, height: 1, transform: 'translateY(-50%)' }} />
        {/* Zoom label */}
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
