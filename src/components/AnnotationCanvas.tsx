import { useEffect, useRef } from 'react';
import { Canvas, PencilBrush, Line, Rect, Ellipse, Triangle, IText, Textbox, Group } from 'fabric';
import { useStore } from '../store/useStore';
import type { DrawTool } from '../store/useStore';
import { cn } from '../utils/cn';

interface AnnotationCanvasProps {
  width: number;
  height: number;
  slideId: string;
  popupId?: string;
}

export default function AnnotationCanvas({ width, height, slideId, popupId }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentShapeRef = useRef<any>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isHistoryUpdate = useRef(false);
  const isInternalChangeRef = useRef(false);
  const slideIdRef = useRef(slideId);
  const popupIdRef = useRef(popupId);

  // Refs for all drawing state — handlers read from refs so they never go stale
  const toolRef = useRef<DrawTool>('select');
  const colorRef = useRef('#ef4444');
  const sizeRef = useRef(4);
  const opacityRef = useRef(1);
  const dashedRef = useRef(false);
  const filledRef = useRef(false);
  const fontFamilyRef = useRef('Inter');
  const fontSizeRef = useRef(24);
  const boldRef = useRef(false);
  const italicRef = useRef(false);

  const {
    currentTool, drawColor, drawSize, drawOpacity,
    isDashedStroke, isFilled, fontFamily, fontSize, isBold, isItalic,
    currentSession, updateAnnotation,
  } = useStore();

  // Keep refs in sync with latest store values
  useEffect(() => { toolRef.current = currentTool; }, [currentTool]);
  useEffect(() => { colorRef.current = drawColor; }, [drawColor]);
  useEffect(() => { sizeRef.current = drawSize; }, [drawSize]);
  useEffect(() => { opacityRef.current = drawOpacity; }, [drawOpacity]);
  useEffect(() => { dashedRef.current = isDashedStroke; }, [isDashedStroke]);
  useEffect(() => { filledRef.current = isFilled; }, [isFilled]);
  useEffect(() => { fontFamilyRef.current = fontFamily; }, [fontFamily]);
  useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);
  useEffect(() => { boldRef.current = isBold; }, [isBold]);
  useEffect(() => { italicRef.current = isItalic; }, [isItalic]);
  useEffect(() => { slideIdRef.current = slideId; }, [slideId]);
  useEffect(() => { popupIdRef.current = popupId; }, [popupId]);

  const updateAnnotationRef = useRef(updateAnnotation);
  useEffect(() => { updateAnnotationRef.current = updateAnnotation; }, [updateAnnotation]);

  const slide = currentSession?.slides.find((s) => s.id === slideId);
  const popup = popupId ? slide?.popups?.find(p => p.id === popupId) : undefined;
  const currentAnnotation = popupId ? popup?.annotation : slide?.annotation;

  // ── Initialize Fabric canvas ONCE ──────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;

    // Guard against React Strict Mode double-mount: Fabric stamps a _fabricCanvas
    // property on the DOM element after initialization. If it's already there,
    // the canvas instance is still live in fabricRef — just bail out.
    if ((canvasRef.current as any)._fabricCanvas) return;

    const canvas = new Canvas(canvasRef.current, {
      isDrawingMode: false,
      selection: true,
      width,
      height,
      renderOnAddRemove: true,
      enableRetinaScaling: false,
      perPixelTargetFind: true,
      targetFindTolerance: 8,
    });
    fabricRef.current = canvas;

    // Save canvas state to history and store
    const saveState = () => {
      if (!fabricRef.current || isHistoryUpdate.current) return;
      isInternalChangeRef.current = true;
      const json = JSON.stringify(fabricRef.current.toJSON());
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(json);
      if (newHistory.length > 50) newHistory.shift();
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      updateAnnotationRef.current(slideIdRef.current, json, popupIdRef.current);
    };

    // Only listen to these — NOT object:added (fires during loadFromJSON causing loops)
    canvas.on('path:created', saveState);
    canvas.on('object:modified', saveState);
    canvas.on('object:removed', saveState);

    // ── Mouse Down ──
    canvas.on('mouse:down', (opt: any) => {
      const tool = toolRef.current;

      if (tool === 'eraser') {
        isDrawingRef.current = true;
        if (opt.target) canvas.remove(opt.target);
        return;
      }

      const shapeTools: DrawTool[] = ['line', 'arrow', 'rectangle', 'circle', 'triangle', 'text', 'sticky'];
      if (!shapeTools.includes(tool)) return;

      const pointer = opt.scenePoint || canvas.getScenePoint(opt.e);
      startPointRef.current = { x: pointer.x, y: pointer.y };
      isDrawingRef.current = true;

      const color = colorRef.current;
      const size = sizeRef.current;
      const opacity = opacityRef.current;
      const dashed = dashedRef.current;
      const filled = filledRef.current;

      const commonProps: any = {
        stroke: color,
        strokeWidth: size,
        fill: filled ? color : 'transparent',
        opacity,
        strokeDashArray: dashed ? [10, 5] : undefined,
        selectable: false,
        evented: false,
      };

      if (tool === 'text') {
        const text = new IText('Type here', {
          left: pointer.x,
          top: pointer.y,
          fill: color,
          fontSize: fontSizeRef.current,
          fontFamily: fontFamilyRef.current,
          fontWeight: boldRef.current ? 'bold' : 'normal',
          fontStyle: italicRef.current ? 'italic' : 'normal',
          opacity,
          selectable: true,
          evented: true,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        isDrawingRef.current = false;
        return;
      }

      if (tool === 'sticky') {
        const colors = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#ddd6fe'];
        const bg = colors[Math.floor(Math.random() * colors.length)];
        const text = new Textbox('Sticky note...', {
          left: pointer.x,
          top: pointer.y,
          width: 160,
          backgroundColor: bg,
          fill: '#1e293b',
          fontSize: 14,
          fontFamily: 'Inter',
          selectable: true,
          evented: true,
          padding: 12,
          splitByGrapheme: true,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        isDrawingRef.current = false;
        return;
      }

      if (tool === 'line' || tool === 'arrow') {
        const line = new Line(
          [pointer.x, pointer.y, pointer.x, pointer.y],
          { ...commonProps, strokeLineCap: 'round' }
        );
        canvas.add(line);
        currentShapeRef.current = line;
      } else if (tool === 'rectangle') {
        const rect = new Rect({ left: pointer.x, top: pointer.y, width: 1, height: 1, ...commonProps });
        canvas.add(rect);
        currentShapeRef.current = rect;
      } else if (tool === 'circle') {
        const ellipse = new Ellipse({ left: pointer.x, top: pointer.y, rx: 1, ry: 1, ...commonProps });
        canvas.add(ellipse);
        currentShapeRef.current = ellipse;
      } else if (tool === 'triangle') {
        const tri = new Triangle({ left: pointer.x, top: pointer.y, width: 1, height: 1, ...commonProps });
        canvas.add(tri);
        currentShapeRef.current = tri;
      }
    });

    // ── Mouse Move ──
    canvas.on('mouse:move', (opt: any) => {
      if (!isDrawingRef.current) return;
      const tool = toolRef.current;

      if (tool === 'eraser') {
        // Remove objects under cursor — save state only on mouse:up
        if (opt.target) canvas.remove(opt.target);
        return;
      }

      if (!startPointRef.current || !currentShapeRef.current) return;

      const pointer = opt.scenePoint || canvas.getScenePoint(opt.e);
      const start = startPointRef.current;
      const shape = currentShapeRef.current;
      const w = Math.abs(pointer.x - start.x);
      const h = Math.abs(pointer.y - start.y);
      const left = Math.min(pointer.x, start.x);
      const top = Math.min(pointer.y, start.y);

      if (shape instanceof Line) {
        shape.set({ x2: pointer.x, y2: pointer.y });
      } else if (shape instanceof Rect) {
        shape.set({ left, top, width: w, height: h });
      } else if (shape instanceof Ellipse) {
        shape.set({ left, top, rx: w / 2, ry: h / 2 });
      } else if (shape instanceof Triangle) {
        shape.set({ left, top, width: w, height: h });
      }

      shape.setCoords();
      canvas.requestRenderAll();
    });

    // ── Mouse Up ──
    canvas.on('mouse:up', () => {
      const tool = toolRef.current;

      if (tool === 'eraser') {
        isDrawingRef.current = false;
        saveState(); // Save once on release, not on every pixel of movement
        return;
      }

      if (currentShapeRef.current) {
        const shape = currentShapeRef.current;
        shape.setCoords();
        shape.set({ selectable: true, evented: true });

        // Arrow: group line + arrowhead so they move together as one object
        if (tool === 'arrow' && shape instanceof Line) {
          const dx = (shape.x2 ?? 0) - (shape.x1 ?? 0);
          const dy = (shape.y2 ?? 0) - (shape.y1 ?? 0);
          const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          const arrowHead = new Triangle({
            left: shape.x2 ?? 0,
            top: shape.y2 ?? 0,
            width: Math.max(sizeRef.current * 4, 12),
            height: Math.max(sizeRef.current * 4, 12),
            fill: colorRef.current,
            angle: angle + 90,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          });
          canvas.remove(shape);
          const group = new Group([shape, arrowHead], { selectable: true, evented: true });
          canvas.add(group);
          // object:added is not listened to (causes loops on loadFromJSON),
          // so we must explicitly save after adding the arrow group.
          saveState();
        }

        currentShapeRef.current = null;
      }

      isDrawingRef.current = false;
      startPointRef.current = null;
    });

    return () => {
      // Only dispose if this canvas instance is still the active one.
      // In React Strict Mode the cleanup fires before the second mount;
      // checking fabricRef prevents a double-dispose crash.
      if (fabricRef.current === canvas) {
        canvas.dispose();
        fabricRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize canvas without destroying it ────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !width || !height) return;
    canvas.setDimensions({ width, height });
    canvas.renderAll();
  }, [width, height]);

  // ── Undo / Redo via custom events from toolbar ──────────────────────────────
  useEffect(() => {
    const handleUndo = () => {
      if (historyIndexRef.current > 0) {
        historyIndexRef.current -= 1;
        isHistoryUpdate.current = true;
        const json = historyRef.current[historyIndexRef.current];
        fabricRef.current?.loadFromJSON(JSON.parse(json)).then(() => {
          fabricRef.current?.renderAll();
          isInternalChangeRef.current = true;
          updateAnnotationRef.current(slideIdRef.current, json, popupIdRef.current);
          isHistoryUpdate.current = false;
        });
      }
    };

    const handleRedo = () => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current += 1;
        isHistoryUpdate.current = true;
        const json = historyRef.current[historyIndexRef.current];
        fabricRef.current?.loadFromJSON(JSON.parse(json)).then(() => {
          fabricRef.current?.renderAll();
          isInternalChangeRef.current = true;
          updateAnnotationRef.current(slideIdRef.current, json, popupIdRef.current);
          isHistoryUpdate.current = false;
        });
      }
    };

    // Support both custom events (from toolbar buttons) and keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.contentEditable === 'true') return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && !e.shiftKey && e.key === 'z') { e.preventDefault(); handleUndo(); }
      else if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); handleRedo(); }
    };

    document.addEventListener('annotation:undo' as any, handleUndo);
    document.addEventListener('annotation:redo' as any, handleRedo);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('annotation:undo' as any, handleUndo);
      document.removeEventListener('annotation:redo' as any, handleRedo);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // ── Load annotation when slideId changes ───────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.clear();
    canvas.backgroundColor = '';

    const currentSlide = useStore.getState().currentSession?.slides.find((s) => s.id === slideId);
    const currentPopup = popupId ? currentSlide?.popups?.find(p => p.id === popupId) : undefined;
    const annotation = popupId ? currentPopup?.annotation : currentSlide?.annotation;

    if (annotation?.fabricJSON) {
      try {
        const parsed =
          typeof annotation.fabricJSON === 'string'
            ? JSON.parse(annotation.fabricJSON)
            : annotation.fabricJSON;

        historyRef.current = [
          typeof annotation.fabricJSON === 'string'
            ? annotation.fabricJSON
            : JSON.stringify(annotation.fabricJSON),
        ];
        historyIndexRef.current = 0;
        isHistoryUpdate.current = true;

        canvas.loadFromJSON(parsed).then(() => {
          canvas.renderAll();
          isHistoryUpdate.current = false;
        });
      } catch (e) {
        console.error('Failed to load annotation:', e);
        isHistoryUpdate.current = false;
      }
    } else {
      historyRef.current = [JSON.stringify(canvas.toJSON())];
      historyIndexRef.current = 0;
    }
  }, [slideId]);

  useEffect(() => {
    if (!fabricRef.current) return;
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    if (!currentAnnotation?.fabricJSON) {
      fabricRef.current.clear();
      fabricRef.current.renderAll();
    }
  }, [currentAnnotation?.fabricJSON]);

  // ── Update canvas drawing mode when tool changes ───────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.discardActiveObject();
    canvas.forEachObject((obj) => { obj.selectable = false; obj.evented = true; });

    switch (currentTool) {
      case 'pen': {
        canvas.isDrawingMode = true;
        const brush = new PencilBrush(canvas);
        const r = parseInt(drawColor.slice(1, 3), 16) || 0;
        const g = parseInt(drawColor.slice(3, 5), 16) || 0;
        const b = parseInt(drawColor.slice(5, 7), 16) || 0;
        brush.color = `rgba(${r},${g},${b},${drawOpacity})`;
        brush.width = drawSize;
        if (isDashedStroke) (brush as any).strokeDashArray = [10, 5];
        canvas.freeDrawingBrush = brush;
        break;
      }
      case 'highlighter': {
        canvas.isDrawingMode = true;
        const hBrush = new PencilBrush(canvas);
        const r = parseInt(drawColor.slice(1, 3), 16) || 0;
        const g = parseInt(drawColor.slice(3, 5), 16) || 0;
        const b = parseInt(drawColor.slice(5, 7), 16) || 0;
        hBrush.color = `rgba(${r},${g},${b},${drawOpacity * 0.4})`;
        hBrush.width = Math.max(drawSize * 3, 20);
        canvas.freeDrawingBrush = hBrush;
        break;
      }
      case 'eraser':
        canvas.isDrawingMode = false;
        canvas.selection = false;
        canvas.defaultCursor = 'cell';
        (canvas as any).hoverCursor = 'cell';
        break;
      case 'select':
      case 'lasso':
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        (canvas as any).hoverCursor = 'move';
        canvas.forEachObject((obj) => { obj.selectable = true; });
        break;
      default:
        canvas.isDrawingMode = false;
        canvas.selection = false;
    }
    canvas.renderAll();
  }, [currentTool, drawColor, drawSize, drawOpacity, isDashedStroke]);

  const getCursorClass = () => {
    switch (currentTool) {
      case 'pen': case 'highlighter': case 'line': case 'arrow':
      case 'rectangle': case 'circle': case 'triangle': return 'cursor-crosshair';
      case 'eraser': return 'cursor-cell';
      case 'select': case 'lasso': return 'cursor-default';
      case 'text': return 'cursor-text';
      default: return 'cursor-crosshair';
    }
  };

  const isInteractiveMedia = slide?.type && !['pdf', 'image', 'blank-white', 'blank-black'].includes(slide.type);
  const popupIsInteractive = popup?.targetSlideId || popup?.mediaType;
  const targetMediaIsInteractive = popupId ? popupIsInteractive : isInteractiveMedia;
  const shouldPassThrough = currentTool === 'select' && targetMediaIsInteractive;

  return (
    <div
      className={cn(
        'absolute inset-0',
        getCursorClass(),
        currentAnnotation?.visible === false ? 'opacity-0' : 'opacity-100',
        currentAnnotation?.locked || shouldPassThrough ? 'pointer-events-none' : 'pointer-events-auto'
      )}
      style={{ zIndex: 20 }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
