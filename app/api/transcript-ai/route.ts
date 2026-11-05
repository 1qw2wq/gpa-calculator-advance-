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

// Model fallback cascade: primary gemini-3.5-flash-lite as requested by user
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

    const systemInstruction = `You are an elite academic transcript parser and University of California (UC) articulation specialist.
Analyze the provided transcript document, image, or text with extreme precision.

CRITICAL REQUIREMENT - DETECT ALL SEMESTERS / TERMS ACROSS MULTIPLE YEARS:
1. High school transcripts ALWAYS span multiple semesters/terms across academic years (e.g. Grade 9 Fall, Grade 9 Spring, Grade 10 Fall, Grade 10 Spring, Grade 11 Fall, Grade 11 Spring, Grade 12 Fall, Grade 12 Spring; or Semester 1, Semester 2; or S1/S2; or Fall 2022, Spring 2023, etc.).
2. You MUST identify and extract EVERY distinct semester, term, quarter, or academic grading period.
3. DO NOT lump courses from multiple semesters into a single term! Each semester must be its own distinct entry in the "terms" array in chronological order.
4. IMPORTANT - HANDLING COLUMNAR / MULTI-TERM TRANSCRIPTS:
   - Many transcripts list courses with columns for multiple terms on one row (e.g., Course Name | Sem 1 / S1 Grade | Sem 2 / S2 Grade).
   - If a course has separate S1 and S2 grades, you MUST split them into two entries: place the Semester 1 grade under the Semester 1 term (with its semester credit), and the Semester 2 grade under the Semester 2 term (with its semester credit).
   - NEVER drop Semester 2 or merge them into one semester!
5. CRITICAL - EXTRACT EXACT COURSE CREDITS / UNITS:
   - Transcripts almost always feature a column for credits or units (labeled: "Credit", "Credits", "Cred", "CR", "Att", "Earn", "Units", "Hrs", "Weight", "Attempted", "Earned", "Sem Credit").
   - You MUST inspect the document for this column and extract the EXACT numeric credit value printed for each course!
   - Many high school transcripts award 0.5 credits (or 5.0 credits) per semester. Colleges award 3.0 or 4.0 credits.
   - For example: if the transcript shows "0.5" or ".50", set "credit": "0.5". If it shows "5.0" or "5", set "credit": "5.0". If it shows "0.25", set "credit": "0.25". If it shows "3.0" or "4.0", set "credit": "3.0" or "4.0".
   - If both Attempted and Earned columns exist, use Earned credits (or Attempted if in-progress).
   - DO NOT default courses to "1.0" if the transcript displays credit values! Only use "1.0" as a fallback if credit is completely absent from the document.
6. For each semester in "terms":
   - "termTitle": Distinct descriptive name, e.g. "Grade 9 - Fall 2022" or "Grade 9 Semester 1" or "Grade 10 Semester 1" or "Fall 2023"
   - "gradeLevel": "9" | "10" | "11" | "12" | "Other" (determine based on school year or sequence: year 1 = 9, year 2 = 10, year 3 = 11, year 4 = 12)
   - "courses": Array of all courses taken specifically during that semester.

For each course:
1. "courseName": Clean, official academic course name (e.g., "AP Calculus BC", "AP Physics 1", "Honors English 10", "Spanish 2", "PE").
2. "originalName": The raw, unaltered course title exactly as shown on the transcript.
3. "score": Numeric percentage (0-100) as a string. If the transcript only displays letter grades, convert accurately:
   - A+ -> "98", A -> "95", A- -> "91"
   - B+ -> "88", B -> "85", B- -> "81"
   - C+ -> "78", C -> "75", C- -> "71"
   - D -> "65", F -> "50"
   - If 1-7 IB scale: 7 -> "98", 6 -> "93", 5 -> "85", 4 -> "75", 3 -> "65", 2 -> "50"
4. "letterGrade": The explicit or mapped letter grade ("A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F").
5. "credit": The EXACT numeric credit hours/units printed on the transcript (e.g. "0.5", "5.0", "0.25", "3.0", "1.0"). Extract the actual number printed. DO NOT default to "1.0" when credits are specified!
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
  ]
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
        text: text
          ? `Additional transcript notes:\n${text}\n\nPlease extract all academic courses across all semesters. Be sure to extract the exact credit/unit hours printed on the transcript for each course (do not default to 1.0 if credits such as 0.5, 5.0, 3.0, etc. are listed).`
          : "Please extract and structure all academic courses from this transcript file across all semesters. Be sure to extract the exact credit/unit hours printed on the transcript for each course (do not default to 1.0 if credits such as 0.5, 5.0, 3.0, etc. are listed)."
      });
    } else {
      contents.push({
        text: `Here is the transcript text:\n\n${text}\n\nPlease extract and structure all academic courses across all semesters. Be sure to extract the exact credit/unit hours printed on the transcript for each course (do not default to 1.0 if credits such as 0.5, 5.0, 3.0, etc. are listed).`
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

    let rootObj: any = parsedJson;
    if (Array.isArray(parsedJson)) {
      if (parsedJson.length > 0 && (parsedJson[0].courses || parsedJson[0].termTitle)) {
        rootObj = { terms: parsedJson };
      } else {
        rootObj = { extractedCourses: parsedJson };
      }
    }

    // Normalize terms structure
    let terms = rootObj.terms || rootObj.semesters || [];

    // Fallback: If terms is missing or empty, group extractedCourses by termTitle or gradeLevel
    if (!Array.isArray(terms) || terms.length === 0) {
      const rawList = rootObj.extractedCourses || rootObj.courses || [];
      if (Array.isArray(rawList) && rawList.length > 0) {
        const termMap: Record<string, any> = {};
        rawList.forEach((c: any) => {
          const rawCredit = c.credit ?? c.credits ?? c.creditEarned ?? c.earnedCredit ?? c.creditAttempted ?? c.attemptedCredit ?? c.units ?? c.unit ?? c.hrs ?? c.hours ?? c.cr ?? c.weight;
          if (rawCredit !== undefined && rawCredit !== null && String(rawCredit).trim() !== "") {
            c.credit = String(rawCredit).trim();
          } else {
            c.credit = "1.0";
          }
          const tTitle = c.termTitle || c.semester || c.term || "Semester 1";
          if (!termMap[tTitle]) {
            termMap[tTitle] = {
              termTitle: tTitle,
              gradeLevel: c.gradeLevel || "10",
              courses: []
            };
          }
          termMap[tTitle].courses.push(c);
        });
        terms = Object.values(termMap);
      }
    }

    // Ensure every course inside every term carries its termTitle and gradeLevel, and normalized credit
    const flatList: any[] = [];
    terms.forEach((t: any, termIdx: number) => {
      if (!t.termTitle) {
        t.termTitle = `Semester ${termIdx + 1}`;
      }
      if (!t.gradeLevel) {
        t.gradeLevel = termIdx < 2 ? "9" : termIdx < 4 ? "10" : termIdx < 6 ? "11" : "12";
      }
      if (Array.isArray(t.courses)) {
        t.courses.forEach((c: any) => {
          const rawCredit = c.credit ?? c.credits ?? c.creditEarned ?? c.earnedCredit ?? c.creditAttempted ?? c.attemptedCredit ?? c.units ?? c.unit ?? c.hrs ?? c.hours ?? c.cr ?? c.weight;
          if (rawCredit !== undefined && rawCredit !== null && String(rawCredit).trim() !== "") {
            c.credit = String(rawCredit).trim();
          } else {
            c.credit = "1.0";
          }
          c.termTitle = t.termTitle;
          c.gradeLevel = t.gradeLevel;
          flatList.push(c);
        });
      }
    });

    rootObj.terms = terms;
    rootObj.extractedCourses = flatList;

    return NextResponse.json({
      success: true,
      modelUsed: usedModel,
      data: rootObj
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
