import React from "react";
import GooglePlacesAutocomplete from "react-google-places-autocomplete";
import { useState, useEffect } from "react";
import { SelectBudgetOptions, SelectTravelsList, AI_PROMPT } from "../constants/options";
import toast from 'react-hot-toast';
import { createChatSession, sendMessage } from "../service/AIModel";
import { useGoogleLogin } from '@react-oauth/google';
import { Dialog, DialogContent, DialogTitle, DialogActions } from '@mui/material';
import axios from 'axios';
import { doc, setDoc } from 'firebase/firestore'; // Added missing imports
import { db } from '../service/firebaseConfig'; // Import db
import { useNavigate } from "react-router-dom"; // Import useNavigate

function CreateTrip() {
  const [place, setPlace] = useState();
  const [formData, setFormData] = useState([]);
  const [generatedTrip, setGeneratedTrip] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  
  // Create chat session on component mount
  const [chatSession, setChatSession] = useState(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Initialize chat session when component mounts
    setChatSession(createChatSession());
  }, []);

  const handleInputChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  useEffect(() => {
    console.log(formData);
  }, [formData]);

  // // This is for login
  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      GetUserProfile(codeResponse);
      setOpenDialog(false);
      onGenerateTrip(true); // Call generate trip again after successful login
    },
    onError: (error) => {
      console.log(error);
      toast.error("Failed to sign in with Google");
    },
  });

  const onGenerateTrip = async (isAfterLogin = false) => {
    // Skip user check if this is called after login
    if (!isAfterLogin) {
      const user = localStorage.getItem('user');
      if (!user) {
        setOpenDialog(true);
        return;
      }
    }

    // Validate form data
    if (formData?.no_of_days > 5) {
      toast.error("Please enter trip days less than 5 days");
      return;
    }

    if (!formData?.no_of_days || !formData?.location || !formData?.budget || !formData?.traveler) {
      toast.error("Please fill all the fields");
      return;
    }
    
    // Show loading toast
    toast.success("Trip is Generating...");
    setIsLoading(true);
    
    try {
      // Replace placeholders in the prompt
      const FINAL_PROMPT = AI_PROMPT
        .replace("{location}", formData?.location?.label)
        .replace("{totalDays}", formData?.no_of_days)
        .replace("{traveler}", formData?.traveler)
        .replace("{budget}", formData?.budget)
        .replace("{total_days}", formData?.no_of_days);
      
      console.log("Sending prompt to Gemini:", FINAL_PROMPT);
      
      // Send message to Gemini
      const responseText = await sendMessage(chatSession, FINAL_PROMPT);
      console.log("Raw AI Response:", responseText?.response?.text());
      
      // Try to parse the response as JSON
      try {
        // 1. Remove the backticks and "json" identifier (if present)
        const cleanedResponseText = responseText.trim(); // Remove leading/trailing whitespace
        const jsonStartIndex = cleanedResponseText.indexOf('{');
        const jsonEndIndex = cleanedResponseText.lastIndexOf('}');
    
        let jsonString = cleanedResponseText; //default value
    
        if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            jsonString = cleanedResponseText.substring(jsonStartIndex, jsonEndIndex + 1);
        }
    
        // 2. Parse the cleaned JSON string
        const parsedResponse = JSON.parse(jsonString);
    
        setGeneratedTrip(parsedResponse);
        console.log("Parsed Trip Data:", parsedResponse);
        toast.success("Trip generated successfully!");
        
        // Save the generated trip to Firebase
        await SavedAiTrip(jsonString); // Save the trip to Firebase
    
      } catch (parseError) {
        console.error("Error parsing AI response as JSON:", parseError);
        toast.error("Received response but couldn't parse as JSON");
        console.log("Non-JSON response:", responseText);
      }
      
    } catch (error) {
      console.error("Error generating trip:", error);
      toast.error("Failed to generate trip. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const GetUserProfile = async(tokenInfo) => {
    axios.get
    (`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${tokenInfo?.access_token}`,{
      headers:{
        Authorization: `Bearer ${tokenInfo?.access_token}`,
        Accept: 'Application/json',
      }
    }).then((response)=>{
      console.log(response);
      
      localStorage.setItem('user', JSON.stringify(response.data));
      setOpenDialog(false);
      onGenerateTrip(true); // Call generate trip again after successful login
    });
  };
  
  const SavedAiTrip = async(tripData) => {
    try {
      setIsLoading(true);
      const user = JSON.parse(localStorage.getItem('user'));
      const docId = Date.now().toString();
      
      console.log("User data:", user); // Debug user data
      
      // Use the correct user ID field from Google's response
      // Google OAuth returns either 'id', 'sub', or 'email' as identifier
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
          <GooglePlacesAutocomplete
            apiKey={import.meta.env.VITE_GOOGLE_PLACE_API_KEY}
            selectProps={{
              place,
              className: "w-full text-base",
              placeholder: "Search a destination...",
              onChange: (value) => {
                setPlace(value);
                handleInputChange("location", value);
              },
            }}
          />
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
                `}
              >
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

      {/* Google Sign In Dialog */}
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
      
      {/* Display Generated Trip Summary (Optional) */}
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