"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  calculateUcGpa,
  detectAgCategoryFromName,
  scoreToUcGradePoint,
  scoreToUcLetterGrade,
  inferGradeLevelFromTermTitle,
  AG_CATEGORIES,
  type AgCategory,
  type UcGpaSummary
} from "../lib/uc-gpa";

// Types matching the state representations
interface Course {
  id: string;
  category: string;
  courseName: string;
  score: string;
  credit: string;
  level?: "Regular" | "Honors" | "AP/IB" | "Custom";
  weightBoost?: string;
  agCategory?: AgCategory;
}

interface Term {
  id: string;
  title: string;
  gradeLevel?: "9" | "10" | "11" | "12" | "Other";
  courses: Course[];
  reflection: string;       // Semester reflective diary notes
  bullets: string[];        // Tagged memories / key achievements
  aiAdvice?: string;        // Cache for server-side AI academic mentor insight
}

interface GpaSnapshot {
  id: string;
  timestamp: string;
  gpa: string;
  totalCredits: number;
  qualityPoints: number;
  note: string;
  terms?: Term[];
}

const INK_ACCENTS = [
  { name: "Charcoal Ink", color: "#1A1A1A", hover: "#2D2D2D", light: "#F5F5F5" },
  { name: "Burgundy Ink", color: "#541212", hover: "#701A1A", light: "#FAF4F4" },
  { name: "Royal Blue Ink", color: "#0F2C59", hover: "#184A96", light: "#F4F7FA" },
  { name: "Forest Green Ink", color: "#1E3F20", hover: "#2E5E32", light: "#F4FAF4" },
  { name: "Warm Terracotta", color: "#6E3C09", hover: "#8A4F10", light: "#FAF6F4" }
];

// Predefined catalog of categories and courses
const predefinedCourseCategories: Record<string, string[]> = {
  "Core Subjects": [
    "English Literature", "EAP (English for Academic Purposes)", "AP English Literature", "AP English Language", "Creative Writing", "Speech and Debate", "Journalism",
    "Mathematics", "AP Calculus AB", "AP Calculus BC", "AP Statistics", "Algebra I", "Algebra II", "Geometry", "Pre-Calculus", "Discrete Math",
    "Physics", "AP Physics 1", "AP Physics 2", "AP Physics C: Mechanics", "AP Physics C: Electricity and Magnetism", "Conceptual Physics",
    "Chemistry", "AP Chemistry", "Organic Chemistry", "Inorganic Chemistry", "Biochemistry",
    "Biology", "AP Biology", "Anatomy and Physiology", "Genetics", "Ecology", "Marine Biology", "Botany", "Zoology", "Microbiology",
    "History", "AP World History", "AP US History", "AP European History", "AP Human Geography", "Civics", "Economics", "Political Science", "Sociology", "Psychology",
    "Social Studies", "AP Psychology", "AP Economics (Micro)", "AP Economics (Macro)", "AP US Government and Politics", "AP Comparative Government and Politics", "World Geography", "US Geography"
  ],
  "Languages": [
    "Chinese", "Chinese Language", "Chinese Literature", "AP Chinese Language and Culture", "Chinese Calligraphy", "Chinese History",
    "Spanish", "AP Spanish Language and Culture", "AP Spanish Literature and Culture", "Spanish for Native Speakers", "Spanish Conversation",
    "French", "AP French Language and Culture", "AP French Literature and Culture", "French Conversation",
    "Japanese", "AP Japanese Language and Culture", "Japanese Culture",
    "German", "AP German Language and Culture", "German Literature",
    "Latin", "AP Latin", "Classical Literature",
    "Korean", "Korean Language", "Korean Culture",
    "Italian", "Russian", "Arabic", "Portuguese", "Sign Language"
  ],
  "Arts": [
    "Music", "Music Theory", "AP Music Theory", "Band", "Orchestra", "Choir", "Vocal Music", "Instrumental Music", "Music Appreciation", "Music History", "Digital Music", "Music Composition", "Music Performance",
    "Art", "Drawing", "Painting", "Sculpture", "Ceramics", "Digital Art", "AP Art History", "AP Studio Art (2-D Design)", "AP Studio Art (3-D Design)", "AP Studio Art (Drawing)", "Photography", "Film Studies", "Graphic Design", "Animation", "Fashion Design", "Interior Design",
    "Drama", "Theatre", "Acting", "Stagecraft", "Playwriting", "Directing", "Film Production", "Screenwriting", "Improvisation", "Costume Design", "Set Design",
    "Dance", "Ballet", "Modern Dance", "Jazz Dance", "Hip Hop Dance", "Folk Dance", "Choreography", "Dance History", "Tap Dance", "Ballroom Dance", "Contemporary Dance"
  ],
  "Business & Technology": [
    "Business Studies", "Introduction to Business", "Business Management", "Marketing", "Accounting", "Economics", "Personal Finance", "Entrepreneurship", "Business Law", "International Business", "Business Ethics", "Human Resources Management",
    "Computer Science", "Coding", "Web Development", "Game Design", "Cybersecurity", "AP Computer Science Principles", "AP Computer Science A", "Data Science", "Information Technology", "Computer Graphics", "Database Management", "Network Administration", "Software Engineering", "Mobile App Development", "Artificial Intelligence", "Machine Learning", "Robotics Programming", "AP business"
  ],
  "Physical Education": [
    "PE (Physical Education)", "Health", "Wellness", "Sports", "Team Sports", "Individual Sports", "Yoga", "Pilates", "Weight Training", "Aerobics", "Swimming", "Track and Field", "Basketball", "Soccer", "Volleyball", "Tennis", "Badminton", "Dance Fitness", "Cross Country", "Golf", "Gymnastics", "Lacrosse", "Rock Climbing", "Self-Defense", "Water Polo", "Zumba"
  ],
  "Other Electives": [
    "Philosophy", "Ethics", "Logic", "Debate", "Public Speaking", "Leadership", "Study Skills", "Creative Writing", "Yearbook", "Student Government", "Community Service", "Robotics", "Engineering", "Architecture", "Psychology", "Sociology", "Anthropology",
    "Environmental Science", "AP Environmental Science", "Sustainability Studies", "Astronomy", "Geology", "Oceanography", "Meteorology", "Earth Science", "Climate Science", "Forensics", "Journalism", "Media Literacy", "Digital Citizenship", "Film Studies",
    "Library Science", "Research Skills", "Test Preparation", "Career Planning", "Personal Development", "Financial Literacy", "Civic Engagement", "World Religions", "Comparative Cultures", "Culinary Arts", "BSS"
  ],
  "Chinese Specific": [
    "Chinese Math", "Chinese Chemistry", "Chinese Biology", "Chinese History", "Chinese Calligraphy", "Chinese Geography", "Chinese Culture", "Advanced Chinese Literature", "Classical Chinese Literature", "AP Chinese Language and Culture", "Chinese Art History", "Chinese Philosophy", "Chinese Music Theory", "Chinese Technology", "Chinese Politics"
  ]
};

interface CourseSuggestion {
  courseName: string;
  category: string;
}

const allPredefinedSuggestions: CourseSuggestion[] = Object.entries(predefinedCourseCategories).flatMap(
  ([category, courses]) => courses.map((courseName) => ({ courseName, category }))
);

const findCategoryForCourseName = (name: string): string | null => {
  const normalized = name.trim().toLowerCase();
  const matched = allPredefinedSuggestions.find((s) => s.courseName.toLowerCase() === normalized);
  return matched ? matched.category : null;
};

const convertScoreToGradePoint = (score: number, useLinear: boolean = false): number => {
  if (isNaN(score) || score < 0) return 0.0;
  if (score < 65) return 0.0;
  
  if (!useLinear) {
    if (score >= 97) return 4.33;
    if (score >= 93) return 4.00;
    if (score >= 90) return 3.67;
    if (score >= 87) return 3.33;
    if (score >= 83) return 3.00;
    if (score >= 80) return 2.67;
    if (score >= 77) return 2.33;
    if (score >= 73) return 2.00;
    if (score >= 70) return 1.67;
    if (score >= 65) return 1.00;
    return 0.0;
  }
  
  const interpolate = (val: number, sMin: number, sMax: number, gpMin: number, gpMax: number) => {
    const clampedVal = Math.min(sMax, Math.max(sMin, val));
    return gpMin + ((clampedVal - sMin) / (sMax - sMin)) * (gpMax - gpMin);
  };

  if (score >= 97) return 4.33;
  if (score >= 93) return interpolate(score, 93, 96, 4.00, 4.32);
  if (score >= 90) return interpolate(score, 90, 92, 3.67, 3.99);
  if (score >= 87) return interpolate(score, 87, 89, 3.33, 3.66);
  if (score >= 83) return interpolate(score, 83, 86, 3.00, 3.32);
  if (score >= 80) return interpolate(score, 80, 82, 2.67, 2.99);
  if (score >= 77) return interpolate(score, 77, 79, 2.33, 2.66);
  if (score >= 73) return interpolate(score, 73, 76, 2.00, 2.32);
  if (score >= 70) return interpolate(score, 70, 72, 1.67, 1.99);
  if (score >= 65) return interpolate(score, 65, 69, 1.00, 1.66);
  
  return 0.0;
};

const convertScoreToLetterGrade = (score: number): string => {
  if (isNaN(score) || score < 0) return "—";
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 65) return "D";
  return "F";
};

interface ScrapedCourse {
  id: string;
  className: string;
  originalName: string;
  score: string;
  category: string;
  level: "Regular" | "Honors" | "AP/IB" | "Custom";
  credit: string;
  agCategory?: AgCategory;
}

const cleanAndMapCourse = (
  rawName: string,
  rawScore: string,
  roundScores: boolean = true,
  rawCredit?: string
): Omit<ScrapedCourse, "id"> => {
  const originalName = rawName.trim();
  let cleanedName = originalName;

  // Remove grade levels e.g. (Grade 11), (Grade 12), etc.
  cleanedName = cleanedName.replace(/\s*\(Grade\s+\d+\)/gi, "");
  // Remove years e.g. 2025-2026 or 25-26
  cleanedName = cleanedName.replace(/\s*\d{4}-\d{4}/g, "");
  cleanedName = cleanedName.replace(/\s*\d{2}-\d{2}/g, "");
  // Remove teacher names if they look like typical bracketed suffixes (e.g. " (May + June 2026)")
  cleanedName = cleanedName.replace(/\s*\([^)]+\)/g, "");
  // Remove semester tags or trailing codes
  cleanedName = cleanedName.replace(/\b[S|T|Y][12]\b/gi, "");
  cleanedName = cleanedName.replace(/\bG\d{1,2}\b/gi, "");
  // Clean double spaces or hyphens
  cleanedName = cleanedName.replace(/[-\s]+/g, " ").trim();

  let mappedName = cleanedName;
  let category = "Core Subjects";
  let level: "Regular" | "Honors" | "AP/IB" | "Custom" = "Regular";

  const lowerName = cleanedName.toLowerCase();

  // Decide level based on keywords
  if (lowerName.includes("ap ") || lowerName.startsWith("ap-") || lowerName.includes(" ap") || lowerName.includes("advanced placement") || lowerName.includes("ib ")) {
    level = "AP/IB";
  } else if (lowerName.includes("honors") || lowerName.includes("hrs") || lowerName.includes("h ")) {
    level = "Honors";
  }

  // Predefined keyword matching
  if (lowerName.includes("ap business") || lowerName.includes("ap-business")) {
    mappedName = "AP Business";
    category = "Business & Technology";
    level = "AP/IB";
  } else if (lowerName.includes("pae") || lowerName.includes("pe") || lowerName.includes("physical education") || lowerName.includes("physical activity")) {
    mappedName = "Physical Education";
    category = "Physical Education";
  } else if (lowerName.includes("calc bc") || lowerName.includes("calculus bc")) {
    mappedName = "AP Calculus BC";
    category = "Core Subjects";
  } else if (lowerName.includes("calc ab") || lowerName.includes("calculus ab")) {
    mappedName = "AP Calculus AB";
    category = "Core Subjects";
  } else if (lowerName.includes("microecon") || lowerName.includes("microeconomics") || lowerName.includes("micro econ")) {
    mappedName = "AP Economics (Micro)";
    category = "Business & Technology";
  } else if (lowerName.includes("macroecon") || lowerName.includes("macroeconomics") || lowerName.includes("macro econ")) {
    mappedName = "AP Economics (Macro)";
    category = "Business & Technology";
  } else if (lowerName.includes("eap") || lowerName.includes("english for academic")) {
    mappedName = "EAP (English for Academic Purposes)";
    category = "Core Subjects";
  } else if (lowerName.includes("chemistry") || lowerName.includes("chem")) {
    mappedName = lowerName.includes("ap") ? "AP Chemistry" : "Chemistry";
    category = "Core Subjects";
  } else if (lowerName.includes("physics") || lowerName.includes("phys")) {
    mappedName = lowerName.includes("ap") ? "AP Physics 1" : "Physics";
    category = "Core Subjects";
  } else if (lowerName.includes("stats") || lowerName.includes("statistics")) {
    mappedName = lowerName.includes("ap") ? "AP Statistics" : "Statistics";
    category = "Core Subjects";
  } else if (lowerName.includes("csp") || lowerName.includes("computer science principles")) {
    mappedName = "AP Computer Science Principles";
    category = "Business & Technology";
  } else if (lowerName.includes("csa") || lowerName.includes("computer science a")) {
    mappedName = "AP Computer Science A";
    category = "Business & Technology";
  } else if (lowerName.includes("chinese")) {
    mappedName = "Chinese";
    category = "Languages";
    if (lowerName.includes("math")) { mappedName = "Chinese Math"; category = "Chinese Specific"; }
    else if (lowerName.includes("chemistry")) { mappedName = "Chinese Chemistry"; category = "Chinese Specific"; }
    else if (lowerName.includes("biology")) { mappedName = "Chinese Biology"; category = "Chinese Specific"; }
    else if (lowerName.includes("history")) { mappedName = "Chinese History"; category = "Chinese Specific"; }
    else if (lowerName.includes("calligraphy")) { mappedName = "Chinese Calligraphy"; category = "Chinese Specific"; }
    else if (lowerName.includes("geography")) { mappedName = "Chinese Geography"; category = "Chinese Specific"; }
    else if (lowerName.includes("culture")) { mappedName = "Chinese Culture"; category = "Chinese Specific"; }
    else if (lowerName.includes("philosophy")) { mappedName = "Chinese Philosophy"; category = "Chinese Specific"; }
    else if (lowerName.includes("technology")) { mappedName = "Chinese Technology"; category = "Chinese Specific"; }
    else if (lowerName.includes("politics")) { mappedName = "Chinese Politics"; category = "Chinese Specific"; }
    else if (lowerName.includes("ap")) { mappedName = "AP Chinese Language and Culture"; category = "Languages"; }
  } else if (lowerName.includes("spanish")) {
    mappedName = "Spanish";
    category = "Languages";
    if (lowerName.includes("ap")) mappedName = "AP Spanish Language and Culture";
  } else if (lowerName.includes("french")) {
    mappedName = "French";
    category = "Languages";
    if (lowerName.includes("ap")) mappedName = "AP French Language and Culture";
  } else if (lowerName.includes("stocks") || lowerName.includes("finance")) {
    mappedName = "Personal Finance";
    category = "Business & Technology";
  } else if (lowerName.includes("biology") || lowerName.includes("bio")) {
    mappedName = lowerName.includes("ap") ? "AP Biology" : "Biology";
    category = "Core Subjects";
  } else {
    // Search predefined
    let found = false;
    for (const [cat, courses] of Object.entries(predefinedCourseCategories)) {
      const match = courses.find(c => c.toLowerCase() === cleanedName.toLowerCase() || cleanedName.toLowerCase().startsWith(c.toLowerCase()));
      if (match) {
        mappedName = match;
        category = cat;
        found = true;
        break;
      }
    }

    if (!found) {
      if (lowerName.includes("math") || lowerName.includes("algebra") || lowerName.includes("geometry") || lowerName.includes("pre-calc") || lowerName.includes("calculus") || lowerName.includes("discrete")) {
        category = "Core Subjects";
      } else if (lowerName.includes("history") || lowerName.includes("civics") || lowerName.includes("economics") || lowerName.includes("econ") || lowerName.includes("geography") || lowerName.includes("social") || lowerName.includes("psychology")) {
        category = "Core Subjects";
      } else if (lowerName.includes("music") || lowerName.includes("art") || lowerName.includes("sculpture") || lowerName.includes("drama") || lowerName.includes("theatre") || lowerName.includes("dance")) {
        category = "Arts";
      } else if (lowerName.includes("coding") || lowerName.includes("programming") || lowerName.includes("computer") || lowerName.includes("web") || lowerName.includes("cybersecurity") || lowerName.includes("software")) {
        category = "Business & Technology";
      } else if (lowerName.includes("pe") || lowerName.includes("physical") || lowerName.includes("health") || lowerName.includes("wellness") || lowerName.includes("sports")) {
        category = "Physical Education";
      } else if (lowerName.includes("philosophy") || lowerName.includes("ethics") || lowerName.includes("debate") || lowerName.includes("public speaking")) {
        category = "Other Electives";
      }
    }
  }

  // Rounding score (e.g. 96.5 -> 97, 96.4 -> 96 if roundScores is true)
  let score = "";
  const pctMatch = rawScore.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    const val = parseFloat(pctMatch[1]);
    score = String(roundScores ? Math.round(val) : val);
  } else {
    const numMatch = rawScore.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      const val = parseFloat(numMatch[1]);
      score = String(roundScores ? Math.round(val) : val);
    }
  }

  let credit = "1.0";
  if (rawCredit !== undefined && rawCredit !== null && String(rawCredit).trim() !== "") {
    credit = String(rawCredit).trim();
  }

  return {
    className: mappedName,
    originalName,
    score,
    category,
    level,
    credit,
    agCategory: detectAgCategoryFromName(mappedName)
  };
};

const generateUniqueId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
};

