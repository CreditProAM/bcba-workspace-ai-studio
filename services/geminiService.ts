/**
 * BCBA Workspace -- single Gemini service boundary.
 *
 * Consolidated from three separate, incompatible AI implementations found across
 * the seven audited prototype projects (see BCBA_PROJECT_AUDIT.md section 9,
 * "Collision Report: geminiService.ts"):
 *   - aba_tool_genie:            many single-purpose `generate*` functions, no schema
 *                                 enforcement, no fallback on failure.
 *   - bcba-clinical-dashboard:    function-calling / tool-use agent pattern
 *                                 (Sidekick can actually mutate app state), partial
 *                                 schema use, no fallback.
 *   - aba-clinical-decision-support-toolkit: the strongest pattern -- schema-constrained
 *                                 JSON, a PII/PHI sanitizer run before every prompt,
 *                                 and an always-available static fallback per prompt.
 *
 * This file is the ONE place the app talks to Gemini. Every export below follows
 * (or is being migrated toward) the same three principles, adopted from whichever
 * source project did them best:
 *   1. Ground output in data the clinician actually entered -- never invent facts.
 *      Prompts are built strictly from function arguments (client/session/event
 *      data already in local state), not from any external or assumed context.
 *   2. Prefer schema-constrained JSON (responseSchema) over free text when the
 *      caller needs structured data back.
 *   3. Fail usefully. Two fallback styles are used depending on what the caller
 *      needs: functions that have a good default (a static template, an empty
 *      string, a friendly placeholder) return it directly on error; functions
 *      with no safe default (e.g. suggestRescheduling) throw, and the calling
 *      component decides the UI response (see App.tsx's handleSmartResolve).
 *
 * PII sanitization (sanitizePromptInput) is applied to the Toolkit's free-text
 * prompts, where the input is a generic scenario description. It is deliberately
 * NOT applied to chatWithSidekick's message: the Sidekick's whole job is to match
 * real client names to real client IDs and take real scheduling actions, so
 * redacting names there would break the feature rather than protect anything.
 */

import { GoogleGenAI, Chat, FunctionDeclaration, Type } from "@google/genai";
import { CalendarEvent, Client, SessionNote } from "../types";
import { PromptTemplate, ToolkitSessionContext, StructuredPromptOutput, TOOLKIT_DISCLAIMER } from "../components/toolkit/toolkitTypes";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// ---------------------------------------------------------------------------
// Sidekick -- function-calling agent (Today tab)
// Pattern adopted from bcba-clinical-dashboard: the model can call real tools
// (addClinicalEvent) that mutate app state, not just generate text.
// ---------------------------------------------------------------------------

// Define the tool for adding events
const addEventTool: FunctionDeclaration = {
  name: "addClinicalEvent",
  description: "Schedules a clinical session, supervision, or assessment for a client.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Title (e.g., 'RBT Supervision', 'VB-MAPP Assessment')" },
      startDateTime: { type: Type.STRING, description: "ISO 8601 string for start" },
      endDateTime: { type: Type.STRING, description: "ISO 8601 string for end" },
      clientId: { type: Type.STRING, description: "The ID of the client (lowercase first name usually)" },
      serviceType: { type: Type.STRING, description: "Type of service: 'Direct 1:1', 'RBT Supervision', 'Parent Training', 'Assessment'" },
      location: { type: Type.STRING, description: "Clinic, Home, School, or Telehealth" }
    },
    required: ["title", "startDateTime", "endDateTime", "clientId"]
  }
};

