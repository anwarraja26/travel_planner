import React, { useState, useEffect, useRef } from "react";
import { SelectBudgetOptions, SelectTravelsList, AI_PROMPT } from "../constants/options";
import toast from 'react-hot-toast';
import { createChatSession, sendMessage } from "../service/AIModel";
import { useGoogleLogin } from '@react-oauth/google';
import { Dialog, DialogContent, DialogTitle, DialogActions } from '@mui/material';
import axios from 'axios';
import { addDoc, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'; 
import { db } from '../service/firebaseConfig'; 
import { useNavigate } from "react-router-dom"; 
import { fetchPlaceSuggestions } from "../service/PlacesAutocomplete";

const CHAT_SYSTEM_PROMPT = `You are a helpful travel planning assistant.
Help the user discover places to go, compare destinations, suggest trip ideas, and answer travel questions.
Keep responses practical, friendly, and concise.
Use this format when possible:
1. Best suggestion
2. Why it fits
3. Budget or travel style note
4. Optional next step

Prefer short bullet points or short labeled sections instead of long paragraphs.`;

const CHAT_WELCOME_MESSAGE = {
  role: "assistant",
  content: "Tell me you are planning a holiday and I will guide you step by step.",
};

const GUIDED_FLOW_STEPS = [
  "mood",
  "country",
  "preference",
  "travelers",
  "budget",
  "location",
  "days",
  "confirm",
];

const GUIDED_STEP_QUESTIONS = {
  mood: "What mood are you looking for on this trip? For example: relaxed, adventurous, romantic, family, or nightlife.",
  country: "Which country would you like to visit?",
  preference: "What type of experience do you prefer, like beach, mountains, city, food, culture, or nature?",
  travelers: "How many persons are traveling?",
  budget: "What budget range do you want: Affordable, Moderate, or Luxury?",
  location: "What is your preferred location or city?",
  days: "How many days will the trip be?",
  confirm: "I have everything I need. Can I generate the trip now?",
};

const GUIDED_INTRO_TEXT =
  "I can help with a holiday plan. Answer one question at a time and I will prepare your trip.";

const GUIDED_RESPONSE_SYSTEM_PROMPT = `You are a conversational travel assistant inside a trip planner.
Your job is to help the user fill out a trip form step by step while sounding natural and helpful.

Return ONLY valid JSON with this exact shape:
{
  "assistantReply": "short conversational response",
  "shouldAdvance": true,
  "normalizedValue": "string or null",
  "suggestedLocation": {
    "label": "string",
    "country": "string"
  } or null,
  "needsConfirmation": false
}

Rules:
- If the user does not know the preferred location or asks for suggestions, set shouldAdvance to false and suggestedLocation to a helpful destination based on the collected context.
- If the user is answering the current step clearly, set shouldAdvance to true.
- Keep assistantReply short, friendly, and direct.
- Do not include markdown fences or extra commentary.`;

const EMPTY_USER_MEMORY = {
  favoriteTripType: "",
  averageBudget: "",
  preferredDestinationType: "",
};

const DESTINATION_TYPE_MAP = {
  goa: "Beach",
  pondicherry: "Beach",
  munnar: "Hill Station",
  ooty: "Hill Station",
  kodaikanal: "Hill Station",
  coorg: "Hill Station",
  manali: "Mountain",
  shimla: "Mountain",
  mussoorie: "Mountain",
  jaipur: "Heritage City",
  udaipur: "Heritage City",
  delhi: "City",
  mumbai: "City",
  bangalore: "City",
  chennai: "City",
  kerala: "Nature / Backwaters",
};

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
  const [openChatDialog, setOpenChatDialog] = useState(false);
  const [chatMessages, setChatMessages] = useState([CHAT_WELCOME_MESSAGE]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [guidedFlowStep, setGuidedFlowStep] = useState(null);
  const [guidedAnswers, setGuidedAnswers] = useState({});
  const [pendingTripSelection, setPendingTripSelection] = useState(null);
  const [pendingLocationSuggestion, setPendingLocationSuggestion] = useState(null);
  const chatMessagesEndRef = useRef(null);
  const chatSuggestions = [
    "I have planning for a holiday",
    "I need a trip idea",
    "Help me choose a country",
    "Plan a budget trip",
  ];
  const navigate = useNavigate();

  const getCurrentUser = () => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      return null;
    }
  };

  const getUserId = (user) => user?.id || user?.sub || user?.email || 'anonymous-user';

  const toDisplayDestination = (selection) => {
    if (selection?.location?.label) {
      return selection.location.label;
    }

    if (typeof selection?.location === 'string' && selection.location.trim()) {
      return selection.location.trim();
    }

    if (selection?.country) {
      return selection.country;
    }

    return 'Your Destination';
  };

  const mapTripTypeFromTravelers = (traveler) => {
    const text = String(traveler || '').toLowerCase();

    if (text.includes('family') || text.includes('3-5')) {
      return 'Family';
    }

    if (text.includes('couple') || text.includes('2')) {
      return 'Couple';
    }

    if (text.includes('friends') || text.includes('5-10')) {
      return 'Friends';
    }

    return 'Solo';
  };

  const mapDestinationType = (destination) => {
    const normalized = String(destination || '').toLowerCase();

    for (const [key, value] of Object.entries(DESTINATION_TYPE_MAP)) {
      if (normalized.includes(key)) {
        return value;
      }
    }

    return 'Mixed';
  };

  const inferFavoriteTripType = (trips) => {
    const frequency = {};

    trips.forEach((trip) => {
      const tripType = trip.tripType || 'Solo';
      frequency[tripType] = (frequency[tripType] || 0) + 1;
    });

    return Object.entries(frequency).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  };

  const inferAverageBudget = (trips) => {
    const budgets = trips.map((trip) => trip.budget).filter(Boolean);

    if (budgets.length === 0) {
      return '';
    }

    const frequency = {};

    budgets.forEach((budget) => {
      frequency[budget] = (frequency[budget] || 0) + 1;
    });

    return Object.entries(frequency).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  };

  const inferPreferredDestinationType = (trips) => {
    const frequency = {};

    trips.forEach((trip) => {
      const destinationType = mapDestinationType(trip.destination);
      frequency[destinationType] = (frequency[destinationType] || 0) + 1;
    });

    const favoriteType = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0]?.[0];

    return favoriteType ? [favoriteType] : [];
  };

  const loadUserMemory = async (uid) => {
    if (!uid) {
      return EMPTY_USER_MEMORY;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      const memory = userDoc.exists() ? userDoc.data()?.memory : null;

      return {
        ...EMPTY_USER_MEMORY,
        ...(memory || {}),
      };
    } catch (error) {
      console.error('Error loading user memory:', error);
      return EMPTY_USER_MEMORY;
    }
  };

  const recalculateUserMemory = async (uid) => {
    if (!uid) {
      return EMPTY_USER_MEMORY;
    }

    const tripsSnapshot = await getDocs(collection(db, 'users', uid, 'trips'));
    const trips = tripsSnapshot.docs.map((tripDoc) => tripDoc.data());

    const memory = {
      favoriteTripType: inferFavoriteTripType(trips),
      averageBudget: inferAverageBudget(trips),
      preferredDestinationType: inferPreferredDestinationType(trips),
    };

    const user = getCurrentUser();

    await setDoc(
      doc(db, 'users', uid),
      {
        profile: {
          id: uid,
          name: user?.name || 'Anonymous',
          email: user?.email || '',
          picture: user?.picture || '',
        },
        memory,
        memoryUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return memory;
  };

  const saveTripToUserHistory = async (uid, tripRecord) => {
    if (!uid) {
      return;
    }

    await addDoc(collection(db, 'users', uid, 'trips'), tripRecord);
    await recalculateUserMemory(uid);
  };

  const buildMemoryPrompt = (memory) => {
    const preferredDestinationText = Array.isArray(memory?.preferredDestinationType)
      ? memory.preferredDestinationType.join(', ')
      : memory?.preferredDestinationType || '';

    return `
User Memory:
- Favorite Trip Type: ${memory?.favoriteTripType || 'Unknown'}
- Average Budget: ${memory?.averageBudget || 'Unknown'}
- Preferred Destination Type: ${preferredDestinationText || 'Unknown'}
`;
  };
  
  useEffect(() => {
    setChatSession(createChatSession());
  }, []);

  useEffect(() => {
    if (openChatDialog) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, openChatDialog]);

  useEffect(() => {
    if (!openChatDialog) {
      setGuidedFlowStep(null);
      setGuidedAnswers({});
      setPendingLocationSuggestion(null);
      setChatMessages([CHAT_WELCOME_MESSAGE]);
      setChatInput("");
    }
  }, [openChatDialog]);

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
          {
            geoCoordinates: {
              latitude: 0,
              longitude: 0,
            },
            placeDetails: `Visit a popular local spot in ${locationLabel} that fits a relaxed travel day.`,
            placeImageUrl: "",
            placeName: `${locationLabel} Heritage Walk`,
            rating: 4,
            ticketPricing: "Varies",
            timeSpent: "2-3 hours",
            travelTime: "15-30 minutes",
            theme: "Culture",
          },
          {
            geoCoordinates: {
              latitude: 0,
              longitude: 0,
            },
            placeDetails: `A scenic stop in ${locationLabel} for photos, food, or a short visit.`,
            placeImageUrl: "",
            placeName: `${locationLabel} Scenic Viewpoint`,
            rating: 4,
            ticketPricing: "Varies",
            timeSpent: "1-2 hours",
            travelTime: "15-30 minutes",
            theme: "Nature",
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

  const openTravelChat = () => {
    setChatMessages([
      CHAT_WELCOME_MESSAGE,
      { role: "assistant", content: GUIDED_INTRO_TEXT },
    ]);
    setGuidedFlowStep(null);
    setGuidedAnswers({});
    setPendingTripSelection(null);
    setPendingLocationSuggestion(null);
    setOpenChatDialog(true);
  };

  const extractJsonBlock = (text) => {
    if (!text) {
      return null;
    }

    const cleanedText = text.trim().replace(/```json\s*/g, "").replace(/```\s*$/g, "");
    const startIndex = cleanedText.indexOf("{");
    const endIndex = cleanedText.lastIndexOf("}");

    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return null;
    }

    try {
      return JSON.parse(cleanedText.slice(startIndex, endIndex + 1));
    } catch (error) {
      console.error("Failed to parse guided AI JSON:", error);
      return null;
    }
  };

  const isAffirmative = (value) => /^(yes|yep|yeah|sure|ok|okay|please do|go ahead|generate|y|correct|fine)/i.test(value.trim());

  const requestGuidedAssistantResponse = async ({ step, message, answers, currentQuestion }) => {
    const responseContext = {
      mood: answers.mood || "",
      country: answers.country || "",
      preference: answers.preference || "",
      travelers: answers.travelers || "",
      budget: answers.budget || "",
      location: answers.location || "",
      days: answers.days || "",
      pendingSuggestion: pendingLocationSuggestion?.label || "",
      currentQuestion,
    };

    const prompt = `${GUIDED_RESPONSE_SYSTEM_PROMPT}

Current step: ${step}
User message: ${message}
Collected context: ${JSON.stringify(responseContext)}

Use the collected context to make the reply feel conversational. If the user asks for a recommendation, give a specific destination suggestion.`;

    try {
      const response = await axios.post("/api/ai-plan", {
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: message },
        ],
      });

      const parsed = extractJsonBlock(response.data?.reply || "");

      return parsed || {
        assistantReply: "Got it.",
        shouldAdvance: true,
        normalizedValue: null,
        suggestedLocation: null,
        needsConfirmation: false,
      };
    } catch (error) {
      console.error("Error generating guided AI response:", error);

      return {
        assistantReply: "Got it.",
        shouldAdvance: true,
        normalizedValue: null,
        suggestedLocation: null,
        needsConfirmation: false,
      };
    }
  };

  const appendAssistantMessage = (content) => {
    setChatMessages((previousMessages) => [...previousMessages, { role: "assistant", content }]);
  };

  const askGuidedStep = async (step) => {
    const question = GUIDED_STEP_QUESTIONS[step];

    if (!question) {
      return;
    }

    appendAssistantMessage(question);
  };

  const normalizeBudgetAnswer = (value) => {
    const text = value.toLowerCase();

    if (text.includes("lux") || text.includes("premium") || text.includes("high")) {
      return "Luxury";
    }

    if (text.includes("aff") || text.includes("cheap") || text.includes("low") || text.includes("budget")) {
      return "Affortable";
    }

    return "Moderate";
  };

  const normalizeTravelersAnswer = (value) => {
    const text = value.toLowerCase();
    const countMatch = text.match(/\d+/);
    const count = countMatch ? parseInt(countMatch[0], 10) : null;

    if (count === 1 || text.includes("solo") || text.includes("me")) {
      return "1";
    }

    if (count === 2 || text.includes("couple") || text.includes("two")) {
      return "2 People";
    }

    if ((count && count >= 3 && count <= 5) || text.includes("family")) {
      return " 3-5 People";
    }

    return " 5-10 People";
  };

  const normalizePreferredLocation = (country, location) => {
    const combinedLocation = [location, country].filter(Boolean).join(", ");

    return {
      label: combinedLocation || location || country || "Your Destination",
      value: {
        name: location || country || "Your Destination",
        address: country || "",
        id: combinedLocation || location || country || "guided-location",
      },
    };
  };

  const moveToNextGuidedStep = (currentStep) => {
    const currentIndex = GUIDED_FLOW_STEPS.indexOf(currentStep);
    const nextStep = GUIDED_FLOW_STEPS[currentIndex + 1] || null;

    setGuidedFlowStep(nextStep);

    if (nextStep) {
      askGuidedStep(nextStep);
    }
  };

  const startGuidedFlow = async (message) => {
    const shouldStartFlow = /holiday|vacation|trip|travel|planning/i.test(message);

    if (!guidedFlowStep && shouldStartFlow) {
      setGuidedFlowStep("mood");
      await askGuidedStep("mood");
      return true;
    }

    if (!guidedFlowStep) {
      setGuidedFlowStep("mood");
      await askGuidedStep("mood");
      return true;
    }

    return false;
  };

  const handleGuidedAnswer = async (message) => {
    const normalizedMessage = message.trim();
    const step = guidedFlowStep;

    if (!step) {
      return;
    }

    if (step === "confirm") {
      const accepted = isAffirmative(normalizedMessage);

      if (!accepted) {
        appendAssistantMessage("No problem. You can change any answer and then say yes when you are ready.");
        return;
      }

      const resolvedLocation = guidedAnswers.location || pendingLocationSuggestion?.label;

      const generatedFormData = {
        mood: guidedAnswers.mood,
        country: guidedAnswers.country,
        preference: guidedAnswers.preference,
        traveler: normalizeTravelersAnswer(guidedAnswers.travelers || "1"),
        budget: normalizeBudgetAnswer(guidedAnswers.budget || "Moderate"),
        location: normalizePreferredLocation(guidedAnswers.country, resolvedLocation || guidedAnswers.location),
        no_of_days: guidedAnswers.days || "3",
      };

      setFormData((previousFormData) => ({
        ...previousFormData,
        ...generatedFormData,
      }));

      setLocationInput(generatedFormData.location.label);
      setPlace(generatedFormData.location);
      setPendingTripSelection(generatedFormData);
      setPendingLocationSuggestion(null);
      setOpenChatDialog(false);
      setChatMessages([CHAT_WELCOME_MESSAGE]);

      onGenerateTrip(false, generatedFormData);

      return;
    }

    if (step === "location" && pendingLocationSuggestion && isAffirmative(normalizedMessage)) {
      const acceptedLocation = pendingLocationSuggestion.label;
      const acceptedLocationObject = normalizePreferredLocation(guidedAnswers.country, acceptedLocation);

      const nextAnswers = {
        ...guidedAnswers,
        location: acceptedLocation,
      };

      setGuidedAnswers(nextAnswers);
      handleInputChange("location", acceptedLocationObject);
      setLocationInput(acceptedLocationObject.label);
      setPlace(acceptedLocationObject);
      setPendingLocationSuggestion(null);
      appendAssistantMessage(`Great, I'll use ${acceptedLocationObject.label}.`);
      moveToNextGuidedStep("location");
      return;
    }

    const updatedAnswers = {
      ...guidedAnswers,
      [step]: normalizedMessage,
    };

    let nextGuidedAnswers = { ...updatedAnswers };

    if (step === "budget") {
      nextGuidedAnswers.budget = normalizeBudgetAnswer(normalizedMessage);
      handleInputChange("budget", nextGuidedAnswers.budget);
    }

    if (step === "travelers") {
      nextGuidedAnswers.travelers = normalizedMessage;
      handleInputChange("traveler", normalizeTravelersAnswer(normalizedMessage));
    }

    if (step === "days") {
      const cleanedDays = normalizedMessage.replace(/\D/g, "") || normalizedMessage;
      nextGuidedAnswers.days = cleanedDays;
      handleInputChange("no_of_days", cleanedDays);
    }

    if (step === "country") {
      nextGuidedAnswers.country = normalizedMessage;
      handleInputChange("country", normalizedMessage);
    }

    if (step === "preference") {
      nextGuidedAnswers.preference = normalizedMessage;
      handleInputChange("preference", normalizedMessage);
    }

    if (step === "mood") {
      nextGuidedAnswers.mood = normalizedMessage;
      handleInputChange("mood", normalizedMessage);
    }

    if (step === "location") {
      const guidance = await requestGuidedAssistantResponse({
        step,
        message: normalizedMessage,
        answers: nextGuidedAnswers,
        currentQuestion: GUIDED_STEP_QUESTIONS.location,
      });

      const suggestedLocationLabel = guidance?.suggestedLocation?.label;

      if (suggestedLocationLabel && (!guidance.shouldAdvance || /suggest|not sure|don't know|dont know|unsure/i.test(normalizedMessage))) {
        const suggestedLocationObject = normalizePreferredLocation(
          guidance.suggestedLocation?.country || nextGuidedAnswers.country,
          suggestedLocationLabel
        );

        setPendingLocationSuggestion(suggestedLocationObject);
        setGuidedAnswers(nextGuidedAnswers);
        appendAssistantMessage(
          `${guidance.assistantReply || "I can suggest one."} Try ${suggestedLocationObject.label}. If you like it, say yes.`
        );
        return;
      }

      const locationObject = normalizePreferredLocation(nextGuidedAnswers.country, guidance.normalizedValue || normalizedMessage);
      nextGuidedAnswers.location = locationObject.label;
      handleInputChange("location", locationObject);
      setLocationInput(locationObject.label);
      setPlace(locationObject);
      setPendingLocationSuggestion(null);
      setGuidedAnswers(nextGuidedAnswers);
      appendAssistantMessage(guidance.assistantReply || `Perfect, I’ll use ${locationObject.label}.`);
      moveToNextGuidedStep(step);
      return;
    }

    setGuidedAnswers(nextGuidedAnswers);

    const guidance = await requestGuidedAssistantResponse({
      step,
      message: normalizedMessage,
      answers: nextGuidedAnswers,
      currentQuestion: GUIDED_STEP_QUESTIONS[step],
    });

    appendAssistantMessage(guidance.assistantReply || "Got it.");

    if (guidance.shouldAdvance !== false) {
      moveToNextGuidedStep(step);
    }
  };

  const handleSendChatMessage = async () => {
    const message = chatInput.trim();

    if (!message || isChatLoading) {
      return;
    }

    setChatMessages((previousMessages) => [...previousMessages, { role: "user", content: message }]);
    setChatInput("");

    if (guidedFlowStep) {
      await handleGuidedAnswer(message);
      return;
    }

    const started = await startGuidedFlow(message);

    if (!started) {
      setIsChatLoading(true);

      try {
        const response = await axios.post("/api/ai-plan", {
          messages: [
            { role: "system", content: CHAT_SYSTEM_PROMPT },
            ...chatMessages.filter((item) => item.role !== "system"),
            { role: "user", content: message },
          ],
        });

        const reply = response.data?.reply || "I couldn't generate a response just now. Please try again.";

        setChatMessages((previousMessages) => [
          ...previousMessages,
          { role: "assistant", content: reply },
        ]);
      } catch (error) {
        console.error("Error sending chat message to AI backend:", error);
        setChatMessages((previousMessages) => [
          ...previousMessages,
          {
            role: "assistant",
            content: "I couldn't connect to the AI backend right now. Please try again in a moment.",
          },
        ]);
      } finally {
        setIsChatLoading(false);
      }
    }
  };

  const renderChatMessage = (message) => {
    const lines = message.content
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (message.role === "user") {
      return <span className="whitespace-pre-wrap">{message.content}</span>;
    }

    const hasStructuredLines = lines.some((line) => /^\d+\.|^[-•]/.test(line));

    if (!hasStructuredLines) {
      return <span className="whitespace-pre-wrap">{message.content}</span>;
    }

    return (
      <div className="space-y-2">
        {lines.map((line, index) => {
          const cleanedLine = line.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '');
          return (
            <div key={`${line}-${index}`} className="flex gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
              <span>{cleanedLine}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderGuidedSummary = () => {
    if (!guidedAnswers || Object.keys(guidedAnswers).length === 0) {
      return null;
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-slate-900">Trip summary so far</h4>
        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
          {guidedAnswers.mood && <div><span className="font-medium text-slate-800">Mood:</span> {guidedAnswers.mood}</div>}
          {guidedAnswers.country && <div><span className="font-medium text-slate-800">Country:</span> {guidedAnswers.country}</div>}
          {guidedAnswers.preference && <div><span className="font-medium text-slate-800">Preference:</span> {guidedAnswers.preference}</div>}
          {guidedAnswers.travelers && <div><span className="font-medium text-slate-800">Persons:</span> {guidedAnswers.travelers}</div>}
          {guidedAnswers.budget && <div><span className="font-medium text-slate-800">Budget:</span> {guidedAnswers.budget}</div>}
          {guidedAnswers.location && <div><span className="font-medium text-slate-800">Location:</span> {guidedAnswers.location}</div>}
          {guidedAnswers.days && <div><span className="font-medium text-slate-800">Days:</span> {guidedAnswers.days}</div>}
        </div>
        {pendingLocationSuggestion && (
          <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Suggested location waiting for approval: {pendingLocationSuggestion.label}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    console.log(formData);
  }, [formData]);

  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      GetUserProfile(codeResponse);
      setOpenDialog(false);
    },
    onError: (error) => {
      console.log(error);
      toast.error("Failed to sign in with Google");
    },
  });

  const onGenerateTrip = async (isAfterLogin = false, selectionOverride = null) => {
    const tripSelection = selectionOverride || pendingTripSelection || formData;
    const currentUser = getCurrentUser();
    const uid = getUserId(currentUser);

    if (!isAfterLogin) {
      const user = localStorage.getItem('user');
      if (!user) {
        setPendingTripSelection(tripSelection);
        setOpenDialog(true);
        return;
      }
    }

    if (tripSelection?.no_of_days > 5) {
      toast.error("Please enter trip days less than 5 days");
      return;
    }

    if (!tripSelection?.no_of_days || !tripSelection?.location || !tripSelection?.budget || !tripSelection?.traveler) {
      toast.error("Please fill all the fields");
      return;
    }
    
    toast.success("Trip is Generating...");
    setIsLoading(true);
    
    try {
      const userMemory = await loadUserMemory(uid);
      const numDays = parseInt(tripSelection?.no_of_days) || 1;
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
          },
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
          },
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
        .replace("{location}", tripSelection?.location?.label)
        .replace("{totalDays}", tripSelection?.no_of_days)
        .replace("{traveler}", tripSelection?.traveler)
        .replace("{budget}", tripSelection?.budget)
        .replace("{total_days}", tripSelection?.no_of_days)
        .replace("{DAYS_STRUCTURE}", daysStructure)
        .concat(buildMemoryPrompt(userMemory));
      
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

        await SavedAiTrip(jsonString, tripSelection, parsedResponse, uid);
      } catch (parseError) {
        console.error("Error parsing AI response as JSON:", parseError);
        console.log("Non-JSON response:", responseText);

        const fallbackTrip = buildFallbackTrip(tripSelection);
        setGeneratedTrip(fallbackTrip);

        try {
          await SavedAiTrip(JSON.stringify(fallbackTrip), tripSelection, fallbackTrip, uid);
          toast.success("AI response invalid, generated a basic trip instead.");
        } catch (saveError) {
          console.error("Error saving fallback trip:", saveError);
          toast.error("AI failed and could not save basic trip. Please try again.");
        }
      }
      
    } catch (error) {
      console.error("Error generating trip:", error);

      const fallbackTrip = buildFallbackTrip(tripSelection);
      setGeneratedTrip(fallbackTrip);

      try {
        await SavedAiTrip(JSON.stringify(fallbackTrip), tripSelection, fallbackTrip, uid);
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
      const selectionToUse = pendingTripSelection || formData;
      setPendingTripSelection(null);
      onGenerateTrip(true, selectionToUse);
    } catch (error) {
      console.error('Error verifying Google login via backend:', error);
      toast.error('Failed to sign in with Google');
    }
  };
  
  const SavedAiTrip = async(tripData, selectionOverride = null, tripPlanOverride = null, uidOverride = null) => {
    try {
      setIsLoading(true);
      const user = JSON.parse(localStorage.getItem('user'));
      const docId = Date.now().toString();
      const selectionData = selectionOverride || pendingTripSelection || formData;
      const uid = uidOverride || getUserId(user);
      const tripPlan = tripPlanOverride || JSON.parse(tripData);
      const destination = toDisplayDestination(selectionData);
      const tripType = mapTripTypeFromTravelers(selectionData?.traveler);
      const budget = selectionData?.budget || 'Moderate';
      const days = parseInt(selectionData?.no_of_days) || 1;
      
      console.log("User data:", user);
      
      const userId = uid;
      
      // Add user details to the stored data
      await setDoc(doc(db, "AITrips", docId), {
        userSelection: selectionData,
        tripData: tripPlan,
        id: docId,
        userId: userId, // Use the correct userId field
        userEmail: user?.email || 'no-email',
        userName: user?.name || 'Anonymous',
        createdAt: new Date().toISOString(),
      });

      await saveTripToUserHistory(uid, {
        destination,
        tripType,
        budget,
        days,
        createdAt: new Date().toISOString(),
        tripData: tripPlan,
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

      <button
        type="button"
        onClick={openTravelChat}
        className="mt-6 w-full rounded-[1.4rem] border border-blue-200 bg-gradient-to-r from-blue-50 via-cyan-50 to-white px-5 py-4 text-left shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-3 text-sm font-semibold text-blue-700 animate-pulse">
              <span className="h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
              Don't know where to go? Click here to chat with AI
            </span>
            <span className="mt-2 block text-sm text-slate-700">
              Open a conversational assistant for destination ideas before you fill the form.
            </span>
          </div>
          <div className="hidden rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white md:block">
            Ask AI
          </div>
        </div>
      </button>

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

      <Dialog
        open={openChatDialog}
        onClose={() => setOpenChatDialog(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Guided Travel AI Chat</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <div className="flex h-[78vh] max-h-[760px] flex-col bg-slate-50">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-4 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">Travel assistant</p>
                  <h3 className="mt-1 text-xl font-semibold">Let's build your holiday step by step</h3>
                  <p className="mt-2 max-w-2xl text-sm text-slate-300">
                    Answer the questions and I will prepare the trip form for you.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Powered by</p>
                  <p className="text-sm font-semibold text-white">Groq conversational AI</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-3">
              {chatSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setChatInput(suggestion)}
                  className="rounded-full border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
              {renderGuidedSummary()}
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                      message.role === "user"
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    {renderChatMessage(message)}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                    Thinking about the best travel options...
                  </div>
                </div>
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="mb-3 text-xs text-slate-500">
                Tip: press Enter to send. The chat will guide you from mood to country, preferences, travelers, budget, location, days, and confirmation.
              </div>
              <div className="flex gap-3">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  placeholder="Tell me where you want to go..."
                  className="flex-1 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleSendChatMessage}
                  disabled={isChatLoading}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <button
            type="button"
            onClick={() => setOpenChatDialog(false)}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Close
          </button>
        </DialogActions>
      </Dialog>
      
      {generatedTrip && (
        <div className="mt-10 rounded-2xl border border-gray-300 bg-white p-6 shadow-md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="mb-2 text-2xl font-bold text-slate-900">Your Generated Trip</h2>
              <p className="text-sm text-green-600 font-medium">Trip saved to your account!</p>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {formData?.location?.label || "Trip ready"}
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <h3 className="text-lg font-semibold text-slate-900">Trip preview</h3>
            <p className="mt-2 text-slate-600">
              {generatedTrip.title || "Your Trip"}
            </p>
            <p className="mt-1 text-slate-600">
              {generatedTrip.description || `${formData?.no_of_days} days in ${formData?.location?.label}`}
            </p>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <div><span className="font-medium text-slate-800">Mood:</span> {formData?.mood || pendingTripSelection?.mood || "-"}</div>
              <div><span className="font-medium text-slate-800">Country:</span> {formData?.country || pendingTripSelection?.country || "-"}</div>
              <div><span className="font-medium text-slate-800">Preference:</span> {formData?.preference || pendingTripSelection?.preference || "-"}</div>
              <div><span className="font-medium text-slate-800">Budget:</span> {formData?.budget || pendingTripSelection?.budget || "-"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default CreateTrip;