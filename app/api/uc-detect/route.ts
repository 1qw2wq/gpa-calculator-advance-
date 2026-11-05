import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please add it to your environment secrets or provide your API key in settings.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash"
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courses, customApiKey } = body;

    if (!Array.isArray(courses) || courses.length === 0) {
      return NextResponse.json(
        { error: "No courses provided for UC auto-detection." },
        { status: 400 }
      );
    }

    const apiKeyHeader = req.headers.get("x-gemini-api-key") || customApiKey;
    let client: GoogleGenAI;
    try {
      client = getGeminiClient(apiKeyHeader || undefined);
    } catch (err: any) {
      return NextResponse.json(
        {
          error: "API Key Required",
          message: err.message || "GEMINI_API_KEY not configured"
        },
        { status: 401 }
      );
    }

    const systemInstruction = `You are the University of California (UC) High School Articulation and A-G Course Evaluation Authority.
Evaluate each course name and determine:
1. "agCategory":
   - "A": History / Social Science (US History, World History, European History, Government, Civics, World Geography)
   - "B": English (English 9/10/11/12, AP Lit, AP Lang, Creative Writing, Journalism)
   - "C": Mathematics (Algebra I, Geometry, Algebra II, Precalculus, AP Calculus AB/BC, AP Statistics, Discrete Math)
   - "D": Science (Biology, Chemistry, Physics, AP Environmental Science, Anatomy)
   - "E": Language Other Than English (LOTE) (Spanish, Chinese, French, Japanese, Latin, German, Korean, Sign Language)
   - "F": Visual and Performing Arts (VPA) (Studio Art, Digital Art, Painting, Band, Choir, Orchestra, Music Theory, Drama, Dance)
   - "G": College-Preparatory Elective (Economics, Psychology, Sociology, Computer Science, Coding, Engineering, Business, Finance, Philosophy)
   - "Non-AG": Physical Education (PE), Health, Wellness, Advisory, Homeroom, Study Hall, Teacher Aide
2. "level":
   - "AP/IB": If course is Advanced Placement or International Baccalaureate
   - "Honors": If course is designated Honors (H)
   - "Regular": Standard college-prep level
3. "explanation": Brief 1-sentence rationale.

Return valid JSON:
{
  "classifications": [
    {
      "id": string,
      "courseName": string,
      "agCategory": "A" | "B" | "C" | "D" | "E" | "F" | "G" | "Non-AG",
      "level": "Regular" | "Honors" | "AP/IB",
      "weightBoost": "0.0" | "0.5" | "1.0",
      "explanation": string
    }
  ]
}`;

    const promptText = `Please classify the following academic courses for University of California (UC) admissions:\n\n${JSON.stringify(courses, null, 2)}`;

    let responseText = "";
    let usedModel = "";
    let lastError: any = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: promptText,
          config: {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });
        if (response.text) {
          responseText = response.text;
          usedModel = model;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} attempt failed:`, err?.message || err);
      }
    }

    if (!responseText) {
      throw lastError || new Error("Failed to classify courses with Gemini models.");
    }

    let cleaned = responseText.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "").trim();
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/```$/, "").trim();
    }

    const parsedJson = JSON.parse(cleaned);

    return NextResponse.json({
      success: true,
      modelUsed: usedModel,
      data: parsedJson
    });

  } catch (error: any) {
    console.error("Error in uc-detect route:", error);
    return NextResponse.json(
      {
        error: "UC Course Classification Failed",
        message: error?.message || "An unexpected error occurred while classifying courses."
      },
      { status: 500 }
    );
  }
}
