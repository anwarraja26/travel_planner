import React, { useEffect, useState } from 'react';
import trip_img from "../../assets/trip.png";
import { GetPlaceDetails } from '../../service/GlobalApi';

function PlacesToVisit({ trip }) {
  const [placeImages, setPlaceImages] = useState({});
  const itinerary = trip?.tripData?.travelPlan?.itinerary;

  const dayKeys = itinerary
    ? Object.keys(itinerary).sort((a, b) => {
        const dayNumA = parseInt(a.replace('day', ''));
        const dayNumB = parseInt(b.replace('day', ''));
        return dayNumA - dayNumB;
      })
    : [];

  useEffect(() => {
    if (itinerary) {
      loadPlaceImages();
    }
  }, [trip]);

  const loadPlaceImages = async () => {
    const newPlaceImages = {};

    for (const dayKey of dayKeys) {
      if (Array.isArray(itinerary[dayKey].places)) {
        for (const place of itinerary[dayKey].places) {
          try {
            if (placeImages[place.placeName] || newPlaceImages[place.placeName]) continue;

            const data = { textQuery: place.placeName };
            const result = await GetPlaceDetails(data);

            if (result.data?.places?.[0]?.photos?.[0]?.name) {
              const photoName = result.data.places[0].photos[0].name;
              const apiKey = import.meta.env.VITE_GOOGLE_PLACE_API_KEY;
              const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&maxWidthPx=600&key=${apiKey}`;
              newPlaceImages[place.placeName] = photoUrl;
            }
          } catch (error) {
            console.error(`Error fetching image for ${place.placeName}:`, error);
          }
        }
      }
    }

    setPlaceImages((prev) => ({ ...prev, ...newPlaceImages }));
  };

  const handleImageError = (placeName) => {
    setPlaceImages((prev) => {
      const updated = { ...prev };
      delete updated[placeName];
      return updated;
    });
  };

  const openInGoogleMaps = (placeName) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
    window.open(url, '_blank');
  };

  return (
    <div>
      <h2 className="font-bold text-lg mb-4">Places To Visit</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {dayKeys.map((dayKey) => (
          <div key={dayKey} className="p-4 border rounded-lg shadow">
            <h2 className="font-medium text-lg mb-3">{dayKey}</h2>

            {Array.isArray(itinerary[dayKey].places) ? (
              <div>
                {itinerary[dayKey].places.map((place, index) => (
                  <div key={index} className="mb-4 border rounded-lg overflow-hidden">
                    <img
                      src={placeImages[place.placeName] || place.placeImageUrl || trip_img}
                      alt={place.placeName}
                      className="w-full h-40 object-cover"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      onError={() => handleImageError(place.placeName)}
                    />
                    <div className="p-3">
                      <h3 className="font-bold text-base">{place.placeName}</h3>
                      <p className="text-sm text-gray-600 mt-1">{place.placeDetails}</p>
                      {place.timeSpent && (
                        <p className="text-m-b mt-2">
                          🕓 Time: {itinerary[dayKey].bestTimeToVisit}
                        </p>
                      )}

                      <button
                        onClick={() => openInGoogleMaps(place.placeName)}
                        className="mt-2 bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md text-sm flex items-center"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        Location
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No places planned for this day</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PlacesToVisit;