export const chatWithSidekick = async (
  history: any[],
  message: string,
  events: CalendarEvent[],
  clients: Client[]
): Promise<any> => {
  const modelId = "gemini-2.5-flash";

  // 1. Prepare Context
  const scheduleContext = events.map(e => {
    const client = clients.find(c => c.id === e.clientId)?.name || 'Unknown';
    let details = `- ${e.start.toLocaleString()} - ${e.end.toLocaleTimeString()}: ${e.title} (${e.serviceType}) for ${client} at ${e.location}`;
    
    // Add checklist context if subtasks exist
    if (e.subTasks && e.subTasks.length > 0) {
      const taskList = e.subTasks.map(t => `  [${t.completed ? 'x' : ' '}] ${t.title}`).join('\n');
      details += `\n  Session Checklist:\n${taskList}`;
    }
    
    return details;
  }).join('\n');

  const clientList = clients.map(c => `${c.name} (ID: ${c.id})`).join(', ');

  const systemPrompt = `
    You are an expert Clinical AI Assistant for a Board Certified Behavior Analyst (BCBA).
    Your goal is to help the BCBA manage their caseload, schedule supervision hours, and track assessments.
    
    CURRENT TIME: ${new Date().toLocaleString()}
    
    ACTIVE CASELOAD:
    ${clientList}

    EXISTING SCHEDULE:
    ${scheduleContext}

    ROLES & RESPONSIBILITIES:
    - You understand ABA terminology (BIP, FBA, VB-MAPP, RBT Supervision, ABC Data).
    - You can see the 'Session Checklist' for events. If a user asks about preparation or tasks, refer to these items.
    - If asked to schedule something, use the 'addClinicalEvent' tool.
    - Ensure 5% supervision requirements are met if asked about RBT supervision.
    - Be professional, concise, and clinically accurate.

    INSTRUCTIONS:
    1. If the user says "Schedule supervision for Liam on Friday at 2pm", use the tool.
    2. If the user asks "What do I need to prepare for Noah?", check the checklist items for Noah's events.
    3. If the user asks "Who do I see today?", summarize the schedule.
  `;

  // 2. Call the API
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        ...history, 
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: [addEventTool] }],
      }
    });

    return response;

  } catch (error) {
    console.error("Sidekick Error:", error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Client Summary (Data tab)
// Schema-constrained JSON with a safe fallback object on failure.
// ---------------------------------------------------------------------------

export interface ClientSummary {
  achievements: string[];
  areasForFocus: string[];
}

export const generateClientSummary = async (client: Client, events: CalendarEvent[]): Promise<ClientSummary> => {
  const modelId = "gemini-2.5-flash";

  // Filter only past events for this client
  const now = new Date();
  const pastEvents = events
    .filter(e => e.clientId === client.id && e.end < now)
    .sort((a, b) => b.start.getTime() - a.start.getTime())
    .slice(0, 10); // Analyze last 10 sessions

  const historyContext = pastEvents.map(e => {
    let context = `Date: ${e.start.toLocaleDateString()}, Type: ${e.serviceType}, Title: "${e.title}"`;
    if (e.description) context += `, Notes: "${e.description}"`;
    if (e.subTasks && e.subTasks.length > 0) {
      const completed = e.subTasks.filter(t => t.completed).map(t => t.title).join(", ");
      const incomplete = e.subTasks.filter(t => !t.completed).map(t => t.title).join(", ");
      if (completed) context += `, Completed Tasks: [${completed}]`;
      if (incomplete) context += `, Incomplete/Focus Tasks: [${incomplete}]`;
    }
    return context;
  }).join("\n");

  const prompt = `
    Analyze the recent clinical session history for client ${client.name} (Diagnosis: ${client.diagnosis || 'Unspecified'}).
    Based strictly on the session logs provided below, identify:
    1. Key Achievements: Progress made, completed assessments, or successful sessions.
    2. Areas for Focus: Incomplete tasks, recurring issues, or supervision needs.

    SESSION LOGS:
    ${historyContext || "No recent session data available."}

    Return the result as a JSON object with two arrays: 'achievements' and 'areasForFocus'.
    Keep bullets concise (under 10 words). Limit to 3 items per category.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
            areasForFocus: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as ClientSummary;

  } catch (error) {
    console.error("Summary Generation Error:", error);
    return {
      achievements: ["Unable to generate summary."],
      areasForFocus: ["Please check connection."]
    };
  }
};

// ---------------------------------------------------------------------------
// Session Narrative (Notes tab)
// Adapted from aba_tool_genie. Grounded strictly in the note's own fields;
// returns '' on failure so the UI can prompt the clinician to write it manually
// rather than show a broken/fabricated narrative.
// ---------------------------------------------------------------------------

/**
 * Generates a professional session narrative strictly from the clinician's own
 * raw notes + the structured data already entered for this session (goals, prompt
 * levels, observed behaviors). No facts are invented -- the model is instructed to
 * synthesize only what was provided, and the UI (DataCollection.tsx) always keeps
 * this editable and requires clinician review before it's treated as final.
 * Adapted from aba_tool_genie/services/geminiService.ts: CPT code / workspace /
 * multi-user author lookups were removed (billing + multi-tenant concerns are out
 * of scope here).
 */
export const generateSessionNarrative = async (
  note: Partial<SessionNote>,
  client: Client,
  authorName: string,
): Promise<string> => {
  const goalLines = (note.goalsAddressed || [])
    .map(goal => `- ${goal} (Prompt Level: ${note.promptLevels?.[goal] || 'N/A'})`)
    .join('\n');

  const behaviorLines = (note.observedBehaviors || [])
    .map(b => {
      const target = client.targetBehaviors?.find(t => t.id === b.behaviorId);
      return `- ${target?.name || b.behaviorId}: Frequency ${b.frequency}, Duration ${b.duration}m, Intensity ${b.intensity || 'n/a'}`;
    })
    .join('\n');

  const prompt = `
    You are an expert BCBA writing an objective, professional, third-person session narrative.
    Use ONLY the information given below. Do not invent client history, diagnoses, or outcomes
    that are not stated. If information is missing, write around it rather than guessing.

    Client: ${client.name}${client.diagnosis ? ` (${client.diagnosis})` : ''}
    Session Date: ${note.date}
    Provider: ${authorName}
    Interventions Used: ${(note.interventions || []).join(', ') || 'None recorded'}
    Environmental Factors: ${note.environmentalFactors || 'None recorded'}

    Goals Addressed (Goal: Prompt Level):
    ${goalLines || 'None recorded'}

    Observed Behaviors (Behavior: Frequency/Duration/Intensity):
    ${behaviorLines || 'None recorded'}

    Therapist's Raw Notes:
    ---
    ${note.rawNotes || '(none provided)'}
    ---

    Write one cohesive, measurable, behavioral paragraph combining the raw notes and the
    quantitative data above. This draft will be reviewed and edited by the clinician before
    it becomes part of the client's record.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = response.text;
    if (!text) throw new Error('Empty response');
    return text.trim();
  } catch (error) {
    console.error('Narrative generation error:', error);
    // Graceful, honest fallback -- never silently fabricate a narrative.
    return '';
  }
};

// ---------------------------------------------------------------------------
// Scheduling assist (Today tab)
// No safe default exists for "a good new time slot", so this throws on failure
// and the caller (App.tsx handleSmartResolve) shows a toast rather than silently
// picking an arbitrary time.
// ---------------------------------------------------------------------------

export const suggestRescheduling = async (
  conflictEvent: CalendarEvent, 
  allEvents: CalendarEvent[]
): Promise<{ newStart: string; newEnd: string; reasoning: string }> => {
  const modelId = "gemini-2.5-flash";

  // Context: List of busy slots for the same day (or adjacent days)
  const busySlots = allEvents
    .filter(e => e.id !== conflictEvent.id)
    .map(e => `Busy: ${e.start.toLocaleString()} to ${e.end.toLocaleTimeString()}`)
    .join("\n");

  const prompt = `
    I have a scheduling conflict for an event.
    Event: "${conflictEvent.title}" (${conflictEvent.serviceType})
    Current Time: ${conflictEvent.start.toLocaleString()} - ${conflictEvent.end.toLocaleTimeString()}
    Duration: ${(conflictEvent.end.getTime() - conflictEvent.start.getTime()) / 60000} minutes.

    EXISTING SCHEDULE:
    ${busySlots}

    TASK:
    Find the best available time slot for this event on the SAME DAY if possible, or the next day.
    Avoid overlaps.
    
    Return JSON:
    {
      "newStart": "ISO 8601 string",
      "newEnd": "ISO 8601 string",
      "reasoning": "Short explanation (e.g. 'Moved to 2 PM to avoid overlap with Team Meeting')"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            newStart: { type: Type.STRING },
            newEnd: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          }
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("No suggestion generated");
    return JSON.parse(text);

  } catch (error) {
    console.error("Reschedule Error:", error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Toolkit (clinical decision-support prompt library)
// Ported from aba-clinical-decision-support-toolkit/services/geminiService.ts.
// This is the strongest AI pattern found across the seven audited prototypes:
// schema-constrained JSON output, a basic PII sanitizer run on every prompt
// before it leaves the browser, and an always-available static fallback per
// template so the Toolkit still works if the API key is missing or the call
// fails. Every other AI function in this file should eventually follow this
// same shape -- see the file-level note near the top for the consolidated
// service boundary.
// ---------------------------------------------------------------------------

const toolkitResponseSchema = {
  type: Type.OBJECT,
  properties: {
    meta: {
      type: Type.OBJECT,
      properties: {
        scenarioId: { type: Type.STRING, description: "The ID of the prompt template used." },
        generatedAt: { type: Type.NUMBER, description: "Timestamp of generation (Date.now())." },
        density: { type: Type.STRING, enum: ['twenty'], description: "Must be 'twenty'." },
      },
      required: ['scenarioId', 'generatedAt', 'density'],
    },
    summary: { type: Type.STRING, description: "A very concise summary, maximum 3 lines or 240 characters." },
    immediateSteps: { type: Type.ARRAY, description: "1 to 3 actionable, imperative-verb steps.", items: { type: Type.STRING } },
    parentScript: { type: Type.STRING, description: "Optional. A script for parents, maximum 5 sentences, person-first language." },
    documentationTemplate: { type: Type.STRING, description: "Optional. A copy-ready documentation template, maximum 8 lines." },
    risksWatchouts: { type: Type.ARRAY, description: "Optional. Maximum 3 brief risks or things to watch out for.", items: { type: Type.STRING } },
    relatedScenarios: { type: Type.ARRAY, description: "Optional. Related scenario IDs from the prompt library.", items: { type: Type.STRING } },
    resources: { type: Type.ARRAY, description: "Optional. Relevant resource labels (not URLs).", items: { type: Type.STRING } },
  },
  required: ['meta', 'summary', 'immediateSteps'],
};

/** Best-effort PII/PHI scrub applied to every Toolkit prompt before it is sent. */
export const sanitizePromptInput = (text: string): string => {
  let sanitized = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email redacted]');
  sanitized = sanitized.replace(/\b\d{5,}\b/g, '[number redacted]');
  return sanitized;
};

const injectPromptTemplate = (template: PromptTemplate): string => `
  ${template.prompt}

  ---
  Response Instructions: Your response MUST be in the specified JSON format and adhere to
  "20% Mode" constraints for clinical decision support -- the 20% of information that drives
  80% of the value for a busy clinician.
  - 'summary' must be highly concise (under 240 characters).
  - 'immediateSteps' must contain 1 to 3 short, actionable steps starting with an imperative verb.
  - 'parentScript', if included, must be brief (under 5 sentences) and use person-first language.
  - 'documentationTemplate', if included, must be a copy-ready text block (under 8 lines).
  - 'risksWatchouts', if included, must be 3 or fewer brief points.
  - For 'meta', use "${template.id}" for scenarioId, the current timestamp for generatedAt, and "twenty" for density.
  - Your entire response will be parsed as JSON. Do not include any text outside of the JSON structure.
`;

const addToolkitDisclaimer = (text: string): string => `${text}\n\n---\n*${TOOLKIT_DISCLAIMER}*`;

/**
 * Generates a Toolkit response for a selected prompt template, or falls back to the
 * template's static (non-AI) answer if the API key is missing or the call fails.
 * Never leaves the clinician with a blank screen.
 */
export const generateToolkitResponse = async (
  template: PromptTemplate,
  _context: ToolkitSessionContext,
): Promise<StructuredPromptOutput | string> => {
  const fullPrompt = sanitizePromptInput(injectPromptTemplate(template));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: toolkitResponseSchema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from API");
    return JSON.parse(text) as StructuredPromptOutput;

  } catch (error) {
    console.error("Toolkit generation error:", error);
    return addToolkitDisclaimer(template.staticFallback);
  }
};

/** Starts (or continues) a grounded follow-up chat about a specific Toolkit response. */
export const createToolkitFollowUpChat = (template: PromptTemplate, initialResponseText: string): Chat => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    history: [
      { role: 'user', parts: [{ text: template.prompt }] },
      { role: 'model', parts: [{ text: initialResponseText }] },
    ],
    config: {
      systemInstruction: "You are a helpful clinical assistant for an Applied Behavior Analysis (ABA) professional. Your follow-up answers should be concise, helpful, and directly address the user's question, maintaining the professional and supportive tone of the initial response. Do not add disclaimers to follow-up answers.",
    },
  });
};