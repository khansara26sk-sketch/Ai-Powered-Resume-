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
  limits: { fileSize: 10 * 1024 * 1024 },
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
/*       HELPER FUNCTIONS        */
/* ============================= */

function extractJsonFromText(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Empty response from Gemini");
  }

  let cleanText = text.trim();

  // Remove markdown code fences
  cleanText = cleanText.replace(/```json/gi, "").replace(/```/g, "").trim();

  // Try direct JSON parse first
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // continue to fallback
  }

  // Try extracting the first JSON object
  const start = cleanText.indexOf("{");
  const end = cleanText.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    console.error("⚠ Gemini Raw Output:", cleanText);
    throw new Error("Invalid JSON returned from Gemini");
  }

  const possibleJson = cleanText.slice(start, end + 1);

  try {
    return JSON.parse(possibleJson);
  } catch (e) {
    console.error("⚠ Gemini Raw Output:", cleanText);
    throw new Error("Invalid JSON returned from Gemini");
  }
}

function normalizeAnalysis(data) {
  return {
    score: typeof data.score === "number" ? data.score : 0,
    missingSkills: Array.isArray(data.missingSkills)
      ? data.missingSkills
      : typeof data.skills === "string"
      ? data.skills.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    improvedResume:
      typeof data.improvedResume === "string" ? data.improvedResume : "",
  };
}

/* ============================= */
/*   ANALYZE TEXT WITH GEMINI    */
/* ============================= */

async function analyzeResumeWithGemini(resumeText, jobRole, experience) {
  const prompt = `
You are a professional ATS Resume Reviewer.

Analyze the resume and return ONLY valid JSON.
Do not add any explanation.
Do not add markdown.
Do not use \`\`\`.

Return exactly in this format:
{
  "score": 85,
  "missingSkills": ["skill1", "skill2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "improvedResume": "full improved resume text here"
}

Rules:
- "score" must be a number from 0 to 100
- "missingSkills" must be an array of strings
- "suggestions" must be an array of strings
- "improvedResume" must be a single string
- Return only one JSON object

Target Job Role: ${jobRole || "Not specified"}
Experience Level: ${experience || "Not specified"}

Resume:
${resumeText}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  console.log("✅ Raw Gemini Response:\n", text);

  const parsed = extractJsonFromText(text);
  return normalizeAnalysis(parsed);
}

/* ============================= */
/*      TEXT RESUME ROUTE        */
/* ============================= */

app.post("/analyze-resume", async (req, res) => {
  try {
    const { resumeText, jobRole, experience } = req.body;

    if (!resumeText || !resumeText.trim()) {
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
          text: "Extract all text from this resume image clearly. Return only plain text.",
        },
      ]);

      const response = await result.response;
      extractedText = response.text();
    }

    else {
      return res.status(400).json({
        error: "Only PDF or Image files are supported",
      });
    }

    if (!extractedText || extractedText.trim().length < 20) {
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
/*          HEALTH ROUTE         */
/* ============================= */

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(express.static(PROJECT_ROOT));

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});