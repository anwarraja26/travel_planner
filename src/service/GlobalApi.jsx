import axios from 'axios';

// Call backend, which in turn talks to Google Places API.
// This keeps the Google API key on the server only.
const BASE_URL = "/api/places/search";

export const GetPlaceDetails = (data) =>
  axios.post(BASE_URL, { data });