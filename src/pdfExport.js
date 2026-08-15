const loadJsPDF = () => new Promise((resolve, reject) => {
  if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  script.onload = () => resolve(window.jspdf.jsPDF);
  script.onerror = reject;
  document.head.appendChild(script);
});

const exportToPDF = async (plan) => {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const GREEN = [27, 122, 77]; // --accent
  const GREEN_DEEP = [20, 92, 58]; // --accent-deep
  const DARK = [22, 35, 28]; // --ink
  const GRAY = [110, 117, 104]; // --muted
  const LIGHT_GREEN_BG = [234, 245, 238]; // --accent-bg
  const PAPER = [248, 247, 242]; // --paper
  const WARM_BG = [251, 243, 228]; // --warm-bg
  const WARM_TEXT = [122, 90, 30]; // --warm-text
  const COOL_BG = [234, 242, 251]; // --cool-bg
  const COOL_TEXT = [30, 76, 122]; // --cool-text
  const pageW = 210;
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 20;

  const checkPage = (needed = 10) => {
    if (y + needed > 275) { doc.addPage(); y = 20; }
  };

  const addText = (text, x, fontSize, color, fontStyle = "normal", maxWidth = null) => {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.setFont("helvetica", fontStyle);
    if (maxWidth) {
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return lines.length * (fontSize * 0.45);
    } else {
      doc.text(text, x, y);
      return fontSize * 0.45;
    }
  };

  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont("times", "bold");
  doc.text("FitPlan AI", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Your Personalized Fitness AI · fitplan-lake.vercel.app", margin, 20);
  y = 38;

  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.setFont("times", "bold");
  const titleLines = doc.splitTextToSize(plan.title, contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 2;

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(plan.summary, contentW);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 4.5 + 4;

  const pillW = contentW / 2 - 2;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const scheduleLines = doc.splitTextToSize(`Schedule: ${plan.schedule?.join(", ")}`, pillW - 6);
  const durationLines = doc.splitTextToSize(`Duration: ${plan.weeks} weeks`, pillW - 6);
  const pillH = Math.max(scheduleLines.length, durationLines.length) * 4 + 4;

  doc.setFillColor(...LIGHT_GREEN_BG);
  doc.roundedRect(margin, y, pillW, pillH, 2, 2, "F");
  doc.setTextColor(...GREEN_DEEP);
  doc.text(scheduleLines, margin + 3, y + 5);
  doc.setFillColor(...COOL_BG);
  doc.roundedRect(margin + contentW / 2 + 2, y, pillW, pillH, 2, 2, "F");
  doc.setTextColor(...COOL_TEXT);
  doc.text(durationLines, margin + contentW / 2 + 5, y + 5);
  y += pillH + 6;

  if (plan.weeks_breakdown) {
    checkPage(20);
    doc.setFillColor(...PAPER);
    doc.roundedRect(margin, y, contentW, plan.weeks_breakdown.length * 9 + 10, 3, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "bold");
    doc.text("PROGRAM PHASES", margin + 4, y + 6);
    y += 10;
    plan.weeks_breakdown.forEach((p, i) => {
      doc.setFillColor(...GREEN);
      doc.circle(margin + 7, y + 2.5, 3, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(String(i + 1), margin + 7, y + 2.5, { align: "center", baseline: "middle" });
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(p.phase, margin + 13, y + 3);
      doc.setTextColor(...GRAY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      const focusLines = doc.splitTextToSize(p.focus, contentW - 20);
      doc.text(focusLines, margin + 13, y + 7);
      y += focusLines.length * 4 + 6;
    });
    y += 4;
  }

  plan.workouts?.forEach(w => {
    checkPage(40);

    doc.setFillColor(...GREEN);
    doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont("times", "bold");
    doc.text(`${w.day.toUpperCase()} · ${w.name}`, margin + 4, y + 7);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(w.duration, pageW - margin - doc.getTextWidth(w.duration) - 4, y + 7);
    y += 13;

    checkPage(10);
    doc.setFillColor(...WARM_BG);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const warmupTextLines = doc.splitTextToSize(w.warmup, contentW - 24);
    doc.roundedRect(margin, y, contentW, warmupTextLines.length * 4.5 + 6, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(...WARM_TEXT);
    doc.setFont("helvetica", "bold");
    doc.text("WARM-UP", margin + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(warmupTextLines, margin + 20, y + 5);
    y += warmupTextLines.length * 4.5 + 8;

    w.exercises?.forEach((ex, i) => {
      checkPage(12);
      doc.setFillColor(...(i % 2 === 0 ? PAPER : [255, 255, 255]));
      const noteLines = ex.note ? doc.splitTextToSize(ex.note, contentW - 40) : [];
      const rowH = 10 + (noteLines.length > 0 ? noteLines.length * 3.5 + 2 : 0) + (ex.effort ? 3.5 : 0);
      doc.roundedRect(margin, y, contentW, rowH, 1.5, 1.5, "F");

      doc.setFillColor(228, 227, 218);
      doc.circle(margin + 6, y + 5, 4, "F");
      doc.setFontSize(7);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.text(String(i + 1), margin + 6, y + 5, { align: "center", baseline: "middle" });

      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.text(ex.name, margin + 13, y + 5.5);

      if (ex.note) {
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        doc.setFont("helvetica", "normal");
        doc.text(noteLines, margin + 13, y + 9.5);
      }

      doc.setFontSize(8.5);
      doc.setTextColor(...GREEN);
      doc.setFont("helvetica", "bold");
      const setsText = `${ex.sets}×${ex.reps}`;
      doc.text(setsText, pageW - margin - 4, y + 5.5, { align: "right" });
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.setFont("helvetica", "normal");
      doc.text(`${ex.rest} rest`, pageW - margin - 4, y + 9.5, { align: "right" });
      if (ex.effort) {
        doc.text(ex.effort, pageW - margin - 4, y + 13, { align: "right" });
      }

      y += rowH + 1.5;
    });

    checkPage(10);
    doc.setFillColor(...LIGHT_GREEN_BG);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const cooldownLines = doc.splitTextToSize(w.cooldown, contentW - 24);
    doc.roundedRect(margin, y, contentW, cooldownLines.length * 4.5 + 6, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GREEN_DEEP);
    doc.setFont("helvetica", "bold");
    doc.text("COOL-DOWN", margin + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(cooldownLines, margin + 22, y + 5);
    y += cooldownLines.length * 4.5 + 10;
  });

  if (plan.nutrition_tips) {
    checkPage(30);
    doc.setFillColor(...PAPER);
    doc.roundedRect(margin, y, contentW, plan.nutrition_tips.length * 8 + 12, 3, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "bold");
    doc.text("NUTRITION TIPS", margin + 4, y + 7);
    y += 11;
    plan.nutrition_tips.forEach(tip => {
      doc.setFillColor(...GREEN);
      doc.circle(margin + 7, y + 2, 1.5, "F");
      doc.setFontSize(8);
      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "normal");
      const tipLines = doc.splitTextToSize(tip, contentW - 16);
      doc.text(tipLines, margin + 11, y + 3);
      y += tipLines.length * 4.5 + 2;
    });
    y += 6;
  }

  if (plan.motivation_strategy) {
    checkPage(20);
    doc.setFillColor(...LIGHT_GREEN_BG);
    const motLines = doc.splitTextToSize(plan.motivation_strategy, contentW - 8);
    doc.roundedRect(margin, y, contentW, motLines.length * 4.5 + 12, 3, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(...GREEN_DEEP);
    doc.setFont("helvetica", "bold");
    doc.text("MOTIVATION STRATEGY", margin + 4, y + 6);
    doc.setFontSize(8);
    doc.setTextColor(...GREEN_DEEP);
    doc.setFont("helvetica", "normal");
    doc.text(motLines, margin + 4, y + 11);
    y += motLines.length * 4.5 + 16;
  }

  if (plan.weekly_checkin) {
    checkPage(20);
    doc.setFillColor(...COOL_BG);
    const checkLines = doc.splitTextToSize(plan.weekly_checkin, contentW - 8);
    doc.roundedRect(margin, y, contentW, checkLines.length * 4.5 + 12, 3, 3, "F");
    doc.setFontSize(7);
    doc.setTextColor(...COOL_TEXT);
    doc.setFont("helvetica", "bold");
    doc.text("WEEKLY CHECK-IN", margin + 4, y + 6);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(checkLines, margin + 4, y + 11);
    y += checkLines.length * 4.5 + 16;
  }

  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.text("Generated by FitPlan AI · Adjust intensity to your level · Consult a doctor before starting any new fitness program", margin, 287);

  doc.save(`${plan.title.replace(/[^a-z0-9]/gi, "_")}.pdf`);
};

export { loadJsPDF, exportToPDF };
