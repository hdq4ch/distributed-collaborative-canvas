import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Collaborative Whiteboard',
  description: 'Real-time collaborative drawing board',
};

export default function BoardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
