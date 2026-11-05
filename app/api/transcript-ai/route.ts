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

// Model fallback cascade: primary gemini-3.1-flash-lite, fallback to 2.5-flash-lite or 3.5-flash if needed
const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-2.5-flash"
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, fileData, mimeType, customApiKey } = body;

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

    if (!text && !fileData) {
      return NextResponse.json(
        { error: "No input provided. Please upload an image/PDF or paste transcript text." },
        { status: 400 }
      );
    }

    const systemInstruction = `You are an elite, highly accurate academic transcript parser and UC (University of California) admissions specialist.
Your task is to thoroughly analyze the provided transcript document or text, extract all course records, and classify their academic attributes and University of California A-G subject designations.

For each course found:
1. "courseName": Clean, standard academic course name (e.g., "AP Calculus BC", "AP Physics 1", "Honors English 10", "Spanish 2", "PE").
2. "originalName": The raw, unaltered course title exactly as shown on the transcript.
3. "score": Numeric percentage (0-100) as a string. If the transcript only displays letter grades, convert accurately:
   - A+ -> "98", A -> "95", A- -> "91"
   - B+ -> "88", B -> "85", B- -> "81"
   - C+ -> "78", C -> "75", C- -> "71"
   - D -> "65", F -> "50"
4. "letterGrade": The explicit or mapped letter grade ("A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F").
5. "credit": Credit hours, typically "1.0" for year-long / standard unit or "0.5" for semester unit. Default to "1.0" if unspecified.
6. "category": Best match among: ["Core Subjects", "Languages", "Arts", "Business & Technology", "Physical Education", "Other Electives", "Chinese Specific"].
7. "level": One of ["Regular", "Honors", "AP/IB", "Custom"]. Mark as "AP/IB" if it is an AP or IB course. Mark as "Honors" if marked as Honors or H.
8. "weightBoost": "1.0" for AP/IB, "0.5" for Honors, "0.0" for Regular.
9. "agCategory": University of California A–G subject designation:
   - "A": History / Social Science (US History, World History, European History, Civics, Government)
   - "B": English (English 9/10/11/12, AP Literature, AP Language, Creative Writing)
   - "C": Mathematics (Algebra I/II, Geometry, Pre-Calculus, AP Calculus AB/BC, AP Statistics)
   - "D": Science (Biology, Chemistry, Physics, Environmental Science)
   - "E": Language Other Than English (Spanish, Chinese, French, Japanese, German, Latin, etc.)
   - "F": Visual and Performing Arts (Studio Art, Music, Band, Orchestra, Choir, Theatre, Drama, Dance)
   - "G": College-Preparatory Elective (Economics, Psychology, Computer Science, Engineering, Journalism)
   - "Non-AG": Physical Education (PE), Health, Driver's Ed, Teacher Assistant, Study Hall, Advisory, Free Period
10. "termTitle": The specific term or semester if indicated (e.g. "Semester 1", "Fall 2024", "Grade 10 Semester 2").
11. "gradeLevel": Detected grade level: "9" | "10" | "11" | "12" | "Other".

You MUST output ONLY valid JSON matching this schema:
{
  "schoolName": string | null,
  "studentName": string | null,
  "terms": [
    {
      "termTitle": string,
      "gradeLevel": "9" | "10" | "11" | "12" | "Other",
      "courses": [
        {
          "courseName": string,
          "originalName": string,
          "score": string,
          "letterGrade": string,
          "credit": string,
          "category": string,
          "level": "Regular" | "Honors" | "AP/IB" | "Custom",
          "weightBoost": string,
          "agCategory": "A" | "B" | "C" | "D" | "E" | "F" | "G" | "Non-AG"
        }
      ]
    }
  ],
  "extractedCourses": [ ...flat list of all extracted courses... ]
}`;

    // Prepare contents
    const contents: any[] = [];
    if (fileData && mimeType) {
      contents.push({
        inlineData: {
          data: fileData,
          mimeType: mimeType
        }
      });
      contents.push({
        text: text ? `Additional transcript notes:\n${text}\n\nPlease extract all academic courses.` : "Please extract and structure all academic courses from this transcript file."
      });
    } else {
      contents.push({
        text: `Here is the transcript text:\n\n${text}\n\nPlease extract and structure all academic courses.`
      });
    }

    let responseText = "";
    let usedModel = "";
    let lastError: any = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await client.models.generateContent({
          model,
          contents,
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
      throw lastError || new Error("Failed to receive response from Gemini models.");
    }

    // Clean markdown code blocks if present
    let cleaned = responseText.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/```$/, "").trim();
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/```$/, "").trim();
    }

    const parsedJson = JSON.parse(cleaned);

    // Ensure extractedCourses list is always populated
    if (!parsedJson.extractedCourses || parsedJson.extractedCourses.length === 0) {
      const flatList: any[] = [];
      if (Array.isArray(parsedJson.terms)) {
        parsedJson.terms.forEach((t: any) => {
          if (Array.isArray(t.courses)) {
            t.courses.forEach((c: any) => {
              flatList.push({
                ...c,
                termTitle: t.termTitle,
                gradeLevel: t.gradeLevel
              });
            });
          }
        });
      }
      parsedJson.extractedCourses = flatList;
    }

    return NextResponse.json({
      success: true,
      modelUsed: usedModel,
      data: parsedJson
    });

  } catch (error: any) {
    console.error("Error in transcript-ai route:", error);
    return NextResponse.json(
      {
        error: "AI Transcript Extraction Failed",
        message: error?.message || "An unexpected error occurred while processing transcript."
      },
      { status: 500 }
    );
  }
}