export default function Home() {
  // State variables loaded from Local Storage
  const [terms, setTerms] = useState<Term[]>([]);
  const [snapshots, setSnapshots] = useState<GpaSnapshot[]>([]);
  
  // Custom academic goals stored locally on the user's computer
  const [targetGpa, setTargetGpa] = useState<string>("3.80");
  const [targetCredits, setTargetCredits] = useState<string>("120");
  const [personalMotivator, setPersonalMotivator] = useState<string>(
    "To build a strong academic foundation, reflect on my progress, and prepare for graduation."
  );

  // UI state variables
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [isExportModelOpen, setIsExportModelOpen] = useState<boolean>(false);
  const [isScaleModalOpen, setIsScaleModalOpen] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "txt">("csv");
  const [completedHydration, setCompletedHydration] = useState<boolean>(false);
  
  // Customization & styling settings
  const [activeAccent, setActiveAccent] = useState<string>("Charcoal Ink");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  
  // Snapshot recording modal helper
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState<boolean>(false);
  const [snapshotNote, setSnapshotNote] = useState<string>("");

  // Input fields for bullets memory additions
  const [bulletInputs, setBulletInputs] = useState<Record<string, string>>({});
  
  // Active autocomplete suggestion tracker: { termId, courseId }
  const [activeSuggestionBox, setActiveSuggestionBox] = useState<{ termId: string; courseId: string } | null>(null);

  // ManageBac Integration state variables
  const [isManageBacModalOpen, setIsManageBacModalOpen] = useState<boolean>(false);
  const [manageBacRawText, setManageBacRawText] = useState<string>("");
  const [parsedManageBacCourses, setParsedManageBacCourses] = useState<ScrapedCourse[]>([]);
  const [selectedManageBacCourses, setSelectedManageBacCourses] = useState<Record<string, boolean>>({});
  const [manageBacTargetTermId, setManageBacTargetTermId] = useState<string>("new");
  const [manageBacImportMode, setManageBacImportMode] = useState<"append" | "replace">("append");
  const [scriptCopied, setScriptCopied] = useState<boolean>(false);
  const [roundScores, setRoundScores] = useState<boolean>(true);
  const [useLinearGpa, setUseLinearGpa] = useState<boolean>(false);

  // University of California (UC) Admissions Mode & Settings
  const [useUcGpa, setUseUcGpa] = useState<boolean>(false);
  const [isDetectingUcTypes, setIsDetectingUcTypes] = useState<boolean>(false);
  const [customGeminiApiKey, setCustomGeminiApiKey] = useState<string>("");

  // AI Transcript Scanner (Gemini 3.5 Flash-Lite) state variables
  const [isAiTranscriptModalOpen, setIsAiTranscriptModalOpen] = useState<boolean>(false);
  const [aiTranscriptInputMode, setAiTranscriptInputMode] = useState<"upload" | "paste">("upload");
  const [aiTranscriptFile, setAiTranscriptFile] = useState<{ name: string; mimeType: string; base64: string } | null>(null);
  const [aiTranscriptRawText, setAiTranscriptRawText] = useState<string>("");
  const [isAiScanningTranscript, setIsAiScanningTranscript] = useState<boolean>(false);
  const [aiExtractedData, setAiExtractedData] = useState<any | null>(null);
  const [parsedAiCourses, setParsedAiCourses] = useState<(ScrapedCourse & { termTitle?: string; gradeLevel?: "9" | "10" | "11" | "12" | "Other" })[]>([]);
  const [selectedAiCourses, setSelectedAiCourses] = useState<Record<string, boolean>>({});
  const [aiTargetTermMode, setAiTargetTermMode] = useState<"auto" | "existing">("auto");
  const [aiTargetTermId, setAiTargetTermId] = useState<string>("new");
  const [aiImportMode, setAiImportMode] = useState<"append" | "replace">("append");

  // View layout modes & summary display settings
  const [viewLayoutMode, setViewLayoutMode] = useState<"separate" | "combined_year">("separate");
  const [summaryDisplayMode, setSummaryDisplayMode] = useState<"2row" | "compact" | "hidden">("2row");
  const [primaryGpaFocus, setPrimaryGpaFocus] = useState<"unweighted" | "weighted">("unweighted");

  // Server-side AI mentoring helpers
  const [isGeneratingMentorAdvice, setIsGeneratingMentorAdvice] = useState<boolean>(false);
  const [isGeneratingSemesterAdvice, setIsGeneratingSemesterAdvice] = useState<Record<string, boolean>>({});
  const [globalMentorAdvice, setGlobalMentorAdvice] = useState<string>("");

  // Custom alert & confirmation modal states to bypass iframe/sandbox confirm/alert blocks
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    message: "",
    onConfirm: () => {},
  });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
  }>({
    isOpen: false,
    message: "",
  });

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      message,
      onConfirm,
    });
  };

  const showAlert = (message: string) => {
    setAlertModal({
      isOpen: true,
      message,
    });
  };

  // ManageBac Parsing and Import Functions
  const handleParseManageBacInput = (text: string, forceRoundScores?: boolean) => {
    const activeRounding = forceRoundScores !== undefined ? forceRoundScores : roundScores;
    setManageBacRawText(text);
    if (!text.trim()) {
      setParsedManageBacCourses([]);
      setSelectedManageBacCourses({});
      return;
    }

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (err) {}
      }
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      parsed = [];
      const lines = text.split("\n");
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Check A: printed object style e.g. 3: {Class: 'EAP 201 (Grade 11)', Overall Mark (Score): 'A (95.63%)'}
        const classRegex = /Class:\s*['"`]?(.*?)['"`]?(?:\s*,|\s*\})/i;
        const scoreRegex = /(?:Overall Mark \(Score\)|Overall Mark|Score|overallMark):\s*['"`]?(.*?)['"`]?(?:\s*,|\s*\})/i;
        
        const cMatch = trimmed.match(classRegex);
        const sMatch = trimmed.match(scoreRegex);

        if (cMatch) {
          let className = cMatch[1].trim();
          let scoreVal = sMatch ? sMatch[1].trim() : "";
          
          if (className.endsWith(",")) className = className.slice(0, -1).trim();
          if (scoreVal.endsWith(",")) scoreVal = scoreVal.slice(0, -1).trim();
          if (className.endsWith("}")) className = className.slice(0, -1).trim();
          if (scoreVal.endsWith("}")) scoreVal = scoreVal.slice(0, -1).trim();
          
          const stripQuotes = (s: string) => {
            if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
              return s.slice(1, -1).trim();
            }
            return s;
          };
          className = stripQuotes(className);
          scoreVal = stripQuotes(scoreVal);

          if (className) {
            parsed.push({
              "Class": className,
              "Overall Mark (Score)": scoreVal
            });
            return;
          }
        }

        // Check B: table-like copy/paste from console.table or tab-delimited or spaces
        let cleanLine = trimmed;
        if (cleanLine.startsWith("│")) cleanLine = cleanLine.substring(1);
        if (cleanLine.endsWith("│")) cleanLine = cleanLine.substring(0, cleanLine.length - 1);
        
        const parts = cleanLine.split(/\s*│\s*|\t+|\s{2,}/).map(p => p.trim()).filter(Boolean);
        
        if (parts.length >= 2) {
          let className = "";
          let scoreVal = "";
          
          const firstIsIndex = /^\d+$/.test(parts[0]);
          if (parts.length >= 3 && firstIsIndex) {
            className = parts[1];
            scoreVal = parts[2];
          } else {
            className = parts[0];
            scoreVal = parts[1];
          }

          const stripQuotes = (s: string) => {
            if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
              return s.slice(1, -1).trim();
            }
            return s;
          };
          className = stripQuotes(className);
          scoreVal = stripQuotes(scoreVal);

          const isHeader = className.toLowerCase() === "class" || scoreVal.toLowerCase().includes("overall mark") || className.toLowerCase().includes("(index)");
          const isSeparator = className.includes("───") || className.includes("═══") || className.startsWith("┌") || className.startsWith("└") || className.startsWith("├");

          if (className && !isHeader && !isSeparator) {
            parsed.push({
              "Class": className,
              "Overall Mark (Score)": scoreVal
            });
          }
        }
      });
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      const list: ScrapedCourse[] = [];
      const selectMap: Record<string, boolean> = {};

      parsed.forEach((item, index) => {
        const rawName = item.Class || item.class || item.Course || item.course || item["Class Name"] || "";
        const rawScore = item["Overall Mark (Score)"] || item["Overall Mark"] || item.Score || item.score || item.Grade || item.grade || "";
        const rawCredit = item.Credit || item.credit || item.Credits || item.credits || item.Units || item.units || item.CR || item.cr || item.Hrs || item.hrs;

        if (rawName && typeof rawName === "string") {
          const cleanCourse = cleanAndMapCourse(rawName, String(rawScore), activeRounding, rawCredit ? String(rawCredit) : undefined);
          const courseId = generateUniqueId(`scraped-${index}`);
          const finalItem = {
            ...cleanCourse,
            id: courseId
          };
          list.push(finalItem);

          const lowerName = rawName.toLowerCase();
          const ignoreList = [
            "my workspace", "calendar", "tasks & deadlines", "tasks", "deadlines",
            "browse all groups", "browse all classes", "browse all files", 
            "dashboard", "messages", "groups", "classes", "files", "browse all"
          ];
          
          const isIgnoredName = ignoreList.some(ignore => lowerName.includes(ignore));
          const isFailedLoad = rawScore && (rawScore.toLowerCase().includes("empty") || rawScore.toLowerCase().includes("not found") || rawScore.toLowerCase().includes("http"));

          selectMap[courseId] = !(isIgnoredName || isFailedLoad);
        }
      });

      setParsedManageBacCourses(list);
      setSelectedManageBacCourses(selectMap);
    } else {
      setParsedManageBacCourses([]);
      setSelectedManageBacCourses({});
    }
  };

  const handleUpdateParsedCourseField = (id: string, field: keyof ScrapedCourse, value: any) => {
    setParsedManageBacCourses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleConfirmManageBacImport = () => {
    const selectedCoursesToImport = parsedManageBacCourses.filter(c => selectedManageBacCourses[c.id]);
    if (selectedCoursesToImport.length === 0) {
      showAlert("Please select at least one course to import.");
      return;
    }

    const coursesToInsert: Course[] = selectedCoursesToImport.map(c => ({
      id: generateUniqueId("course"),
      category: c.category,
      courseName: c.className,
      score: c.score,
      credit: c.credit,
      level: c.level,
      weightBoost: c.level === "Regular" ? "0.0" : c.level === "Honors" ? "0.5" : c.level === "AP/IB" ? "1.0" : "0.0"
    }));

    let updatedTerms = [...terms];

    if (manageBacTargetTermId === "new") {
      const nextTermNum = terms.length + 1;
      const newTerm: Term = {
        id: generateUniqueId("term"),
        title: `Semester ${nextTermNum} (ManageBac Import)`,
        courses: coursesToInsert,
        reflection: "Imported grades from ManageBac portal.",
        bullets: [`Imported ${coursesToInsert.length} courses from ManageBac.`]
      };
      updatedTerms.push(newTerm);
      showAlert(`Successfully created Semester ${nextTermNum} and imported ${coursesToInsert.length} courses!`);
    } else {
      updatedTerms = terms.map(term => {
        if (term.id === manageBacTargetTermId) {
          let finalCourses = [...term.courses];
          if (manageBacImportMode === "replace") {
            finalCourses = coursesToInsert;
          } else {
            const cleanExisting = term.courses.filter(c => c.courseName || c.score);
            finalCourses = [...cleanExisting, ...coursesToInsert];
          }
          
          if (finalCourses.length === 0) {
            finalCourses.push({
              id: `course-empty-${term.id}`,
              category: "Core Subjects",
              courseName: "",
              score: "",
              credit: ""
            });
          }

          return {
            ...term,
            courses: finalCourses,
            bullets: [...term.bullets, `Imported/Updated ${coursesToInsert.length} courses from ManageBac.`]
          };
        }
        return term;
      });

      const targetTermTitle = terms.find(t => t.id === manageBacTargetTermId)?.title || "Selected Semester";
      showAlert(`Successfully imported ${coursesToInsert.length} courses into ${targetTermTitle}!`);
    }

    syncTerms(updatedTerms);
    setIsManageBacModalOpen(false);
    setManageBacRawText("");
    setParsedManageBacCourses([]);
    setSelectedManageBacCourses({});
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const writeDefaultTerms = () => {
    const defaultCourse: Course = {
      id: "course-1-1",
      category: "Core Subjects",
      courseName: "",
      score: "",
      credit: "",
      agCategory: "G"
    };
    const defaultTerm: Term = {
      id: "term-1",
      title: "Semester 1",
      gradeLevel: "9",
      courses: [defaultCourse],
      reflection: "",
      bullets: ["Set up my GPA tracker for the semester!"]
    };
    setTerms([defaultTerm]);
    localStorage.setItem("gpaTracker_terms", JSON.stringify([defaultTerm]));
  };

  // Step 1: Handle Client Hydration & Local Storage Retrieval (using setTimeout to avoid synchronous setState inside render effects)
  useEffect(() => {
    const retrieveState = () => {
      // Retrieve terms
      const storedTerms = localStorage.getItem("gpaTracker_terms");
      if (storedTerms) {
        try {
          setTerms(JSON.parse(storedTerms));
        } catch (e) {
          console.error("Failed to parse stored terms, writing default");
          writeDefaultTerms();
        }
      } else {
        writeDefaultTerms();
      }

      // Retrieve snapshots
      const storedSnapshots = localStorage.getItem("gpaTracker_snapshots");
      if (storedSnapshots) {
        try {
          setSnapshots(JSON.parse(storedSnapshots));
        } catch (e) {
          console.error("Failed to parse stored snapshots");
        }
      }

      // Retrieve target goals
      const storedTargetGpa = localStorage.getItem("gpaTracker_targetGpa");
      if (storedTargetGpa) setTargetGpa(storedTargetGpa);
      const storedTargetCredits = localStorage.getItem("gpaTracker_targetCredits");
      if (storedTargetCredits) setTargetCredits(storedTargetCredits);
      const storedMotivator = localStorage.getItem("gpaTracker_personalMotivator");
      if (storedMotivator) setPersonalMotivator(storedMotivator);

      const storedShowIntro = localStorage.getItem("gpaTracker_showIntro");
      if (storedShowIntro) {
        setShowIntro(storedShowIntro === "true");
      }

      const storedRoundScores = localStorage.getItem("gpaTracker_roundScores");
      if (storedRoundScores !== null) {
        setRoundScores(storedRoundScores === "true");
      }

      const storedUseLinearGpa = localStorage.getItem("gpaTracker_useLinearGpa_v2");
      if (storedUseLinearGpa !== null) {
        setUseLinearGpa(storedUseLinearGpa === "true");
      } else {
        setUseLinearGpa(false);
      }

      const storedUseUcGpa = localStorage.getItem("gpaTracker_useUcGpa");
      if (storedUseUcGpa !== null) {
        setUseUcGpa(storedUseUcGpa === "true");
      }

      const storedApiKey = localStorage.getItem("gpaTracker_geminiApiKey");
      if (storedApiKey) {
        setCustomGeminiApiKey(storedApiKey);
      }

      // Retrieve custom details
      const storedAccent = localStorage.getItem("gpaTracker_accent");
      if (storedAccent) setActiveAccent(storedAccent);

      const storedCustomCats = localStorage.getItem("gpaTracker_customCategories");
      if (storedCustomCats) {
        try {
          setCustomCategories(JSON.parse(storedCustomCats));
        } catch (e) {
          console.error("Failed to parse stored custom categories");
        }
      }

      const storedViewLayout = localStorage.getItem("gpaTracker_viewLayoutMode");
      if (storedViewLayout === "separate" || storedViewLayout === "combined_year") {
        setViewLayoutMode(storedViewLayout);
      }

      const storedSummaryMode = localStorage.getItem("gpaTracker_summaryDisplayMode");
      if (storedSummaryMode === "2row" || storedSummaryMode === "compact" || storedSummaryMode === "hidden") {
        setSummaryDisplayMode(storedSummaryMode);
      }

      const storedPrimaryFocus = localStorage.getItem("gpaTracker_primaryGpaFocus");
      if (storedPrimaryFocus === "unweighted" || storedPrimaryFocus === "weighted") {
        setPrimaryGpaFocus(storedPrimaryFocus);
      }

      setCompletedHydration(true);
    };

    setTimeout(retrieveState, 0);
  }, []);

  // Sync to database
  const syncTerms = (updatedTerms: Term[]) => {
    setTerms(updatedTerms);
    localStorage.setItem("gpaTracker_terms", JSON.stringify(updatedTerms));
  };

  // State syncers for goals
  const syncTargetGpa = (val: string) => {
    setTargetGpa(val);
    localStorage.setItem("gpaTracker_targetGpa", val);
  };
  const syncTargetCredits = (val: string) => {
    setTargetCredits(val);
    localStorage.setItem("gpaTracker_targetCredits", val);
  };
  const syncPersonalMotivator = (val: string) => {
    setPersonalMotivator(val);
    localStorage.setItem("gpaTracker_personalMotivator", val);
  };

  const syncRoundScores = (val: boolean) => {
    setRoundScores(val);
    localStorage.setItem("gpaTracker_roundScores", String(val));
    handleParseManageBacInput(manageBacRawText, val);
  };

  const syncUseLinearGpa = (val: boolean) => {
    setUseLinearGpa(val);
    localStorage.setItem("gpaTracker_useLinearGpa_v2", String(val));
  };

  const syncUseUcGpa = (val: boolean) => {
    setUseUcGpa(val);
    localStorage.setItem("gpaTracker_useUcGpa", String(val));
  };

  const syncCustomGeminiApiKey = (val: string) => {
    setCustomGeminiApiKey(val);
    localStorage.setItem("gpaTracker_geminiApiKey", val);
  };

  const syncViewLayoutMode = (val: "separate" | "combined_year") => {
    setViewLayoutMode(val);
    localStorage.setItem("gpaTracker_viewLayoutMode", val);
  };

  const syncSummaryDisplayMode = (val: "2row" | "compact" | "hidden") => {
    setSummaryDisplayMode(val);
    localStorage.setItem("gpaTracker_summaryDisplayMode", val);
  };

  const syncPrimaryGpaFocus = (val: "unweighted" | "weighted") => {
    setPrimaryGpaFocus(val);
    localStorage.setItem("gpaTracker_primaryGpaFocus", val);
  };

  // GPA calculation helper
  const getTotals = () => {
    let totalWeightedGradePoints = 0;
    let totalUnweightedGradePoints = 0;
    let totalCollegiate4GradePoints = 0;
    let totalCredits = 0;

    terms.forEach((term) => {
      term.courses.forEach((course) => {
        let score = parseFloat(course.score);
        const credit = parseFloat(course.credit);

        if (!isNaN(score) && !isNaN(credit)) {
          if (roundScores) {
            score = Math.round(score);
          }
          const gradePoint = convertScoreToGradePoint(score, useLinearGpa);

          // Collegiate standard 4.0 grade point: A=4, B=3, C=2, D=1, F=0
          let col4Gp = 0;
          if (score >= 90) col4Gp = 4.0;
          else if (score >= 80) col4Gp = 3.0;
          else if (score >= 70) col4Gp = 2.0;
          else if (score >= 60) col4Gp = 1.0;
          else col4Gp = 0.0;
          
          let boost = 0;
          if (course.level === "Honors") {
            boost = 0.5;
          } else if (course.level === "AP/IB") {
            boost = 1.0;
          } else if (course.level === "Custom" && course.weightBoost) {
            boost = parseFloat(course.weightBoost) || 0;
          }

          totalWeightedGradePoints += (gradePoint + boost) * credit;
          totalUnweightedGradePoints += gradePoint * credit;
          totalCollegiate4GradePoints += col4Gp * credit;
          totalCredits += credit;
        }
      });
    });

    const gpa = totalCredits === 0 ? 0 : totalWeightedGradePoints / totalCredits;
    const unweightedGpa = totalCredits === 0 ? 0 : totalUnweightedGradePoints / totalCredits;
    const collegiateUnweightedGpa = totalCredits === 0 ? 0 : totalCollegiate4GradePoints / totalCredits;
    return {
      gpa: gpa.toFixed(2),
      unweightedGpa: unweightedGpa.toFixed(2),
      collegiateUnweightedGpa: collegiateUnweightedGpa.toFixed(2),
      totalCredits,
      qualityPoints: totalWeightedGradePoints.toFixed(1),
      unweightedQualityPoints: totalUnweightedGradePoints.toFixed(1)
    };
  };

  const totals = getTotals();
  const ucTotals = calculateUcGpa(terms.map((t, idx) => ({
    id: t.id,
    title: t.title,
    gradeLevel: t.gradeLevel || inferGradeLevelFromTermTitle(t.title, idx),
    courses: t.courses.map(c => ({
      id: c.id,
      courseName: c.courseName,
      score: c.score,
      credit: c.credit,
      level: c.level,
      agCategory: c.agCategory || detectAgCategoryFromName(c.courseName)
    }))
  })));
  const currentAccent = INK_ACCENTS.find((p) => p.name === activeAccent) || INK_ACCENTS[0];

  // Detailed summary of all entered courses & scores
  const detailedSummary = useMemo(() => {
    let totalCoursesCount = 0;
    let totalCredits = 0;
    let totalWeightedQP = 0;
    let totalUnweightedQP = 0;
    let totalCollegiateQP = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    let minScore = Infinity;
    let maxScore = -Infinity;
    let highestCourse: { name: string; score: number } | null = null;
    let lowestCourse: { name: string; score: number } | null = null;

    const gradeCounts: Record<string, number> = {
      "A+": 0,
      "A": 0,
      "A-": 0,
      "B+": 0,
      "B": 0,
      "B-": 0,
      "C+": 0,
      "C": 0,
      "C-": 0,
      "D": 0,
      "F": 0,
    };

    const semesterSummaries = terms.map((term, termIdx) => {
      let termCredits = 0;
      let termWeightedQP = 0;
      let termUnweightedQP = 0;
      let termCourseCount = 0;
      let termScoreSum = 0;

      term.courses.forEach((c) => {
        let scoreNum = parseFloat(c.score);
        const creditNum = parseFloat(c.credit);
        if (!isNaN(scoreNum) && !isNaN(creditNum)) {
          if (roundScores) scoreNum = Math.round(scoreNum);
          const gp = convertScoreToGradePoint(scoreNum, useLinearGpa);
          let col4 = 0;
          if (scoreNum >= 90) col4 = 4.0;
          else if (scoreNum >= 80) col4 = 3.0;
          else if (scoreNum >= 70) col4 = 2.0;
          else if (scoreNum >= 60) col4 = 1.0;

          let boost = 0;
          if (c.level === "Honors") boost = 0.5;
          else if (c.level === "AP/IB") boost = 1.0;
          else if (c.level === "Custom" && c.weightBoost) boost = parseFloat(c.weightBoost) || 0;

          const wQp = (gp + boost) * creditNum;
          const uQp = gp * creditNum;

          termCredits += creditNum;
          termWeightedQP += wQp;
          termUnweightedQP += uQp;
          termCourseCount += 1;
          termScoreSum += scoreNum;

          totalCredits += creditNum;
          totalWeightedQP += wQp;
          totalUnweightedQP += uQp;
          totalCollegiateQP += col4 * creditNum;
          totalCoursesCount += 1;
          scoreSum += scoreNum;
          scoreCount += 1;

          if (scoreNum > maxScore) {
            maxScore = scoreNum;
            highestCourse = { name: c.courseName || "Course", score: scoreNum };
          }
          if (scoreNum < minScore) {
            minScore = scoreNum;
            lowestCourse = { name: c.courseName || "Course", score: scoreNum };
          }

          const letter = convertScoreToLetterGrade(scoreNum);
          if (gradeCounts[letter] !== undefined) {
            gradeCounts[letter] += 1;
          }
        }
      });

      const termUnweightedGpa = termCredits > 0 ? (termUnweightedQP / termCredits).toFixed(2) : "0.00";
      const termWeightedGpa = termCredits > 0 ? (termWeightedQP / termCredits).toFixed(2) : "0.00";
      const termAvgScore = termCourseCount > 0 ? (termScoreSum / termCourseCount).toFixed(1) : "0.0";

      return {
        id: term.id,
        title: term.title || `Semester ${termIdx + 1}`,
        gradeLevel: term.gradeLevel || inferGradeLevelFromTermTitle(term.title, termIdx),
        courseCount: termCourseCount,
        credits: termCredits,
        unweightedQP: termUnweightedQP.toFixed(2),
        weightedQP: termWeightedQP.toFixed(2),
        unweightedGpa: termUnweightedGpa,
        weightedGpa: termWeightedGpa,
        avgScore: termAvgScore,
      };
    });

    const avgScore = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : "0.0";
    const overallUnweightedGpa = totalCredits > 0 ? (totalUnweightedQP / totalCredits).toFixed(2) : "0.00";
    const overallWeightedGpa = totalCredits > 0 ? (totalWeightedQP / totalCredits).toFixed(2) : "0.00";
    const overallCollegiateGpa = totalCredits > 0 ? (totalCollegiateQP / totalCredits).toFixed(2) : "0.00";

    return {
      totalCoursesCount,
      totalCredits,
      totalWeightedQP: totalWeightedQP.toFixed(2),
      totalUnweightedQP: totalUnweightedQP.toFixed(2),
      overallUnweightedGpa,
      overallWeightedGpa,
      overallCollegiateGpa,
      avgScore,
      minScore: minScore === Infinity ? 0 : minScore,
      maxScore: maxScore === -Infinity ? 0 : maxScore,
      highestCourse,
      lowestCourse,
      gradeCounts,
      semesterSummaries,
    };
  }, [terms, roundScores, useLinearGpa]);

  // Combined Academic Years grouping (Grade 9, Grade 10, Grade 11, Grade 12)
  const academicYears = useMemo(() => {
    const years: {
      yearLabel: string;
      gradeLevel: string;
      terms: Term[];
      stats: {
        credits: number;
        coursesCount: number;
        unweightedQP: number;
        weightedQP: number;
        unweightedGpa: string;
        weightedGpa: string;
      };
      pairedCourses: {
        key: string;
        courseName: string;
        category: string;
        agCategory: AgCategory;
        sem1Course?: Course;
        sem2Course?: Course;
        sem1TermId?: string;
        sem2TermId?: string;
      }[];
    }[] = [];

    const processed = new Set<string>();

    for (let i = 0; i < terms.length; i++) {
      const t1 = terms[i];
      if (processed.has(t1.id)) continue;

      const grade = t1.gradeLevel || inferGradeLevelFromTermTitle(t1.title, i);
      let t2: Term | null = null;

      if (i + 1 < terms.length && !processed.has(terms[i + 1].id)) {
        const nextT = terms[i + 1];
        const nextGrade = nextT.gradeLevel || inferGradeLevelFromTermTitle(nextT.title, i + 1);
        if (
          nextGrade === grade ||
          (t1.title.toLowerCase().includes("1") && nextT.title.toLowerCase().includes("2")) ||
          (t1.title.toLowerCase().includes("semester 1") && nextT.title.toLowerCase().includes("semester 2"))
        ) {
          t2 = nextT;
        }
      }

      const yearTerms = t2 ? [t1, t2] : [t1];
      yearTerms.forEach((t) => processed.add(t.id));

      let yrCredits = 0;
      let yrUnweightedQP = 0;
      let yrWeightedQP = 0;
      let yrCourses = 0;

      yearTerms.forEach((t) => {
        t.courses.forEach((c) => {
          const sc = parseFloat(c.score);
          const cr = parseFloat(c.credit);
          if (!isNaN(sc) && !isNaN(cr)) {
            const roundedSc = roundScores ? Math.round(sc) : sc;
            const gp = convertScoreToGradePoint(roundedSc, useLinearGpa);
            let boost = 0;
            if (c.level === "Honors") boost = 0.5;
            else if (c.level === "AP/IB") boost = 1.0;
            else if (c.level === "Custom" && c.weightBoost) boost = parseFloat(c.weightBoost) || 0;

            yrCredits += cr;
            yrCourses += 1;
            yrUnweightedQP += gp * cr;
            yrWeightedQP += (gp + boost) * cr;
          }
        });
      });

      const courseMap = new Map<
        string,
        {
          key: string;
          courseName: string;
          category: string;
          agCategory: AgCategory;
          sem1Course?: Course;
          sem2Course?: Course;
          sem1TermId?: string;
          sem2TermId?: string;
        }
      >();

      t1.courses.forEach((c) => {
        const key = (c.courseName || "Untitled").trim().toLowerCase();
        courseMap.set(key, {
          key,
          courseName: c.courseName || "Untitled",
          category: c.category || "Core Subjects",
          agCategory: c.agCategory || detectAgCategoryFromName(c.courseName),
          sem1Course: c,
          sem1TermId: t1.id,
        });
      });

      if (t2) {
        t2.courses.forEach((c) => {
          const key = (c.courseName || "Untitled").trim().toLowerCase();
          const existing = courseMap.get(key);
          if (existing) {
            existing.sem2Course = c;
            existing.sem2TermId = t2.id;
          } else {
            courseMap.set(key, {
              key,
              courseName: c.courseName || "Untitled",
              category: c.category || "Core Subjects",
              agCategory: c.agCategory || detectAgCategoryFromName(c.courseName),
              sem2Course: c,
              sem2TermId: t2.id,
            });
          }
        });
      }

      years.push({
        yearLabel: t2 ? `Grade ${grade} Academic Year` : t1.title,
        gradeLevel: grade,
        terms: yearTerms,
        stats: {
          credits: yrCredits,
          coursesCount: yrCourses,
          unweightedQP: yrUnweightedQP,
          weightedQP: yrWeightedQP,
          unweightedGpa: yrCredits > 0 ? (yrUnweightedQP / yrCredits).toFixed(2) : "0.00",
          weightedGpa: yrCredits > 0 ? (yrWeightedQP / yrCredits).toFixed(2) : "0.00",
        },
        pairedCourses: Array.from(courseMap.values()),
      });
    }

    return years;
  }, [terms, roundScores, useLinearGpa]);

  // Target Graduation Calculations
  const targetDiffGpa = parseFloat(targetGpa);
  const targetDiffCredits = parseInt(targetCredits) || 120;
  const currentCompletedCredits = totals.totalCredits;
  const currentGpaVal = parseFloat(totals.gpa);
  const currentQualityPoints = parseFloat(totals.qualityPoints);

  const remainingCredits = Math.max(0, targetDiffCredits - currentCompletedCredits);
  const totalQualityPointsRequired = targetDiffGpa * targetDiffCredits;
  const remainingQualityPointsRequired = Math.max(0, totalQualityPointsRequired - currentQualityPoints);
  const neededAverageGpaOnRemaining = remainingCredits === 0 ? 0 : remainingQualityPointsRequired / remainingCredits;

  // Semester / Term Operations
  const handleAddTerm = () => {
    const nextTermNum = terms.length + 1;
    const newCourse: Course = {
      id: `course-${nextTermNum}-1`,
      category: "Core Subjects",
      courseName: "",
      score: "",
      credit: "",
      agCategory: "G"
    };
    const newTerm: Term = {
      id: generateUniqueId("term"),
      title: `Semester ${nextTermNum}`,
      gradeLevel: inferGradeLevelFromTermTitle(`Semester ${nextTermNum}`, terms.length),
      courses: [newCourse],
      reflection: "",
      bullets: []
    };
    const updated = [...terms, newTerm];
    syncTerms(updated);
  };

  const handleUpdateTermGradeLevel = (termId: string, gradeLevel: "9" | "10" | "11" | "12" | "Other") => {
    const updated = terms.map(t => t.id === termId ? { ...t, gradeLevel } : t);
    syncTerms(updated);
  };

  const handleDeleteTerm = (termId: string) => {
    showConfirm("Are you sure you want to delete this semester and all of its course records?", () => {
      const updated = terms.filter((t) => t.id !== termId);
      syncTerms(updated);
    });
  };

  const handleUpdateTermTitle = (termId: string, newTitle: string) => {
    const updated = terms.map((t) => (t.id === termId ? { ...t, title: newTitle } : t));
    syncTerms(updated);
  };

  const handleUpdateTermReflection = (termId: string, newText: string) => {
    const updated = terms.map((t) => (t.id === termId ? { ...t, reflection: newText } : t));
    syncTerms(updated);
  };

  const handleAddBulletMemory = (termId: string) => {
    const bulletText = bulletInputs[termId]?.trim();
    if (!bulletText) return;

    const updated = terms.map((t) => {
      if (t.id === termId) {
        return {
          ...t,
          bullets: [...t.bullets, bulletText]
        };
      }
      return t;
    });

    syncTerms(updated);
    setBulletInputs({ ...bulletInputs, [termId]: "" });
  };

  const handleDeleteBulletMemory = (termId: string, bulletIdx: number) => {
    const updated = terms.map((t) => {
      if (t.id === termId) {
        return {
          ...t,
          bullets: t.bullets.filter((_, i) => i !== bulletIdx)
        };
      }
      return t;
    });
    syncTerms(updated);
  };

  // Course Specific Operations
  const handleAddCourseToTerm = (termId: string) => {
    const updated = terms.map((t) => {
      if (t.id === termId) {
        const nextCourseNum = t.courses.length + 1;
        const newCourse: Course = {
          id: `course-${termId}-${Date.now()}-${nextCourseNum}`,
          category: Object.keys(predefinedCourseCategories)[0],
          courseName: "",
          score: "",
          credit: ""
        };
        return {
          ...t,
          courses: [...t.courses, newCourse]
        };
      }
      return t;
    });
    syncTerms(updated);
  };

  const handleAddSubjectToAcademicYear = (ay: (typeof academicYears)[0]) => {
    const timestamp = Date.now();
    const updated = terms.map((t) => {
      if (ay.terms.some((yt) => yt.id === t.id)) {
        const nextCourseNum = t.courses.length + 1;
        const newCourse: Course = {
          id: `course-${t.id}-${timestamp}-${nextCourseNum}`,
          category: Object.keys(predefinedCourseCategories)[0],
          courseName: "",
          score: "",
          credit: "1",
          level: "Regular",
          agCategory: "G",
        };
        return {
          ...t,
          courses: [...t.courses, newCourse],
        };
      }
      return t;
    });
    syncTerms(updated);
  };

  const handleEnableCourseInPartnerSemester = (partnerTermId: string, baseCourse: Course) => {
    const timestamp = Date.now();
    const updated = terms.map((t) => {
      if (t.id === partnerTermId) {
        const nextCourseNum = t.courses.length + 1;
        const newCourse: Course = {
          id: `course-${partnerTermId}-${timestamp}-${nextCourseNum}`,
          category: baseCourse.category,
          courseName: baseCourse.courseName,
          score: "",
          credit: baseCourse.credit || "1",
          level: baseCourse.level || "Regular",
          agCategory: baseCourse.agCategory || "G",
          weightBoost: baseCourse.weightBoost,
        };
        return {
          ...t,
          courses: [...t.courses, newCourse],
        };
      }
      return t;
    });
    syncTerms(updated);
  };

  const handleDeleteCourse = (termId: string, courseId: string) => {
    const updated = terms.map((t) => {
      if (t.id === termId) {
        return {
          ...t,
          courses: t.courses.filter((c) => c.id !== courseId)
        };
      }
      return t;
    });
    syncTerms(updated);
  };

  const handleUpdateCourseField = (
    termId: string,
    courseId: string,
    field: keyof Course,
    value: string
  ) => {
    const updated = terms.map((t) => {
      if (t.id === termId) {
        return {
          ...t,
          courses: t.courses.map((c) => (c.id === courseId ? { ...c, [field]: value } : c))
        };
      }
      return t;
    });
    syncTerms(updated);
  };

  const handleUpdateCourseFields = (
    termId: string,
    courseId: string,
    updates: Partial<Course>
  ) => {
    const updated = terms.map((t) => {
      if (t.id === termId) {
        return {
          ...t,
          courses: t.courses.map((c) => (c.id === courseId ? { ...c, ...updates } : c))
        };
      }
      return t;
    });
    syncTerms(updated);
  };

  const handleSelectAutocompleteValue = (
    termId: string,
    courseId: string,
    courseName: string,
    category?: string
  ) => {
    if (category) {
      handleUpdateCourseFields(termId, courseId, {
        courseName,
        category
      });
    } else {
      handleUpdateCourseField(termId, courseId, "courseName", courseName);
    }
    setActiveSuggestionBox(null);
  };

  // Reset functionality
  const handleResetDashboard = () => {
    showConfirm("Are you sure you want to reset everything? This will clear all semester structures, written reflections, local snapshots, and target settings.", () => {
      localStorage.removeItem("gpaTracker_terms");
      localStorage.removeItem("gpaTracker_snapshots");
      localStorage.removeItem("gpaTracker_targetGpa");
      localStorage.removeItem("gpaTracker_targetCredits");
      localStorage.removeItem("gpaTracker_personalMotivator");
      localStorage.removeItem("gpaTracker_customCategories");
      localStorage.removeItem("gpaTracker_accent");
      
      setSnapshots([]);
      setCustomCategories([]);
      setActiveAccent("Charcoal Ink");
      setTargetGpa("3.80");
      setTargetCredits("120");
      setPersonalMotivator("To build a strong academic foundation, reflect on my progress, and prepare for graduation.");
      setGlobalMentorAdvice("");
      
      writeDefaultTerms();
      setShowIntro(true);
      localStorage.setItem("gpaTracker_showIntro", "true");
    });
  };

  // Local Snapshots Operations
  const handleSaveSnapshot = () => {
    const timestampStr = new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });

    const newSnapshot: GpaSnapshot = {
      id: generateUniqueId("snapshot"),
      timestamp: timestampStr,
      gpa: totals.gpa,
      totalCredits: totals.totalCredits,
      qualityPoints: parseFloat(totals.qualityPoints),
      note: snapshotNote.trim() || `Milestone Backup`,
      terms: JSON.parse(JSON.stringify(terms)) // deep copy coursework terms
    };

    const updated = [newSnapshot, ...snapshots];
    setSnapshots(updated);
    localStorage.setItem("gpaTracker_snapshots", JSON.stringify(updated));
    setSnapshotNote("");
    setIsSnapshotModalOpen(false);
    showAlert("Academic snapshot saved successfully! You can find it listed in your Snapshot ledger below.");
  };

  const handleDeleteSnapshot = (snapshotId: string) => {
    showConfirm("Delete this local snapshot record? This cannot be undone.", () => {
      const updated = snapshots.filter((s) => s.id !== snapshotId);
      setSnapshots(updated);
      localStorage.setItem("gpaTracker_snapshots", JSON.stringify(updated));
    });
  };

  const handleRestoreSnapshot = (snapshot: GpaSnapshot) => {
    showConfirm(`Do you want to restore snapshot from ${snapshot.timestamp}? It has a GPA of ${snapshot.gpa}. Warning: This will overwrite your current active board. We suggest taking a snapshot backup of your current active board first!`, () => {
      if (snapshot.terms && snapshot.terms.length > 0) {
        syncTerms(snapshot.terms);
        showAlert(`Snapshot restored successfully! Loaded ${snapshot.terms.length} semesters with a cumulative GPA of ${snapshot.gpa}.`);
      } else {
        showAlert("Note: This legacy snapshot is missing course records and only stored high-level metrics. Please import a file to reload older reports.");
      }
    });
  };

  // Export / Download File Logic
  const handleDownloadFile = () => {
    let fileContent = "";
    let fileName = "gpa_track_report";

    if (exportFormat === "csv") {
      let csvRows = ["Term Name,Grade Level,Category,Course Name,Level,UC A-G Area,Score,Credit Hours"];

      terms.forEach((term, idx) => {
        const gradeLvl = term.gradeLevel || inferGradeLevelFromTermTitle(term.title, idx);
        term.courses.forEach((course) => {
          const cat = course.category.replace(/"/g, '""');
          const name = course.courseName.replace(/"/g, '""');
          const lvl = course.level || "Regular";
          const ag = course.agCategory || detectAgCategoryFromName(course.courseName);
          const score = course.score;
          const cred = course.credit;
          csvRows.push(`"${term.title}","Grade ${gradeLvl}","${cat}","${name}","${lvl}","${ag}","${score}","${cred}"`);
        });
      });

      csvRows.push(`,,,Standard High School Weighted GPA,,${totals.gpa}`);
      csvRows.push(`,,,Standard High School Unweighted GPA (4.0 Max),,${totals.collegiateUnweightedGpa}`);
      csvRows.push(`,,,Standard High School Unweighted GPA (4.33 Scale),,${totals.unweightedGpa}`);
      csvRows.push(`,,,UC Capped Weighted GPA (10th-11th),,${ucTotals.cappedWeightedGpa}`);
      csvRows.push(`,,,UC Fully Weighted GPA (10th-11th),,${ucTotals.fullyWeightedGpa}`);
      csvRows.push(`,,,UC Unweighted GPA (10th-11th),,${ucTotals.unweightedGpa}`);
      csvRows.push(`,,,Cumulative UC Weighted GPA (9-12),,${ucTotals.cumulativeWeightedGpa}`);
      csvRows.push(`,,,Cumulative UC Unweighted GPA (9-12),,${ucTotals.cumulativeUnweightedGpa}`);
      fileContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\r\n"));
      fileName += ".csv";
    } else {
      // Plain text report
      terms.forEach((term, idx) => {
        const gradeLvl = term.gradeLevel || inferGradeLevelFromTermTitle(term.title, idx);
        fileContent += `\n=== ${term.title} (Grade ${gradeLvl}) ===\n`;
        if (term.reflection) {
          fileContent += `Reflection: ${term.reflection}\n`;
        }
        if (term.bullets.length > 0) {
          fileContent += `Memories & Highlights:\n`;
          term.bullets.forEach((b) => {
            fileContent += `- ${b}\n`;
          });
        }
        fileContent += `Courses:\n`;
        term.courses.forEach((row) => {
          const ag = row.agCategory || detectAgCategoryFromName(row.courseName);
          fileContent += `${row.category} | [UC: ${ag}] ${row.courseName || "General"} (${row.level || "Regular"}): ${row.score}% (${row.credit} cr)\n`;
        });
      });

      fileContent += `\n=== SUMMARY OF ALL WEIGHTED & UNWEIGHTED GPAS ===\nStandard High School Weighted GPA: ${totals.gpa}\nStandard High School Unweighted (4.0 Max): ${totals.collegiateUnweightedGpa}\nStandard High School Unweighted (4.33 Scale): ${totals.unweightedGpa}\nUC Capped Weighted GPA (10th-11th): ${ucTotals.cappedWeightedGpa}\nUC Fully Weighted GPA (10th-11th): ${ucTotals.fullyWeightedGpa}\nUC Unweighted GPA (10th-11th): ${ucTotals.unweightedGpa}\nCumulative UC Weighted GPA (9-12): ${ucTotals.cumulativeWeightedGpa}\nCumulative UC Unweighted GPA (9-12): ${ucTotals.cumulativeUnweightedGpa}\nTOTAL CREDITS COMPLETED: ${totals.totalCredits}\n`;
      fileContent = "data:text/plain;charset=utf-8," + encodeURIComponent(fileContent);
      fileName += ".txt";
    }

    const link = document.createElement("a");
    link.setAttribute("href", fileContent);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportModelOpen(false);
  };

  // Import Upload File Logic
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const contents = e.target?.result as string;
      const lines = contents.trim().split(/\r?\n/);
      let importedCount = 0;

      let isNewFormat = false;
      if (lines.length > 0 && lines[0].toLowerCase().includes("term name")) {
        isNewFormat = true;
        lines.shift(); // Remove headers
      } else if (lines.length > 0 && lines[0].toLowerCase().includes("coursecategory")) {
        lines.shift();
      }

      // Track terms
      let termsMap: Record<string, Term> = {};
      let termsArray: Term[] = [];

      lines.forEach((line, idx) => {
        let parts: string[] = [];
        let inQuotes = false;
        let current = "";

        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') {
            inQuotes = !inQuotes;
            continue;
          }
          if (line[i] === "," && !inQuotes) {
            parts.push(current.trim());
            current = "";
            continue;
          }
          current += line[i];
        }
        parts.push(current.trim());

        if (parts.length < 4 && line.includes(",")) {
          parts = line.split(",").map((p) => p.trim());
        }

        // Logic for New Format (5 columns: Term, Category, Name, Score, Credit)
        if (isNewFormat && parts.length >= 5) {
          const termName = parts[0];
          const cat = parts[1];
          const name = parts[2];
          const scoreStr = parts[3];
          const creditStr = parts[4];

          if (termName) {
            if (!termsMap[termName]) {
              const newTerm: Term = {
                id: `term-${Date.now()}-${idx}`,
                title: termName,
                courses: [],
                reflection: "",
                bullets: []
              };
              termsMap[termName] = newTerm;
              termsArray.push(newTerm);
            }

            const scoreNum = parseFloat(scoreStr);
            const creditNum = parseFloat(creditStr);

            if (!isNaN(scoreNum) || !isNaN(creditNum) || name) {
              termsMap[termName].courses.push({
                id: `course-${Date.now()}-${idx}-${Math.random()}`,
                category: cat || "Core Subjects",
                courseName: name,
                score: scoreStr,
                credit: creditStr
              });
              importedCount++;
            }
          }
        }
        // Old 4-column legacy format loader
        else if (!isNewFormat && parts.length >= 4) {
          const cat = parts[0];
          const name = parts[1];
          const scoreStr = parts[2];
          const creditStr = parts[3];

          const defaultTermName = "Semester 1";
          if (!termsMap[defaultTermName]) {
            const newTerm: Term = {
              id: `term-${Date.now()}-${idx}`,
              title: defaultTermName,
              courses: [],
              reflection: "",
              bullets: []
            };
            termsMap[defaultTermName] = newTerm;
            termsArray.push(newTerm);
          }

          termsMap[defaultTermName].courses.push({
            id: `course-${Date.now()}-${idx}-${Math.random()}`,
            category: cat || "Core Subjects",
            courseName: name,
            score: scoreStr,
            credit: creditStr
          });
          importedCount++;
        }
      });

      if (termsArray.length > 0) {
        // Enforce that all terms have at least one course rows
        termsArray.forEach((t) => {
          if (t.courses.length === 0) {
            t.courses.push({
              id: `course-empty-${t.id}`,
              category: "Core Subjects",
              courseName: "",
              score: "",
              credit: ""
            });
          }
        });
        syncTerms(termsArray);
        showAlert(`Success! Successfully loaded ${importedCount} courses spread across ${termsArray.length} semesters.`);
      } else {
        showAlert("No valid coursework data detected in the file.");
      }
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // AI Mentor server endpoint fetcher
  const handleConsultGlobalMentorInfo = async () => {
    setIsGeneratingMentorAdvice(true);
    setGlobalMentorAdvice("");
    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms,
          cumulativeGpa: totals.gpa,
          totalCredits: totals.totalCredits,
        }),
      });
      const data = await response.json();
      setGlobalMentorAdvice(data.text || "No response received.");
    } catch (e) {
      console.error(e);
      setGlobalMentorAdvice("Unable to connect to your local academic advisor service right now. Please refresh and try again.");
    } finally {
      setIsGeneratingMentorAdvice(false);
    }
  };

  const handleConsultSemesterMentorInfo = async (termId: string) => {
    setIsGeneratingSemesterAdvice({ ...isGeneratingSemesterAdvice, [termId]: true });
    
    // Pick just this singular term context
    const singleTerm = terms.filter((t) => t.id === termId);
    try {
      const response = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms: singleTerm,
          cumulativeGpa: totals.gpa,
          totalCredits: totals.totalCredits,
        }),
      });
      const data = await response.json();
      
      const updated = terms.map((t) => {
        if (t.id === termId) {
          return { ...t, aiAdvice: data.text };
        }
        return t;
      });
      syncTerms(updated);
    } catch (e) {
      console.error(e);
      showAlert("Consultation failed. Make sure your local workspace server is active.");
    } finally {
      setIsGeneratingSemesterAdvice({ ...isGeneratingSemesterAdvice, [termId]: false });
    }
  };

  // UC A-G Types Auto-Detection using Gemini 3.5 Flash-Lite
  const handleAutoDetectUcTypes = async () => {
    const allCoursesList: Array<{ id: string; courseName: string; currentLevel?: string; currentAg?: string }> = [];
    terms.forEach(t => {
      t.courses.forEach(c => {
        if (c.courseName && c.courseName.trim()) {
          allCoursesList.push({
            id: c.id,
            courseName: c.courseName.trim(),
            currentLevel: c.level || "Regular",
            currentAg: c.agCategory || detectAgCategoryFromName(c.courseName)
          });
        }
      });
    });

    if (allCoursesList.length === 0) {
      showAlert("No courses found to classify. Please enter some course names first.");
      return;
    }

    setIsDetectingUcTypes(true);
    try {
      const response = await fetch("/api/uc-detect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customGeminiApiKey ? { "x-gemini-api-key": customGeminiApiKey } : {})
        },
        body: JSON.stringify({
          courses: allCoursesList,
          customApiKey: customGeminiApiKey
        })
      });

      const resData = await response.json();
      if (!response.ok || resData.error) {
        throw new Error(resData.message || resData.error || "Failed to classify courses.");
      }

      const classifications: Array<{
        id: string;
        courseName: string;
        agCategory: AgCategory;
        level: "Regular" | "Honors" | "AP/IB";
        weightBoost: string;
      }> = resData.data?.classifications || [];

      const classMap = new Map<string, typeof classifications[0]>();
      classifications.forEach(item => {
        if (item.id) classMap.set(item.id, item);
        if (item.courseName) classMap.set(item.courseName.toLowerCase().trim(), item);
      });

      let updatedCount = 0;
      const updatedTerms = terms.map(t => ({
        ...t,
        courses: t.courses.map(c => {
          const match = classMap.get(c.id) || classMap.get(c.courseName.toLowerCase().trim());
          if (match) {
            updatedCount++;
            return {
              ...c,
              agCategory: match.agCategory,
              level: match.level,
              weightBoost: match.weightBoost || (match.level === "AP/IB" ? "1.0" : match.level === "Honors" ? "0.5" : "0.0")
            };
          }
          return c;
        })
      }));

      syncTerms(updatedTerms);
      showAlert(`AI Classification Complete! Successfully evaluated ${updatedCount} courses with Gemini 3.5 Flash-Lite.`);
    } catch (err: any) {
      console.error("UC Auto-Detect Error:", err);
      showAlert(`Classification error: ${err?.message || "Could not connect to AI service. Please check your API key."}`);
    } finally {
      setIsDetectingUcTypes(false);
    }
  };

  // AI Transcript Scanner Handler using Gemini 3.5 Flash-Lite
  const handleTriggerAiTranscriptScan = async () => {
    if (!aiTranscriptRawText.trim() && !aiTranscriptFile) {
      showAlert("Please upload a transcript document/image or paste transcript text first.");
      return;
    }

    setIsAiScanningTranscript(true);
    setParsedAiCourses([]);
    setSelectedAiCourses({});

    try {
      const response = await fetch("/api/transcript-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(customGeminiApiKey ? { "x-gemini-api-key": customGeminiApiKey } : {})
        },
        body: JSON.stringify({
          text: aiTranscriptRawText,
          fileData: aiTranscriptFile?.base64,
          mimeType: aiTranscriptFile?.mimeType,
          customApiKey: customGeminiApiKey
        })
      });

      const resData = await response.json();
      if (!response.ok || resData.error) {
        throw new Error(resData.message || resData.error || "Transcript extraction failed.");
      }

      const extracted = resData.data;
      setAiExtractedData(extracted);

      const courseList: (ScrapedCourse & { termTitle?: string; gradeLevel?: "9" | "10" | "11" | "12" | "Other" })[] = [];
      const selectMap: Record<string, boolean> = {};

      const rawCourses = extracted.extractedCourses || [];
      rawCourses.forEach((c: any, index: number) => {
        const courseId = generateUniqueId(`ai-course-${index}`);
        const rawCredit = c.credit ?? c.credits ?? c.creditEarned ?? c.earnedCredit ?? c.creditAttempted ?? c.attemptedCredit ?? c.units ?? c.unit ?? c.hrs ?? c.hours ?? c.cr ?? c.weight;
        const finalCredit = (rawCredit !== undefined && rawCredit !== null && String(rawCredit).trim() !== "")
          ? String(rawCredit).trim()
          : "1.0";

        const parsedItem = {
          id: courseId,
          className: c.courseName || c.originalName || "Unnamed Course",
          originalName: c.originalName || c.courseName || "",
          score: String(c.score || "95"),
          category: c.category || "Core Subjects",
          level: (c.level as any) || (c.courseName?.toLowerCase().includes("ap") ? "AP/IB" : c.courseName?.toLowerCase().includes("honors") ? "Honors" : "Regular"),
          credit: finalCredit,
          agCategory: (c.agCategory as AgCategory) || detectAgCategoryFromName(c.courseName || ""),
          termTitle: c.termTitle || "Semester 1",
          gradeLevel: c.gradeLevel || "10"
        };
        courseList.push(parsedItem);
        selectMap[courseId] = true;
      });

      setParsedAiCourses(courseList);
      setSelectedAiCourses(selectMap);
    } catch (err: any) {
      console.error("AI Transcript Scan Error:", err);
      showAlert(`Scan Error: ${err?.message || "Failed to analyze transcript. Please verify your GEMINI_API_KEY."}`);
    } finally {
      setIsAiScanningTranscript(false);
    }
  };

  const handleConfirmAiTranscriptImport = () => {
    const selected = parsedAiCourses.filter(c => selectedAiCourses[c.id]);
    if (selected.length === 0) {
      showAlert("Please select at least one course to import.");
      return;
    }

    if (aiTargetTermMode === "auto") {
      // Map courses by their termTitle
      const termMap = new Map<string, { title: string; gradeLevel: "9" | "10" | "11" | "12" | "Other"; courses: Course[] }>();

      // 1. Pre-populate from aiExtractedData.terms to maintain chronological order
      if (aiExtractedData?.terms && Array.isArray(aiExtractedData.terms)) {
        aiExtractedData.terms.forEach((t: any, idx: number) => {
          const title = (t.termTitle || `Semester ${idx + 1}`).trim();
          termMap.set(title.toLowerCase(), {
            title,
            gradeLevel: t.gradeLevel || inferGradeLevelFromTermTitle(title, idx),
            courses: []
          });
        });
      }

      // 2. Distribute selected courses into terms
      selected.forEach((c) => {
        const courseTermTitle = (c.termTitle || "Semester 1").trim();
        const key = courseTermTitle.toLowerCase();

        let targetGroup = termMap.get(key);
        if (!targetGroup) {
          targetGroup = {
            title: courseTermTitle,
            gradeLevel: c.gradeLevel || inferGradeLevelFromTermTitle(courseTermTitle, termMap.size),
            courses: []
          };
          termMap.set(key, targetGroup);
        }

        targetGroup.courses.push({
          id: generateUniqueId("course"),
          category: c.category,
          courseName: c.className,
          score: c.score,
          credit: c.credit,
          level: c.level,
          weightBoost: c.level === "AP/IB" ? "1.0" : c.level === "Honors" ? "0.5" : "0.0",
          agCategory: c.agCategory
        });
      });

      // 3. Collect terms with at least one course
      const newTermsToAdd: Term[] = [];
      termMap.forEach((group) => {
        if (group.courses.length > 0) {
          newTermsToAdd.push({
            id: generateUniqueId("term"),
            title: group.title,
            gradeLevel: group.gradeLevel,
            courses: group.courses,
            reflection: "Imported via Gemini 3.5 Flash-Lite Transcript Scanner.",
            bullets: [`Imported ${group.courses.length} courses from official transcript.`]
          });
        }
      });

      if (newTermsToAdd.length > 0) {
        // If current terms array only has 1 empty semester, replace it cleanly!
        const isCurrentEmpty = terms.length === 1 && terms[0].courses.length === 0;
        const updated = isCurrentEmpty ? newTermsToAdd : [...terms, ...newTermsToAdd];
        syncTerms(updated);
        showAlert(`Successfully imported ${selected.length} courses across ${newTermsToAdd.length} semesters!`);
        setIsAiTranscriptModalOpen(false);
        setParsedAiCourses([]);
        setAiTranscriptFile(null);
        setAiTranscriptRawText("");
        return;
      }
    }

    // Default or existing term import
    const coursesToInsert: Course[] = selected.map(c => ({
      id: generateUniqueId("course"),
      category: c.category,
      courseName: c.className,
      score: c.score,
      credit: c.credit,
      level: c.level,
      weightBoost: c.level === "AP/IB" ? "1.0" : c.level === "Honors" ? "0.5" : "0.0",
      agCategory: c.agCategory
    }));

    if (aiTargetTermId === "new") {
      const nextTermNum = terms.length + 1;
      const newTerm: Term = {
        id: generateUniqueId("term"),
        title: `Semester ${nextTermNum} (AI Transcript Import)`,
        gradeLevel: inferGradeLevelFromTermTitle(`Semester ${nextTermNum}`, terms.length),
        courses: coursesToInsert,
        reflection: "Imported via Gemini 3.5 Flash-Lite Transcript Scanner.",
        bullets: [`Imported ${coursesToInsert.length} courses.`]
      };
      syncTerms([...terms, newTerm]);
      showAlert(`Created Semester ${nextTermNum} with ${coursesToInsert.length} courses!`);
    } else {
      const updated = terms.map(term => {
        if (term.id === aiTargetTermId) {
          if (aiImportMode === "replace") {
            return {
              ...term,
              courses: coursesToInsert,
              bullets: [...term.bullets, `Replaced with ${coursesToInsert.length} AI-imported courses.`]
            };
          } else {
            return {
              ...term,
              courses: [...term.courses, ...coursesToInsert],
              bullets: [...term.bullets, `Added ${coursesToInsert.length} AI-imported courses.`]
            };
          }
        }
        return term;
      });
      syncTerms(updated);
      showAlert(`Updated semester with ${coursesToInsert.length} courses!`);
    }

    setIsAiTranscriptModalOpen(false);
    setParsedAiCourses([]);
    setAiTranscriptFile(null);
    setAiTranscriptRawText("");
  };

  const toggleHomeView = (val: boolean) => {
    setShowIntro(val);
    localStorage.setItem("gpaTracker_showIntro", String(val));
  };

  if (!completedHydration) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f6f6f8]">
        <div className="text-center">
          <div className="animate-spin text-primary text-5xl mb-4">⌛</div>
          <p className="text-slate-600 font-medium">Securing local memories database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans text-[#1A1A1A] antialiased relative overflow-x-hidden min-h-screen selection:bg-[#1A1A1A] selection:text-white">

      <div className="relative z-10 flex flex-col h-full min-h-screen">
        {/* Navbar */}
        <nav className="w-full px-4 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto glass-panel rounded-2xl px-6 py-3.5 flex items-center justify-between border border-[#1A1A1A]/10">
            <div className="flex items-center gap-3">
              <div className="bg-[#1A1A1A] p-2 rounded-xl text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
              <div>
                <span className="text-sm font-bold uppercase tracking-[0.1em] text-[#1A1A1A] block leading-none">
                  GPA Calculator
                </span>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mt-1">
                  & Memoir Journal
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Back to intro/app toggle */}
              <button
                onClick={() => toggleHomeView(!showIntro)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#1A1A1A] hover:bg-[#1A1A1A]/5 border border-[#1A1A1A]/5 hover:border-[#1A1A1A]/10 rounded-lg transition-all"
                id="btnToggleView"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {showIntro ? "dashboard" : "home"}
                </span>
                <span>{showIntro ? "Enter Tracker" : "Memoir Hub"}</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider font-semibold text-slate-700 bg-white/40 hover:bg-white rounded-xl transition-all border border-[#1A1A1A]/10 shadow-none"
                id="importBtn"
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                <span className="hidden sm:inline">Import</span>
              </button>

              <button
                onClick={() => setIsAiTranscriptModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider font-bold text-slate-800 bg-amber-50/80 hover:bg-amber-100/90 rounded-xl transition-all border border-amber-300/60 shadow-sm"
                id="aiTranscriptBtn"
                title="AI Transcript Scanner (Gemini 3.5 Flash-Lite)"
              >
                <span className="material-symbols-outlined text-[18px] text-amber-600">auto_awesome</span>
                <span>AI Transcript</span>
              </button>

              <button
                onClick={() => setIsManageBacModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider font-semibold text-slate-700 bg-white/40 hover:bg-white rounded-xl transition-all border border-[#1A1A1A]/10 shadow-none"
                id="managebacBtn"
              >
                <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                <span className="hidden sm:inline">ManageBac</span>
              </button>

              <button
                onClick={() => setIsExportModelOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#2C2C2C] text-white text-xs uppercase tracking-[0.25em] font-bold rounded-xl transition-all shadow-none"
                id="exportBtn"
              >
                <span className="material-symbols-outlined text-[20px]">ios_share</span>
                <span>Export</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Hidden File Input for Import */}
        <input
          type="file"
          id="fileInput"
          ref={fileInputRef}
          accept=".csv,.txt"
          onChange={handleImportFile}
          style={{ display: "none" }}
        />

        {/* Dynamic Transition Between Screens */}
        <AnimatePresence mode="wait">
          {showIntro ? (
            /* ==============================================
               1. INTRO / WELCOME & MEMORIES Hub VIEW
               ============================================== */
            <motion.main
              key="intro-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex-grow w-full max-w-7xl mx-auto px-4 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-24"
              id="introView"
            >
              {/* Column 1: Core Action & Stats Brief (lg:col-span-5) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* Clean Hero Presentation */}
                <div className="glass-panel rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden border border-[#1A1A1A]/10">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-[0.15em] mb-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>100% Sovereign Local Storage</span>
                  </div>
                  <h1 className="text-[#1A1A1A] font-light leading-[1.0] tracking-tighter mb-4" style={{ fontFamily: "Georgia, serif", fontSize: "3.2rem" }}>
                    Academic <br/>Ledger &amp; <br/>
                    <span className="italic font-normal" style={{ color: currentAccent.color }}>GPA Tracker.</span>
                  </h1>
                  <p className="text-sm leading-relaxed max-w-sm mb-6 text-slate-650">
                    Your grades and reflections never leave this device. Multi-system calculation for High School, College, and University of California admissions with AI transcript scanning.
                  </p>

                  {/* Feature Badges Grid */}
                  <div className="grid grid-cols-2 gap-2 w-full mb-6 text-left">
                    <div className="p-2.5 bg-white/70 border border-[#1A1A1A]/10 rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-amber-600">auto_awesome</span>
                      <div>
                        <span className="text-[10px] font-bold text-slate-900 block leading-tight">Gemini 3.5 Flash-Lite</span>
                        <span className="text-[8px] text-slate-400">OCR Transcript Scan</span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-white/70 border border-[#1A1A1A]/10 rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-amber-700">school</span>
                      <div>
                        <span className="text-[10px] font-bold text-slate-900 block leading-tight">UC Admissions A-G</span>
                        <span className="text-[8px] text-slate-400">Capped &amp; Uncapped</span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-white/70 border border-[#1A1A1A]/10 rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-blue-600">view_column</span>
                      <div>
                        <span className="text-[10px] font-bold text-slate-900 block leading-tight">Dual-Semester View</span>
                        <span className="text-[8px] text-slate-400">2-Row Year Comparison</span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-white/70 border border-[#1A1A1A]/10 rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600">verified_user</span>
                      <div>
                        <span className="text-[10px] font-bold text-slate-900 block leading-tight">Zero Cloud Storage</span>
                        <span className="text-[8px] text-slate-400">Browser-Only Sovereign</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 w-full">
                    <button
                      onClick={() => toggleHomeView(false)}
                      className="w-full py-4 bg-[#1A1A1A] hover:bg-[#2C2C2C] text-white text-xs uppercase tracking-[0.2em] font-bold rounded transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">dashboard</span>
                      <span>Launch Live Tracker</span>
                    </button>
                    
                    <button
                      onClick={() => setIsAiTranscriptModalOpen(true)}
                      className="w-full py-3 bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-300/70 text-xs uppercase tracking-[0.15em] font-bold rounded transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px] text-amber-600">auto_awesome</span>
                      <span>AI Transcript Scanner</span>
                    </button>

                    <button
                      onClick={handleResetDashboard}
                      className="text-[9px] uppercase tracking-[0.15em] font-bold text-red-500 hover:text-red-700 hover:bg-red-50/50 py-1.5 px-3 rounded transition-colors self-center mt-2"
                    >
                      Reset Memories Database
                    </button>
                  </div>
                </div>

                {/* Local Stats Achievement Snapshot */}
                <div className="glass-panel rounded-2xl p-6 border border-[#1A1A1A]/10">
                  <h3 className="font-bold text-[#1A1A1A] text-xs uppercase tracking-[0.2em] mb-4 border-b border-[#1A1A1A]/10 pb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#1A1A1A] text-[18px]">workspace_premium</span>
                      <span>Device Record Overview</span>
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">{detailedSummary.totalCoursesCount} Courses</span>
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-3 text-center mb-4">
                    <div className="bg-white/50 p-3 rounded border border-[#1A1A1A]/5 hover:border-[#1A1A1A]/15 transition-colors">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Unwtd GPA</span>
                      <span className="block text-2.5xl font-light italic mt-1 text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif", color: currentAccent.color }}>
                        {totals.unweightedGpa}
                      </span>
                    </div>
                    <div className="bg-white/50 p-3 rounded border border-[#1A1A1A]/5 hover:border-[#1A1A1A]/15 transition-colors">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Weighted GPA</span>
                      <span className="block text-2.5xl font-light italic mt-1 text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                        {totals.gpa}
                      </span>
                    </div>
                    <div className="bg-white/50 p-3 rounded border border-[#1A1A1A]/5 hover:border-[#1A1A1A]/15 transition-colors">
                      <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Credits</span>
                      <span className="block text-2.5xl font-light italic mt-1 text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                        {totals.totalCredits}
                      </span>
                    </div>
                  </div>

                  {/* Graduation Goal Forecast Tool */}
                  <div className="p-4 bg-white/30 border border-[#1A1A1A]/10 rounded">
                    <h4 className="text-[10px] font-bold text-[#1A1A1A] uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">crisis_line</span>
                      <span>Graduation Forecaster</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Target GPA</label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.0"
                          max="4.33"
                          value={targetGpa}
                          onChange={(e) => syncTargetGpa(e.target.value)}
                          className="w-full text-xs font-bold text-[#1A1A1A] bg-white border border-[#1A1A1A]/10 focus:outline-none focus:border-[#1A1A1A] p-2 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Target Credits</label>
                        <input
                          type="number"
                          value={targetCredits}
                          onChange={(e) => syncTargetCredits(e.target.value)}
                          className="w-full text-xs font-bold text-[#1A1A1A] bg-white border border-[#1A1A1A]/10 focus:outline-none focus:border-[#1A1A1A] p-2 rounded"
                        />
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-650 space-y-1.5 border-t border-[#1A1A1A]/10 pt-2.5 font-mono">
                      <div className="flex justify-between">
                        <span>Credits Remaining:</span>
                        <span className="font-bold">{remainingCredits} cr</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Required Average:</span>
                        <span className="font-bold">
                          {neededAverageGpaOnRemaining <= 0
                            ? "Completed! 🎉"
                            : neededAverageGpaOnRemaining > 4.33
                            ? "Off Scale (Limit 4.33) ⚠️"
                            : `${neededAverageGpaOnRemaining.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personal Motivation Card */}
                <div className="glass-panel rounded-2xl p-6 border border-[#1A1A1A]/10">
                  <h3 className="font-bold text-[#1A1A1A] text-xs uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">favorite</span>
                    <span>Academic Mission</span>
                  </h3>
                  <textarea
                    value={personalMotivator}
                    onChange={(e) => syncPersonalMotivator(e.target.value)}
                    placeholder="Provide your main driving force or long-term objective here..."
                    className="w-full h-24 p-3 text-xs text-slate-605 bg-white border border-[#1A1A1A]/10 rounded focus:border-[#1A1A1A] resize-none focus:outline-none placeholder-slate-400"
                  />
                  <div className="flex justify-between items-center text-[10px] uppercase tracking-widest opacity-40 mt-2 font-mono">
                    <span>DB Status: Ready</span>
                    <span>Local Cookie Encryption</span>
                  </div>
                </div>

              </div>

              {/* Column 2: Memory Snapshots & Reflections Timeline (lg:col-span-8) */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                
                {/* AI Advisor Global Auditor */}
                <div className="glass-panel rounded-2xl p-6 border border-[#1A1A1A]/10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#1A1A1A] p-2 rounded text-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">auto_awesome</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1A1A1A] text-sm uppercase tracking-[0.1em]">Memories Advisor</h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Global Academic Ledger Auditor</p>
                      </div>
                    </div>

                    <button
                      onClick={handleConsultGlobalMentorInfo}
                      disabled={isGeneratingMentorAdvice}
                      className={`px-4 py-2 bg-[#1A1A1A] hover:bg-[#2C2C2C] text-white text-[11px] font-bold uppercase tracking-[0.15em] rounded transition-all flex items-center gap-1.5 ${
                        isGeneratingMentorAdvice ? "opacity-60 cursor-not-allowed animate-pulse" : ""
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">science</span>
                      <span>{isGeneratingMentorAdvice ? "Auditing..." : "Audit Ledger"}</span>
                    </button>
                  </div>

                  {globalMentorAdvice ? (
                    <div className="p-4 bg-white border border-[#1A1A1A]/10 rounded prose text-slate-700 text-xs leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap font-sans">
                      {globalMentorAdvice}
                    </div>
                  ) : (
                    <div className="p-10 border border-dashed border-[#1A1A1A]/10 rounded text-center text-slate-400">
                      <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">consultant</span>
                      <p className="text-xs font-semibold">Ready to Auditing</p>
                      <p className="text-[10px] mt-1 max-w-xs mx-auto">Click &quot;Audit Ledger&quot; to let secure server-side AI analyze your combined semesters, GPAs, and reflections.</p>
                    </div>
                  )}
                </div>

                {/* Timeline Journal of Reflections & Achievements */}
                <div className="glass-panel rounded-2xl p-6 border border-[#1A1A1A]/10">
                  <h3 className="font-bold text-[#1A1A1A] text-xs uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">book</span>
                    <span>Academic Memory Archival</span>
                  </h3>

                  <div className="space-y-6 relative border-l border-[#1A1A1A]/10 ml-4 pl-6 py-2">
                    {terms.map((term, idx) => (
                      <div key={term.id} className="relative group/timeline">
                        {/* Timeline Elegant Index */}
                        <div className="absolute -left-[35px] top-0 text-[#1A1A1A]/20 text-xl font-light italic w-6 h-6 flex items-center justify-center" style={{ fontFamily: "Georgia, serif" }}>
                          0{idx + 1}
                        </div>

                        <div className="bg-white border border-[#1A1A1A]/5 hover:border-[#1A1A1A]/10 p-5 rounded transition-all">
                          <div className="flex items-baseline justify-between mb-2">
                            <h4 className="font-bold text-[#1A1A1A] text-sm uppercase tracking-wider">{term.title || `Semester ${idx + 1}`}</h4>
                            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest pb-0.5 border-b border-[#1A1A1A]/10">
                              {term.courses.length} courses
                            </span>
                          </div>

                          {/* Reflections info */}
                          {term.reflection ? (
                            <p className="text-xs text-slate-600 italic mt-3 border-l border-[#1A1A1A]/10 pl-3 leading-relaxed">
                              &ldquo;{term.reflection}&rdquo;
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic mt-2.5">
                              No reflective entry written for this period. Enter Grade Dashboard to record highlights.
                            </p>
                          )}

                          {/* Bullet points memory achievements */}
                          {term.bullets && term.bullets.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-[#1A1A1A]/5">
                              <span className="text-[9px] font-mono text-slate-400 block mb-2 uppercase tracking-wider">
                                Highpoints & Milestones:
                              </span>
                              <ul className="space-y-1.5">
                                {term.bullets.map((bullet, bIdx) => (
                                  <li key={bIdx} className="text-xs text-slate-650 flex items-start gap-2">
                                    <span className="text-slate-400 mt-1.5 text-[6px]">&#9632;</span>
                                    <span>{bullet}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Snapshots database list */}
                <div className="glass-panel rounded-2xl p-6 border border-[#1A1A1A]/10">
                  <div className="mb-4">
                    <h3 className="font-bold text-[#1A1A1A] text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px]">restore</span>
                      <span>Milestone Backups</span>
                    </h3>
                  </div>

                  {snapshots.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {snapshots.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white border border-[#1A1A1A]/5 hover:border-[#1A1A1A]/10 p-4 rounded flex flex-col justify-between transition-all"
                        >
                          <div>
                            <div className="flex justify-between items-start border-b border-[#1A1A1A]/5 pb-2 mb-2">
                              <span className="text-[9px] font-mono text-slate-400">
                                {item.timestamp}
                              </span>
                              <button
                                onClick={() => handleDeleteSnapshot(item.id)}
                                className="text-red-500 hover:text-red-700 text-[10px] font-bold uppercase tracking-wider bg-transparent cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                            <h4 className="text-xl font-light italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                              GPA {item.gpa}
                            </h4>
                            <div className="text-[9px] font-mono text-slate-500 mt-1 uppercase tracking-wider">
                              Credits: {item.totalCredits} &bull; Quality Pts: {item.qualityPoints}
                            </div>
                            <p className="text-xs text-slate-600 bg-[#F2F0ED]/50 p-2.5 rounded border border-[#1A1A1A]/5 mt-3 leading-relaxed">
                              &ldquo;{item.note}&rdquo;
                            </p>
                          </div>
                          
                          <button
                            onClick={() => handleRestoreSnapshot(item)}
                            className="w-full mt-4 py-2 border border-[#1A1A1A]/10 hover:border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A]/5 text-[10px] font-bold uppercase tracking-widest rounded transition-all"
                          >
                            Restore Target Scenario
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-[#1A1A1A]/10 rounded text-center text-slate-400">
                      <span className="material-symbols-outlined text-2xl block mb-2 text-slate-300">save_as</span>
                      <p className="text-xs font-semibold">No backup snapshots registered</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                        Commit milestone restore points inside the Grade Dashboard to compare different scenarios safely.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </motion.main>
          ) : (
            /* ==============================================
               2. MAIN GPA TRACKER DASHBOARD VIEW
               ============================================== */
            <motion.main
              key="dashboard-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex-grow w-full max-w-7xl mx-auto px-4 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pb-24"
              id="dashboardView"
            >
              {/* LEFT COLUMN: Sticky Hero Stats & Grading Scale Table */}
              <section className="lg:col-span-5 lg:sticky lg:top-28 flex flex-col gap-6">
                
                {/* UC Mode Activation Toggle Bar */}
                <div className="glass-panel rounded-2xl p-4 border border-[#1A1A1A]/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-800">
                      <span className="material-symbols-outlined text-[20px]">school</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">UC Admissions GPA Mode</div>
                      <div className="text-[10px] text-slate-500">Calculate official University of California Capped & Weighted GPAs</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={useUcGpa}
                      onChange={(e) => syncUseUcGpa(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1A1A1A]"
                         style={{ backgroundColor: useUcGpa ? currentAccent.color : undefined }}
                    ></div>
                  </label>
                </div>

                {/* Main GPA Display Card */}
                <div className="glass-panel rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden border border-[#1A1A1A]/10">
                  {useUcGpa ? (
                    <>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100/70 border border-amber-300/60 text-amber-900 text-[10px] font-bold uppercase tracking-widest mb-3">
                        <span className="material-symbols-outlined text-[13px]">verified</span>
                        <span>UC Admissions Benchmark</span>
                      </div>
                      <h1 className="text-7xl lg:text-8xl font-light italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif", color: currentAccent.color }}>
                        {ucTotals.cappedWeightedGpa}
                      </h1>
                      <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mb-1">Capped Weighted GPA</p>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-center gap-2 mt-1">
                        <span>Fully Weighted: <strong className="text-slate-800">{ucTotals.fullyWeightedGpa}</strong></span>
                        <span>&bull;</span>
                        <span>Unweighted: <strong className="text-slate-800">{ucTotals.unweightedGpa}</strong></span>
                      </div>

                      {/* UC Stats Grid matching Image 1: Base Points, Total Courses, Honors Points */}
                      <div className="grid grid-cols-3 gap-2.5 w-full mt-6">
                        <div className="bg-white border border-[#1A1A1A]/10 p-3 rounded flex flex-col items-center gap-0.5">
                          <span className="text-slate-500 text-[8.5px] uppercase tracking-wider font-bold">Total Base Points</span>
                          <span className="text-2xl font-light italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif", color: currentAccent.color }}>
                            {ucTotals.tenthEleventhBasePoints}
                          </span>
                          <span className="text-[7.5px] text-slate-400">A=4, B=3, C=2...</span>
                        </div>
                        <div className="bg-white border border-[#1A1A1A]/10 p-3 rounded flex flex-col items-center gap-0.5">
                          <span className="text-slate-500 text-[8.5px] uppercase tracking-wider font-bold">Total Courses</span>
                          <span className="text-2xl font-light italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                            {ucTotals.tenthEleventhCoursesCount}
                          </span>
                          <span className="text-[7.5px] text-slate-400">10th &amp; 11th A-G</span>
                        </div>
                        <div className="bg-white border border-[#1A1A1A]/10 p-3 rounded flex flex-col items-center gap-0.5">
                          <span className="text-slate-500 text-[8.5px] uppercase tracking-wider font-bold">Capped Honors</span>
                          <span className="text-2xl font-light italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                            {ucTotals.honorsPointsApplied} / 8
                          </span>
                          <span className="text-[7.5px] text-slate-400">{ucTotals.honorsPointsPotential} uncapped</span>
                        </div>
                      </div>

                      {/* Formula Step-by-Step Breakdown (Image 1) */}
                      <div className="w-full mt-3 p-2.5 bg-amber-50/70 border border-amber-200/70 rounded-lg text-left space-y-1.5 font-mono text-[10px]">
                        <div className="flex justify-between items-center text-amber-950 font-bold border-b border-amber-200/60 pb-1">
                          <span className="font-sans text-[9px] uppercase tracking-wider">UC Capped GPA Formula:</span>
                          <span>({ucTotals.tenthEleventhBasePoints} + {ucTotals.honorsPointsApplied}) ÷ {ucTotals.tenthEleventhCoursesCount || 1} = {ucTotals.cappedWeightedGpa}</span>
                        </div>
                        <div className="flex justify-between text-slate-700 text-[9.5px]">
                          <span className="font-sans">UC Unweighted Formula:</span>
                          <span>{ucTotals.tenthEleventhBasePoints} ÷ {ucTotals.tenthEleventhCoursesCount || 1} = <strong>{ucTotals.unweightedGpa}</strong></span>
                        </div>
                        <div className="flex justify-between text-slate-700 text-[9.5px]">
                          <span className="font-sans">UC Fully Weighted:</span>
                          <span>({ucTotals.tenthEleventhBasePoints} + {ucTotals.honorsPointsPotential}) ÷ {ucTotals.tenthEleventhCoursesCount || 1} = <strong>{ucTotals.fullyWeightedGpa}</strong></span>
                        </div>
                        <div className="text-[8.5px] text-amber-800/80 pt-0.5 font-sans italic border-t border-amber-200/40">
                          ⚡ Truncates to two decimals without rounding per UC official guidelines (e.g. 200 ÷ 52 = 3.84). Max 8 honors points (max 4 from 10th grade).
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Standard GPA Header & Primary Focus Selector */}
                      <div className="flex items-center justify-center p-1 bg-slate-100 rounded-xl mb-3 text-[10px] font-bold uppercase tracking-wider">
                        <button
                          type="button"
                          onClick={() => syncPrimaryGpaFocus("unweighted")}
                          className={`px-3 py-1 rounded-lg transition-all ${
                            primaryGpaFocus === "unweighted"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          Unweighted 4.33
                        </button>
                        <button
                          type="button"
                          onClick={() => syncPrimaryGpaFocus("weighted")}
                          className={`px-3 py-1 rounded-lg transition-all ${
                            primaryGpaFocus === "weighted"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          Weighted (+AP/IB)
                        </button>
                      </div>

                      {primaryGpaFocus === "unweighted" ? (
                        <>
                          <h1 className="text-7xl lg:text-8xl font-light italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif", color: currentAccent.color }}>
                            {totals.unweightedGpa}
                          </h1>
                          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mb-1">
                            Official Unweighted GPA (4.33 Scale)
                          </p>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-center gap-2 mt-1">
                            <span>Weighted: <strong className="text-slate-800">{totals.gpa}</strong></span>
                            <span>&bull;</span>
                            <span>Collegiate 4.00: <strong className="text-slate-800">{totals.collegiateUnweightedGpa}</strong></span>
                          </div>
                        </>
                      ) : (
                        <>
                          <h1 className="text-7xl lg:text-8xl font-light italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif", color: currentAccent.color }}>
                            {totals.gpa}
                          </h1>
                          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mb-1">
                            Standard Weighted GPA
                          </p>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-center gap-2 mt-1">
                            <span>Unweighted 4.33: <strong className="text-slate-800">{totals.unweightedGpa}</strong></span>
                            <span>&bull;</span>
                            <span>Collegiate 4.00: <strong className="text-slate-800">{totals.collegiateUnweightedGpa}</strong></span>
                          </div>
                        </>
                      )}

                      {/* Normal GPA Stats Grid: Sum of (Grade Point × Credits) / Total Credits */}
                      <div className="grid grid-cols-2 gap-3 w-full mt-6">
                        <div className="bg-white border border-[#1A1A1A]/10 p-3 rounded flex flex-col items-center gap-0.5">
                          <span className="text-slate-500 text-[8.5px] uppercase tracking-wider font-bold">Sum of (GP × Credits)</span>
                          <span className="text-2xl font-light italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif", color: currentAccent.color }}>
                            {primaryGpaFocus === "unweighted" ? totals.unweightedQualityPoints : totals.qualityPoints}
                          </span>
                          <span className="text-[7.5px] text-slate-400">
                            {primaryGpaFocus === "unweighted" ? "Unweighted QP" : "Total Quality Points"}
                          </span>
                        </div>
                        <div className="bg-white border border-[#1A1A1A]/10 p-3 rounded flex flex-col items-center gap-0.5">
                          <span className="text-slate-500 text-[8.5px] uppercase tracking-wider font-bold">Total Credits</span>
                          <span className="text-2xl font-light italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                            {totals.totalCredits}
                          </span>
                          <span className="text-[7.5px] text-slate-400">Completed Hours</span>
                        </div>
                      </div>

                      {/* Formula Step-by-Step Breakdown */}
                      <div className="w-full mt-3 p-2.5 bg-slate-50 border border-slate-200/70 rounded-lg text-left space-y-1 font-mono text-[10px]">
                        <div className="flex justify-between items-center text-slate-900 font-bold">
                          <span className="font-sans text-[9px] uppercase tracking-wider text-slate-500">
                            {primaryGpaFocus === "unweighted" ? "Unweighted GPA Formula:" : "Weighted GPA Formula:"}
                          </span>
                          <span>
                            {primaryGpaFocus === "unweighted"
                              ? `${totals.unweightedQualityPoints} ÷ ${totals.totalCredits || 1} = ${totals.unweightedGpa}`
                              : `${totals.qualityPoints} ÷ ${totals.totalCredits || 1} = ${totals.gpa}`}
                          </span>
                        </div>
                        <div className="text-[8.5px] text-slate-400 font-sans italic pt-0.5 border-t border-slate-200/50">
                          Formula: GPA = Sum of (Grade Point × Credits) ÷ Total Credits
                        </div>
                      </div>
                    </>
                  )}

                  <hr className="w-full border-[#1A1A1A]/10 my-5" />

                  {/* Options: Take Local Snapshot Backups */}
                  <button
                    onClick={() => setIsSnapshotModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1A1A1A] hover:bg-[#2C2C2C] text-white font-bold rounded text-[10px] uppercase tracking-[0.15em] transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>Commit Live GPA Snapshot</span>
                  </button>
                </div>

                {/* Detailed Academic Ledger & Score Sum Card */}
                <div className="glass-panel rounded-2xl p-5 border border-[#1A1A1A]/10">
                  <div className="flex items-center justify-between mb-4 border-b border-[#1A1A1A]/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-[#1A1A1A]/5 p-1.5 rounded text-[#1A1A1A] flex items-center justify-center" style={{ color: currentAccent.color }}>
                        <span className="material-symbols-outlined text-[18px]">query_stats</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1A1A1A] text-xs uppercase tracking-[0.15em]" style={{ color: currentAccent.color }}>
                          Academic Ledger &amp; Score Sum
                        </h3>
                        <span className="text-[9px] text-slate-500">Live Course &amp; Performance Audit</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                      {detailedSummary.totalCoursesCount} Courses
                    </span>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center mb-4">
                    <div className="p-2.5 bg-white border border-[#1A1A1A]/10 rounded flex flex-col">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Total Credits</span>
                      <span className="text-xl font-light italic mt-0.5 text-slate-900" style={{ fontFamily: "Georgia, serif" }}>
                        {detailedSummary.totalCredits}
                      </span>
                      <span className="text-[7.5px] text-slate-400">Completed Hours</span>
                    </div>
                    <div className="p-2.5 bg-white border border-[#1A1A1A]/10 rounded flex flex-col">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Score Average</span>
                      <span className="text-xl font-light italic mt-0.5" style={{ fontFamily: "Georgia, serif", color: currentAccent.color }}>
                        {detailedSummary.avgScore}%
                      </span>
                      <span className="text-[7.5px] text-slate-400">All Graded Courses</span>
                    </div>
                    <div className="p-2.5 bg-white border border-[#1A1A1A]/10 rounded flex flex-col col-span-2 sm:col-span-1">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Unweighted QP</span>
                      <span className="text-xl font-light italic mt-0.5 text-slate-900" style={{ fontFamily: "Georgia, serif" }}>
                        {detailedSummary.totalUnweightedQP}
                      </span>
                      <span className="text-[7.5px] text-slate-400">Sum of (GP × Cr)</span>
                    </div>
                  </div>

                  {/* Score Extremes & Range */}
                  <div className="p-2.5 bg-slate-50/90 border border-slate-200/70 rounded-lg text-xs mb-4 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-medium">Highest Scored Course:</span>
                      <span className="font-bold text-slate-800 truncate ml-2">
                        {detailedSummary.highestCourse ? `${(detailedSummary.highestCourse as any).name} (${(detailedSummary.highestCourse as any).score}%)` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-medium">Lowest Scored Course:</span>
                      <span className="font-bold text-slate-800 truncate ml-2">
                        {detailedSummary.lowestCourse ? `${(detailedSummary.lowestCourse as any).name} (${(detailedSummary.lowestCourse as any).score}%)` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">Weighted Quality Points Sum:</span>
                      <span className="font-mono font-bold text-slate-800">{detailedSummary.totalWeightedQP} QP</span>
                    </div>
                  </div>

                  {/* Grade Distribution Spectrum */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      <span>Grade Distribution Spectrum</span>
                      <span>{detailedSummary.totalCoursesCount} Total</span>
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-11 gap-1 text-center font-mono">
                      {Object.entries(detailedSummary.gradeCounts).map(([grd, count]) => (
                        <div key={grd} className="bg-white border border-[#1A1A1A]/10 rounded py-1 px-0.5 flex flex-col items-center">
                          <span className="text-[8px] font-bold text-slate-500">{grd}</span>
                          <span className={`text-[11px] font-bold ${count > 0 ? "text-slate-900" : "text-slate-300"}`}>
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-Semester Breakdown Ledger Table */}
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Semester Breakdown Ledger
                    </div>
                    <div className="overflow-x-auto border border-[#1A1A1A]/10 rounded-lg bg-white">
                      <table className="w-full text-left text-[10px] font-mono">
                        <thead className="bg-slate-50/90 text-slate-500 uppercase text-[8px] tracking-wider border-b border-slate-200/60">
                          <tr>
                            <th className="py-1.5 px-2 font-bold">Term / Grade</th>
                            <th className="py-1.5 px-1 font-bold text-center">Courses</th>
                            <th className="py-1.5 px-1 font-bold text-center">Credits</th>
                            <th className="py-1.5 px-1 font-bold text-center">Avg %</th>
                            <th className="py-1.5 px-1.5 font-bold text-right text-slate-800">Unwtd</th>
                            <th className="py-1.5 px-2 font-bold text-right">Wtd</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {detailedSummary.semesterSummaries.map((s, idx) => (
                            <tr key={s.id || idx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-1.5 px-2 font-sans font-medium text-slate-900 truncate max-w-[100px]" title={s.title}>
                                {s.title}
                              </td>
                              <td className="py-1.5 px-1 text-center">{s.courseCount}</td>
                              <td className="py-1.5 px-1 text-center font-bold">{s.credits}</td>
                              <td className="py-1.5 px-1 text-center">{s.avgScore}%</td>
                              <td className="py-1.5 px-1.5 text-right font-bold text-slate-900" style={{ color: currentAccent.color }}>
                                {s.unweightedGpa}
                              </td>
                              <td className="py-1.5 px-2 text-right">{s.weightedGpa}</td>
                            </tr>
                          ))}
                          {detailedSummary.semesterSummaries.length > 1 && (
                            <tr className="bg-slate-50/80 font-bold border-t border-slate-200 text-slate-900">
                              <td className="py-1.5 px-2 font-sans uppercase text-[8px] tracking-wider">Total Ledger</td>
                              <td className="py-1.5 px-1 text-center">{detailedSummary.totalCoursesCount}</td>
                              <td className="py-1.5 px-1 text-center">{detailedSummary.totalCredits}</td>
                              <td className="py-1.5 px-1 text-center">{detailedSummary.avgScore}%</td>
                              <td className="py-1.5 px-1.5 text-right text-slate-950 font-black" style={{ color: currentAccent.color }}>
                                {detailedSummary.overallUnweightedGpa}
                              </td>
                              <td className="py-1.5 px-2 text-right">{detailedSummary.overallWeightedGpa}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* UC A-G Requirement Tracker OR Grading Scale Table */}
                {useUcGpa ? (
                  <div className="glass-panel rounded-2xl p-5 border border-[#1A1A1A]/10">
                    <div className="flex items-center justify-between mb-4 border-b border-[#1A1A1A]/10 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-[#1A1A1A]/5 p-1.5 rounded text-[#1A1A1A] flex items-center justify-center" style={{ color: currentAccent.color }}>
                          <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-[#1A1A1A] text-xs uppercase tracking-[0.15em]" style={{ color: currentAccent.color }}>A-G Subject Progress</h3>
                          <div className="text-[9px] text-slate-500">UC minimum high school requirements</div>
                        </div>
                      </div>
                      <button
                        onClick={handleAutoDetectUcTypes}
                        disabled={isDetectingUcTypes}
                        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-[#1A1A1A] hover:bg-[#2C2C2C] text-white flex items-center gap-1 transition-all disabled:opacity-50"
                        title="Auto-classify courses with Gemini 3.5 Flash-Lite"
                      >
                        <span className={`material-symbols-outlined text-[14px] ${isDetectingUcTypes ? "animate-spin" : "text-amber-300"}`}>
                          {isDetectingUcTypes ? "progress_activity" : "auto_awesome"}
                        </span>
                        <span>{isDetectingUcTypes ? "Classifying..." : "Auto-Detect (AI)"}</span>
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                      {ucTotals.agProgress.map((item) => {
                        const pct = Math.min(100, Math.round((item.completedCredits / (item.requiredCredits || 1)) * 100));
                        return (
                          <div key={item.code} className="p-2.5 bg-white/70 border border-[#1A1A1A]/5 rounded-lg">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-[10px] font-mono">
                                  {item.code}
                                </span>
                                <span>{item.name}</span>
                              </span>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.isSatisfied ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                {item.completedCredits} / {item.requiredCredits} yrs {item.isSatisfied ? '✔' : ''}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-300 ${item.isSatisfied ? 'bg-emerald-500' : 'bg-[#1A1A1A]'}`}
                                style={{ width: `${pct}%`, backgroundColor: item.isSatisfied ? undefined : currentAccent.color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {ucTotals.totalNonAgCredits > 0 && (
                      <div className="mt-3 p-2 bg-slate-50 border border-slate-200/60 rounded text-[9.5px] text-slate-500 flex items-center justify-between">
                        <span>Non-A-G Credits (e.g. PE, Health):</span>
                        <strong>{ucTotals.totalNonAgCredits} Cr (Excluded)</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Grading Scale Table UI */
                  <div className="glass-panel rounded-2xl p-5 border border-[#1A1A1A]/10">
                    <div className="flex items-center gap-2 mb-4 border-b border-[#1A1A1A]/10 pb-3">
                      <div className="bg-[#1A1A1A]/5 p-1.5 rounded text-[#1A1A1A] flex items-center justify-center" style={{ color: currentAccent.color }}>
                        <span className="material-symbols-outlined text-[20px]">analytics</span>
                      </div>
                      <h3 className="font-bold text-[#1A1A1A] text-xs uppercase tracking-[0.15em]" style={{ color: currentAccent.color }}>Grading Scale (4.33)</h3>
                    </div>
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1">
                      <table className="w-full text-xs text-left text-slate-600">
                        <thead className="text-[10px] text-slate-500 uppercase bg-[#F2F0ED]/50 sticky top-0 z-10 backdrop-blur-sm">
                          <tr>
                            <th className="px-3 py-2 rounded-l" scope="col">Range</th>
                            <th className="px-3 py-2" scope="col">Grade</th>
                            <th className="px-3 py-2 rounded-r text-right" scope="col">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1A1A1A]/5">
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-800">97 – 100</td>
                            <td className="px-3 py-2 font-bold text-slate-500">A+</td>
                            <td className="px-3 py-2 text-right font-bold text-[#1A1A1A]">4.33</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-800">93 – 96</td>
                            <td className="px-3 py-2 font-bold text-slate-500">A</td>
                            <td className="px-3 py-2 text-right font-bold text-[#1A1A1A]">{useLinearGpa ? "4.00 – 4.32" : "4.00"}</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-800">90 – 92</td>
                            <td className="px-3 py-2 font-bold text-slate-500">A-</td>
                            <td className="px-3 py-2 text-right font-bold text-[#1A1A1A]">{useLinearGpa ? "3.67 – 3.99" : "3.67"}</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-800">87 – 89</td>
                            <td className="px-3 py-2 font-bold text-slate-500">B+</td>
                            <td className="px-3 py-2 text-right font-bold text-[#1A1A1A]">{useLinearGpa ? "3.33 – 3.66" : "3.33"}</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-800">83 – 86</td>
                            <td className="px-3 py-2 font-bold text-slate-500">B</td>
                            <td className="px-3 py-2 text-right font-bold text-[#1A1A1A]">{useLinearGpa ? "3.00 – 3.32" : "3.00"}</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-800">80 – 82</td>
                            <td className="px-3 py-2 font-bold text-slate-500">B-</td>
                            <td className="px-3 py-2 text-right font-bold text-[#1A1A1A]">{useLinearGpa ? "2.67 – 2.99" : "2.67"}</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-800">77 – 79</td>
                            <td className="px-3 py-2 font-bold text-slate-500">C+</td>
                            <td className="px-3 py-2 text-right font-bold text-[#1A1A1A]">{useLinearGpa ? "2.33 – 2.66" : "2.33"}</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-800">73 – 76</td>
                            <td className="px-3 py-2 font-bold text-slate-500">C</td>
                            <td className="px-3 py-2 text-right font-bold text-[#1A1A1A]">{useLinearGpa ? "2.00 – 2.32" : "2.00"}</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-800">70 – 72</td>
                            <td className="px-3 py-2 font-bold text-slate-500">C-</td>
                            <td className="px-3 py-2 text-right font-bold text-[#1A1A1A]">{useLinearGpa ? "1.67 – 1.99" : "1.67"}</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-800">65 – 69</td>
                            <td className="px-3 py-2 font-bold text-slate-500">D</td>
                            <td className="px-3 py-2 text-right font-bold text-[#1A1A1A]">{useLinearGpa ? "1.00 – 1.66" : "1.00"}</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-850">Below 65</td>
                            <td className="px-3 py-2 font-bold text-red-500">F</td>
                            <td className="px-3 py-2 text-right font-bold text-red-650">0.00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={() => setIsScaleModalOpen(true)}
                      className="w-full mt-3 text-[10px] uppercase tracking-wider text-center text-slate-500 hover:text-[#1A1A1A] transition-colors focus:outline-none"
                    >
                      View All Ranges
                    </button>
                  </div>
                )}

                {/* Academic Customization Card */}
                <div className="glass-panel rounded-2xl p-5 border border-[#1A1A1A]/10 mt-6 animate-fade-in">
                  <div className="flex items-center gap-2 mb-4 border-b border-[#1A1A1A]/10 pb-3">
                    <div className="bg-[#1A1A1A]/5 p-1.5 rounded flex items-center justify-center" style={{ color: currentAccent.color }}>
                      <span className="material-symbols-outlined text-[20px]">palette</span>
                    </div>
                    <h3 className="font-bold text-[#1A1A1A] text-xs uppercase tracking-[0.15em]" style={{ color: currentAccent.color }}>Academic Customizer</h3>
                  </div>

                  {/* 1. Theme selection */}
                  <div className="mb-4">
                    <label className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1.5 block">Signature Style Ink</label>
                    <div className="grid grid-cols-2 gap-2">
                      {INK_ACCENTS.map((accent) => (
                        <button
                          key={accent.name}
                          onClick={() => {
                            setActiveAccent(accent.name);
                            localStorage.setItem("gpaTracker_accent", accent.name);
                          }}
                          className={`flex items-center gap-1.5 p-2 rounded text-[10px] font-bold text-left border transition-all ${
                            activeAccent === accent.name
                              ? "bg-slate-50"
                              : "border-transparent hover:border-[#1A1A1A]/10 bg-transparent text-slate-600"
                          }`}
                          style={{
                            borderColor: activeAccent === accent.name ? currentAccent.color : "transparent",
                          }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: accent.color }}
                          />
                          <span style={{ color: activeAccent === accent.name ? currentAccent.color : "inherit" }}>
                            {accent.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rounding selection */}
                  <div className="pt-3 border-t border-[#1A1A1A]/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col pr-4">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-0.5 block">Round Score Decimals</span>
                        <span className="text-[9.5px] text-slate-500 leading-snug">
                          Interpret decimals with standard rounding (e.g. 96.5 &rarr; 97, 96.4 &rarr; 96) for all courses.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input
                          type="checkbox"
                          checked={roundScores}
                          onChange={(e) => syncRoundScores(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1A1A1A]"
                             style={{ backgroundColor: roundScores ? currentAccent.color : undefined }}
                        ></div>
                      </label>
                    </div>
                  </div>

                  {/* GPA Calculation Mode Toggle */}
                  <div className="pt-3 border-t border-[#1A1A1A]/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col pr-4">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-0.5 block">Linear GPA Scaling</span>
                        <span className="text-[9.5px] text-slate-500 leading-snug">
                          When enabled, grade points are calculated linearly within score ranges. When disabled, standard flat grade points (Normal) are used.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input
                          type="checkbox"
                          checked={useLinearGpa}
                          onChange={(e) => syncUseLinearGpa(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1A1A1A]"
                             style={{ backgroundColor: useLinearGpa ? currentAccent.color : undefined }}
                        ></div>
                      </label>
                    </div>
                  </div>

                  {/* UC Mode Toggle in Customizer */}
                  <div className="pt-3 border-t border-[#1A1A1A]/5">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col pr-4">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-0.5 block">UC Admissions GPA Mode</span>
                        <span className="text-[9.5px] text-slate-500 leading-snug">
                          Activate University of California 10th-11th grade calculation with A-G subject tracking & 8-semester honors cap.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input
                          type="checkbox"
                          checked={useUcGpa}
                          onChange={(e) => syncUseUcGpa(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1A1A1A]"
                             style={{ backgroundColor: useUcGpa ? currentAccent.color : undefined }}
                        ></div>
                      </label>
                    </div>
                  </div>

                  {/* Gemini API Key Setting */}
                  <div className="pt-3 border-t border-[#1A1A1A]/5">
                    <label className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">Gemini API Key (Optional Override)</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="AIzaSy... (leave blank to use server environment)"
                        value={customGeminiApiKey}
                        onChange={(e) => syncCustomGeminiApiKey(e.target.value)}
                        className="flex-grow p-1.5 text-xs border border-[#1A1A1A]/10 rounded bg-white focus:outline-none font-mono"
                      />
                      {customGeminiApiKey && (
                        <button
                          type="button"
                          onClick={() => syncCustomGeminiApiKey("")}
                          className="px-2 py-1 text-[10px] text-slate-500 hover:text-red-500 rounded border border-[#1A1A1A]/10"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 block">Used for Gemini 3.5 Flash-Lite transcript parsing and UC type auto-detection.</span>
                  </div>

                  {/* 2. Custom Category Addition */}
                  <div className="pt-3 border-t border-[#1A1A1A]/5">
                    <label className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-1.5 block">Create Customized Course Category</label>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        const catName = (data.get("newCat") as string)?.trim();
                        if (catName) {
                          if (customCategories.includes(catName) || predefinedCourseCategories[catName]) {
                            showAlert(`"${catName}" already exists!`);
                            return;
                          }
                          const updated = [...customCategories, catName];
                          setCustomCategories(updated);
                          localStorage.setItem("gpaTracker_customCategories", JSON.stringify(updated));
                          showAlert(`Created category: "${catName}"! You can now select it on any course row.`);
                          e.currentTarget.reset();
                        } else {
                          showAlert("Please type a category name first.");
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input
                        name="newCat"
                        type="text"
                        placeholder="e.g. Science Labs, IB Seminar"
                        className="flex-grow p-2 text-xs border border-[#1A1A1A]/10 rounded bg-white focus:outline-none"
                        style={{
                          borderColor: "rgba(26,26,26,0.1)",
                        }}
                      />
                      <button
                        type="submit"
                        className="py-2 px-3 text-[10px] uppercase font-bold tracking-widest text-white rounded transition-all flex items-center justify-center cursor-pointer"
                        style={{ backgroundColor: currentAccent.color }}
                      >
                        Add
                      </button>
                    </form>
                  </div>
                </div>
              </section>

              {/* RIGHT COLUMN: Course Inputs & Semesters */}
              <section className="lg:col-span-7 flex flex-col gap-6 pb-20">
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 pb-3 border-b border-[#1A1A1A]/10">
                  <div>
                    <h2 className="text-[#1A1A1A] font-light italic text-4xl tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
                      My Courses
                    </h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
                      Academic Record Entry &amp; Audit
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {/* View Layout Mode Toggle */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/70 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => syncViewLayoutMode("separate")}
                        className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 ${
                          viewLayoutMode === "separate"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                        title="View and edit individual semesters sequentially"
                      >
                        <span className="material-symbols-outlined text-[14px]">view_agenda</span>
                        <span>Single Semesters</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => syncViewLayoutMode("combined_year")}
                        className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 ${
                          viewLayoutMode === "combined_year"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                        title="Combine Sem 1 & Sem 2 side by side per academic year (matching transcripts)"
                      >
                        <span className="material-symbols-outlined text-[14px]">view_column</span>
                        <span>Combined 2-Sem Year</span>
                      </button>
                    </div>

                    {/* Summary Display Mode Toggle */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/70 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => syncSummaryDisplayMode("2row")}
                        className={`px-2 py-1 rounded transition-all ${
                          summaryDisplayMode === "2row"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                        title="Show 2-row comparison summary of Semester 1 vs Semester 2"
                      >
                        2-Row Summary
                      </button>
                      <button
                        type="button"
                        onClick={() => syncSummaryDisplayMode("compact")}
                        className={`px-2 py-1 rounded transition-all ${
                          summaryDisplayMode === "compact"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                        title="Compact summary pills"
                      >
                        Compact
                      </button>
                      <button
                        type="button"
                        onClick={() => syncSummaryDisplayMode("hidden")}
                        className={`px-2 py-1 rounded transition-all ${
                          summaryDisplayMode === "hidden"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                        title="Hide term summaries"
                      >
                        Hide
                      </button>
                    </div>

                    <button
                      onClick={handleResetDashboard}
                      className="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors flex items-center gap-1 py-1 px-2.5 hover:bg-red-50 rounded focus:outline-none ml-auto"
                      id="resetBtn"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete_sweep</span> Reset
                    </button>
                  </div>
                </header>

                {/* MAIN CONTAINER FOR SEMESTERS */}
                <div id="allTermsContainer" className="flex flex-col gap-10">
                  {viewLayoutMode === "combined_year" ? (
                    /* =======================================================
                       COMBINED 2-SEMESTER ACADEMIC YEAR VIEW
                       (Pairs Sem 1 & Sem 2 side by side per subject)
                       ======================================================= */
                    academicYears.map((ay, ayIdx) => {
                      const sem1 = ay.terms[0];
                      const sem2 = ay.terms[1];
                      const sem1Sum = detailedSummary.semesterSummaries.find((s) => s.id === sem1?.id);
                      const sem2Sum = sem2 ? detailedSummary.semesterSummaries.find((s) => s.id === sem2.id) : null;

                      return (
                        <div key={ay.yearLabel + ayIdx} className="term-block animate-fade-in py-1">
                          {/* Academic Year Header */}
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 group relative pb-2 border-b border-[#1A1A1A]/10">
                            <div className="flex items-center gap-3">
                              <h3 className="text-2xl font-light italic text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                                {ay.yearLabel}
                              </h3>
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                Grade {ay.gradeLevel}
                              </span>
                              {useUcGpa && (ay.gradeLevel === "10" || ay.gradeLevel === "11") && (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-300/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[11px] text-amber-600">verified</span>
                                  <span>Counted in UC GPA (10th/11th)</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-slate-500 font-mono text-[10px]">
                                Year Combined: <strong className="text-slate-900">{ay.stats.credits} Cr</strong> &bull; Unwtd:{" "}
                                <strong className="text-slate-900" style={{ color: currentAccent.color }}>
                                  {ay.stats.unweightedGpa}
                                </strong>{" "}
                                &bull; Wtd: <strong className="text-slate-900">{ay.stats.weightedGpa}</strong>
                              </span>
                            </div>
                          </div>

                          {/* 2-Row Semester Summary Table (Comparing Sem 1 vs Sem 2) */}
                          {summaryDisplayMode === "2row" && (
                            <div className="mb-4 overflow-x-auto border border-[#1A1A1A]/10 rounded-xl bg-white p-3 shadow-xs">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">view_timeline</span>
                                  <span>2-Row Semester Audit ({ay.yearLabel})</span>
                                </span>
                                <span className="text-[8px] font-mono text-slate-400">Comparing 1st Semester vs 2nd Semester</span>
                              </div>
                              <table className="w-full text-left text-[10px] font-mono">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-[8px] tracking-wider border-b border-slate-200/60">
                                  <tr>
                                    <th className="py-1 px-2 font-bold">Semester Period</th>
                                    <th className="py-1 px-1 font-bold text-center">Courses</th>
                                    <th className="py-1 px-1 font-bold text-center">Credits</th>
                                    <th className="py-1 px-1 font-bold text-center">Avg %</th>
                                    <th className="py-1 px-1.5 font-bold text-right text-slate-800">Unwtd GPA</th>
                                    <th className="py-1 px-2 font-bold text-right">Wtd GPA</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {sem1Sum && (
                                    <tr className="hover:bg-slate-50/60">
                                      <td className="py-1.5 px-2 font-sans font-medium text-slate-900 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                                        <span>{sem1Sum.title}</span>
                                      </td>
                                      <td className="py-1.5 px-1 text-center">{sem1Sum.courseCount}</td>
                                      <td className="py-1.5 px-1 text-center font-bold">{sem1Sum.credits}</td>
                                      <td className="py-1.5 px-1 text-center">{sem1Sum.avgScore}%</td>
                                      <td className="py-1.5 px-1.5 text-right font-bold text-slate-900" style={{ color: currentAccent.color }}>
                                        {sem1Sum.unweightedGpa}
                                      </td>
                                      <td className="py-1.5 px-2 text-right">{sem1Sum.weightedGpa}</td>
                                    </tr>
                                  )}
                                  {sem2Sum ? (
                                    <tr className="hover:bg-slate-50/60">
                                      <td className="py-1.5 px-2 font-sans font-medium text-slate-900 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                                        <span>{sem2Sum.title}</span>
                                      </td>
                                      <td className="py-1.5 px-1 text-center">{sem2Sum.courseCount}</td>
                                      <td className="py-1.5 px-1 text-center font-bold">{sem2Sum.credits}</td>
                                      <td className="py-1.5 px-1 text-center">{sem2Sum.avgScore}%</td>
                                      <td className="py-1.5 px-1.5 text-right font-bold text-slate-900" style={{ color: currentAccent.color }}>
                                        {sem2Sum.unweightedGpa}
                                      </td>
                                      <td className="py-1.5 px-2 text-right">{sem2Sum.weightedGpa}</td>
                                    </tr>
                                  ) : (
                                    <tr className="text-slate-400 italic">
                                      <td className="py-1.5 px-2 font-sans" colSpan={6}>
                                        2nd Semester not yet registered for this grade.
                                      </td>
                                    </tr>
                                  )}
                                  <tr className="bg-slate-50/90 font-bold border-t border-slate-200 text-slate-900">
                                    <td className="py-1.5 px-2 font-sans uppercase text-[8px] tracking-wider">Combined Year Total</td>
                                    <td className="py-1.5 px-1 text-center">{ay.stats.coursesCount}</td>
                                    <td className="py-1.5 px-1 text-center">{ay.stats.credits}</td>
                                    <td className="py-1.5 px-1 text-center">
                                      {sem1Sum && sem2Sum
                                        ? ((parseFloat(sem1Sum.avgScore) + parseFloat(sem2Sum.avgScore)) / 2).toFixed(1) + "%"
                                        : sem1Sum?.avgScore + "%"}
                                    </td>
                                    <td className="py-1.5 px-1.5 text-right text-slate-950 font-black" style={{ color: currentAccent.color }}>
                                      {ay.stats.unweightedGpa}
                                    </td>
                                    <td className="py-1.5 px-2 text-right">{ay.stats.weightedGpa}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Paired Subject Cards: Sem 1 & Sem 2 in 2 Synchronized Columns */}
                          <div className="course-list flex flex-col gap-4 mb-4">
                            {ay.pairedCourses.map((pairedItem) => {
                              const sem1Course = pairedItem.sem1Course;
                              const sem2Course = pairedItem.sem2Course;
                              const sem1TermId = pairedItem.sem1TermId || sem1?.id;
                              const sem2TermId = pairedItem.sem2TermId || sem2?.id;

                              return (
                                <div
                                  key={pairedItem.key + pairedItem.courseName}
                                  className="glass-card rounded-xl p-4 flex flex-col gap-3 animate-fade-in relative z-10"
                                >
                                  {/* Subject Header */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1A1A1A]/10">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-bold text-slate-900 text-sm">
                                        {pairedItem.courseName || "Untitled Course"}
                                      </span>
                                      <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                        {pairedItem.category}
                                      </span>
                                      <span className="text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-900">
                                        UC: {pairedItem.agCategory}
                                      </span>
                                      {(sem1Course?.level || sem2Course?.level) && (
                                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                                          {sem1Course?.level || sem2Course?.level}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 ml-auto">
                                      {sem1Course && sem1TermId && (
                                        <button
                                          onClick={() => handleDeleteCourse(sem1TermId, sem1Course.id)}
                                          className="text-[9px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
                                          title="Delete from Semester 1"
                                        >
                                          Delete S1
                                        </button>
                                      )}
                                      {sem2Course && sem2TermId && (
                                        <button
                                          onClick={() => handleDeleteCourse(sem2TermId, sem2Course.id)}
                                          className="text-[9px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
                                          title="Delete from Semester 2"
                                        >
                                          Delete S2
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Two-Row / Two-Column Semester Entry Box */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Semester 1 Box */}
                                    <div className="p-3 bg-white/70 border border-[#1A1A1A]/10 rounded-lg flex flex-col justify-between">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                          <span>{sem1?.title || "1st Semester"}</span>
                                        </span>
                                        {sem1Course && (
                                          <span className="text-[8px] font-mono text-slate-400">
                                            {sem1Course.credit} Credits
                                          </span>
                                        )}
                                      </div>

                                      {sem1Course && sem1TermId ? (
                                        <div className="grid grid-cols-3 gap-2 items-center">
                                          <div>
                                            <label className="text-[8px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Score (%)</label>
                                            <input
                                              type="number"
                                              className="w-full modern-input rounded text-xs font-bold py-1.5 px-2"
                                              placeholder="0-100"
                                              min="0"
                                              max="100"
                                              value={sem1Course.score}
                                              onChange={(e) => handleUpdateCourseField(sem1TermId, sem1Course.id, "score", e.target.value)}
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[8px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Credits</label>
                                            <input
                                              type="number"
                                              step="any"
                                              className="w-full modern-input rounded text-xs font-semibold py-1.5 px-2"
                                              placeholder="Cr"
                                              min="0"
                                              value={sem1Course.credit}
                                              onChange={(e) => handleUpdateCourseField(sem1TermId, sem1Course.id, "credit", e.target.value)}
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[8px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Result</label>
                                            {(() => {
                                              if (!sem1Course.score) return <div className="text-slate-400 text-[10px]">—</div>;
                                              const sc = parseFloat(sem1Course.score);
                                              const cr = parseFloat(sem1Course.credit) || 0;
                                              const gp = convertScoreToGradePoint(roundScores ? Math.round(sc) : sc, useLinearGpa);
                                              const letG = convertScoreToLetterGrade(roundScores ? Math.round(sc) : sc);
                                              return (
                                                <div className="text-[10px] font-mono font-bold text-slate-900 bg-slate-50 py-1.5 px-1 rounded border border-slate-200/60 text-center">
                                                  {letG} ({gp.toFixed(2)}) &bull; {(gp * cr).toFixed(1)} QP
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="py-2 text-center text-slate-400 text-xs italic">
                                          Not entered in 1st Semester
                                        </div>
                                      )}
                                    </div>

                                    {/* Semester 2 Box */}
                                    <div className="p-3 bg-white/70 border border-[#1A1A1A]/10 rounded-lg flex flex-col justify-between">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          <span>{sem2?.title || "2nd Semester"}</span>
                                        </span>
                                        {sem2Course && (
                                          <span className="text-[8px] font-mono text-slate-400">
                                            {sem2Course.credit} Credits
                                          </span>
                                        )}
                                      </div>

                                      {sem2Course && sem2TermId ? (
                                        <div className="grid grid-cols-3 gap-2 items-center">
                                          <div>
                                            <label className="text-[8px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Score (%)</label>
                                            <input
                                              type="number"
                                              className="w-full modern-input rounded text-xs font-bold py-1.5 px-2"
                                              placeholder="0-100"
                                              min="0"
                                              max="100"
                                              value={sem2Course.score}
                                              onChange={(e) => handleUpdateCourseField(sem2TermId, sem2Course.id, "score", e.target.value)}
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[8px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Credits</label>
                                            <input
                                              type="number"
                                              step="any"
                                              className="w-full modern-input rounded text-xs font-semibold py-1.5 px-2"
                                              placeholder="Cr"
                                              min="0"
                                              value={sem2Course.credit}
                                              onChange={(e) => handleUpdateCourseField(sem2TermId, sem2Course.id, "credit", e.target.value)}
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[8px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Result</label>
                                            {(() => {
                                              if (!sem2Course.score) return <div className="text-slate-400 text-[10px]">—</div>;
                                              const sc = parseFloat(sem2Course.score);
                                              const cr = parseFloat(sem2Course.credit) || 0;
                                              const gp = convertScoreToGradePoint(roundScores ? Math.round(sc) : sc, useLinearGpa);
                                              const letG = convertScoreToLetterGrade(roundScores ? Math.round(sc) : sc);
                                              return (
                                                <div className="text-[10px] font-mono font-bold text-slate-900 bg-slate-50 py-1.5 px-1 rounded border border-slate-200/60 text-center">
                                                  {letG} ({gp.toFixed(2)}) &bull; {(gp * cr).toFixed(1)} QP
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        </div>
                                      ) : sem2TermId && sem1Course ? (
                                        <button
                                          onClick={() => handleEnableCourseInPartnerSemester(sem2TermId, sem1Course)}
                                          className="py-2.5 px-3 border border-dashed border-[#1A1A1A]/20 hover:border-[#1A1A1A]/50 rounded text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
                                        >
                                          <span className="material-symbols-outlined text-[15px]">add_circle</span>
                                          <span>+ Enable in {sem2?.title || "2nd Semester"}</span>
                                        </button>
                                      ) : (
                                        <div className="py-2 text-center text-slate-400 text-xs italic">
                                          2nd Semester not created
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Add Subject to Year Button */}
                          <button
                            onClick={() => handleAddSubjectToAcademicYear(ay)}
                            className="mt-2 mb-6 w-full py-3.5 rounded border border-dashed border-[#1A1A1A]/20 text-[#1A1A1A] hover:bg-[#1A1A1A]/5 hover:border-[#1A1A1A]/40 font-bold uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-2 group focus:outline-none"
                          >
                            <span className="material-symbols-outlined text-[16px] group-hover:scale-115 transition-transform">add</span>
                            <span>+ Add Subject to {ay.yearLabel} (Both Semesters)</span>
                          </button>

                          <hr className="my-6 border-[#1A1A1A]/10" />
                        </div>
                      );
                    })
                  ) : (
                    terms.map((term, termIdx) => {
                      const ay = academicYears.find((y) => y.terms.some((t) => t.id === term.id));
                      const termSum = detailedSummary.semesterSummaries.find((s) => s.id === term.id);
                      const partnerTerm = ay?.terms.find((t) => t.id !== term.id);
                      const partnerSum = partnerTerm ? detailedSummary.semesterSummaries.find((s) => s.id === partnerTerm.id) : null;

                      return (
                        <div key={term.id} className="term-block animate-fade-in py-1">
                          
                          {/* Term Header Layout */}
                          <div className="flex flex-wrap items-center gap-3 mb-4 group relative">
                            <input
                              type="text"
                              value={term.title}
                              onChange={(e) => handleUpdateTermTitle(term.id, e.target.value)}
                              className="termTitle text-xl font-light italic text-[#1A1A1A] bg-transparent border-0 border-b border-transparent focus:border-[#1A1A1A] focus:ring-0 p-0 transition-all"
                              style={{ fontFamily: "Georgia, serif" }}
                            />
                            <span className="material-symbols-outlined text-slate-400 text-[18px] opacity-0 group-hover:opacity-100 transition-opacity">
                              edit
                            </span>

                            {/* Grade Level Selector */}
                            <div className="flex items-center gap-1.5 ml-1">
                              <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Grade:</label>
                              <select
                                value={term.gradeLevel || inferGradeLevelFromTermTitle(term.title, termIdx)}
                                onChange={(e) => handleUpdateTermGradeLevel(term.id, e.target.value as any)}
                                className="text-[10px] font-bold py-1 px-2 border border-[#1A1A1A]/10 rounded bg-white/80 text-slate-700 cursor-pointer focus:outline-none"
                              >
                                <option value="9">Grade 9</option>
                                <option value="10">Grade 10</option>
                                <option value="11">Grade 11</option>
                                <option value="12">Grade 12</option>
                                <option value="Other">Other</option>
                              </select>

                              {useUcGpa && ((term.gradeLevel || inferGradeLevelFromTermTitle(term.title, termIdx)) === "10" || (term.gradeLevel || inferGradeLevelFromTermTitle(term.title, termIdx)) === "11") && (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-300/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[11px] text-amber-600">verified</span>
                                  <span>Counted in UC GPA</span>
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => handleDeleteTerm(term.id)}
                              className="ml-auto text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-red-700 deleteTermBtn"
                              style={{ display: terms.length === 1 && termIdx === 0 ? "none" : "block" }}
                            >
                              Delete Term
                            </button>
                          </div>

                          {/* 2-Row Semester Summary Banner */}
                          {summaryDisplayMode === "2row" && (
                            <div className="mb-4 overflow-x-auto border border-[#1A1A1A]/10 rounded-xl bg-white p-3 shadow-xs">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[13px]">view_timeline</span>
                                  <span>2-Row Semester Summary ({ay?.yearLabel || term.title})</span>
                                </span>
                                <span className="text-[8px] font-mono text-slate-400">Comparing Active Term &amp; Partner Semester</span>
                              </div>
                              <table className="w-full text-left text-[10px] font-mono">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-[8px] tracking-wider border-b border-slate-200/60">
                                  <tr>
                                    <th className="py-1 px-2 font-bold">Semester</th>
                                    <th className="py-1 px-1 font-bold text-center">Courses</th>
                                    <th className="py-1 px-1 font-bold text-center">Credits</th>
                                    <th className="py-1 px-1 font-bold text-center">Avg %</th>
                                    <th className="py-1 px-1.5 font-bold text-right text-slate-800">Unwtd</th>
                                    <th className="py-1 px-2 font-bold text-right">Wtd</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {termSum && (
                                    <tr className="bg-slate-50/70 font-semibold">
                                      <td className="py-1.5 px-2 font-sans text-slate-900 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block"></span>
                                        <span>{termSum.title} (Active)</span>
                                      </td>
                                      <td className="py-1.5 px-1 text-center">{termSum.courseCount}</td>
                                      <td className="py-1.5 px-1 text-center font-bold">{termSum.credits}</td>
                                      <td className="py-1.5 px-1 text-center">{termSum.avgScore}%</td>
                                      <td className="py-1.5 px-1.5 text-right font-bold text-slate-900" style={{ color: currentAccent.color }}>
                                        {termSum.unweightedGpa}
                                      </td>
                                      <td className="py-1.5 px-2 text-right">{termSum.weightedGpa}</td>
                                    </tr>
                                  )}
                                  {partnerSum ? (
                                    <tr className="hover:bg-slate-50/50">
                                      <td className="py-1.5 px-2 font-sans text-slate-600 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block"></span>
                                        <span>{partnerSum.title}</span>
                                      </td>
                                      <td className="py-1.5 px-1 text-center">{partnerSum.courseCount}</td>
                                      <td className="py-1.5 px-1 text-center font-bold">{partnerSum.credits}</td>
                                      <td className="py-1.5 px-1 text-center">{partnerSum.avgScore}%</td>
                                      <td className="py-1.5 px-1.5 text-right font-bold text-slate-700">
                                        {partnerSum.unweightedGpa}
                                      </td>
                                      <td className="py-1.5 px-2 text-right">{partnerSum.weightedGpa}</td>
                                    </tr>
                                  ) : (
                                    <tr className="text-slate-400 italic">
                                      <td className="py-1.5 px-2 font-sans" colSpan={6}>
                                        Partner semester not configured for this academic year.
                                      </td>
                                    </tr>
                                  )}
                                  {ay && (
                                    <tr className="bg-slate-50/90 font-bold border-t border-slate-200 text-slate-900">
                                      <td className="py-1 px-2 font-sans uppercase text-[8px] tracking-wider">Combined Year Total</td>
                                      <td className="py-1 px-1 text-center">{ay.stats.coursesCount}</td>
                                      <td className="py-1 px-1 text-center">{ay.stats.credits}</td>
                                      <td className="py-1 px-1 text-center">
                                        {termSum && partnerSum
                                          ? ((parseFloat(termSum.avgScore) + parseFloat(partnerSum.avgScore)) / 2).toFixed(1) + "%"
                                          : termSum?.avgScore + "%"}
                                      </td>
                                      <td className="py-1 px-1.5 text-right text-slate-950 font-black" style={{ color: currentAccent.color }}>
                                        {ay.stats.unweightedGpa}
                                      </td>
                                      <td className="py-1 px-2 text-right">{ay.stats.weightedGpa}</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {summaryDisplayMode === "compact" && termSum && (
                            <div className="mb-3 px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-lg flex flex-wrap items-center justify-between text-[10px] font-mono">
                              <span>Courses: <strong>{termSum.courseCount}</strong></span>
                              <span>&bull;</span>
                              <span>Credits: <strong>{termSum.credits}</strong></span>
                              <span>&bull;</span>
                              <span>Score Avg: <strong>{termSum.avgScore}%</strong></span>
                              <span>&bull;</span>
                              <span>Unwtd GPA: <strong style={{ color: currentAccent.color }}>{termSum.unweightedGpa}</strong></span>
                              <span>&bull;</span>
                              <span>Wtd GPA: <strong>{termSum.weightedGpa}</strong></span>
                            </div>
                          )}

                      {/* Course Card Grid Container */}
                      <div className="course-list flex flex-col gap-4 mb-4">
                        {term.courses.map((course) => {
                          // Autocomplete suggestion filtering across ALL categories
                          const inputValue = course.courseName.toLowerCase();
                          const matchingSuggestions = allPredefinedSuggestions.filter((suggestion) =>
                            suggestion.courseName.toLowerCase().includes(inputValue)
                          );

                          const isAutocompleteActive =
                            activeSuggestionBox?.termId === term.id &&
                            activeSuggestionBox?.courseId === course.id &&
                            inputValue.length > 0 &&
                            matchingSuggestions.length > 0;

                          return (
                            <div
                              key={course.id}
                              className="glass-card rounded-xl p-5 flex flex-col md:flex-row gap-4 items-start md:items-center group animate-fade-in relative z-10 animate-fade-in"
                            >
                              {/* 1. Category Selector */}
                              <div className={`w-full ${useUcGpa ? "md:w-[13%]" : "md:w-[15%]"}`}>
                                <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 mb-1 block">Category</label>
                                <div className="relative">
                                  <select
                                    value={course.category}
                                    onChange={(e) => {
                                      handleUpdateCourseFields(term.id, course.id, {
                                        category: e.target.value,
                                        courseName: "" // reset name on category change
                                      });
                                    }}
                                    className="courseCategory w-full modern-input rounded-lg text-xs font-semibold text-slate-700 py-2.5 pl-3 pr-8 appearance-none cursor-pointer focus:outline-none focus:border-[#1A1A1A] focus:ring-0"
                                  >
                                    {[...Object.keys(predefinedCourseCategories), ...customCategories].map((catName) => (
                                      <option key={catName} value={catName}>
                                        {catName}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                    <span className="material-symbols-outlined text-[18px]">expand_more</span>
                                  </div>
                                </div>
                              </div>

                              {/* UC A-G Area Selector (Shown when UC Mode is active) */}
                              {useUcGpa && (
                                <div className="w-full md:w-[13%]">
                                  <label className="text-[9px] uppercase tracking-wider font-bold text-amber-800 ml-1 mb-1 flex items-center justify-between">
                                    <span>UC A-G</span>
                                    <span className="text-[8px] font-mono px-1 rounded bg-amber-100 text-amber-900 font-bold">{course.agCategory || detectAgCategoryFromName(course.courseName)}</span>
                                  </label>
                                  <div className="relative">
                                    <select
                                      value={course.agCategory || detectAgCategoryFromName(course.courseName)}
                                      onChange={(e) => handleUpdateCourseField(term.id, course.id, "agCategory", e.target.value)}
                                      className="w-full modern-input rounded-lg text-xs font-semibold text-slate-800 py-2.5 pl-2 pr-6 appearance-none cursor-pointer focus:outline-none focus:border-[#1A1A1A]"
                                    >
                                      <option value="A">A: History</option>
                                      <option value="B">B: English</option>
                                      <option value="C">C: Math</option>
                                      <option value="D">D: Science</option>
                                      <option value="E">E: Language</option>
                                      <option value="F">F: Arts</option>
                                      <option value="G">G: Elective</option>
                                      <option value="Non-AG">Non-A-G (PE)</option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-500">
                                      <span className="material-symbols-outlined text-[16px]">expand_more</span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* 2. Course Name with React Autocomplete Dropdown */}
                              <div className="w-full md:w-[22%] relative">
                                <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 mb-1 block">Course Name</label>
                                <input
                                  type="text"
                                  className="courseName w-full modern-input rounded-lg text-xs font-semibold text-slate-750 placeholder-slate-400 py-2.5 px-3 focus:outline-none focus:border-[#1A1A1A] focus:ring-0"
                                  placeholder="e.g. AP Calculus"
                                  value={course.courseName}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const detectedCategory = findCategoryForCourseName(val);
                                    if (detectedCategory) {
                                      handleUpdateCourseFields(term.id, course.id, {
                                        courseName: val,
                                        category: detectedCategory
                                      });
                                    } else {
                                      handleUpdateCourseField(term.id, course.id, "courseName", val);
                                    }
                                    setActiveSuggestionBox({ termId: term.id, courseId: course.id });
                                  }}
                                  onFocus={() => {
                                    setActiveSuggestionBox({ termId: term.id, courseId: course.id });
                                  }}
                                  onBlur={() => {
                                    // Delay to let click on suggestions register beforehand
                                    setTimeout(() => {
                                      setActiveSuggestionBox(null);
                                    }, 180);
                                  }}
                                />

                                {/* Interactive autocomplete matches popup */}
                                {isAutocompleteActive && (
                                  <div className="autocomplete-dropdown block">
                                    {matchingSuggestions.map((item) => (
                                      <div
                                        key={`${item.courseName}-${item.category}`}
                                        onMouseDown={(e) => {
                                          e.preventDefault(); // Prevents triggers from firing on blur
                                          handleSelectAutocompleteValue(term.id, course.id, item.courseName, item.category);
                                        }}
                                        className="flex justify-between items-center py-1.5 px-2 hover:bg-slate-50 cursor-pointer"
                                      >
                                        <span className="font-medium text-slate-800">{item.courseName}</span>
                                        <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase font-bold ml-2 shrink-0">{item.category}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* 3. Course Level Selector */}
                              <div className="w-full md:w-[18%]">
                                <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 mb-1 block">Course Level</label>
                                <div className="relative">
                                  <select
                                    value={course.level || "Regular"}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleUpdateCourseFields(term.id, course.id, {
                                        level: val as any,
                                        weightBoost: val === "Regular" ? "0.0" : val === "Honors" ? "0.5" : val === "AP/IB" ? "1.0" : course.weightBoost || "0.0"
                                      });
                                    }}
                                    className="courseLevel w-full modern-input rounded-lg text-xs font-semibold text-slate-705 py-2.5 pl-3 pr-8 appearance-none cursor-pointer focus:outline-none focus:border-[#1A1A1A] focus:ring-0"
                                  >
                                    <option value="Regular">Regular (+0.0)</option>
                                    <option value="Honors">Honors (+0.5)</option>
                                    <option value="AP/IB">AP / IB (+1.0)</option>
                                    <option value="Custom">Custom Boost...</option>
                                  </select>
                                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                    <span className="material-symbols-outlined text-[18px]">expand_more</span>
                                  </div>
                                </div>
                                {course.level === "Custom" && (
                                  <div className="mt-1">
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      placeholder="Boost e.g. 0.7"
                                      className="courseBoost w-full p-1 bg-white border border-[#1A1A1A]/10 rounded text-[10px] font-bold text-slate-700 outline-none focus:border-[#1A1A1A]"
                                      value={course.weightBoost || ""}
                                      onChange={(e) => handleUpdateCourseField(term.id, course.id, "weightBoost", e.target.value)}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* 4. Score Input (0-100) */}
                              <div className="w-full md:w-[11%]">
                                <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 mb-1 block">Score (%)</label>
                                <input
                                  type="number"
                                  className="courseScore w-full modern-input rounded-lg text-xs font-bold text-[#1A1A1A] py-2.5 px-3 focus:outline-none focus:border-[#1A1A1A] focus:ring-0"
                                  placeholder="0-100"
                                  min="0"
                                  max="100"
                                  value={course.score}
                                  onChange={(e) => handleUpdateCourseField(term.id, course.id, "score", e.target.value)}
                                />
                              </div>

                              {/* 5. Credit hours entry (step="any") */}
                              <div className="w-full md:w-[11%]">
                                <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 mb-1 block">Credits</label>
                                <input
                                  type="number"
                                  className="courseCredit w-full modern-input rounded-lg text-xs font-semibold text-slate-700 py-2.5 px-3 focus:outline-none focus:border-[#1A1A1A] focus:ring-0"
                                  placeholder="Cr"
                                  min="0"
                                  step="any"
                                  value={course.credit}
                                  onChange={(e) => handleUpdateCourseField(term.id, course.id, "credit", e.target.value)}
                                />
                              </div>

                              {/* 6. Dynamic Calculated Grade & Points Badge */}
                              <div className={`w-full ${useUcGpa ? "md:w-[15%]" : "md:w-[16%]"}`}>
                                <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 ml-1 mb-1 block">
                                  {useUcGpa ? "UC Grade Pts" : "Grade & Points"}
                                </label>
                                {course.score ? (() => {
                                  const parsedVal = parseFloat(course.score);
                                  if (isNaN(parsedVal)) {
                                    return (
                                      <div className="bg-slate-100 rounded-lg py-2 px-2 text-[10px] text-center text-slate-400">
                                        —
                                      </div>
                                    );
                                  }
                                  const displayVal = roundScores ? Math.round(parsedVal) : parsedVal;
                                  const cr = parseFloat(course.credit) || 0;

                                  if (useUcGpa) {
                                    const agCat = course.agCategory || detectAgCategoryFromName(course.courseName);
                                    if (agCat === "Non-AG") {
                                      return (
                                        <div className="bg-slate-100 rounded-lg py-1.5 px-2 text-[10px] text-center text-slate-500 font-mono">
                                          <span className="block font-bold">Non-A-G</span>
                                          <span className="text-[8px] text-slate-400">Excluded (PE)</span>
                                        </div>
                                      );
                                    }
                                    const baseUcPoint = scoreToUcGradePoint(displayVal);
                                    const isHonors = (course.level === "AP/IB" || course.level === "Honors") && baseUcPoint >= 2.0;
                                    const totalPoint = baseUcPoint + (isHonors ? 1.0 : 0.0);
                                    return (
                                      <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg py-1 px-2 text-[10px] text-center font-mono text-amber-950">
                                        <div className="flex items-center justify-between font-bold">
                                          <span>{scoreToUcLetterGrade(displayVal)}</span>
                                          <span>{totalPoint.toFixed(1)} UC{isHonors ? " ✦" : ""}</span>
                                        </div>
                                        <div className="text-[8px] text-amber-800/80 flex justify-between border-t border-amber-200/50 mt-0.5 pt-0.5">
                                          <span>Base: {baseUcPoint}</span>
                                          <span>{isHonors ? "Honors +1" : "Standard"}</span>
                                        </div>
                                      </div>
                                    );
                                  }

                                  const letter = convertScoreToLetterGrade(displayVal);
                                  const unwtdGp = convertScoreToGradePoint(displayVal, useLinearGpa);
                                  let boost = 0;
                                  if (course.level === "Honors") boost = 0.5;
                                  else if (course.level === "AP/IB") boost = 1.0;
                                  else if (course.level === "Custom" && course.weightBoost) boost = parseFloat(course.weightBoost) || 0;
                                  const wtdGp = unwtdGp + boost;
                                  const qp = (unwtdGp * cr).toFixed(2);

                                  return (
                                    <div className="bg-white border border-[#1A1A1A]/10 rounded-lg py-1 px-2 text-[10px] font-mono text-slate-800 shadow-xs">
                                      <div className="flex items-center justify-between font-bold">
                                        <span className="text-xs font-sans text-slate-900">{letter}</span>
                                        <span style={{ color: currentAccent.color }}>{unwtdGp.toFixed(2)} GP</span>
                                      </div>
                                      <div className="text-[8px] text-slate-500 flex items-center justify-between border-t border-slate-100 mt-0.5 pt-0.5">
                                        <span>Wtd: {wtdGp.toFixed(2)}</span>
                                        <span>QP: {qp}</span>
                                      </div>
                                    </div>
                                  );
                                })() : (
                                  <div className="bg-slate-50 border border-slate-200/60 rounded-lg py-2 px-2 text-[10px] text-center text-slate-400 italic">
                                    —
                                  </div>
                                )}
                              </div>

                              {/* 7. Delete Row button */}
                              <button
                                onClick={() => handleDeleteCourse(term.id, course.id)}
                                className="deleteBtn p-2 mt-4 md:mt-0 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all md:self-center ml-auto md:ml-0 focus:outline-none"
                              >
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Semester reflections & memories logs - LOCAL MEMORIES */}
                      <div className="bg-white border border-[#1A1A1A]/10 rounded-xl p-5 mt-4 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-[#1A1A1A] mb-2 uppercase tracking-[0.15em] text-[10px]">
                          <span className="material-symbols-outlined text-[16px]">edit_note</span>
                          <span>Reflection Memory & Milestones</span>
                        </div>

                        {/* Written reflective summary input */}
                        <textarea
                          placeholder="Type personal reflections, learnings, hurdles, or achievements for this semester..."
                          value={term.reflection}
                          onChange={(e) => handleUpdateTermReflection(term.id, e.target.value)}
                          className="w-full p-2.5 bg-[#F2F0ED]/30 border border-[#1A1A1A]/10 rounded resize-none text-[12px] h-16 text-slate-700 focus:border-[#1A1A1A] focus:outline-none"
                        />

                        {/* Bullet point list achievements addition */}
                        <div className="mt-4">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Key Highlights Log:</label>
                          <div className="flex gap-2 mb-3">
                            <input
                              type="text"
                              placeholder="e.g. Cleared AP Calc Midterm with 94%! Joined Spanish Club."
                              value={bulletInputs[term.id] || ""}
                              onChange={(e) => setBulletInputs({ ...bulletInputs, [term.id]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddBulletMemory(term.id);
                                }
                              }}
                              className="flex-grow bg-white border border-[#1A1A1A]/10 p-2 text-xs rounded focus:outline-none focus:border-[#1A1A1A]"
                            />
                            <button
                              onClick={() => handleAddBulletMemory(term.id)}
                              className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#2C2C2C] text-white rounded font-bold uppercase text-[10px] tracking-wider transition-all"
                            >
                              Add Log
                            </button>
                          </div>

                          {term.bullets && term.bullets.length > 0 && (
                            <div className="space-y-1 bg-[#F2F0ED]/30 border border-[#1A1A1A]/5 p-2 rounded">
                              {term.bullets.map((bulletLine, bIdx) => (
                                <div key={bIdx} className="flex justify-between items-center text-xs text-slate-650 bg-white py-1.5 px-3 rounded border border-[#1A1A1A]/5">
                                  <span>{bulletLine}</span>
                                  <button
                                    onClick={() => handleDeleteBulletMemory(term.id, bIdx)}
                                    className="text-red-500 hover:text-red-700 text-[10px] uppercase font-bold tracking-wider"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Smart AI mentoring recommendations specific to this sem */}
                        <div className="mt-4 pt-4 border-t border-[#1A1A1A]/10">
                          <button
                            onClick={() => handleConsultSemesterMentorInfo(term.id)}
                            disabled={isGeneratingSemesterAdvice[term.id]}
                            className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#1A1A1A] font-bold hover:opacity-80 transition-opacity ${
                              isGeneratingSemesterAdvice[term.id] ? "animate-pulse" : ""
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">science</span>
                            <span>
                              {isGeneratingSemesterAdvice[term.id]
                                ? "Auditing Grades & Reflections..."
                                : "Analyze Semester with AI Advisor"}
                            </span>
                          </button>

                          {term.aiAdvice && (
                            <div className="bg-white border border-[#1A1A1A]/10 p-4 rounded mt-3 whitespace-pre-wrap leading-relaxed text-[11px] text-slate-700 font-sans prose">
                              {term.aiAdvice}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Add Course to Term Button */}
                      <button
                        onClick={() => handleAddCourseToTerm(term.id)}
                        className="addCourseToTermBtn mt-4 w-full py-3.5 rounded border border-dashed border-[#1A1A1A]/20 text-[#1A1A1A] hover:bg-[#1A1A1A]/5 hover:border-[#1A1A1A]/40 font-bold uppercase tracking-[0.2em] text-[10px] transition-all flex items-center justify-center gap-2 group focus:outline-none"
                      >
                        <span className="material-symbols-outlined text-[16px] group-hover:scale-115 transition-transform">add</span>
                        Add Course to {term.title}
                      </button>

                      <hr className="my-8 border-[#1A1A1A]/10" />
                    </div>
                  );
                })
              )}
                </div>

                {/* ADD SEMESTER BUTTON */}
                <button
                  onClick={handleAddTerm}
                  className="w-full py-4 rounded border border-dashed border-[#1A1A1A]/20 bg-white text-[#1A1A1A] font-bold hover:bg-[#1A1A1A]/5 hover:border-[#1A1A1A]/40 transition-all flex items-center justify-center gap-2 group focus:outline-none uppercase tracking-[0.2em] text-[10px]"
                  id="addTermBtn"
                >
                  <span className="material-symbols-outlined text-[20px]">calendar_add_on</span>
                  Add New Semester
                </button>
              </section>
            </motion.main>
          )}
        </AnimatePresence>
      </div>

      {/* ========================================================
         MODALS (AI Transcript, ManageBac, Export, Full Scale, etc.)
         ======================================================== */}

      {/* AI Transcript Scanner Modal (Gemini 3.5 Flash-Lite) */}
      {isAiTranscriptModalOpen && (
        <div className="modal block">
          <div className="modal-content rounded-xl p-6 relative border border-[#1A1A1A]/15 shadow-xl max-w-3xl max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-[#1A1A1A]/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                    AI Transcript Scanner
                  </h2>
                  <span className="text-[10px] text-amber-800 font-mono font-medium">
                    Powered by Gemini 3.5 Flash-Lite
                  </span>
                </div>
              </div>
              <span
                onClick={() => {
                  setIsAiTranscriptModalOpen(false);
                  setIsAiScanningTranscript(false);
                }}
                className="cursor-pointer text-2xl text-slate-400 hover:text-slate-800 transition-colors"
              >
                &times;
              </span>
            </div>

            <div className="space-y-6 font-sans">
              {/* Step 1: Input method tabs */}
              <div className="p-4 bg-white/70 border border-[#1A1A1A]/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <span className="bg-[#1A1A1A] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">1</span>
                    <span>Provide Transcript File or Text</span>
                  </h3>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-[#1A1A1A]/5">
                    <button
                      type="button"
                      onClick={() => setAiTranscriptInputMode("upload")}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                        aiTranscriptInputMode === "upload" ? "bg-white shadow-xs text-slate-900" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Document / Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiTranscriptInputMode("paste")}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                        aiTranscriptInputMode === "paste" ? "bg-white shadow-xs text-slate-900" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Paste Text
                    </button>
                  </div>
                </div>

                {aiTranscriptInputMode === "upload" ? (
                  <div className="space-y-3">
                    <label
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const result = reader.result as string;
                            const base64 = result.includes(",") ? result.split(",")[1] : result;
                            setAiTranscriptFile({
                              name: file.name,
                              mimeType: file.type || "application/pdf",
                              base64
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="border-2 border-dashed border-[#1A1A1A]/20 hover:border-[#1A1A1A]/50 bg-white/60 hover:bg-white rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group"
                    >
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/webp,image/jpg"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              const result = reader.result as string;
                              const base64 = result.includes(",") ? result.split(",")[1] : result;
                              setAiTranscriptFile({
                                name: file.name,
                                mimeType: file.type || "application/pdf",
                                base64
                              });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <span className="material-symbols-outlined text-4xl text-slate-400 group-hover:text-[#1A1A1A] group-hover:scale-110 transition-all mb-2">
                        upload_file
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {aiTranscriptFile ? aiTranscriptFile.name : "Click to select or drag & drop transcript"}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1">
                        Supports PDF transcripts, screenshots, or report card photos (PDF, PNG, JPG, WEBP)
                      </span>
                    </label>

                    {aiTranscriptFile && (
                      <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-lg text-xs text-emerald-900">
                        <div className="flex items-center gap-2 truncate">
                          <span className="material-symbols-outlined text-[18px] text-emerald-700">check_circle</span>
                          <span className="font-semibold truncate">{aiTranscriptFile.name}</span>
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {aiTranscriptFile.mimeType}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAiTranscriptFile(null)}
                          className="text-xs text-emerald-700 hover:text-red-600 font-bold ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={aiTranscriptRawText}
                      onChange={(e) => setAiTranscriptRawText(e.target.value)}
                      placeholder="Paste your transcript text, student portal course table, or report card summary here..."
                      className="w-full h-28 p-3 font-mono text-[11px] bg-white border border-[#1A1A1A]/15 rounded-lg focus:outline-none focus:border-[#1A1A1A] resize-none"
                    />
                  </div>
                )}

                {/* Gemini API Key setting hint */}
                <div className="pt-2 border-t border-[#1A1A1A]/5 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-amber-600">key</span>
                    <span>API Key: {customGeminiApiKey ? "Custom key active" : "Server GEMINI_API_KEY"}</span>
                  </span>
                  {!customGeminiApiKey && (
                    <button
                      type="button"
                      onClick={() => {
                        const key = prompt("Enter your Gemini API key (AIzaSy...):");
                        if (key && key.trim()) {
                          syncCustomGeminiApiKey(key.trim());
                        }
                      }}
                      className="text-amber-800 hover:underline font-semibold"
                    >
                      Set Custom Key
                    </button>
                  )}
                </div>

                {/* Action trigger button */}
                <button
                  type="button"
                  onClick={handleTriggerAiTranscriptScan}
                  disabled={isAiScanningTranscript || (!aiTranscriptFile && !aiTranscriptRawText.trim())}
                  className="w-full py-3 bg-[#1A1A1A] hover:bg-[#2C2C2C] disabled:opacity-40 text-white text-xs uppercase tracking-[0.2em] font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className={`material-symbols-outlined text-[18px] ${isAiScanningTranscript ? "animate-spin" : "text-amber-300"}`}>
                    {isAiScanningTranscript ? "progress_activity" : "auto_awesome"}
                  </span>
                  <span>
                    {isAiScanningTranscript ? "Analyzing with Gemini 3.5 Flash-Lite..." : "Extract Courses with Gemini 3.5 Flash-Lite"}
                  </span>
                </button>
              </div>

              {/* Step 2: Staged Review & Verification */}
              {parsedAiCourses.length > 0 && (
                <div className="p-4 bg-white/70 border border-[#1A1A1A]/10 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <span className="bg-[#1A1A1A] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">2</span>
                      <span>Review Extracted Courses ({parsedAiCourses.length})</span>
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = Object.keys(selectedAiCourses).length === parsedAiCourses.length &&
                            Object.values(selectedAiCourses).every(Boolean);
                          const newMap: Record<string, boolean> = {};
                          parsedAiCourses.forEach(c => { newMap[c.id] = !allSelected; });
                          setSelectedAiCourses(newMap);
                        }}
                        className="text-[10px] uppercase font-bold tracking-wider text-slate-600 hover:text-[#1A1A1A]"
                      >
                        {Object.values(selectedAiCourses).filter(Boolean).length === parsedAiCourses.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                  </div>

                  {aiExtractedData?.schoolName && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-lg text-xs text-amber-900 flex items-center justify-between">
                      <span className="font-semibold">Detected School: {aiExtractedData.schoolName}</span>
                      {aiExtractedData.studentName && <span>Student: {aiExtractedData.studentName}</span>}
                    </div>
                  )}

                  {/* Semester-Grouped Course Cards List */}
                  {(() => {
                    const termMap: Record<string, { termTitle: string; gradeLevel?: string; courses: typeof parsedAiCourses }> = {};
                    const order: string[] = [];

                    if (aiExtractedData?.terms && Array.isArray(aiExtractedData.terms)) {
                      aiExtractedData.terms.forEach((t: any) => {
                        const title = (t.termTitle || "Semester 1").trim();
                        if (!termMap[title]) {
                          termMap[title] = { termTitle: title, gradeLevel: t.gradeLevel, courses: [] };
                          order.push(title);
                        }
                      });
                    }

                    parsedAiCourses.forEach((course) => {
                      const title = (course.termTitle || "Semester 1").trim();
                      if (!termMap[title]) {
                        termMap[title] = { termTitle: title, gradeLevel: course.gradeLevel, courses: [] };
                        order.push(title);
                      }
                      termMap[title].courses.push(course);
                    });

                    const validGroups = order.map(k => termMap[k]).filter(g => g && g.courses.length > 0);

                    return (
                      <div className="max-h-[360px] overflow-y-auto border border-[#1A1A1A]/10 rounded-lg divide-y divide-[#1A1A1A]/10 bg-white">
                        {validGroups.map((group, groupIdx) => {
                          const groupSelectedCount = group.courses.filter(c => selectedAiCourses[c.id]).length;
                          const isAllGroupSelected = groupSelectedCount === group.courses.length && group.courses.length > 0;

                          return (
                            <div key={`term-group-${groupIdx}`} className="p-3 bg-slate-50/40">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1A1A1A]/10">
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-amber-600 text-[18px]">calendar_month</span>
                                  <span className="font-bold text-xs text-[#1A1A1A]">{group.termTitle}</span>
                                  {group.gradeLevel && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                                      Grade {group.gradeLevel}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-500 font-medium">({group.courses.length} courses)</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newMap = { ...selectedAiCourses };
                                    group.courses.forEach(c => {
                                      newMap[c.id] = !isAllGroupSelected;
                                    });
                                    setSelectedAiCourses(newMap);
                                  }}
                                  className="text-[9px] uppercase font-bold tracking-wider text-slate-600 hover:text-[#1A1A1A]"
                                >
                                  {isAllGroupSelected ? "Deselect Semester" : "Select Semester"}
                                </button>
                              </div>

                              <div className="space-y-2">
                                {group.courses.map((course) => {
                                  const isSelected = !!selectedAiCourses[course.id];
                                  return (
                                    <div key={course.id} className={`p-2.5 rounded-lg border transition-all ${isSelected ? 'bg-white border-[#1A1A1A]/15 shadow-2xs' : 'bg-slate-100/50 border-transparent opacity-60'}`}>
                                      <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => setSelectedAiCourses({
                                              ...selectedAiCourses,
                                              [course.id]: e.target.checked
                                            })}
                                            className="w-4 h-4 rounded text-[#1A1A1A] focus:ring-[#1A1A1A]"
                                          />
                                          <span className="text-xs font-bold text-slate-800">
                                            {course.className}
                                          </span>
                                        </label>
                                        <span className="text-[9px] font-mono text-slate-400 max-w-[200px] truncate" title={course.originalName}>
                                          Raw: {course.originalName}
                                        </span>
                                      </div>

                                      {isSelected && (
                                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs mt-2">
                                          <div className="sm:col-span-4">
                                            <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Course Name</label>
                                            <input
                                              type="text"
                                              value={course.className}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                setParsedAiCourses(parsedAiCourses.map(c => c.id === course.id ? { ...c, className: val } : c));
                                              }}
                                              className="w-full p-1 border border-[#1A1A1A]/10 rounded text-[11px] font-semibold bg-white"
                                            />
                                          </div>
                                          <div className="sm:col-span-2">
                                            <label className="text-[8px] font-bold text-amber-800 uppercase block mb-0.5">UC A-G Area</label>
                                            <select
                                              value={course.agCategory || "G"}
                                              onChange={(e) => {
                                                const val = e.target.value as AgCategory;
                                                setParsedAiCourses(parsedAiCourses.map(c => c.id === course.id ? { ...c, agCategory: val } : c));
                                              }}
                                              className="w-full p-1 border border-amber-300 rounded text-[11px] font-bold bg-amber-50/50"
                                            >
                                              <option value="A">A: History</option>
                                              <option value="B">B: English</option>
                                              <option value="C">C: Math</option>
                                              <option value="D">D: Science</option>
                                              <option value="E">E: Language</option>
                                              <option value="F">F: Arts</option>
                                              <option value="G">G: Elective</option>
                                              <option value="Non-AG">Non-A-G (PE)</option>
                                            </select>
                                          </div>
                                          <div className="sm:col-span-2">
                                            <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Level</label>
                                            <select
                                              value={course.level}
                                              onChange={(e) => {
                                                const val = e.target.value as any;
                                                setParsedAiCourses(parsedAiCourses.map(c => c.id === course.id ? { ...c, level: val } : c));
                                              }}
                                              className="w-full p-1 border border-[#1A1A1A]/10 rounded text-[11px] font-semibold bg-white"
                                            >
                                              <option value="Regular">Regular</option>
                                              <option value="Honors">Honors</option>
                                              <option value="AP/IB">AP / IB</option>
                                            </select>
                                          </div>
                                          <div className="sm:col-span-2">
                                            <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Score %</label>
                                            <input
                                              type="number"
                                              value={course.score}
                                              min="0"
                                              max="100"
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                setParsedAiCourses(parsedAiCourses.map(c => c.id === course.id ? { ...c, score: val } : c));
                                              }}
                                              className="w-full p-1 border border-[#1A1A1A]/10 rounded text-[11px] font-bold text-center bg-white"
                                            />
                                          </div>
                                          <div className="sm:col-span-2">
                                            <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Credits</label>
                                            <input
                                              type="number"
                                              step="any"
                                              min="0"
                                              value={course.credit}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                setParsedAiCourses(parsedAiCourses.map(c => c.id === course.id ? { ...c, credit: val } : c));
                                              }}
                                              className="w-full p-1 border border-[#1A1A1A]/10 rounded text-[11px] font-semibold text-center bg-white"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Destination Options */}
                  <div className="pt-2 border-t border-[#1A1A1A]/5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Target Semester Destination</label>
                        <select
                          value={aiTargetTermId}
                          onChange={(e) => {
                            setAiTargetTermId(e.target.value);
                            setAiTargetTermMode(e.target.value === "new" ? "auto" : "existing");
                          }}
                          className="w-full p-2 border border-[#1A1A1A]/12 rounded text-xs font-semibold bg-white"
                        >
                          <option value="new">Auto-create Semesters from Transcript</option>
                          {terms.map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                        </select>
                      </div>

                      {aiTargetTermId !== "new" && (
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Integration Mode</label>
                          <div className="flex gap-4 mt-2">
                            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                              <input
                                type="radio"
                                name="aiMode"
                                value="append"
                                checked={aiImportMode === "append"}
                                onChange={() => setAiImportMode("append")}
                                className="text-[#1A1A1A] focus:ring-[#1A1A1A] w-3.5 h-3.5"
                              />
                              <span>Append courses</span>
                            </label>
                            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                              <input
                                type="radio"
                                name="aiMode"
                                value="replace"
                                checked={aiImportMode === "replace"}
                                onChange={() => setAiImportMode("replace")}
                                className="text-[#1A1A1A] focus:ring-[#1A1A1A] w-3.5 h-3.5"
                              />
                              <span>Replace existing</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmAiTranscriptImport}
                      className="w-full py-3 bg-[#1A1A1A] hover:bg-[#2C2C2C] text-white text-xs uppercase tracking-[0.2em] font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">done_all</span>
                      <span>Import {Object.values(selectedAiCourses).filter(Boolean).length} Courses into GPA Tracker</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ManageBac Import Modal */}
      {isManageBacModalOpen && (
        <div className="modal block">
          <div className="modal-content rounded-xl p-6 relative border border-[#1A1A1A]/15 shadow-lg max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1A1A1A]/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl" style={{ color: currentAccent.color }}>sync_alt</span>
                <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>ManageBac Grade Integration</h2>
              </div>
              <span
                onClick={() => {
                  setIsManageBacModalOpen(false);
                  setManageBacRawText("");
                  setParsedManageBacCourses([]);
                  setSelectedManageBacCourses({});
                }}
                className="cursor-pointer text-2xl text-slate-400 hover:text-slate-800 transition-colors"
              >
                &times;
              </span>
            </div>

            <div className="space-y-6 font-sans">
              {/* Step 1: Explanation and Script Copy */}
              <div className="p-4 bg-white/50 border border-[#1A1A1A]/10 rounded-lg">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <span className="bg-[#1A1A1A] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">1</span>
                  <span>Extract Grades from ManageBac</span>
                </h3>
                <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                  Log into your ManageBac student portal in another browser tab, navigate to any of your class pages, and open your browser&apos;s Developer Console (press <strong>F12</strong>, or <strong>Right-Click &rarr; Inspect &rarr; Console</strong>). Copy and paste the <strong>In-Page Visual Scanner</strong> script below, then press <strong>Enter</strong>.
                </p>
                
                <div className="p-3 bg-blue-50/50 border border-blue-200/50 rounded-lg text-[10.5px] text-slate-600 mb-3 leading-normal">
                  <strong className="text-slate-800">🔒 Cross-Domain Security Note:</strong> Due to browser Same-Origin Policy, websites cannot directly fetch data from other domains (like ManageBac). Running this client-side scanner inside your logged-in ManageBac tab is the <strong>safest, most secure, and only browser-supported method</strong> to fetch your grades automatically without exposing your password or credentials.
                </div>

                <div className="relative">
                  <pre className="p-3 bg-slate-900 text-slate-200 text-[10px] font-mono rounded-lg overflow-x-auto max-h-[180px] mb-2 border border-slate-850 select-all">
{`(async function() {
    console.log("Initializing in-page multi-class visual scanner...");

    // 1. Identify all class links from your sidebar navigation menu (Parent Window)
    const classElements = Array.from(document.querySelectorAll('.f-menu__submenu-item a.f-menu__submenu-link'))
        .filter(a => {
            const titleSpan = a.querySelector('.f-menu__submenu-link-title');
            return titleSpan && titleSpan.textContent.trim() !== "Browse All Classes";
        });

    if (classElements.length === 0) {
        console.log("Could not find any classes in your sidebar navigation menu.");
        alert("Please run this script while logged into ManageBac!");
        return;
    }

    console.log(\`Identified \${classElements.length} classes. Fetching records in the background...\`);
    const overallGrades = [];

    // Create a floating container to show the progress and the active iframe
    let visualContainer = document.getElementById('mb-visual-scanner');
    if (visualContainer) visualContainer.remove();

    visualContainer = document.createElement('div');
    visualContainer.id = 'mb-visual-scanner';
    Object.assign(visualContainer.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '600px',
        height: '450px',
        backgroundColor: '#ffffff',
        border: '3px solid #7bcdc9',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        zIndex: '99999',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'sans-serif'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
        backgroundColor: '#7bcdc9',
        color: '#ffffff',
        padding: '12px',
        fontWeight: 'bold',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    });
    header.innerHTML = '<span>MB Class Grade Scanner</span><span id="scan-progress" style="background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:10px;font-size:11px;">0/0</span>';
    visualContainer.appendChild(header);

    // Status text
    const statusText = document.createElement('div');
    Object.assign(statusText.style, {
        padding: '10px 14px',
        fontSize: '12px',
        borderBottom: '1px solid #eee',
        color: '#333',
        fontWeight: '500',
        backgroundColor: '#f9f9f9'
    });
    statusText.textContent = 'Preparing scanner...';
    visualContainer.appendChild(statusText);

    // Preview frame
    const iframeContainer = document.createElement('div');
    Object.assign(iframeContainer.style, {
        flex: '1',
        position: 'relative',
        backgroundColor: '#eee'
    });
    
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
        border: 'none',
        transform: 'scale(0.6)',
        transformOrigin: 'top left',
        width: '167%',
        height: '167%'
    });
    iframeContainer.appendChild(iframe);
    visualContainer.appendChild(iframeContainer);

    document.body.appendChild(visualContainer);

    for (let i = 0; i < classElements.length; i++) {
        const element = classElements[i];
        const className = element.querySelector('.f-menu__submenu-link-title').textContent.trim();
        const url = element.href;

        header.querySelector('#scan-progress').textContent = \`\${i + 1}/\${classElements.length}\`;
        statusText.textContent = \`Loading: \${className}...\`;

        // Load iframe (this points directly to the /units tab via the sidebar link)
        iframe.src = url;

        // Wait for iframe to load
        await new Promise((resolve) => {
            iframe.onload = () => resolve();
        });

        // Let the page settle briefly
        await new Promise(resolve => setTimeout(resolve, 850));

        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;

            // Step 1: Open the details sidebar (using the precise button from your screenshot)
            const iframeInfoButton = doc.querySelector('button[aria-controls="sidebar_info"]');
            if (iframeInfoButton && iframeInfoButton.getAttribute('aria-expanded') === 'false') {
                iframeInfoButton.click();
                statusText.textContent = \`Opening details sidebar for: \${className}...\`;
                await new Promise(resolve => setTimeout(resolve, 850)); // wait for sidebar animation
            }

            // Step 2: Extract the overall score from the sidebar container
            const container = doc.querySelector('.sidebar-items-list');
            let overallMark = "Not yet available";

            if (container) {
                const rows = container.querySelectorAll('.list-item:not(.list-item-head)');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('.cell');
                    if (cells.length >= 2) {
                        const category = cells[0].textContent.trim().replace(/\\s+/g, ' ');
                        if (category.toLowerCase() === 'overall') {
                            overallMark = cells[1].textContent.trim().replace(/\\s+/g, ' ');
                        }
                    }
                });
            }

            overallGrades.push({
                "Class": className,
                "Overall Mark (Score)": overallMark
            });

        } catch (err) {
            console.error(\`Error scanning \${className}:\`, err);
            overallGrades.push({
                "Class": className,
                "Overall Mark (Score)": "Scan Error"
            });
        }

        await new Promise(resolve => setTimeout(resolve, 300));
    }

    statusText.textContent = "Scanning complete! Copying results...";
    await new Promise(resolve => setTimeout(resolve, 1000));
    visualContainer.remove();

    console.clear();
    console.log("=== Overall Grades for All Enrolled Classes ===");
    console.table(overallGrades);
    const jsonStr = JSON.stringify(overallGrades, null, 2);
    try {
        await navigator.clipboard.writeText(jsonStr);
        alert("SUCCESS! ManageBac grade data has been extracted and copied to your clipboard automatically! Please return to this GPA Tracker app and paste it.");
    } catch (e) {
        console.log(jsonStr);
        alert("Extraction done. Please copy the printed JSON block from your developer console below.");
    }
})();`}
                  </pre>
                  <button
                    onClick={() => {
                      const scriptText = `(async function() {
    console.log("Initializing in-page multi-class visual scanner...");

    // 1. Identify all class links from your sidebar navigation menu (Parent Window)
    const classElements = Array.from(document.querySelectorAll('.f-menu__submenu-item a.f-menu__submenu-link'))
        .filter(a => {
            const titleSpan = a.querySelector('.f-menu__submenu-link-title');
            return titleSpan && titleSpan.textContent.trim() !== "Browse All Classes";
        });

    if (classElements.length === 0) {
        console.log("Could not find any classes in your sidebar navigation menu.");
        alert("Please run this script while logged into ManageBac!");
        return;
    }

    console.log(\`Identified \${classElements.length} classes. Fetching records in the background...\`);
    const overallGrades = [];

    // Create a floating container to show the progress and the active iframe
    let visualContainer = document.getElementById('mb-visual-scanner');
    if (visualContainer) visualContainer.remove();

    visualContainer = document.createElement('div');
    visualContainer.id = 'mb-visual-scanner';
    Object.assign(visualContainer.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '600px',
        height: '450px',
        backgroundColor: '#ffffff',
        border: '3px solid #7bcdc9',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        zIndex: '99999',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'sans-serif'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
        backgroundColor: '#7bcdc9',
        color: '#ffffff',
        padding: '12px',
        fontWeight: 'bold',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    });
    header.innerHTML = '<span>MB Class Grade Scanner</span><span id="scan-progress" style="background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:10px;font-size:11px;">0/0</span>';
    visualContainer.appendChild(header);

    // Status text
    const statusText = document.createElement('div');
    Object.assign(statusText.style, {
        padding: '10px 14px',
        fontSize: '12px',
        borderBottom: '1px solid #eee',
        color: '#333',
        fontWeight: '500',
        backgroundColor: '#f9f9f9'
    });
    statusText.textContent = 'Preparing scanner...';
    visualContainer.appendChild(statusText);

    // Preview frame
    const iframeContainer = document.createElement('div');
    Object.assign(iframeContainer.style, {
        flex: '1',
        position: 'relative',
        backgroundColor: '#eee'
    });
    
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
        border: 'none',
        transform: 'scale(0.6)',
        transformOrigin: 'top left',
        width: '167%',
        height: '167%'
    });
    iframeContainer.appendChild(iframe);
    visualContainer.appendChild(iframeContainer);

    document.body.appendChild(visualContainer);

    for (let i = 0; i < classElements.length; i++) {
        const element = classElements[i];
        const className = element.querySelector('.f-menu__submenu-link-title').textContent.trim();
        const url = element.href;

        header.querySelector('#scan-progress').textContent = \`\${i + 1}/\s*classElements.length\`.replace('/s*', '');
        header.querySelector('#scan-progress').textContent = \`\${i + 1}/\${classElements.length}\`;
        statusText.textContent = \`Loading: \${className}...\`;

        // Load iframe (this points directly to the /units tab via the sidebar link)
        iframe.src = url;

        // Wait for iframe to load
        await new Promise((resolve) => {
            iframe.onload = () => resolve();
        });

        // Let the page settle briefly
        await new Promise(resolve => setTimeout(resolve, 850));

        try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;

            // Step 1: Open the details sidebar (using the precise button from your screenshot)
            const iframeInfoButton = doc.querySelector('button[aria-controls="sidebar_info"]');
            if (iframeInfoButton && iframeInfoButton.getAttribute('aria-expanded') === 'false') {
                iframeInfoButton.click();
                statusText.textContent = \`Opening details sidebar for: \${className}...\`;
                await new Promise(resolve => setTimeout(resolve, 850)); // wait for sidebar animation
            }

            // Step 2: Extract the overall score from the sidebar container
            const container = doc.querySelector('.sidebar-items-list');
            let overallMark = "Not yet available";

            if (container) {
                const rows = container.querySelectorAll('.list-item:not(.list-item-head)');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('.cell');
                    if (cells.length >= 2) {
                        const category = cells[0].textContent.trim().replace(/\\s+/g, ' ');
                        if (category.toLowerCase() === 'overall') {
                            overallMark = cells[1].textContent.trim().replace(/\\s+/g, ' ');
                        }
                    }
                });
            }

            overallGrades.push({
                "Class": className,
                "Overall Mark (Score)": overallMark
            });

        } catch (err) {
            console.error(\`Error scanning \${className}:\`, err);
            overallGrades.push({
                "Class": className,
                "Overall Mark (Score)": "Scan Error"
            });
        }

        await new Promise(resolve => setTimeout(resolve, 300));
    }

    statusText.textContent = "Scanning complete! Copying results...";
    await new Promise(resolve => setTimeout(resolve, 1000));
    visualContainer.remove();

    console.clear();
    console.log("=== Overall Grades for All Enrolled Classes ===");
    console.table(overallGrades);
    const jsonStr = JSON.stringify(overallGrades, null, 2);
    try {
        await navigator.clipboard.writeText(jsonStr);
        alert("SUCCESS! ManageBac grade data has been extracted and copied to your clipboard automatically! Please return to this GPA Tracker app and paste it.");
    } catch (e) {
        console.log(jsonStr);
        alert("Extraction done. Please copy the printed JSON block from your developer console below.");
    }
})();`;
                      navigator.clipboard.writeText(scriptText);
                      setScriptCopied(true);
                      setTimeout(() => setScriptCopied(false), 2000);
                    }}
                    className="absolute top-2 right-2 px-3 py-1 bg-[#1A1A1A] text-white hover:bg-[#2D2D2D] text-[10px] uppercase tracking-wider font-bold rounded flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[12px]">{scriptCopied ? "check" : "content_copy"}</span>
                    <span>{scriptCopied ? "Copied" : "Copy Script"}</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Paste Area */}
              <div className="p-4 bg-white/50 border border-[#1A1A1A]/10 rounded-lg">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <span className="bg-[#1A1A1A] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">2</span>
                  <span>Paste Grade Data Below</span>
                </h3>
                <textarea
                  value={manageBacRawText}
                  onChange={(e) => handleParseManageBacInput(e.target.value)}
                  placeholder="Paste the clipboard results here (either raw console logs or JSON array)..."
                  className="w-full h-24 p-3 font-mono text-[11px] text-slate-750 bg-white border border-[#1A1A1A]/12 rounded focus:border-[#1A1A1A] resize-none focus:outline-none mb-3"
                />
                
                <div className="flex items-center justify-between pt-2.5 border-t border-[#1A1A1A]/5">
                  <div className="flex flex-col pr-4">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">calculate</span>
                      <span>Round Score Decimals</span>
                    </span>
                    <span className="text-[9.5px] text-slate-500 leading-snug mt-0.5">
                      Toggle standard rounding (e.g., 96.5 &rarr; 97, 96.4 &rarr; 96). When off, exact decimal scores are preserved.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={roundScores}
                      onChange={(e) => syncRoundScores(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1A1A1A]"></div>
                  </label>
                </div>
              </div>

              {/* Step 3: Verified Staging & Tuning (Only if parsed courses exist) */}
              {parsedManageBacCourses.length > 0 && (
                <div className="p-4 bg-white/50 border border-[#1A1A1A]/10 rounded-lg space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <span className="bg-[#1A1A1A] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">3</span>
                    <span>Verify & Stage Courses</span>
                  </h3>
                  
                  <div className="max-h-[250px] overflow-y-auto border border-[#1A1A1A]/10 rounded-lg divide-y divide-[#1A1A1A]/5 bg-white">
                    {parsedManageBacCourses.map((course) => {
                      const isSelected = !!selectedManageBacCourses[course.id];
                      return (
                        <div key={course.id} className={`p-3 flex flex-col gap-3 ${isSelected ? 'bg-white' : 'bg-slate-50/50 opacity-60'}`}>
                          {/* Checked & Original Suffix Info */}
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => setSelectedManageBacCourses({
                                  ...selectedManageBacCourses,
                                  [course.id]: e.target.checked
                                })}
                                className="w-4 h-4 rounded text-[#1A1A1A] focus:ring-[#1A1A1A]"
                              />
                              <span className="text-xs font-bold text-slate-800">
                                {course.className || "Unnamed Class"}
                              </span>
                            </label>
                            <span className="text-[9px] font-mono text-slate-400 max-w-[180px] truncate" title={course.originalName}>
                              Raw: {course.originalName}
                            </span>
                          </div>

                          {/* Detail Adjustments */}
                          {isSelected && (
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                              {/* Inline Name Editing */}
                              <div className="sm:col-span-4">
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Name</label>
                                <input
                                  type="text"
                                  value={course.className}
                                  onChange={(e) => handleUpdateParsedCourseField(course.id, "className", e.target.value)}
                                  className="w-full p-1 border border-[#1A1A1A]/10 rounded text-[11px] font-semibold bg-white"
                                />
                              </div>

                              {/* Category selection */}
                              <div className="sm:col-span-3">
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Category</label>
                                <select
                                  value={course.category}
                                  onChange={(e) => handleUpdateParsedCourseField(course.id, "category", e.target.value)}
                                  className="w-full p-1 border border-[#1A1A1A]/10 rounded text-[11px] font-semibold bg-white"
                                >
                                  {[...Object.keys(predefinedCourseCategories), ...customCategories].map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Level selection */}
                              <div className="sm:col-span-2">
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Level</label>
                                <select
                                  value={course.level}
                                  onChange={(e) => handleUpdateParsedCourseField(course.id, "level", e.target.value)}
                                  className="w-full p-1 border border-[#1A1A1A]/10 rounded text-[11px] font-semibold bg-white"
                                >
                                  <option value="Regular">Regular</option>
                                  <option value="Honors">Honors</option>
                                  <option value="AP/IB">AP / IB</option>
                                </select>
                              </div>

                              {/* Score editing */}
                              <div className="sm:col-span-2">
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Score %</label>
                                <input
                                  type="number"
                                  value={course.score}
                                  min="0"
                                  max="100"
                                  onChange={(e) => handleUpdateParsedCourseField(course.id, "score", e.target.value)}
                                  className="w-full p-1 border border-[#1A1A1A]/10 rounded text-[11px] font-bold text-center bg-white"
                                />
                              </div>

                              {/* Credit hours editing */}
                              <div className="sm:col-span-1">
                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-0.5">Cr</label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={course.credit}
                                  onChange={(e) => handleUpdateParsedCourseField(course.id, "credit", e.target.value)}
                                  className="w-full p-1 border border-[#1A1A1A]/10 rounded text-[11px] font-semibold text-center bg-white"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Target Semester Config */}
                  <div className="pt-2 border-t border-[#1A1A1A]/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Target Semester</label>
                      <select
                        value={manageBacTargetTermId}
                        onChange={(e) => setManageBacTargetTermId(e.target.value)}
                        className="w-full p-2 border border-[#1A1A1A]/12 rounded text-xs font-semibold bg-white"
                      >
                        <option value="new">Create New Semester</option>
                        {terms.map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                    </div>

                    {manageBacTargetTermId !== "new" && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Integration Mode</label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                            <input
                              type="radio"
                              name="mbMode"
                              value="append"
                              checked={manageBacImportMode === "append"}
                              onChange={() => setManageBacImportMode("append")}
                              className="text-[#1A1A1A] focus:ring-[#1A1A1A] w-3.5 h-3.5"
                            />
                            <span>Append courses</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                            <input
                              type="radio"
                              name="mbMode"
                              value="replace"
                              checked={manageBacImportMode === "replace"}
                              onChange={() => setManageBacImportMode("replace")}
                              className="text-[#1A1A1A] focus:ring-[#1A1A1A] w-3.5 h-3.5"
                            />
                            <span>Overwrite semester</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleConfirmManageBacImport}
                    className="w-full py-3 bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white rounded font-bold uppercase text-xs tracking-wider transition-all"
                  >
                    Confirm Import ({parsedManageBacCourses.filter(c => selectedManageBacCourses[c.id]).length} Courses Checked)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {isExportModelOpen && (
        <div className="modal block">
          <div className="modal-content rounded-xl p-6 relative border border-[#1A1A1A]/10 shadow-lg">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1A1A1A]/5">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>Export Options</h2>
              <span
                onClick={() => setIsExportModelOpen(false)}
                className="cursor-pointer text-2xl text-slate-400 hover:text-slate-800 transition-colors"
              >
                &times;
              </span>
            </div>
            
            <div className="flex flex-col gap-3 font-sans">
              <label className="flex items-center gap-3 p-4 border border-[#1A1A1A]/10 rounded hover:bg-white cursor-pointer transition bg-white/40">
                <input
                  type="radio"
                  name="exportFormat"
                  value="csv"
                  checked={exportFormat === "csv"}
                  onChange={() => setExportFormat("csv")}
                  className="text-[#1A1A1A] focus:ring-[#1A1A1A] w-5 h-5 bg-[#1A1A1A]"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-[#1A1A1A] text-xs uppercase tracking-wider">CSV Spreadsheet</span>
                  <span className="text-[11px] text-[#1A1A1A]/70">Best for Excel or Google Sheets (Includes Semester name)</span>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-4 border border-[#1A1A1A]/10 rounded hover:bg-white cursor-pointer transition bg-white/40">
                <input
                  type="radio"
                  name="exportFormat"
                  value="txt"
                  checked={exportFormat === "txt"}
                  onChange={() => setExportFormat("txt")}
                  className="text-[#1A1A1A] focus:ring-[#1A1A1A] w-5 h-5 bg-[#1A1A1A]"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-[#1A1A1A] text-xs uppercase tracking-wider">Plain Text Report</span>
                  <span className="text-[11px] text-[#1A1A1A]/70">Fully readable journal of reflections and scores</span>
                </div>
              </label>
            </div>

            <button
              onClick={handleDownloadFile}
              className="mt-6 w-full bg-[#1A1A1A] hover:bg-[#2C2C2C] text-white py-3 rounded font-bold uppercase tracking-[0.2em] transition-all text-[11px] text-center"
            >
              Download Report File
            </button>
          </div>
        </div>
      )}

       {/* Scale Reference Modal */}
      {isScaleModalOpen && (
        <div className="modal block">
          <div className="modal-content rounded-xl p-6 max-h-[85vh] overflow-y-auto relative border border-[#1A1A1A]/15 shadow-lg">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1A1A1A]/10">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>Full GPA Boundaries</h2>
              <span
                onClick={() => setIsScaleModalOpen(false)}
                className="cursor-pointer text-2xl text-slate-400 hover:text-slate-800 transition-colors"
              >
                &times;
              </span>
            </div>
            
             <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2.5 bg-slate-50 font-bold text-slate-500 rounded border border-[#1A1A1A]/5 text-center">Range %</div>
              <div className="p-2.5 bg-slate-50 font-bold text-slate-500 rounded border border-[#1A1A1A]/5 text-center">Grade</div>
              <div className="p-2.5 bg-slate-50 font-bold text-slate-500 rounded border border-[#1A1A1A]/5 text-center">GPA Points</div>

              <div className="p-2 rounded border border-[#1A1A1A]/5 font-semibold text-center">97 – 100</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">A+</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">4.33</div>
              
              <div className="p-2 rounded border border-[#1A1A1A]/5 font-semibold text-center">93 – 96</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">A</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">{useLinearGpa ? "4.00 – 4.32" : "4.00"}</div>
              
              <div className="p-2 rounded border border-[#1A1A1A]/5 font-semibold text-center">90 – 92</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">A-</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">{useLinearGpa ? "3.67 – 3.99" : "3.67"}</div>
              
              <div className="p-2 rounded border border-[#1A1A1A]/5 font-semibold text-center">87 – 89</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">B+</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">{useLinearGpa ? "3.33 – 3.66" : "3.33"}</div>
              
              <div className="p-2 rounded border border-[#1A1A1A]/5 font-semibold text-center">83 – 86</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">B</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">{useLinearGpa ? "3.00 – 3.32" : "3.00"}</div>
              
              <div className="p-2 rounded border border-[#1A1A1A]/5 font-semibold text-center">80 – 82</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">B-</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">{useLinearGpa ? "2.67 – 2.99" : "2.67"}</div>
              
              <div className="p-2 rounded border border-[#1A1A1A]/5 font-semibold text-center">77 – 79</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">C+</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">{useLinearGpa ? "2.33 – 2.66" : "2.33"}</div>
              
              <div className="p-2 rounded border border-[#1A1A1A]/5 font-semibold text-center">73 – 76</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">C</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center font-bold">{useLinearGpa ? "2.00 – 2.32" : "2.00"}</div>
              
              <div className="p-2 rounded border border-[#1A1A1A]/5 font-semibold text-center">70 – 72</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">C-</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center">{useLinearGpa ? "1.67 – 1.99" : "1.67"}</div>
              
              <div className="p-2 rounded border border-[#1A1A1A]/5 font-semibold text-center">65 – 69</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center font-bold">D</div>
              <div className="p-2 text-[#1A1A1A] font-bold rounded border border-[#1A1A1A]/10 text-center font-bold">{useLinearGpa ? "1.00 – 1.66" : "1.00"}</div>
              
              <div className="p-2 rounded border border-[#1A1A1A]/5 font-semibold text-center">Below 65</div>
              <div className="p-2 text-red-500 font-bold rounded border border-[#1A1A1A]/10 text-center">F</div>
              <div className="p-2 text-red-650 font-bold rounded border border-[#1A1A1A]/10 text-center">0.00</div>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Backup Notes Modal */}
      {isSnapshotModalOpen && (
        <div className="modal block">
          <div className="modal-content rounded-xl p-6 relative border border-[#1A1A1A]/15 shadow-lg">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1A1A1A]/10">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>Commit Backup Snapshot</h2>
              <span
                onClick={() => setIsSnapshotModalOpen(false)}
                className="cursor-pointer text-2xl text-slate-400 hover:text-slate-800 transition-colors"
              >
                &times;
              </span>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Backup Identifier Notes</label>
              <textarea
                placeholder="Write a message for this milestone, e.g., 'Grade after AP Physics mid-term revisions'..."
                value={snapshotNote}
                onChange={(e) => setSnapshotNote(e.target.value)}
                className="w-full p-2.5 bg-white border border-[#1A1A1A]/10 text-xs text-slate-700 rounded focus:border-[#1A1A1A] resize-none h-20 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsSnapshotModalOpen(false)}
                className="w-1/2 py-2.5 text-[10px] uppercase font-bold tracking-widest text-[#1A1A1A] bg-white border border-[#1A1A1A]/10 hover:bg-slate-50 rounded transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSnapshot}
                className="w-1/2 py-2.5 text-[10px] uppercase font-bold tracking-widest text-white bg-[#1A1A1A] hover:bg-[#2C2C2C] rounded transition-all"
              >
                Save Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal block">
          <div className="modal-content rounded-xl p-6 relative border border-[#1A1A1A]/15 shadow-lg max-w-[400px]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1A1A1A]/10">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                Confirm Action
              </h2>
              <span
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="cursor-pointer text-2xl text-slate-400 hover:text-slate-800 transition-colors"
              >
                &times;
              </span>
            </div>
            <p className="text-xs text-slate-750 leading-relaxed mb-6 font-sans">
              {confirmModal.message}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="w-1/2 py-2.5 text-[10px] uppercase font-bold tracking-widest text-[#1A1A1A] bg-white border border-[#1A1A1A]/10 hover:bg-slate-50 rounded transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal({ ...confirmModal, isOpen: false });
                }}
                className="w-1/2 py-2.5 text-[10px] uppercase font-bold tracking-widest text-white bg-red-600 hover:bg-red-750 rounded transition-all shadow-none"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertModal.isOpen && (
        <div className="modal block">
          <div className="modal-content rounded-xl p-6 relative border border-[#1A1A1A]/15 shadow-lg max-w-[400px]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#1A1A1A]/10">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
                Notice
              </h2>
              <span
                onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                className="cursor-pointer text-2xl text-slate-400 hover:text-slate-800 transition-colors"
              >
                &times;
              </span>
            </div>
            <p className="text-xs text-slate-750 leading-relaxed mb-6 font-sans">
              {alertModal.message}
            </p>
            <button
              onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
              className="w-full py-2.5 text-[10px] uppercase font-bold tracking-widest text-white bg-[#1A1A1A] hover:bg-[#2C2C2C] rounded transition-all text-center"
            >
              OK
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
