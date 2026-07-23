const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function isSpam(data, honeypotField) {
  if (honeypotField && data[honeypotField]) {
    return true;
  }

  if (typeof data === 'object') {
    for (const key of Object.keys(data)) {
      const val = String(data[key] || '');
      if (val.length > 5000) return true;
      if (/(https?:\/\/[^\s]+){3,}/.test(val)) return true;
    }
  }

  return false;
}

async function rateLimiter(pool, ip, widgetId) {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  const { rows } = await pool.query(
    'SELECT COALESCE(SUM(count), 0) AS total FROM rate_limits WHERE ip = $1 AND widget_id = $2 AND window_start > $3',
    [ip, widgetId, windowStart]
  );

  if (Number(rows[0].total) >= RATE_LIMIT_MAX) {
    return false;
  }

  await pool.query(
    `INSERT INTO rate_limits (ip, widget_id, window_start, count)
     VALUES ($1, $2, date_trunc('minute', now()), 1)
     ON CONFLICT (ip, widget_id, window_start)
     DO UPDATE SET count = rate_limits.count + 1`,
    [ip, widgetId]
  );

  return true;
}

async function cleanupRateLimits(pool) {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS * 2);
  await pool.query('DELETE FROM rate_limits WHERE window_start < $1', [cutoff]);
}

module.exports = { getClientIp, isSpam, rateLimiter, cleanupRateLimits, RATE_LIMIT_MAX };
