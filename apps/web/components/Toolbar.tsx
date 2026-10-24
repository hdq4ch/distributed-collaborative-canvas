'use client';

import { Tool } from './Canvas';

interface ToolbarProps {
  tool: Tool;
  color: string;
  strokeWidth: number;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TOOLS: Array<{ id: Tool; label: string; icon: string }> = [
  { id: 'pen', label: 'Pen', icon: '✏️' },
  { id: 'line', label: 'Line', icon: '╱' },
  { id: 'rectangle', label: 'Rectangle', icon: '▭' },
  { id: 'circle', label: 'Circle', icon: '○' },
  { id: 'eraser', label: 'Eraser', icon: '⌫' },
  { id: 'text', label: 'Text', icon: 'T' },
];

const PRESET_COLORS = [
  '#000000', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
  '#ffffff',
];

const STROKE_WIDTHS = [2, 4, 8, 16];

export default function Toolbar({
  tool, color, strokeWidth,
  onToolChange, onColorChange, onStrokeWidthChange,
  onUndo, onRedo, onClear, onExport,
  canUndo, canRedo,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 shadow-sm flex-wrap">
      {/* Tool Selector */}
      <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => onToolChange(t.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tool === t.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Color Presets */}
      <div className="flex items-center gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => onColorChange(c)}
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
              color === c ? 'border-blue-500 scale-110' : 'border-gray-300'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        {/* Custom color input */}
        <input
          type="color"
          value={color}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-6 h-6 rounded-full border border-gray-300 cursor-pointer"
          title="Custom color"
        />
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Stroke Width */}
      <div className="flex items-center gap-1">
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => onStrokeWidthChange(w)}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
              strokeWidth === w ? 'bg-blue-100 border border-blue-400' : 'hover:bg-gray-100'
            }`}
            title={`Stroke: ${w}px`}
          >
            <div
              className="rounded-full bg-gray-700"
              style={{ width: Math.min(w * 1.5, 20), height: Math.min(w * 1.5, 20) }}
            />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ↩ Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="px-3 py-1.5 rounded-md text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ↪ Redo
        </button>
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Actions */}
      <button
        onClick={onClear}
        title="Clear canvas"
        className="px-3 py-1.5 rounded-md text-sm text-red-600 hover:bg-red-50"
      >
        🗑 Clear
      </button>
      <button
        onClick={onExport}
        title="Export as PNG"
        className="px-3 py-1.5 rounded-md text-sm text-green-600 hover:bg-green-50"
      >
        ⬇ Export
      </button>
    </div>
  );
}
