import { useEffect, useRef, useCallback } from 'react';
import { Canvas, PencilBrush, Line, Rect, Ellipse, Triangle, IText, Textbox, Group } from 'fabric';
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
  const isInternalChangeRef = useRef(false);

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
      perPixelTargetFind: true,
      targetFindTolerance: 8,
    });

    fabricRef.current = canvas;

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
          isInternalChangeRef.current = true;
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
          isInternalChangeRef.current = true;
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
      // Empty canvas history start
      historyRef.current = [JSON.stringify(canvas.toJSON())];
      historyIndexRef.current = 0;
    }
  }, [slideId]);

  // Sync external changes (like "Clear This Slide") to canvas
  useEffect(() => {
    if (!fabricRef.current) return;
    
    // Ignore internal changes to prevent infinite loops and flickering
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    if (!slide?.annotation.fabricJSON) {
      // The slide was cleared externally
      fabricRef.current.clear();
      // Re-apply tools
      if (currentTool === 'pen' || currentTool === 'highlighter') {
        fabricRef.current.isDrawingMode = true;
      }
    } else {
      // The slide was loaded externally
      try {
        const parsed = typeof slide.annotation.fabricJSON === 'string'
          ? JSON.parse(slide.annotation.fabricJSON)
          : slide.annotation.fabricJSON;
          
        isHistoryUpdate.current = true;
        fabricRef.current.loadFromJSON(parsed).then(() => {
          fabricRef.current?.renderAll();
          isHistoryUpdate.current = false;
        });
      } catch (e) {
        console.error('Failed to load annotation externally:', e);
      }
    }
  }, [slide?.annotation.fabricJSON, currentTool]);

  // Update canvas mode based on tool
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.discardActiveObject();

    // Reset selectability
    canvas.forEachObject((obj) => {
      obj.selectable = false;
      obj.evented = true;
    });

    switch (currentTool) {
      case 'pen': {
        canvas.isDrawingMode = true;
        const brush = new PencilBrush(canvas);
        const r = parseInt(drawColor.slice(1, 3), 16) || 0;
        const g = parseInt(drawColor.slice(3, 5), 16) || 0;
        const b = parseInt(drawColor.slice(5, 7), 16) || 0;
        brush.color = `rgba(${r}, ${g}, ${b}, ${drawOpacity})`;
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
        hBrush.color = `rgba(${r}, ${g}, ${b}, ${drawOpacity * 0.4})`; // Highlighters are naturally more transparent
        hBrush.width = Math.max(drawSize * 3, 20);
        canvas.freeDrawingBrush = hBrush;
        break;
      }
      case 'eraser': {
        canvas.isDrawingMode = false;
        canvas.selection = false;
        canvas.defaultCursor = 'cell';
        (canvas as any).hoverCursor = 'cell';
        break;
      }
      case 'select':
      case 'lasso': {
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        (canvas as any).hoverCursor = 'move';
        canvas.forEachObject((obj) => {
          obj.selectable = true;
        });
        break;
      }
      default: {
        canvas.isDrawingMode = false;
        canvas.selection = false;
      }
    }

    canvas.renderAll();
  }, [currentTool, drawColor, drawSize, drawOpacity, isDashedStroke]);

  const saveCanvasState = useCallback(() => {
    if (!fabricRef.current) return;
    if (isHistoryUpdate.current) return;
    
    isInternalChangeRef.current = true;
    const json = JSON.stringify(fabricRef.current.toJSON());
    
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(json);
    if (newHistory.length > 50) newHistory.shift();
    
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
    
    updateAnnotation(slideId, json);
  }, [slideId, updateAnnotation]);

  const handleMouseDown = useCallback((opt: any) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (currentTool === 'eraser') {
      isDrawingRef.current = true;
      if (opt.target) {
        canvas.remove(opt.target);
        saveCanvasState();
      }
      return;
    }

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
    if (!canvas || !isDrawingRef.current) return;

    if (currentTool === 'eraser') {
      if (opt.target) {
        canvas.remove(opt.target);
        saveCanvasState();
      }
      return;
    }

    if (!startPointRef.current || !currentShapeRef.current) return;

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

    if (currentTool === 'eraser') {
      isDrawingRef.current = false;
      return;
    }

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

      saveCanvasState();
      currentShapeRef.current = null;
    }

    isDrawingRef.current = false;
    startPointRef.current = null;
  }, [currentTool, drawColor, drawSize, saveCanvasState]);

  // Attach events
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('path:created', saveCanvasState);
    canvas.on('object:modified', saveCanvasState);
    canvas.on('object:added', saveCanvasState);
    canvas.on('object:removed', saveCanvasState);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('path:created', saveCanvasState);
      canvas.off('object:modified', saveCanvasState);
      canvas.off('object:added', saveCanvasState);
      canvas.off('object:removed', saveCanvasState);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp, saveCanvasState]);

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
