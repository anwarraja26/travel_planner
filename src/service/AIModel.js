import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Google Generative AI with your API key
const apiKey = "AIzaSyB6Pxff2cK1722IoVDopPwOBDwl1FLXgFE";
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

// Create a chat session function that can be exported and used in other components
export const createChatSession = () => {
  return model.startChat({
    generationConfig,
    history: [],
  });
};

// Function to send a message to the model
export const sendMessage = async (chatSession, message) => {
  try {
    const result = await chatSession.sendMessage(message);
    return result.response.text();
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    throw error;
  }
};