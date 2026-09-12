// Netlify serverless function — keeps the Claude API key server-side.
// Requires environment variable ANTHROPIC_API_KEY (set in Netlify:
// Project configuration → Environment variables).

const SYSTEM_PROMPT = `You are the personal AI assistant on the portfolio website of Mohammed Sultan Alqahtani.

STRICT RULES:
- ONLY answer questions about Mohammed using the knowledge base below.
- Reply in the SAME language the visitor writes in (Arabic or English).
- Keep answers short (2-4 sentences), friendly, and professional.
- NEVER invent information not in the knowledge base. If you don't know, say so and suggest contacting Mohammed directly at 4mohammed.alqahtani@gmail.com.
- Politely DECLINE anything unrelated to Mohammed (coding help, recipes, general knowledge, personal questions about the visitor) and redirect the conversation to Mohammed's studies, projects, or skills.

KNOWLEDGE BASE:
Mohammed Sultan Alqahtani is a Computer Science student at Imam Mohammad Ibn Saud Islamic University in Riyadh, Saudi Arabia, expected to graduate in 2027. He specializes in Artificial Intelligence and Machine Learning.

Training: He completed two intensive bootcamps at Tuwaiq Academy — the Large Language Models (LLM) Bootcamp and the Electronic Circuit Design & Manufacturing Bootcamp.

Projects:
The portfolio sends you the current project cards from the website on each request. Use that project context as the source of truth for projects. Explain projects naturally using their title, type, description, and listed technologies/tags. If a visitor asks about a project that is not present in the supplied project context, say you do not have enough information rather than inventing details.

Skills: OpenAI API integration, prompt engineering, model fine-tuning, AI-assisted development, data analysis, predictive modeling, FlutterFlow and low-code development, PCB design and electronic circuit troubleshooting, Microsoft Office.

Languages: Arabic (native), English (working proficiency).

Contact: email 4mohammed.alqahtani@gmail.com — phone +966 54 480 2261 — LinkedIn: linkedin.com/in/4mohammed-alqahtani — Location: Riyadh, Saudi Arabia.`;

exports.handler = async (event) => {
  const headers = { "Content-Type": "application/json" };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing ANTHROPIC_API_KEY environment variable" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const message = (payload.message || "").toString().slice(0, 1000).trim();
  if (!message) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Empty message" }) };
  }

  // The portfolio sends its current project cards so the assistant stays in sync
  // when projects are added or edited in index.html.
  const projectContext = Array.isArray(payload.projects)
    ? payload.projects
        .slice(0, 20)
        .filter(p => p && typeof p.title === "string")
        .map(p => ({
          title: p.title.slice(0, 160),
          type: typeof p.type === "string" ? p.type.slice(0, 160) : "",
          description: typeof p.description === "string" ? p.description.slice(0, 700) : "",
          technologies: Array.isArray(p.technologies) ? p.technologies.slice(0, 12).map(String).map(x => x.slice(0, 80)) : []
        }))
    : [];

  const dynamicSystemPrompt = `${SYSTEM_PROMPT}

CURRENT PROJECTS FROM THE PORTFOLIO:
${JSON.stringify(projectContext, null, 2)}

Use these current project cards when answering questions about Mohammed's projects. Do not claim a project has a feature, technology, result, or link unless it appears in this project context or the fixed knowledge base above.`;

  // Rebuild conversation history in Anthropic Messages API format (last few turns only)
  const history = Array.isArray(payload.history) ? payload.history.slice(-10) : [];
  const messages = history
    .filter(m => m && (m.role === "user" || m.role === "model") && typeof m.text === "string")
    .map(m => ({ role: m.role === "model" ? "assistant" : "user", content: m.text.slice(0, 1000) }));
  messages.push({ role: "user", content: message });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system: dynamicSystemPrompt,
        messages
      })
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Claude API error:", res.status, detail);
      return { statusCode: 502, headers, body: JSON.stringify({ error: "Upstream AI error" }) };
    }

    const data = await res.json();
    const reply = (data?.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text || "")
      .join("")
      .trim();

    if (!reply) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: "Empty AI reply" }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server error" }) };
  }
};
