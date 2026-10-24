'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

function generateRoomId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function HomePage() {
  const [newRoomId, setNewRoomId] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const router = useRouter();

  // Generate room ID client-side after mount (Math.random() can't run during SSR)
  useEffect(() => {
    setNewRoomId(Math.random().toString(36).slice(2, 10));
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const id = joinInput.trim();
    if (id) router.push(`/board/${id}`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🖊️</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Collaborative Whiteboard</h1>
          <p className="text-gray-500 text-sm">
            Draw together in real-time. No account needed.
          </p>
        </div>

        {/* Create new board */}
        <Link
          href={`/board/${newRoomId}`}
          className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors mb-4"
        >
          + Create New Board
        </Link>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm text-gray-400 bg-white px-2 w-fit mx-auto">
            or join existing
          </div>
        </div>

        {/* Join by room ID */}
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            type="text"
            placeholder="Enter room ID..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            className="bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            Join
          </button>
        </form>

        {/* Feature chips */}
        <div className="flex flex-wrap gap-2 mt-8 justify-center">
          {['Real-time sync', 'Freehand drawing', 'Shapes', 'Undo/Redo', 'Export PNG'].map((f) => (
            <span key={f} className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
              {f}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
