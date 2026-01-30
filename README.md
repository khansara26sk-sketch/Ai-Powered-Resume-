# AI Resume Feedback

Get an **ATS-style score**, **recommended skills**, **actionable suggestions**, and an **improved resume** based on your resume text, target job role, and experience level.

## Output (JSON)

The API returns:

```json
{
  "score": 78,
  "skills": "JavaScript, React, REST APIs, Git, Problem Solving",
  "suggestions": ["Suggestion 1", "Suggestion 2", ...],
  "improvedResume": "Full improved resume text..."
}
```

## Run the app (single command)

**1. Open the project folder** (use your real path; this is an example):

```cmd
cd "c:\Users\HP\OneDrive\Desktop\coding\HTML\Ai Powered Resume Feedback"
```

**2. Start the app:**

```cmd
npm start
```

Or to only run the server (same as start): `npm run dev`

This installs backend dependencies if needed and starts the server. Open the URL shown in the terminal (e.g. **http://localhost:3000**) in your browser. If port 3000 is in use, the server will try 3001, 3002, etc. — use the URL it prints. Paste your resume, set **Target Job Role** and **Experience Level**, then click **Analyze & Improve Resume**.

**If you see "address already in use"** — something else is using the port. To free port 3000 on Windows, run in a new terminal:
```cmd
netstat -ano | findstr :3000
```
Note the PID (last column), then:
```cmd
taskkill /PID <PID> /F
```
Replace `<PID>` with the number from the previous command.

## AI analysis

The app uses **Google Gemini** if `GOOGLE_API_KEY` is set in the `.env` file in the project root. Without it, the backend uses rule-based scoring and suggestions.
