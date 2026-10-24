'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Tool = 'pen' | 'line' | 'rectangle' | 'circle' | 'eraser' | 'text';

export interface DrawShape {
  id: string;
  tool: Tool;
  color: string;
  strokeWidth: number;
  points?: Array<{ x: number; y: number }>;   // for pen/eraser/line
  x?: number; y?: number;                       // for shapes & text
  width?: number; height?: number;              // for rectangle
  radius?: number;                              // for circle
  endX?: number; endY?: number;                 // for line
  text?: string;                                // for text tool
  fontSize?: number;                            // for text tool
}

interface CanvasProps {
  tool: Tool;
  color: string;
  strokeWidth: number;
  shapes: DrawShape[];
  onShapeAdded: (shape: DrawShape) => void;
}

// ─── Text Overlay State ────────────────────────────────────────────────────────

interface TextInput {
  x: number;  // canvas coords
  y: number;
  screenX: number;  // pixel position for the HTML input overlay
  screenY: number;
}

// ─── Canvas Component ─────────────────────────────────────────────────────────

export default function Canvas({ tool, color, strokeWidth, shapes, onShapeAdded }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPoints = useRef<Array<{ x: number; y: number }>>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Text tool state
  const [textInput, setTextInput] = useState<TextInput | null>(null);
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  // ── Resize canvas to fill parent ──────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const container = canvasRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Focus text input when it appears ──────────────────────────────────────
  useEffect(() => {
    if (textInput) {
      setTimeout(() => textInputRef.current?.focus(), 50);
    }
  }, [textInput]);

  // ── Redraw all shapes whenever the shapes array or dimensions change ───────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    shapes.forEach((shape) => drawShape(ctx, shape));
  }, [shapes, dimensions]);

  // ── Mouse event helpers ────────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // ── Commit text shape ──────────────────────────────────────────────────────
  const commitText = useCallback(() => {
    if (!textInput || !textValue.trim()) {
      setTextInput(null);
      setTextValue('');
      return;
    }
    const fontSize = Math.max(strokeWidth * 4, 14);
    const shape: DrawShape = {
      id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tool: 'text',
      color,
      strokeWidth,
      x: textInput.x,
      y: textInput.y,
      text: textValue,
      fontSize,
    };
    onShapeAdded(shape);
    setTextInput(null);
    setTextValue('');
  }, [textInput, textValue, color, strokeWidth, onShapeAdded]);

  // ── Mouse down ──────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'text') {
      // For text: place an input overlay at the click position
      const rect = canvasRef.current!.getBoundingClientRect();
      const pos = getPos(e);
      setTextInput({
        x: pos.x,
        y: pos.y,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
      });
      setTextValue('');
      return;
    }
    isDrawing.current = true;
    const pos = getPos(e);
    startPos.current = pos;
    currentPoints.current = [pos];
  }, [tool]);

  // ── Mouse move ─────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const pos = getPos(e);

    if (tool === 'pen' || tool === 'eraser') {
      currentPoints.current.push(pos);
      ctx.beginPath();
      ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
      ctx.lineWidth = tool === 'eraser' ? strokeWidth * 3 : strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = currentPoints.current;
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      // Ghost preview for shape tools
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      shapes.forEach((s) => drawShape(ctx, s));
      const previewShape: DrawShape = {
        id: 'preview',
        tool,
        color,
        strokeWidth,
        x: startPos.current.x,
        y: startPos.current.y,
        width: pos.x - startPos.current.x,
        height: pos.y - startPos.current.y,
        endX: pos.x,
        endY: pos.y,
        radius: Math.hypot(pos.x - startPos.current.x, pos.y - startPos.current.y) / 2,
      };
      ctx.globalAlpha = 0.6;
      drawShape(ctx, previewShape);
      ctx.globalAlpha = 1;
    }
  }, [tool, color, strokeWidth, shapes]);

  // ── Mouse up ───────────────────────────────────────────────────────────────
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const pos = getPos(e);
    const start = startPos.current;

    const shape: DrawShape = {
      id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tool,
      color,
      strokeWidth,
    };

    if (tool === 'pen' || tool === 'eraser') {
      shape.points = currentPoints.current;
    } else if (tool === 'line') {
      shape.points = [start, pos];
    } else if (tool === 'rectangle') {
      shape.x = start.x;
      shape.y = start.y;
      shape.width = pos.x - start.x;
      shape.height = pos.y - start.y;
    } else if (tool === 'circle') {
      shape.x = (start.x + pos.x) / 2;
      shape.y = (start.y + pos.y) / 2;
      shape.radius = Math.hypot(pos.x - start.x, pos.y - start.y) / 2;
    }

    onShapeAdded(shape);
    currentPoints.current = [];
  }, [tool, color, strokeWidth, onShapeAdded]);

  const handleMouseLeave = useCallback(() => {
    if (isDrawing.current) isDrawing.current = false;
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className={`touch-none ${tool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'block' }}
      />

      {/* ── Text input overlay ─────────────────────────────────────────────── */}
      {textInput && (
        <input
          ref={textInputRef}
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText();
            if (e.key === 'Escape') { setTextInput(null); setTextValue(''); }
          }}
          onBlur={commitText}
          className="absolute bg-transparent border-b-2 border-blue-500 outline-none px-1"
          style={{
            left: textInput.screenX,
            top: textInput.screenY - Math.max(strokeWidth * 4, 14),
            color,
            fontSize: Math.max(strokeWidth * 4, 14),
            fontFamily: 'sans-serif',
            minWidth: 100,
            caretColor: color,
          }}
          placeholder="Type here..."
        />
      )}
    </div>
  );
}

// ─── Drawing Functions ─────────────────────────────────────────────────────────

function drawShape(ctx: CanvasRenderingContext2D, shape: DrawShape): void {
  ctx.beginPath();
  ctx.strokeStyle = shape.tool === 'eraser' ? '#FFFFFF' : shape.color;
  ctx.lineWidth = shape.tool === 'eraser' ? shape.strokeWidth * 3 : shape.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (shape.tool) {
    case 'pen':
    case 'eraser':
    case 'line': {
      const pts = shape.points;
      if (!pts || pts.length < 2) return;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      break;
    }

    case 'rectangle': {
      if (shape.x === undefined || shape.y === undefined) return;
      ctx.strokeRect(shape.x, shape.y, shape.width ?? 0, shape.height ?? 0);
      break;
    }

    case 'circle': {
      if (shape.x === undefined || shape.y === undefined || !shape.radius) return;
      ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'text': {
      if (!shape.text || shape.x === undefined || shape.y === undefined) return;
      const fontSize = shape.fontSize ?? Math.max(shape.strokeWidth * 4, 14);
      ctx.fillStyle = shape.color;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillText(shape.text, shape.x, shape.y);
      break;
    }
  }
}
