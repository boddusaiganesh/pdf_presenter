import { useEffect, useRef, useCallback } from 'react';
import { Canvas, PencilBrush, Line, Rect, Ellipse, Triangle, IText, Textbox, Group, Shadow } from 'fabric';
import { useStore } from '../store/useStore';
import type { DrawTool } from '../store/useStore';
import { cn } from '../utils/cn';

interface AnnotationCanvasProps {
  width: number;
  height: number;
  slideId: string;
}

export default function AnnotationCanvas({ width, height, slideId }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const currentShapeRef = useRef<any>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isHistoryUpdate = useRef(false);

  const {
    currentTool, drawColor, drawSize, drawOpacity,
    isDashedStroke, isFilled, fontFamily, fontSize, isBold, isItalic,
    currentSession, updateAnnotation
  } = useStore();

  const slide = currentSession?.slides.find((s) => s.id === slideId);

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || !width || !height) return;

    const canvas = new Canvas(canvasRef.current, {
      isDrawingMode: false,
      selection: true,
      width,
      height,
      renderOnAddRemove: true,
      enableRetinaScaling: false,
    });

    fabricRef.current = canvas;

    // Load saved annotation
    if (slide?.annotation.fabricJSON) {
      try {
        canvas.loadFromJSON(JSON.parse(slide.annotation.fabricJSON)).then(() => {
          canvas.renderAll();
        });
      } catch (e) {
        console.error('Failed to load annotation:', e);
      }
    }

    // Save on modification
    const saveAnnotation = () => {
      if (isHistoryUpdate.current) return;
      const json = JSON.stringify(canvas.toJSON());
      
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(json);
      if (newHistory.length > 50) newHistory.shift();
      
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
      
      updateAnnotation(slideId, json);
    };

    canvas.on('object:modified', saveAnnotation);
    canvas.on('object:added', saveAnnotation);
    canvas.on('object:removed', saveAnnotation);
    canvas.on('path:created', saveAnnotation);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [width, height]);

  // Handle Undo/Redo keyboard events
  useEffect(() => {
    const handleUndo = () => {
      if (historyIndexRef.current > 0) {
        historyIndexRef.current -= 1;
        isHistoryUpdate.current = true;
        const json = historyRef.current[historyIndexRef.current];
        fabricRef.current?.loadFromJSON(JSON.parse(json)).then(() => {
          fabricRef.current?.renderAll();
          updateAnnotation(slideId, json);
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
          updateAnnotation(slideId, json);
          isHistoryUpdate.current = false;
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      // Handle fake events from toolbar
      if (ctrl && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (ctrl && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [slideId, updateAnnotation]);

  // Load annotation when slideId changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.clear();
    canvas.backgroundColor = '';

    if (slide?.annotation.fabricJSON) {
      try {
        const parsed = typeof slide.annotation.fabricJSON === 'string'
          ? JSON.parse(slide.annotation.fabricJSON)
          : slide.annotation.fabricJSON;
        
        // Reset history stack for this slide
        historyRef.current = [typeof slide.annotation.fabricJSON === 'string' ? slide.annotation.fabricJSON : JSON.stringify(slide.annotation.fabricJSON)];
        historyIndexRef.current = 0;

        canvas.loadFromJSON(parsed).then(() => {
          canvas.renderAll();
        });
      } catch (e) {
        console.error('Failed to load annotation:', e);
      }
    } else {
      // Empty canvas history start
      historyRef.current = [JSON.stringify(canvas.toJSON())];
      historyIndexRef.current = 0;
    }
  }, [slideId]);

  // Update canvas mode based on tool
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.selection = false;

    switch (currentTool) {
      case 'pen': {
        canvas.isDrawingMode = true;
        const brush = new PencilBrush(canvas);
        brush.color = drawColor;
        brush.width = drawSize;
        if (isDashedStroke) (brush as any).strokeDashArray = [10, 5];
        canvas.freeDrawingBrush = brush;
        break;
      }
      case 'highlighter': {
        canvas.isDrawingMode = true;
        const hBrush = new PencilBrush(canvas);
        hBrush.color = drawColor;
        hBrush.width = Math.max(drawSize * 3, 20);
        canvas.freeDrawingBrush = hBrush;
        break;
      }
      case 'eraser': {
        canvas.isDrawingMode = true;
        const eBrush = new PencilBrush(canvas);
        eBrush.color = 'rgba(0,0,0,0.01)';
        eBrush.width = drawSize * 4;
        canvas.freeDrawingBrush = eBrush;
        break;
      }
      case 'select':
      case 'lasso': {
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        (canvas as any).hoverCursor = 'move';
        break;
      }
      default: {
        canvas.isDrawingMode = false;
        canvas.selection = false;
      }
    }

    canvas.renderAll();
  }, [currentTool, drawColor, drawSize, drawOpacity, isDashedStroke]);

  // Mouse handlers for shapes
  const handleMouseDown = useCallback((opt: any) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const shapeTools: DrawTool[] = ['line', 'arrow', 'rectangle', 'circle', 'triangle', 'text', 'sticky'];
    if (!shapeTools.includes(currentTool)) return;

    const pointer = canvas.getScenePoint(opt.e);
    startPointRef.current = { x: pointer.x, y: pointer.y };
    isDrawingRef.current = true;

    const strokeColor = drawColor;
    const fillColor = isFilled ? drawColor : 'transparent';
    const commonProps: any = {
      stroke: strokeColor,
      strokeWidth: drawSize,
      fill: fillColor,
      opacity: drawOpacity,
      strokeDashArray: isDashedStroke ? [10, 5] : undefined,
      selectable: false,
      evented: false,
    };

    if (currentTool === 'text') {
      const text = new IText('Type here', {
        left: pointer.x,
        top: pointer.y,
        fill: drawColor,
        fontSize,
        fontFamily,
        fontWeight: isBold ? 'bold' : 'normal',
        fontStyle: isItalic ? 'italic' : 'normal',
        opacity: drawOpacity,
        selectable: true,
        evented: true,
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      isDrawingRef.current = false;
      return;
    }

    if (currentTool === 'sticky') {
      const colors = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#ddd6fe'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const rect = new Rect({
        width: 160, height: 100, fill: color, rx: 6, ry: 6,
        stroke: 'rgba(0,0,0,0.1)', strokeWidth: 1,
      });
      const text = new Textbox('Sticky note...', {
        width: 140, top: 10, left: 10,
        fill: '#1e293b', fontSize: 13, fontFamily: 'Inter',
      });
      const group = new Group([rect, text], {
        left: pointer.x, top: pointer.y, selectable: true, evented: true,
      });
      canvas.add(group);
      isDrawingRef.current = false;
      updateAnnotation(slideId, JSON.stringify(canvas.toJSON()));
      return;
    }

    if (currentTool === 'line' || currentTool === 'arrow') {
      const line = new Line(
        [pointer.x, pointer.y, pointer.x, pointer.y],
        { ...commonProps, strokeLineCap: 'round' }
      );
      canvas.add(line);
      currentShapeRef.current = line;
    } else if (currentTool === 'rectangle') {
      const rect = new Rect({
        left: pointer.x, top: pointer.y, width: 1, height: 1, ...commonProps,
      });
      canvas.add(rect);
      currentShapeRef.current = rect;
    } else if (currentTool === 'circle') {
      const ellipse = new Ellipse({
        left: pointer.x, top: pointer.y, rx: 1, ry: 1, ...commonProps,
      });
      canvas.add(ellipse);
      currentShapeRef.current = ellipse;
    } else if (currentTool === 'triangle') {
      const tri = new Triangle({
        left: pointer.x, top: pointer.y, width: 1, height: 1, ...commonProps,
      });
      canvas.add(tri);
      currentShapeRef.current = tri;
    }
  }, [currentTool, drawColor, drawSize, drawOpacity, isDashedStroke, isFilled, fontSize, fontFamily, isBold, isItalic, slideId, updateAnnotation]);

  const handleMouseMove = useCallback((opt: any) => {
    const canvas = fabricRef.current;
    if (!canvas || !isDrawingRef.current || !startPointRef.current || !currentShapeRef.current) return;

    const pointer = canvas.getScenePoint(opt.e);
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

    canvas.renderAll();
  }, []);

  const handleMouseUp = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !isDrawingRef.current) return;

    if (currentShapeRef.current) {
      const shape = currentShapeRef.current;
      shape.set({ selectable: true, evented: true });

      // Add arrowhead for arrow tool
      if (currentTool === 'arrow' && shape instanceof Line) {
        const dx = (shape.x2 ?? 0) - (shape.x1 ?? 0);
        const dy = (shape.y2 ?? 0) - (shape.y1 ?? 0);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const arrowHead = new Triangle({
          left: shape.x2 ?? 0,
          top: shape.y2 ?? 0,
          width: Math.max(drawSize * 4, 12),
          height: Math.max(drawSize * 4, 12),
          fill: drawColor,
          angle: angle + 90,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        canvas.add(arrowHead);
      }

      updateAnnotation(slideId, JSON.stringify(canvas.toJSON()));
      currentShapeRef.current = null;
    }

    isDrawingRef.current = false;
    startPointRef.current = null;
  }, [currentTool, drawColor, drawSize, slideId, updateAnnotation]);

  // Attach events
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);

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
  const shouldPassThroughEvents = currentTool === 'select' && isInteractiveMedia;

  return (
    <div
      className={cn(
        'absolute inset-0',
        getCursorClass(),
        slide?.annotation.visible === false ? 'opacity-0' : 'opacity-100',
        slide?.annotation.locked || shouldPassThroughEvents ? 'pointer-events-none' : 'pointer-events-auto'
      )}
      style={{ zIndex: 20 }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
