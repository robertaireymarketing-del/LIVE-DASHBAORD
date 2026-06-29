/**
 * netlify/functions/anthropic-proxy.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Serverless proxy that forwards requests from the browser to the Anthropic API.
 * Needed because browsers cannot call api.anthropic.com directly (CORS policy).
 *
 * SETUP
 * ─────
 * 1. Create the folder:  netlify/functions/
 * 2. Drop this file in:  netlify/functions/anthropic-proxy.js
 * 3. Add your API key to Netlify environment variables:
 *      Site settings → Environment variables → Add variable
 *      Key:   ANTHROPIC_API_KEY
 *      Value: sk-ant-…  (your key from console.anthropic.com)
 * 4. Deploy — the function is available at /.netlify/functions/anthropic-proxy
 *
 * The function accepts a POST with a standard Anthropic messages request body
 * and streams/returns the response directly back to the caller.
 */

exports.handler = async function(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY environment variable is not set. Add it in Netlify → Site settings → Environment variables.' }),
    };
  }

  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
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
      body: JSON.stringify({ error: 'Upstream request failed: ' + err.message }),
    };
  }
};
