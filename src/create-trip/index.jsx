import React, { useState, useEffect } from "react";
import { SelectBudgetOptions, SelectTravelsList, AI_PROMPT } from "../constants/options";
import toast from 'react-hot-toast';
import { createChatSession, sendMessage } from "../service/AIModel";
import { useGoogleLogin } from '@react-oauth/google';
import { Dialog, DialogContent, DialogTitle, DialogActions } from '@mui/material';
import axios from 'axios';
import { doc, setDoc } from 'firebase/firestore'; 
import { db } from '../service/firebaseConfig'; 
import { useNavigate } from "react-router-dom"; 
import { fetchPlaceSuggestions } from "../service/PlacesAutocomplete";

function CreateTrip() {
  const [place, setPlace] = useState();
  const [formData, setFormData] = useState({});
  const [generatedTrip, setGeneratedTrip] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [chatSession, setChatSession] = useState(null);
  const [locationInput, setLocationInput] = useState("");
  const [locationOptions, setLocationOptions] = useState([]);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    setChatSession(createChatSession());
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadSuggestions = async () => {
      const query = locationInput.trim();
      if (!query) {
        setLocationOptions([]);
        return;
      }

      try {
        setIsLocationLoading(true);
        const suggestions = await fetchPlaceSuggestions(query);
        setLocationOptions(suggestions);
      } catch (error) {
        console.error("Error fetching location suggestions:", error);
      } finally {
        setIsLocationLoading(false);
      }
    };

    const timeoutId = setTimeout(loadSuggestions, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [locationInput]);

  const buildFallbackTrip = (formData) => {
    const totalDays = parseInt(formData?.no_of_days) || 1;
    const locationLabel = formData?.location?.label || "Your Destination";
    const travelerLabel = formData?.traveler || "Travelers";
    const budgetLabel = formData?.budget || "Moderate";

    const itinerary = {};

    for (let i = 1; i <= totalDays; i++) {
      itinerary[`day${i}`] = {
        bestTimeToVisit: "Daytime",
        places: [
          {
            geoCoordinates: {
              latitude: 0,
              longitude: 0,
            },
            placeDetails: `Explore key attractions and local spots in ${locationLabel}.`,
            placeImageUrl: "",
            placeName: `${locationLabel} Highlights`,
            rating: 4,
            ticketPricing: "Varies",
            timeSpent: "4-6 hours",
            travelTime: "15-30 minutes",
            theme: "Sightseeing",
          },
        ],
      };
    }

    const priceLabel =
      budgetLabel === "Affortable"
        ? "Budget friendly stay"
        : budgetLabel === "Moderate"
        ? "Mid-range stay"
        : "Premium stay";

    return {
      travelPlan: {
        budget: budgetLabel,
        duration: `${totalDays} days`,
        hotelOptions: [
          {
            description: `${budgetLabel} stay in ${locationLabel}`,
            geoCoordinates: {
              latitude: 0,
              longitude: 0,
            },
            hotelAddress: locationLabel,
            hotelImageUrl: "",
            hotelName: "Recommended Hotel",
            price: priceLabel,
            rating: 4.2,
          },
        ],
        itinerary,
        location: locationLabel,
        travelers: travelerLabel,
      },
    };
  };

  const handleInputChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  useEffect(() => {
    console.log(formData);
  }, [formData]);

  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      GetUserProfile(codeResponse);
      setOpenDialog(false);
      onGenerateTrip(true); 
    },
    onError: (error) => {
      console.log(error);
      toast.error("Failed to sign in with Google");
    },
  });

  const onGenerateTrip = async (isAfterLogin = false) => {
    if (!isAfterLogin) {
      const user = localStorage.getItem('user');
      if (!user) {
        setOpenDialog(true);
        return;
      }
    }

    if (formData?.no_of_days > 5) {
      toast.error("Please enter trip days less than 5 days");
      return;
    }

    if (!formData?.no_of_days || !formData?.location || !formData?.budget || !formData?.traveler) {
      toast.error("Please fill all the fields");
      return;
    }
    
    toast.success("Trip is Generating...");
    setIsLoading(true);
    
    try {
      const numDays = parseInt(formData?.no_of_days) || 1;
      const daysStructure = Array.from({ length: numDays }, (_, i) => `
      "day${i + 1}": {
        "bestTimeToVisit": "",
        "places": [
          {
            "geoCoordinates": {
              "latitude": 0,
              "longitude": 0
            },
            "placeDetails": "",
            "placeImageUrl": "",
            "placeName": "",
            "rating": 0,
            "ticketPricing": "",
            "timeSpent": "",
            "travelTime": "",
            "theme": ""
          }
        ]
      }`).join(',');

      const FINAL_PROMPT = AI_PROMPT
        .replace("{location}", formData?.location?.label)
        .replace("{totalDays}", formData?.no_of_days)
        .replace("{traveler}", formData?.traveler)
        .replace("{budget}", formData?.budget)
        .replace("{total_days}", formData?.no_of_days)
        .replace("{DAYS_STRUCTURE}", daysStructure);
      
      console.log("Sending prompt to AI:", FINAL_PROMPT);
      
      const responseText = await sendMessage(chatSession, FINAL_PROMPT);
      console.log("Raw AI Response:", responseText);
      
      try {
        let cleanedResponseText = responseText.trim();
        
        // Remove common AI response artifacts
        cleanedResponseText = cleanedResponseText
          .replace(/```json\s*/g, '')
          .replace(/```\s*$/g, '')
          .replace(/^[^{]*({.*})[^}]*$/s, '$1')
          .replace(/,\s*}/g, '}')  
          .replace(/,\s*]/g, ']'); 
        const jsonStartIndex = cleanedResponseText.indexOf('{');
        const jsonEndIndex = cleanedResponseText.lastIndexOf('}');
    
        let jsonString = cleanedResponseText; 
    
        if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            jsonString = cleanedResponseText.substring(jsonStartIndex, jsonEndIndex + 1);
        }
    
        console.log("Attempting to parse JSON:", jsonString.substring(0, 200) + "...");
        
        const parsedResponse = JSON.parse(jsonString);

        setGeneratedTrip(parsedResponse);
        console.log("Parsed Trip Data:", parsedResponse);
        toast.success("Trip generated successfully!");

        await SavedAiTrip(jsonString);
      } catch (parseError) {
        console.error("Error parsing AI response as JSON:", parseError);
        console.log("Non-JSON response:", responseText);

        const fallbackTrip = buildFallbackTrip(formData);
        setGeneratedTrip(fallbackTrip);

        try {
          await SavedAiTrip(JSON.stringify(fallbackTrip));
          toast.success("AI response invalid, generated a basic trip instead.");
        } catch (saveError) {
          console.error("Error saving fallback trip:", saveError);
          toast.error("AI failed and could not save basic trip. Please try again.");
        }
      }
      
    } catch (error) {
      console.error("Error generating trip:", error);

      const fallbackTrip = buildFallbackTrip(formData);
      setGeneratedTrip(fallbackTrip);

      try {
        await SavedAiTrip(JSON.stringify(fallbackTrip));
        toast.success("AI unavailable, generated a basic trip instead.");
      } catch (saveError) {
        console.error("Error saving fallback trip:", saveError);
        toast.error("Failed to generate trip, even basic fallback. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const GetUserProfile = async (tokenInfo) => {
    try {
      const res = await axios.post('/api/auth/google', {
        access_token: tokenInfo?.access_token,
      });

      const userData = res.data.user;
      console.log('Google user profile via backend:', userData);

      localStorage.setItem('user', JSON.stringify(userData));
      setOpenDialog(false);
      onGenerateTrip(true); // Call generate trip again after successful login
    } catch (error) {
      console.error('Error verifying Google login via backend:', error);
      toast.error('Failed to sign in with Google');
    }
  };
  
  const SavedAiTrip = async(tripData) => {
    try {
      setIsLoading(true);
      const user = JSON.parse(localStorage.getItem('user'));
      const docId = Date.now().toString();
      
      console.log("User data:", user);
      
      const userId = user?.id || user?.sub || user?.email || 'anonymous-user';
      
      // Add user details to the stored data
      await setDoc(doc(db, "AITrips", docId), {
        userSelection: formData,
        tripData: JSON.parse(tripData),
        id: docId,
        userId: userId, // Use the correct userId field
        userEmail: user?.email || 'no-email',
        userName: user?.name || 'Anonymous',
        createdAt: new Date().toISOString(),
      });
      
      toast.success("Trip saved to your account!");
      console.log("Trip saved successfully with ID:", docId);
      navigate(`/view-trip/${docId}`);
    } catch (error) {
      console.error("Error saving trip to Firebase:", error);
      toast.error("Failed to save trip. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="sm:px-10 md:px-32 lg:px-56 xl:px-10 px-5 mt-10">
      <h2 className="font-bold text-3xl">Tell us your travel preferences 🏕️🌴</h2>
      <p className="mt-3 text-gray-500 text-xl">
        Just provide some basic information, and our trip planner will generate
        a customized itinerary based on your preferences.
      </p>

      <div className="mt-20 flex-col gap-10">
        <div>
          <h2 className="text-xl my-3 font-medium ">
            What is your destination of choice?
          </h2>
          <div className="relative">
            <input
              type="text"
              value={locationInput}
              onChange={(e) => {
                const value = e.target.value;
                setLocationInput(value);
              }}
              placeholder="Search a destination..."
              className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isLocationLoading && (
              <div className="absolute right-3 top-2.5 text-xs text-gray-500">
                Loading...
              </div>
            )}
            {locationOptions.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl mt-1 max-h-60 overflow-auto shadow-lg">
                {locationOptions.map((option, index) => (
                  <div
                    key={index}
                    className="px-4 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                    onClick={() => {
                      setLocationInput(option.label);
                      setPlace(option);
                      handleInputChange("location", option);
                      setLocationOptions([]);
                    }}
                  >
                    <div className="font-medium">{option.label}</div>
                    {option.value?.address && (
                      <div className="text-xs text-gray-500">{option.value.address}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-xl my-3 font-medium">
            How many days are you planning your trip?
          </h2>
          <input
            type="number"
            placeholder="Ex. 3"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => handleInputChange("no_of_days", e.target.value)}
          />
        </div>

        <div>
          <h2 className="text-xl my-3 font-medium">What is Your Budget?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 mt-5">
            {SelectBudgetOptions.map((item, index) => (
              <div
                key={index}
                onClick={() => handleInputChange("budget", item.title)}
                className={`p-4 border rounded-lg cursor-pointer transition duration-200 ease-in-out 
                  hover:shadow-lg hover:border-gray-400
                  ${formData?.budget === item.title ? ' border-3 shadow-lg border-black ' : 'border-gray-300'}
                `}>
                
                <h2 className="text-4xl mb-2">{item.icon}</h2>
                <h2 className="font-bold text-lg">{item.title}</h2>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl my-3 font-medium">Who do you plan on travelling with on your next adventure?</h2>
          <div className="grid grid-cols-3 gap-5 mt-5">
            {SelectTravelsList.map((item, index) => (
              <div
                key={index}
                onClick={() => handleInputChange("traveler", item.people)}
                className={`p-4 border cursor-pointer rounded-lg hover:shadow
                ${formData?.traveler === item.people ? ' border-3 shadow-lg border-black ' : 'border-gray-300'}`}>
                <h2 className="text-4xl">{item.icon}</h2>
                <h2 className="font-bold text-lg">{item.title}</h2>
                <h2 className="text-sm text-gray-500">{item.desc}</h2>
              </div>
            ))}
          </div>
        </div>
        <div className="my-10 flex justify-end">
          <button 
            onClick={() => onGenerateTrip()} 
            className={`bg-black text-white px-6 py-3 rounded-2xl shadow-md hover:bg-gray-800 transition duration-300 ease-in-out ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? 'Generating...' : 'Generate Trip'}
          </button>      
        </div>
      </div>  

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Sign In Required</DialogTitle>
        <DialogContent>
          <p>You need to sign in with Google to generate a trip.</p>
        </DialogContent>
        <DialogActions>
          <button 
            onClick={() => setOpenDialog(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg mr-2"
          >
            Cancel
          </button>
          <button 
            onClick={() => login()}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg"
          >
            Sign in with Google
          </button>
        </DialogActions>
      </Dialog>
      
      {generatedTrip && (
        <div className="mt-10 p-6 border border-gray-300 rounded-lg shadow-md">
          <h2 className="font-bold text-2xl mb-4">Your Generated Trip</h2>
          <p className="text-green-600 font-medium">Trip saved to your account!</p>
          <div className="mt-4">
            <h3 className="font-medium text-xl">{generatedTrip.title || "Your Trip"}</h3>
            <p className="text-gray-600">{generatedTrip.description || `${formData?.no_of_days} days in ${formData?.location?.label}`}</p>
          </div>
        </div>
      )}
    </div>
  );
}
export default CreateTrip;