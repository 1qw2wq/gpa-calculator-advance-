import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Fallback checking to prevent startup crash if API key is not yet set
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment secrets.");
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

export async function POST(req: NextRequest) {
  try {
    const { terms, cumulativeGpa, totalCredits } = await req.json();

    let client: GoogleGenAI;
    try {
      client = getGeminiClient();
    } catch (keyError: any) {
      return NextResponse.json(
        { 
          error: "API Key Config Required", 
          text: "### Oh, Hello!\n\nI am your AI Academic Mentor. To let me analyze your grades and local memories, please click on the **Secrets panel** in AI Studio and add your `GEMINI_API_KEY` environment variable. Once set, I can review your course trends and give you custom study advice!"
        },
        { status: 200 } // Return 200 so frontend can display the friendly secret configuration prompt
      );
    }

    // Build a rich, structured context of the user's local memories
    let profileDescription = `Academic Profile Summary:\n`;
    profileDescription += `- Cumulative GPA: ${cumulativeGpa}\n`;
    profileDescription += `- Total Credit Hours: ${totalCredits}\n\n`;
    profileDescription += `Semester breakdown:\n`;

    terms.forEach((term: any, idx: number) => {
      profileDescription += `Semester: ${term.title || `Semester ${idx + 1}`}\n`;
      if (term.reflection) {
        profileDescription += `  - Shared Reflections: "${term.reflection}"\n`;
      }
      if (term.bullets && term.bullets.length > 0) {
        profileDescription += `  - Saved Memories/Milestones:\n`;
        term.bullets.forEach((b: string) => {
          profileDescription += `    * ${b}\n`;
        });
      }
      profileDescription += `  - Courses:\n`;
      term.courses.forEach((course: any) => {
        profileDescription += `    * ${course.courseName || "Unnamed Course"} (${course.category || "General"}), Score: ${course.score || "N/A"}%, Credits: ${course.credit || 0}\n`;
      });
      profileDescription += `\n`;
    });

    const systemInstruction = `You are an elite academic mentor and advisor. Your role is to look at a student's GPA, course performance, and reflective comments ("semester memories/reflections"), and supply helpful, supportive, and highly concrete advice.
    Choose a warm, empathetic, and objective tone. Do not use generic corporate language. Avoid flowery praise like "Stellar!", "Unbelievable!". Seek to be constructive and practical.
    Return your response formatted in clean, professional Markdown with headers. Include:
    1. **Overall Performance Analysis**: Synthesize the classes and spot patterns (e.g., strong in Languages, struggling in AP Math).
    2. **Insight on Student Reflections**: Connect their grades with their subjective reflections/memories.
    3. **Actionable Study Tactics & Milestones**: Give 3 highly practical recommendations for the upcoming semesters based on their logs.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Here are my academic records and semester memories:\n\n${profileDescription}`,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error in mentor route:", error);
    return NextResponse.json(
      { error: "Generation Failed", text: "I ran into a small error compiling your academic advice. Please check your data or try again in a moment." },
      { status: 500 }
    );
  }
}
