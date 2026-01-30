/**
 * AI Resume Feedback API
 * Accepts resumeText, jobRole, experience and returns ATS score, skills, suggestions, improvedResume.
 * Uses Google Gemini API (GOOGLE_API_KEY in .env) for AI analysis; fallback to rule-based.
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;
const PROJECT_ROOT = path.join(__dirname, "..");

/**
 * Rule-based ATS-style scoring and suggestions when no AI key is set.
 */
function analyzeResumeMock(resumeText, jobRole, experience) {
  const text = (resumeText || "").trim().toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  let score = 50;
  if (wordCount >= 300) score += 15;
  else if (wordCount >= 200) score += 10;
  else if (wordCount >= 100) score += 5;
  if (text.includes("experience") || text.includes("work")) score += 5;
  if (text.includes("skill") || text.includes("technical")) score += 5;
  if (text.includes("education")) score += 5;
  if (/\d+%|\d+\s*(years?|yrs?)/.test(text)) score += 10; // quantified achievements
  if (text.includes("project") || text.includes("achievement")) score += 5;
  score = Math.min(100, Math.max(0, score));

  const commonSkillsByRole = {
    "frontend developer": "JavaScript, React, HTML5, CSS3, REST APIs, Git, Responsive Design",
    "backend developer": "Node.js, Python, SQL, REST APIs, Git, System Design",
    "full stack": "JavaScript, React, Node.js, SQL, REST APIs, Git, AWS",
    "data scientist": "Python, SQL, Machine Learning, Statistics, Data Visualization",
    "software engineer": "Programming, Data Structures, Git, Problem Solving, Agile",
  };
  const roleKey = Object.keys(commonSkillsByRole).find((k) =>
    (jobRole || "").toLowerCase().includes(k)
  );
  const skills =
    commonSkillsByRole[roleKey] ||
    "Relevant technical skills, Problem Solving, Communication, Teamwork";

  const suggestions = [
    "Use strong action verbs (e.g., Led, Developed, Implemented) instead of generic phrases.",
    "Quantify achievements with numbers and percentages where possible.",
    "Tailor bullet points to match keywords from the target job description.",
    "Keep sections clear: Summary, Experience, Skills, Education, Projects.",
    "Remove unnecessary personal details and keep the resume to 1–2 pages.",
  ].slice(0, 5);

  const improvedResume = buildImprovedResume(resumeText, jobRole, experience);

  return {
    score: Math.round(score),
    skills,
    suggestions,
    improvedResume,
  };
}

function buildImprovedResume(resumeText, jobRole, experience) {
  const role = jobRole || "Professional";
  const exp = experience || "Fresher";
  const lines = (resumeText || "")
    .trim()
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const hasSummary = /summary|objective|profile/i.test(resumeText);
  const hasSkills = /skill|technical|expertise/i.test(resumeText);
  const hasExperience = /experience|work|employment/i.test(resumeText);
  const hasEducation = /education|degree|university|college/i.test(resumeText);

  const out = [];
  out.push(`${role.toUpperCase()}`);
  out.push(`Experience Level: ${exp}`);
  out.push("");

  if (!hasSummary && lines.length > 0) {
    out.push("PROFESSIONAL SUMMARY");
    out.push(
      `Results-oriented ${role} with ${exp.toLowerCase()} experience. ${lines[0].replace(/^[•\-\*]\s*/, "")}`
    );
    out.push("");
  }

  if (!hasSkills) {
    out.push("SKILLS");
    out.push("Relevant technical and soft skills (tailor to job description).");
    out.push("");
  }

  if (!hasExperience) {
    out.push("EXPERIENCE");
    out.push("• List roles with dates, company, and bullet achievements.");
    out.push("");
  }

  if (!hasEducation) {
    out.push("EDUCATION");
    out.push("Degree, Institution, Year.");
    out.push("");
  }

  out.push("--- Content from your resume (cleaned) ---");
  out.push("");
  out.push(lines.join("\n"));

  return out.join("\n");
}

const GEMINI_MODEL = "gemini-1.5-flash";

/**
 * Call Google Gemini API to analyze resume and return the required JSON.
 */
async function analyzeResumeWithGemini(resumeText, jobRole, experience) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are an ATS (Applicant Tracking System) resume reviewer and improver.

Target job role: ${jobRole || "Not specified"}
Experience level: ${experience || "Not specified"}

Analyze the following resume and return your response ONLY as a valid JSON object with exactly these keys (no markdown, no code block, no extra text):
- "score": number from 0 to 100 (ATS-style score)
- "skills": string of comma-separated missing or recommended skills for the target job
- "suggestions": array of 3 to 5 short actionable suggestion strings
- "improvedResume": string containing the full improved resume text (plain text, clear sections)

Resume to analyze:

${(resumeText || "").slice(0, 28000)}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini error:", res.status, err);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const raw = jsonMatch ? jsonMatch[0] : text;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Gemini request failed:", e.message);
    return null;
  }
}

app.post("/analyze", async (req, res) => {
  try {
    const { resumeText, jobRole, experience } = req.body || {};

    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({
        error: "resumeText is required",
      });
    }

    const aiResult = await analyzeResumeWithGemini(resumeText, jobRole, experience);

    const result = aiResult || analyzeResumeMock(resumeText, jobRole, experience);

    if (typeof result.score !== "number") result.score = Number(result.score) || 0;
    if (typeof result.skills !== "string") result.skills = String(result.skills || "");
    if (!Array.isArray(result.suggestions)) result.suggestions = [];
    if (typeof result.improvedResume !== "string") result.improvedResume = String(result.improvedResume || "");

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));

// Serve frontend (index.html, script.js, style.css)
app.use(express.static(PROJECT_ROOT));

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`AI Resume Feedback running at http://localhost:${server.address().port}`);
      const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      console.log(key ? "Using Google Gemini API for analysis." : "No GOOGLE_API_KEY — using rule-based analysis.");
      resolve(server);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") reject(err);
      else reject(err);
    });
  });
}

(async () => {
  for (let p = PORT; p < PORT + 5; p++) {
    try {
      await startServer(p);
      break;
    } catch (err) {
      if (err.code === "EADDRINUSE" && p < PORT + 4) {
        console.log(`Port ${p} in use, trying ${p + 1}...`);
      } else {
        console.error("Could not start server. Free a port first.");
        console.error("Windows: netstat -ano | findstr :3000  then  taskkill /PID <PID> /F");
        process.exit(1);
      }
    }
  }
})();
