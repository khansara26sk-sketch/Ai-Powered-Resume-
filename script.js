/**
 * AI Resume Feedback — frontend
 * Sends resumeText, jobRole, experience to backend and displays JSON result.
 */

// Same origin when served by backend
const API_BASE = "";

const imageInput = document.getElementById("resumeImage");
const previewBox = document.getElementById("imagePreview");
const previewImg = document.getElementById("previewImg");
const analyzeBtn = document.getElementById("analyzeBtn");
const resumeTextarea = document.getElementById("resumeText");

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    previewImg.src = reader.result;
    previewBox.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

analyzeBtn.addEventListener("click", async () => {
  const resumeText = resumeTextarea?.value?.trim() || "";
  const jobRole = document.getElementById("jobRole")?.value?.trim() || "";
  const experience =
    document.getElementById("experience")?.value?.trim() || "Fresher";

  if (!resumeText) {
    alert("Please paste your resume text in the text area.");
    resumeTextarea?.focus();
    return;
  }

  const outputEl = document.getElementById("output");
  const scoreEl = document.getElementById("score");
  const skillsEl = document.getElementById("skills");
  const suggestionsList = document.getElementById("suggestions");
  const improvedResumeEl = document.getElementById("improvedResume");

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing…";

  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText,
        jobRole,
        experience,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.error || `Request failed (${res.status})`;
      alert(msg);
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "Analyze & Improve Resume";
      return;
    }

    // Expected JSON: { score, skills, suggestions, improvedResume }
    const score = typeof data.score === "number" ? data.score : Number(data.score) || 0;
    const skills = typeof data.skills === "string" ? data.skills : (data.skills || []).join(", ");
    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    const improvedResume = typeof data.improvedResume === "string" ? data.improvedResume : String(data.improvedResume || "");

    scoreEl.textContent = `${score} / 100`;
    skillsEl.textContent = skills || "—";

    suggestionsList.innerHTML = "";
    suggestions.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      suggestionsList.appendChild(li);
    });

    // Show improved resume as plain text with line breaks
    improvedResumeEl.innerHTML = improvedResume
      .split("\n")
      .map((line) => {
        const t = escapeHtml(line);
        return line.trim().toUpperCase() === line.trim() && line.trim().length < 50
          ? `<strong>${t}</strong>`
          : t;
      })
      .join("<br>");

    outputEl.classList.remove("hidden");
    outputEl.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    alert(
      "Could not reach the server. Run npm start from the project root and open http://localhost:3000"
    );
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze & Improve Resume";
  }
});

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
