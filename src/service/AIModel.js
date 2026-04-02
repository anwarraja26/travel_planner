export const createChatSession = () => {
  return [];
};

export const sendMessage = async (chatSession, message) => {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Add the new user message locally first
      chatSession.push({
        role: "user",
        content: message,
      });

      // Call backend API instead of hitting the model directly from the browser
      const response = await fetch("/api/ai-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: chatSession }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = errorBody.error || `Backend error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const reply = data.reply;

      chatSession.push({
        role: "assistant",
        content: reply,
      });

      return reply;
    } catch (error) {
      console.error(`Error sending message to AI backend (attempt ${retryCount + 1}):`, error);
      
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
