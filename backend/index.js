import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

app.use(cors());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Google OAuth helper: exchange access_token for user profile
app.post('/api/auth/google', async (req, res) => {
  try {
    const { access_token } = req.body || {};

    if (!access_token) {
      return res.status(400).json({ error: 'access_token is required' });
    }

    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.error?.message || `Google userinfo error: ${response.status}`;
      console.error('Error response from Google userinfo API:', errorBody);
      return res.status(response.status).json({ error: message });
    }

    const profile = await response.json();

    const user = {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      picture: profile.picture,
    };

    return res.json({ user });
  } catch (error) {
    console.error('Error in /api/auth/google:', error);
    return res.status(500).json({ error: 'Failed to verify Google login. Please try again.' });
  }
});


// AI trip planner endpoint
app.post('/api/ai-plan', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const reply = completion.choices[0]?.message?.content || '';

    return res.json({ reply });
  } catch (error) {
    console.error('Error in /api/ai-plan:', error);

    if (error.error?.type === 'rate_limit_exceeded' || error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait a few minutes and try again.',
      });
    }

    return res.status(500).json({ error: 'Failed to generate trip. Please try again.' });
  }
});

// Google Places search endpoint
app.post('/api/places/search', async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY is not configured on the server.' });
    }

    const { data } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'data object is required in request body.' });
    }

    const url = 'https://places.googleapis.com/v1/places:searchText';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.photos',
          'places.displayName',
          'places.id',
          'places.formattedAddress',
        ],
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.error?.message || `Google Places error: ${response.status}`;
      console.error('Error response from Google Places:', errorBody);
      return res.status(response.status).json({ error: message });
    }

    const result = await response.json();
    return res.json(result);
  } catch (error) {
    console.error('Error in /api/places/search:', error);
    return res.status(500).json({ error: 'Failed to fetch place details. Please try again.' });
  }
});

// Google Places photo proxy endpoint
app.get('/api/places/photo', async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY is not configured on the server.' });
    }

    const { photoName, maxHeightPx = 400, maxWidthPx = 600 } = req.query;

    if (!photoName) {
      return res.status(400).json({ error: 'photoName query parameter is required.' });
    }

    const url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeightPx}&maxWidthPx=${maxWidthPx}&key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.error?.message || `Google Places photo error: ${response.status}`;
      console.error('Error response from Google Places photo API:', errorBody);
      return res.status(response.status).json({ error: message });
    }

    // Pipe content-type and binary body through to the client
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (error) {
    console.error('Error in /api/places/photo:', error);
    return res.status(500).json({ error: 'Failed to fetch place photo. Please try again.' });
  }
});

// Simple autocomplete endpoint using Places Text Search
app.get('/api/places/autocomplete', async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY is not configured on the server.' });
    }

    const { input } = req.query;

    if (!input || typeof input !== 'string' || !input.trim()) {
      return res.status(400).json({ error: 'input query parameter is required.' });
    }

    const url = 'https://places.googleapis.com/v1/places:searchText';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.displayName',
          'places.id',
          'places.formattedAddress',
        ],
      },
      body: JSON.stringify({
        textQuery: input,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.error?.message || `Google Places autocomplete error: ${response.status}`;
      console.error('Error response from Google Places autocomplete API:', errorBody);
      return res.status(response.status).json({ error: message });
    }

    const result = await response.json();

    const suggestions = (result.places || []).map((place) => ({
      label: place.displayName?.text || place.formattedAddress || 'Unknown place',
      value: {
        name: place.displayName?.text || '',
        address: place.formattedAddress || '',
        id: place.id,
      },
    }));

    return res.json({ suggestions });
  } catch (error) {
    console.error('Error in /api/places/autocomplete:', error);
    return res.status(500).json({ error: 'Failed to fetch autocomplete suggestions. Please try again.' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});
