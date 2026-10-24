'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Whiteboard from '../../../components/Whiteboard';

export default function BoardPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [userName, setUserName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [inputVal, setInputVal] = useState('');

  // Restore saved name from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('wb-username');
    if (saved) {
      setUserName(saved);
      setConfirmed(true);
    }
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const name = inputVal.trim() || `User-${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem('wb-username', name);
    setUserName(name);
    setConfirmed(true);
  };

  if (!confirmed) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🖊️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Join Board</h2>
          <p className="text-gray-500 text-sm mb-6">
            Room:{' '}
            <code className="bg-gray-100 px-2 py-0.5 rounded text-blue-600">
              {roomId}
            </code>
          </p>
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              autoFocus
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Your display name (optional)"
              className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              Join Board →
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-4">
            Share the room ID with collaborators to draw together.
          </p>
        </div>
      </main>
    );
  }

  return <Whiteboard roomId={roomId} userName={userName} />;
}
