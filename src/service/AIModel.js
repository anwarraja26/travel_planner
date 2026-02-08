import Groq from "groq-sdk";

// Initialize Groq client
const groq = new Groq({
  apiKey: "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", // use .env
  dangerouslyAllowBrowser: true,
});

// Create chat session (manual history)
export const createChatSession = () => {
  return [];
};

export const sendMessage = async (chatSession, message) => {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Add user message to history
      chatSession.push({
        role: "user",
        content: message,
      });

      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: chatSession,
        temperature: 0.7,
        max_tokens: 800, // Reduced from 1024 to avoid rate limits
      });

      const reply = completion.choices[0].message.content;

      // Save assistant reply
      chatSession.push({
        role: "assistant",
        content: reply,
      });

      return reply;
    } catch (error) {
      console.error(`Error sending message to Groq (attempt ${retryCount + 1}):`, error);
      
      // Check if it's a rate limit error
      if (error.error?.type === 'rate_limit_exceeded' || error.status === 429) {
        retryCount++;
        
        if (retryCount >= maxRetries) {
          throw new Error('Rate limit exceeded. Please wait a few minutes and try again.');
        }
        
        // Extract wait time from error message or use exponential backoff
        const waitTime = error.error?.message?.match(/(\d+\.?\d*)s/) 
          ? parseFloat(error.error.message.match(/(\d+\.?\d*)s/)[1]) * 1000
          : Math.pow(2, retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
        
        console.log(`Rate limit hit. Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        // For non-rate-limit errors, don't retry
        throw error;
      }
    }
  }
  
  throw new Error('Failed to generate trip after multiple attempts.');
};
