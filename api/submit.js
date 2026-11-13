const REQUIRED_FIELDS = ['clientName', 'clientPhone', 'title'];
const MAX_BODY_CHARS = 20000;
const WEBHOOK_TIMEOUT_MS = 8000;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const webhookUrl = process.env.ZAPIER_WEBHOOK_URL || 'https://hook.eu1.make.com/9yhlr88qy4aembvhojeovgq5kx7268b9';
  if (!webhookUrl) {
    console.error('ZAPIER_WEBHOOK_URL is not configured');
    return res.status(500).json({ success: false, error: 'Submission service is not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid JSON' });
    }
  }
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > MAX_BODY_CHARS) {
    return res.status(400).json({ success: false, error: 'Invalid submission' });
  }

  const missing = REQUIRED_FIELDS.filter((f) => typeof body[f] !== 'string' || !body[f].trim());
  if (missing.length) {
    return res.status(400).json({ success: false, error: `Missing fields: ${missing.join(', ')}` });
  }

  try {
    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'work_submission',
        source: 'srone-studio',
        submittedAt: new Date().toISOString(),
        ...body,
      }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!upstream.ok) throw new Error(`Zapier responded with ${upstream.status}`);
  } catch (error) {
    console.error('Failed to forward submission to Zapier', error);
    return res.status(502).json({ success: false, error: 'Unable to submit right now' });
  }

  return res.status(200).json({ success: true });
};
