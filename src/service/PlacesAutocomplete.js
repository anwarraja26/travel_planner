import axios from 'axios';

// Simple helper to ask the backend for autocomplete suggestions.
// The backend wraps Google Places so that the API key stays on the server.
export const fetchPlaceSuggestions = async (input) => {
  if (!input || !input.trim()) return [];

  const response = await axios.get('/api/places/autocomplete', {
    params: { input },
  });

  return response.data?.suggestions || [];
};
