const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://ai-powered-resume-backend-f3o3.onrender.com";

/* ============================= */
/*      FILE PREVIEW LOGIC      */
/* ============================= */

const fileInput = document.getElementById("resumeImage");
const previewBox = document.getElementById("imagePreview");
const previewImg = document.getElementById("previewImg");
const fileNameDisplay = document.getElementById("fileName");
const analyzeBtn = document.getElementById("analyzeBtn");
const downloadBtn = document.getElementById("downloadBtn");

fileInput.addEventListener("change", () => {

  const file = fileInput.files[0];

  if (!file) {
    previewBox.classList.add("hidden");
    fileNameDisplay.classList.add("hidden");
    return;
  }

  fileNameDisplay.classList.remove("hidden");

  if (file.type.startsWith("image/")) {

    fileNameDisplay.textContent = "🖼 Image Uploaded: " + file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      previewBox.classList.remove("hidden");
    };

    reader.readAsDataURL(file);

  } else if (file.type.includes("pdf")) {

    previewBox.classList.add("hidden");
    fileNameDisplay.textContent = "📄 PDF Uploaded: " + file.name;

  } else {
    previewBox.classList.add("hidden");
    fileNameDisplay.textContent = "Unsupported file type";
  }

});


/* ============================= */
/*       ANALYZE BUTTON          */
/* ============================= */

analyzeBtn.addEventListener("click", async () => {

  const resumeText = document.getElementById("resumeText").value.trim();
  const resumeFile = document.getElementById("resumeImage").files[0];
  const jobRole = document.getElementById("jobRole").value.trim();
  const experience = document.getElementById("experience").value;

  const statusMessage = document.getElementById("statusMessage");
  const outputSection = document.getElementById("output");

  if (!resumeText && !resumeFile) {
    alert("Please paste resume text OR upload PDF/Image.");
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  statusMessage.textContent = "🤖 Calling Gemini AI... Please wait...";
  statusMessage.style.color = "#555";

  try {

    let response;

    if (resumeText) {

      response = await fetch(`${API_BASE}/analyze-resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobRole,
          experience
        })
      });

    } else {

      const formData = new FormData();
      formData.append("resumeFile", resumeFile);
      formData.append("jobRole", jobRole);
      formData.append("experience", experience);

      response = await fetch(`${API_BASE}/analyze-resume-file`, {
        method: "POST",
        body: formData
      });
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Analysis failed");
    }

    document.getElementById("score").textContent =
      data.score ? data.score + " / 100" : "N/A";

    document.getElementById("skills").textContent =
      data.skills || "None";

    const suggestionsList = document.getElementById("suggestions");
    suggestionsList.innerHTML = "";

    if (Array.isArray(data.suggestions)) {
      data.suggestions.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        suggestionsList.appendChild(li);
      });
    }

    document.getElementById("improvedResume").innerHTML =
      data.improvedResume
        ? data.improvedResume.replace(/\n/g, "<br>")
        : "No improved version provided.";

    outputSection.classList.remove("hidden");
    outputSection.scrollIntoView({ behavior: "smooth" });

    downloadBtn.classList.remove("hidden");

    statusMessage.textContent = "✅ Gemini analysis complete!";
    statusMessage.style.color = "green";

  } catch (error) {

    console.error("Error:", error);
    statusMessage.textContent =
      "❌ Error analyzing resume. Make sure backend is running.";
    statusMessage.style.color = "red";

  } finally {

    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze & Improve Resume";

  }

});


/* ============================= */
/*   CLEAN PROFESSIONAL PDF     */
/* ============================= */

downloadBtn.addEventListener("click", () => {

  const resumeContent = document.getElementById("improvedResume").innerText;

  if (!resumeContent.trim()) {
    alert("No improved resume available to download.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const usableWidth = pageWidth - margin * 2;

  // Start slightly below top for clean margin
  let yPosition = 25;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  const lines = doc.splitTextToSize(resumeContent, usableWidth);

  lines.forEach(line => {

    if (yPosition > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }

    doc.text(line, margin, yPosition);
    yPosition += 7;

  });

  // Footer (optional – remove if you don't want it)
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    "Generated by AI Resume Feedback",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  doc.save("Improved_Resume.pdf");

});