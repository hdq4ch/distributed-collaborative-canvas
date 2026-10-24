import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// All board routes require authentication
router.use(requireAuth);

const CreateBoardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false),
});

// GET /boards — list boards the user owns or is a member of
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const boards = await prisma.board.findMany({
      where: {
        OR: [
          { ownerId: req.userId! },
          { members: { some: { userId: req.userId! } } },
        ],
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ boards });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /boards — create a new board
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, isPublic } = CreateBoardSchema.parse(req.body);
    const board = await prisma.board.create({
      data: {
        name,
        description,
        isPublic,
        ownerId: req.userId!,
        members: {
          create: { userId: req.userId!, role: 'OWNER' },
        },
      },
      include: { owner: { select: { id: true, name: true } } },
    });
    res.status(201).json({ board });
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    if (e['name'] === 'ZodError') {
      res.status(400).json({ error: 'Validation failed', details: e['errors'] });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /boards/:id — get a single board
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const board = await prisma.board.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { ownerId: req.userId! },
          { isPublic: true },
          { members: { some: { userId: req.userId! } } },
        ],
      },
      include: {
        owner: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!board) {
      res.status(404).json({ error: 'Board not found' });
      return;
    }
    res.json({ board });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /boards/:id — delete a board (owner only)
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const board = await prisma.board.findUnique({ where: { id: req.params.id } });
    if (!board) { res.status(404).json({ error: 'Board not found' }); return; }
    if (board.ownerId !== req.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
    await prisma.board.delete({ where: { id: req.params.id } });
    res.json({ message: 'Board deleted' });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
