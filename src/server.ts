import app from "./app";

// PORT is hardcoded with a fallback for now.
// Proper env variable validation (Zod) is set up in the next task.
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Nexora API server running on port ${PORT}`);
});