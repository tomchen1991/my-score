import { Hono } from 'hono';
import { setupAuth } from './auth';
import type { AuthBindings } from './auth-provider';

export { ScoreAuthSession } from './auth-session';

const app = new Hono<{ Bindings: AuthBindings }>();
setupAuth(app);

function formatDate(value: unknown): unknown {
  if (!value) return value;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().split('T')[0];
}

function formatMediaRow<T extends Record<string, unknown>>(row: T): T {
  return { ...row, date: formatDate(row.date) };
}

app.get('/api/media/perfect', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM media WHERE rating = 10'
    ).all();
    return c.json({
      code: 0,
      data: results.map((item) => formatMediaRow(item as Record<string, unknown>)),
      message: 'Success',
    });
  } catch (error) {
    return c.json({ code: 1, data: {}, message: errorMessage(error) }, 500);
  }
});

app.get('/api/media/list', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM media').all();
    return c.json({
      code: 0,
      data: results.map((item) => formatMediaRow(item as Record<string, unknown>)),
      message: 'Success',
    });
  } catch (error) {
    return c.json({ code: 1, data: {}, message: errorMessage(error) }, 500);
  }
});

app.post('/api/media/create', async (c) => {
  try {
    const data = await c.req.json<{
      title: string;
      type: string;
      rating?: number | null;
      notes?: string | null;
      platform?: string | null;
      date?: string | null;
    }>();

    const created = await c.env.DB.prepare(
      `INSERT INTO media (title, type, rating, notes, platform, date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       RETURNING *`
    )
      .bind(
        data.title,
        data.type,
        data.rating ?? null,
        data.notes ?? null,
        data.platform ?? null,
        data.date ?? null
      )
      .first<Record<string, unknown>>();

    return c.json(
      {
        code: 0,
        data: created ? formatMediaRow(created) : created,
        message: 'Created successfully',
      },
      201
    );
  } catch (error) {
    return c.json({ code: 2, data: {}, message: errorMessage(error) }, 500);
  }
});

app.put('/api/media/updateById/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const data = await c.req.json<{
      title: string;
      type: string;
      rating?: number | null;
      notes?: string | null;
      platform?: string | null;
      date?: string | null;
    }>();

    await c.env.DB.prepare(
      `UPDATE media
       SET title = ?, type = ?, rating = ?, notes = ?, platform = ?, date = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(
        data.title,
        data.type,
        data.rating ?? null,
        data.notes ?? null,
        data.platform ?? null,
        data.date ?? null,
        id
      )
      .run();

    const updated = await c.env.DB.prepare('SELECT * FROM media WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();

    if (!updated) {
      return c.json({ code: 1, data: {}, message: 'Media not found' }, 404);
    }

    return c.json({
      code: 0,
      data: formatMediaRow(updated),
      message: 'Updated successfully',
    });
  } catch (error) {
    return c.json({ code: 2, data: {}, message: errorMessage(error) }, 500);
  }
});

app.delete('/api/media/deleteById/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
    return c.json({ code: 0, data: {}, message: 'Deleted successfully' });
  } catch (error) {
    return c.json({ code: 2, data: {}, message: errorMessage(error) }, 500);
  }
});

app.get('/api/media/page', async (c) => {
  try {
    const type = c.req.query('type');
    const currentPage = parseInt(c.req.query('currentPage') || '1', 10);
    const pageSize = parseInt(c.req.query('pageSize') || '10', 10);
    const title = c.req.query('title') || '';
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const sortBy = c.req.query('sortBy') || 'date';
    const sortType = c.req.query('sortType') || 'desc';

    if (!type) {
      return c.json({ code: 1, data: {}, message: 'Type is required' }, 400);
    }

    const conditions = ['type = ?'];
    const params: Array<string | number> = [type];

    if (title) {
      conditions.push('title LIKE ?');
      params.push(`%${title}%`);
    }
    if (startDate) {
      conditions.push('date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('date <= ?');
      params.push(endDate);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const orderColumn = sortBy === 'score' ? 'rating' : 'date';
    const orderDirection = sortType.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const offset = (currentPage - 1) * pageSize;

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM media ${where}`
    )
      .bind(...params)
      .first<{ total: number }>();

    const { results } = await c.env.DB.prepare(
      `SELECT * FROM media ${where} ORDER BY ${orderColumn} ${orderDirection} LIMIT ? OFFSET ?`
    )
      .bind(...params, pageSize, offset)
      .all();

    return c.json({
      code: 0,
      data: {
        list: results.map((item) => formatMediaRow(item as Record<string, unknown>)),
        total: totalRow?.total || 0,
        currentPage,
        pageSize,
      },
      message: 'Success',
    });
  } catch (error) {
    return c.json({ code: 1, data: {}, message: errorMessage(error) }, 500);
  }
});

app.get('/api/media/stats', async (c) => {
  try {
    const totalRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM media'
    ).first<{ total: number }>();
    const perfectRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM media WHERE rating = 10'
    ).first<{ count: number }>();
    const { results: typeStats } = await c.env.DB.prepare(
      'SELECT type, COUNT(*) as count FROM media GROUP BY type ORDER BY count DESC'
    ).all();
    const avgRow = await c.env.DB.prepare(
      'SELECT AVG(rating) as avg FROM media WHERE rating IS NOT NULL'
    ).first<{ avg: number | null }>();
    const { results: latest } = await c.env.DB.prepare(
      'SELECT title, type, rating, date FROM media ORDER BY created_at DESC LIMIT 5'
    ).all();

    return c.json({
      code: 0,
      data: {
        total: totalRow?.total || 0,
        perfectCount: perfectRow?.count || 0,
        avgRating: avgRow?.avg != null ? Number(avgRow.avg).toFixed(2) : '0.00',
        typeStats,
        latest: latest.map((item) => formatMediaRow(item as Record<string, unknown>)),
      },
      message: 'Success',
    });
  } catch (error) {
    return c.json({ code: 1, data: {}, message: errorMessage(error) }, 500);
  }
});

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ code: 404, message: 'Not Found' }, 404);
  }
  return c.text('Not Found', 404);
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export default app;
