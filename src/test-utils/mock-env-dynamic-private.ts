export const env = {
  GOOGLE_GENERATIVE_AI_API_KEY:
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || "TEST_KEY",
  GROQ_API_KEY:
    process.env.GROQ_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    "TEST_KEY",
};
