class AIEngine {
    constructor() {
        this.apiKey = "AIzaSyAhIMV274Nv0hsL8xX8tCCf67l4nrRZ4sU";
        this.modelName = "gemini-2.0-flash";
        this.apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    }

    async processText(action, text) {
        if (!text || text.trim() === '') {
            throw new Error("No text identified in your selection.");
        }

        // Setup dynamic prompts based on requested action
        let systemInstruction = "You are a highly capable text processing assistant.";
        let userPrompt = `Here is the source text to process:\n\n${text}\n\n`;

        switch (action) {
            case "summarize":
                systemInstruction = "You are an expert summarizer. Provide a concise, clear summary of the provided text.";
                userPrompt += "Please summarize the text succinctly.";
                break;
            case "key_points":
                systemInstruction = "You are an expert analyst. Extract the main key points from the text.";
                userPrompt += "Extract the key points from this text, formatted as a clear, concise bulleted list.";
                break;
            case "blog":
                systemInstruction = "You are a professional content writer and blogger.";
                userPrompt += "Transform the core concepts of this text into a well-structured, engaging blog post draft. Give it a catchy title.";
                break;
            case "linkedin":
                systemInstruction = "You are a professional marketing thought leader on LinkedIn.";
                userPrompt += "Rewrite the main ideas of this text into an engaging, professional LinkedIn post. Use an energetic tone, appropriate spacing, and relevant hashtags.";
                break;
            case "tweet":
                systemInstruction = "You are an expert social media manager specializing in Twitter.";
                userPrompt += "Convert the main concepts from this text into a compelling, engaging Tweet thread. Number the tweets sequentially (e.g. 🧵 1/3).";
                break;
            default:
                systemInstruction = "You are a helpful text formatting assistant.";
                userPrompt += `Perform the action requested: ${action}`;
        }

        const requestBody = {
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            contents: [{
                parts: [{ text: userPrompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1500,
            }
        };

        try {
            const response = await fetch(this.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.error?.message || response.statusText;
                throw new Error(errMsg);
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts?.length > 0) {
                return data.candidates[0].content.parts[0].text.trim();
            } else {
                throw new Error("Received an empty response from Gemini API.");
            }

        } catch (error) {
            console.error("AI Engine Error:", error);
            throw new Error(`${error.message}`);
        }
    }
}

// Expose singleton to the system
window.AI = new AIEngine();
