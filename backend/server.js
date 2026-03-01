/**
 * AI Resume Feedback API
 * Supports:
 * - Resume Text
 * - Resume Image
 * - Resume PDF
 * (NO Login System)
 */

const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;
const PROJECT_ROOT = path.join(__dirname, "..");

/* ============================= */
/*         MULTER SETUP          */
/* ============================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/* ============================= */
/*        GEMINI SETUP           */
/* ============================= */

if (!process.env.GOOGLE_API_KEY) {
  console.error("❌ GOOGLE_API_KEY missing in .env file");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 4096,
  },
});

/* ============================= */
/*   ANALYZE TEXT WITH GEMINI    */
/* ============================= */

async function analyzeResumeWithGemini(resumeText, jobRole, experience) {
  const prompt = `
You are a professional ATS Resume Reviewer.

Return ONLY valid JSON in this format:
{
  "score": number,
  "skills": string,
  "suggestions": string[],
  "improvedResume": string
}

Target Job Role: ${jobRole || "Not specified"}
Experience Level: ${experience || "Not specified"}

Resume:
${resumeText}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  const cleanText = text.replace(/```json|```/g, "").trim();
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("⚠ Gemini Raw Output:", cleanText);
    throw new Error("Invalid JSON returned from Gemini");
  }

  return JSON.parse(jsonMatch[0]);
}

/* ============================= */
/*      TEXT RESUME ROUTE        */
/* ============================= */

app.post("/analyze-resume", async (req, res) => {
  try {
    const { resumeText, jobRole, experience } = req.body;

    if (!resumeText) {
      return res.status(400).json({ error: "resumeText is required" });
    }

    const result = await analyzeResumeWithGemini(
      resumeText,
      jobRole,
      experience
    );

    res.json(result);

  } catch (err) {
    console.error("❌ Text Analysis Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ============================= */
/*   IMAGE / PDF RESUME ROUTE    */
/* ============================= */

app.post("/analyze-resume-file", upload.single("resumeFile"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    const { jobRole, experience } = req.body;
    const fileType = req.file.mimetype;
    let extractedText = "";

    // -------- PDF --------
    if (fileType === "application/pdf") {
      const pdfData = await pdfParse(req.file.buffer);
      extractedText = pdfData.text;
    }

    // -------- IMAGE --------
    else if (fileType.startsWith("image/")) {
      const base64Image = req.file.buffer.toString("base64");

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: fileType,
            data: base64Image,
          },
        },
        {
          text: "Extract all resume text clearly. Return only plain text."
        }
      ]);

      const response = await result.response;
      extractedText = response.text();
    }

    else {
      return res.status(400).json({
        error: "Only PDF or Image files are supported",
      });
    }

    if (!extractedText || extractedText.length < 20) {
      throw new Error("Could not extract resume content");
    }

    const analysis = await analyzeResumeWithGemini(
      extractedText,
      jobRole,
      experience
    );

    res.json(analysis);

  } catch (err) {
    console.error("❌ File Analysis Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ============================= */

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(express.static(PROJECT_ROOT));

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});