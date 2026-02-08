import React, { useEffect, useState } from 'react';
import trip_img from "../../assets/trip.png";
import { Link } from 'react-router-dom';
import { GetPlaceDetails } from '../../service/GlobalApi';

function Hotels({ trip }) {
  const [hotelImages, setHotelImages] = useState({});
  
  useEffect(() => {
    if (trip?.tripData?.travelPlan?.hotelOptions) {
      loadHotelImages();
    }
  }, [trip]);
  
  const loadHotelImages = async () => {
    const newHotelImages = {};
    const hotels = trip?.tripData?.travelPlan?.hotelOptions || [];
    
    for (const hotel of hotels) {
      try {
        const data = {
          textQuery: `${hotel.hotelName} ${hotel.hotelAddress}`,
        };
        
        const result = await GetPlaceDetails(data);
        if (result.data?.places?.[0]?.photos?.[0]?.name) {
          const photoName = result.data.places[0].photos[0].name;
          const apiKey = import.meta.env.VITE_GOOGLE_PLACE_API_KEY;
          const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&maxWidthPx=600&key=${apiKey}`;
          newHotelImages[hotel.hotelName] = photoUrl;
        }
      } catch (error) {
        console.error(`Error fetching image for ${hotel.hotelName}:`, error);
      }
    }
    
    setHotelImages(newHotelImages);
  };
  
  const handleImageError = (hotelName) => {
    setHotelImages(prev => {
      const updated = {...prev};
      delete updated[hotelName];
      return updated;
    });
  };

  return (
    <div>
      <h2 className='font-bold text-xl mt-5'>Hotel Recommendation</h2>
      <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 mt-5'>
        {trip?.tripData?.travelPlan?.hotelOptions?.map((hotel, index) => (                
          <div key={index} className='hover:scale-110 transition-all cursor-pointer'>
            <Link 
              to={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.hotelName+"."+hotel.hotelAddress)}`} 
              target="_blank" 
              className='block'
            >
              <img 
                src={hotelImages[hotel.hotelName] || trip_img} 
                className="rounded-xl w-full h-48 object-cover"
                alt={hotel.hotelName}
                onError={() => handleImageError(hotel.hotelName)}
              />
              <div className='my-2 flex flex-col gap-2'>
                <h2 className='font-medium'>{hotel?.hotelName}</h2>
                <h2 className='text-xs text-gray-500'>📍 {hotel?.hotelAddress}</h2>
                <h2 className='text-sm'>💸 {hotel?.price}</h2>
                <h2 className='text-sm'>⭐ {hotel?.rating}</h2>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Hotels;