/**
 * netlify/functions/anthropic-proxy.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Place this file at:  netlify/functions/anthropic-proxy.js
 *
 * Your Netlify env var is named: notebookkey
 * (visible in Netlify → roberts-dashboard → Environment variables)
 *
 * This function forwards browser requests to Anthropic's API,
 * bypassing CORS restrictions that prevent direct browser calls.
 */

exports.handler = async function(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Read API key — your Netlify var is "notebookkey"
  const apiKey = process.env.notebookkey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'API key not found. Make sure "notebookkey" is set in Netlify environment variables.'
      }),
    };
  }

  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upstream request failed: ' + err.message }),
    };
  }
};
