import React, { useEffect, useState } from 'react';
import trip_img from '../../assets/trip.png';
import { IoIosSend } from "react-icons/io";
import { GetPlaceDetails } from '../../service/GlobalApi';

function InfoSection({ trip }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (trip?.userSelection?.location?.label) {
      setImageError(false); // Reset error state when location changes
      getPlacePhoto(trip.userSelection.location.label);
    }
  }, [trip?.userSelection?.location?.label]);

  const getPlacePhoto = async (locationName) => {
    try {
      const data = { textQuery: locationName };
      const result = await GetPlaceDetails(data);

      const photoName = result.data?.places?.[0]?.photos?.[0]?.name;
      const apiKey = import.meta.env.VITE_GOOGLE_PLACE_API_KEY;

      if (photoName) {
        // ✅ Use the direct image URL with API key in query params (same as Hotels.jsx)
        const directPhotoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=900&maxWidthPx=1200&key=${apiKey}`;
        setPhotoUrl(directPhotoUrl);
      } else {
        console.log("No photo found");
      }
    } catch (error) {
      console.error("Error fetching photo:", error);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  if (!trip?.userSelection) return null;

  const locationLabel = trip.userSelection.location?.label;

  return (
    <div>
      <img 
        src={!imageError && photoUrl ? photoUrl : trip_img} 
        alt={locationLabel || "Trip Destination"} 
        onError={handleImageError}
        className="rounded-xl w-[1200px] h-[400px] object-cover shadow-md"
      />


      <div className="flex justify-between items-center">
        <div className="my-5 flex flex-col gap-2">
          <h2 className="font-bold text-2xl">{locationLabel}</h2>
          <div className="flex gap-5 flex-wrap">
            <h2 className="p-1 px-3 bg-gray-200 rounded-full text-gray-500 text-xs md:text-md">
              📅 {trip.userSelection.no_of_days} Days
            </h2>
            <h2 className="p-1 px-3 bg-gray-200 rounded-full text-gray-500 text-xs md:text-md">
              💰 {trip.userSelection.budget} Budget
            </h2>
            <h2 className="p-1 px-3 bg-gray-200 rounded-full text-gray-500 text-xs md:text-md">
              🗺️ No. of Travelers {trip.userSelection.traveler}
            </h2>
          </div>
        </div>
        <button className="bg-black text-white px-6 py-3 rounded-2xl shadow-md hover:bg-gray-800 transition duration-300 ease-in-out flex items-center justify-center">
          <IoIosSend />
        </button>
      </div>
    </div>
  );
}

export default InfoSection;
