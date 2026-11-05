/**
 * University of California (UC) GPA Calculation Engine
 * 
 * Implements the official UC admissions calculation guidelines:
 * 1. Letter grades convert to standard 4.0 points: A = 4, B = 3, C = 2, D = 1, F = 0.
 *    Pluses and minuses (+/-) are completely ignored (e.g. A-, A, A+ are all 4.0).
 * 2. Only A-G approved courses are included. Non-academic courses (PE, Health, TA) are excluded.
 * 3. In the official UC Admissions GPA, only courses completed in 10th and 11th grade count.
 * 4. Honors/AP/IB weighting (+1.0 point) is awarded for approved courses with grades of A, B, or C.
 *    (Grades of D or F receive 0 extra points).
 * 5. Capped Weighted GPA:
 *    - Maximum of 8 semester courses (4 year-long equivalents) of honors points allowed between 10th and 11th grade.
 *    - No more than 4 semester courses (2 year-long equivalents) of honors points can come from 10th grade.
 * 6. Fully Weighted GPA:
 *    - Extra points for all eligible AP/IB/Honors courses taken in 10th/11th grade without upper limit.
 * 7. Unweighted GPA:
 *    - Standard 4.0 scale on all 10th/11th grade A-G courses (0 honors points).
 */

export type AgCategory = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "Non-AG";

export const AG_CATEGORIES: Record<AgCategory, { code: AgCategory; name: string; requiredYears: number; requiredSemesters: number; description: string }> = {
  "A": { code: "A", name: "History / Social Science", requiredYears: 2, requiredSemesters: 4, description: "2 years required (World History, US History, Civics)" },
  "B": { code: "B", name: "English", requiredYears: 4, requiredSemesters: 8, description: "4 years required of college-preparatory English" },
  "C": { code: "C", name: "Mathematics", requiredYears: 3, requiredSemesters: 6, description: "3 years required, 4 recommended (Algebra, Geometry, Algebra II, Pre-Calc, Calculus, Stats)" },
  "D": { code: "D", name: "Science", requiredYears: 2, requiredSemesters: 4, description: "2 years required, 3 recommended (Biology, Chemistry, Physics)" },
  "E": { code: "E", name: "Language Other Than English", requiredYears: 2, requiredSemesters: 4, description: "2 years required, 3 recommended of the same language" },
  "F": { code: "F", name: "Visual and Performing Arts", requiredYears: 1, requiredSemesters: 2, description: "1 year required (Dance, Music, Theatre, Visual Art)" },
  "G": { code: "G", name: "College-Preparatory Elective", requiredYears: 1, requiredSemesters: 2, description: "1 year required chosen from approved A-F subjects or other electives" },
  "Non-AG": { code: "Non-AG", name: "Non-A-G (Excluded)", requiredYears: 0, requiredSemesters: 0, description: "Physical Education, Health, Advisory, or non-academic electives" }
};

export interface UcCourseInput {
  id: string;
  courseName: string;
  score: string;      // numeric percentage e.g. "95" or letter grade "A-"
  credit: string;     // e.g. "1.0", "0.5"
  level?: "Regular" | "Honors" | "AP/IB" | "Custom";
  agCategory?: AgCategory;
}

export interface UcTermInput {
  id: string;
  title: string;
  gradeLevel?: "9" | "10" | "11" | "12" | "Other";
  courses: UcCourseInput[];
}

export interface AgProgressItem {
  code: AgCategory;
  name: string;
  completedCredits: number;
  requiredCredits: number;
  isSatisfied: boolean;
}

export interface UcGpaSummary {
  // Official 10th-11th grade GPAs (Image 1 Formulas: Base Points / Total Courses)
  cappedWeightedGpa: string;
  fullyWeightedGpa: string;
  unweightedGpa: string;
  
  // Cumulative 9th-12th grade GPAs (for overall context)
  cumulativeCappedGpa: string;
  cumulativeWeightedGpa: string;
  cumulativeUnweightedGpa: string;

  // Exact Formula Variables (from UC guidelines: Base Points / Total Courses)
  tenthEleventhBasePoints: number;
  tenthEleventhCoursesCount: number;
  cumulativeBasePoints: number;
  cumulativeCoursesCount: number;

  // Credits & Honors Points Accounting
  tenthEleventhCredits: number;
  totalAgCredits: number;
  totalNonAgCredits: number;
  
  honorsPointsApplied: number;
  honorsPointsPotential: number;
  honorsTenthGradeApplied: number;
  honorsEleventhGradeApplied: number;
  maxHonorsAllowed: number;
  
  // A-G Progress
  agProgress: AgProgressItem[];
  allAgRequirementsMet: boolean;
}

/**
 * Truncates a GPA value to two decimal places without rounding per official UC policy.
 * (e.g. 200 / 52 = 3.84615... -> 3.84, NOT 3.85)
 */
export function truncateToTwoDecimals(val: number): string {
  if (isNaN(val) || val <= 0) return "0.00";
  // Add a small epsilon (1e-9) to avoid floating-point inaccuracies like 3.84 * 100 = 383.99999999999994
  const truncated = Math.floor((val + 1e-9) * 100) / 100;
  return truncated.toFixed(2);
}

/**
 * Normalizes a score or letter grade into standard UC grade points:
 * A (90-100) = 4.0
 * B (80-89)  = 3.0
 * C (70-79)  = 2.0
 * D (60-69)  = 1.0
 * F (<60)    = 0.0
 * 
 * Note: Pluses and minuses are explicitly ignored per UC guidelines.
 */
export function scoreToUcGradePoint(rawScore: string | number): number {
  if (rawScore === null || rawScore === undefined) return 0;
  const str = String(rawScore).trim().toUpperCase();

  // If letter grade passed
  if (str.startsWith("A")) return 4.0;
  if (str.startsWith("B")) return 3.0;
  if (str.startsWith("C")) return 2.0;
  if (str.startsWith("D")) return 1.0;
  if (str.startsWith("F")) return 0.0;

  // If percentage numeric score
  const num = parseFloat(str);
  if (isNaN(num) || num < 0) return 0;
  if (num >= 90) return 4.0;
  if (num >= 80) return 3.0;
  if (num >= 70) return 2.0;
  if (num >= 60) return 1.0;
  return 0.0;
}

/**
 * Converts score to UC letter grade
 */
export function scoreToUcLetterGrade(rawScore: string | number): string {
  const gp = scoreToUcGradePoint(rawScore);
  if (gp === 4.0) return "A";
  if (gp === 3.0) return "B";
  if (gp === 2.0) return "C";
  if (gp === 1.0) return "D";
  return "F";
}

/**
 * Infers grade level from term title if not explicitly set
 */
export function inferGradeLevelFromTermTitle(title: string, index: number): "9" | "10" | "11" | "12" | "Other" {
  const lower = title.toLowerCase();
  if (lower.includes("grade 9") || lower.includes("9th") || lower.includes("freshman") || lower.includes("g9")) return "9";
  if (lower.includes("grade 10") || lower.includes("10th") || lower.includes("sophomore") || lower.includes("g10")) return "10";
  if (lower.includes("grade 11") || lower.includes("11th") || lower.includes("junior") || lower.includes("g11")) return "11";
  if (lower.includes("grade 12") || lower.includes("12th") || lower.includes("senior") || lower.includes("g12")) return "12";
  
  // Default based on semester index (assuming 2 semesters per grade)
  if (index === 0 || index === 1) return "9";
  if (index === 2 || index === 3) return "10";
  if (index === 4 || index === 5) return "11";
  if (index === 6 || index === 7) return "12";
  return "10"; // Default fallback
}

/**
 * Offline heuristic classifier for A-G categories when AI has not yet classified the course
 */
export function detectAgCategoryFromName(courseName: string): AgCategory {
  const lower = courseName.toLowerCase();

  // Non-A-G (Physical Education, Health, Advisory, Free Period)
  if (
    lower.includes("pe") ||
    lower.includes("physical education") ||
    lower.includes("pae") ||
    lower.includes("health") ||
    lower.includes("wellness") ||
    lower.includes("fitness") ||
    lower.includes("advisory") ||
    lower.includes("homeroom") ||
    lower.includes("study hall") ||
    lower.includes("free period") ||
    lower.includes("driver")
  ) {
    return "Non-AG";
  }

  // Area A: History / Social Science
  if (
    lower.includes("history") ||
    lower.includes("government") ||
    lower.includes("gov") ||
    lower.includes("civics") ||
    lower.includes("world cultures") ||
    lower.includes("european history") ||
    lower.includes("us history") ||
    lower.includes("geography")
  ) {
    return "A";
  }

  // Area B: English
  if (
    lower.includes("english") ||
    lower.includes("literature") ||
    lower.includes("eap") ||
    lower.includes("writing") ||
    lower.includes("composition") ||
    lower.includes("lang & comp") ||
    lower.includes("lit & comp")
  ) {
    return "B";
  }

  // Area C: Mathematics
  if (
    lower.includes("math") ||
    lower.includes("algebra") ||
    lower.includes("geometry") ||
    lower.includes("calculus") ||
    lower.includes("calc") ||
    lower.includes("statistics") ||
    lower.includes("stats") ||
    lower.includes("pre-calc") ||
    lower.includes("precalculus") ||
    lower.includes("trigonometry") ||
    lower.includes("discrete")
  ) {
    return "C";
  }

  // Area D: Science
  if (
    lower.includes("biology") ||
    lower.includes("bio") ||
    lower.includes("chemistry") ||
    lower.includes("chem") ||
    lower.includes("physics") ||
    lower.includes("phys") ||
    lower.includes("environmental science") ||
    lower.includes("anatomy") ||
    lower.includes("physiology")
  ) {
    return "D";
  }

  // Area E: Language Other Than English
  if (
    lower.includes("chinese") ||
    lower.includes("spanish") ||
    lower.includes("french") ||
    lower.includes("japanese") ||
    lower.includes("german") ||
    lower.includes("latin") ||
    lower.includes("korean") ||
    lower.includes("italian") ||
    lower.includes("russian") ||
    lower.includes("arabic") ||
    lower.includes("mandarin") ||
    lower.includes("lote")
  ) {
    return "E";
  }

  // Area F: Visual & Performing Arts
  if (
    lower.includes("art") ||
    lower.includes("music") ||
    lower.includes("theatre") ||
    lower.includes("theater") ||
    lower.includes("drama") ||
    lower.includes("dance") ||
    lower.includes("drawing") ||
    lower.includes("painting") ||
    lower.includes("ceramics") ||
    lower.includes("orchestra") ||
    lower.includes("band") ||
    lower.includes("choir") ||
    lower.includes("photo") ||
    lower.includes("film") ||
    lower.includes("design")
  ) {
    return "F";
  }

  // Area G: College-Preparatory Elective
  if (
    lower.includes("economics") ||
    lower.includes("econ") ||
    lower.includes("psychology") ||
    lower.includes("psych") ||
    lower.includes("sociology") ||
    lower.includes("computer science") ||
    lower.includes("coding") ||
    lower.includes("programming") ||
    lower.includes("business") ||
    lower.includes("finance") ||
    lower.includes("philosophy") ||
    lower.includes("journalism") ||
    lower.includes("speech") ||
    lower.includes("debate") ||
    lower.includes("robotics")
  ) {
    return "G";
  }

  // Default to Elective G if academic
  return "G";
}

/**
 * Calculates University of California (UC) GPA metrics
 */
export function calculateUcGpa(terms: UcTermInput[]): UcGpaSummary {
  // 10th & 11th Grade Accounting (Image 1 Formulas: Base Points / Total Courses)
  let points1011Base = 0;
  let courses1011Count = 0;
  let credits1011 = 0;

  let tenthGradeHonorsPoints = 0;
  let eleventhGradeHonorsPoints = 0;
  let tenthEleventhUncappedHonorsPoints = 0;

  // Cumulative (9-12) Accounting
  let cumulativeBasePoints = 0;
  let cumulativeCoursesCount = 0;
  let cumulativeCredits = 0;
  let cumulativeHonorsPoints = 0;

  let totalNonAgCredits = 0;

  // A-G Subject Progress Tracking (accumulated across all 9-12 grades)
  const agCreditsMap: Record<AgCategory, number> = {
    "A": 0,
    "B": 0,
    "C": 0,
    "D": 0,
    "E": 0,
    "F": 0,
    "G": 0,
    "Non-AG": 0
  };

  terms.forEach((term, termIdx) => {
    const gradeLevel = term.gradeLevel || inferGradeLevelFromTermTitle(term.title, termIdx);
    const isTenthOrEleventh = gradeLevel === "10" || gradeLevel === "11";

    term.courses.forEach((course) => {
      const credit = parseFloat(course.credit);
      const validCredit = (!isNaN(credit) && credit > 0) ? credit : 1.0;

      const agCategory = course.agCategory || detectAgCategoryFromName(course.courseName);

      // Track non-A-G credits separately (PE, Health, TA, etc. excluded per UC guidelines)
      if (agCategory === "Non-AG") {
        totalNonAgCredits += validCredit;
        agCreditsMap["Non-AG"] += validCredit;
        return;
      }

      // Track A-G subject completion across high school
      agCreditsMap[agCategory] = (agCreditsMap[agCategory] || 0) + validCredit;

      const basePoint = scoreToUcGradePoint(course.score);
      const isPassForHonors = basePoint >= 2.0; // Must be C or better (A, B, C)
      const isHonorsCourse = course.level === "AP/IB" || course.level === "Honors";

      // Cumulative (9-12)
      cumulativeBasePoints += basePoint;
      cumulativeCoursesCount += 1;
      cumulativeCredits += validCredit;

      if (isHonorsCourse && isPassForHonors) {
        cumulativeHonorsPoints += 1;
      }

      // 10th & 11th Grade UC Focus Window (Image 1 Primary Baseline)
      if (isTenthOrEleventh) {
        points1011Base += basePoint;
        courses1011Count += 1;
        credits1011 += validCredit;

        if (isHonorsCourse && isPassForHonors) {
          tenthEleventhUncappedHonorsPoints += 1;
          if (gradeLevel === "10") {
            tenthGradeHonorsPoints += 1;
          } else if (gradeLevel === "11") {
            eleventhGradeHonorsPoints += 1;
          }
        }
      }
    });
  });

  // Calculate Capped Honors Points per UC policy (Image 1):
  // - Maximum of 8 semester points
  // - No more than 4 semester points from 10th grade
  const cappedTenthHonors = Math.min(4, tenthGradeHonorsPoints);
  const remainingAllowance = Math.max(0, 8 - cappedTenthHonors);
  const cappedEleventhHonors = Math.min(remainingAllowance, eleventhGradeHonorsPoints);
  const totalCappedHonors = cappedTenthHonors + cappedEleventhHonors;

  // 10th-11th Official GPAs (Image 1 Formulas)
  // UC Unweighted = Total Base Points / Total Courses
  const unweightedGpaRaw = courses1011Count > 0 ? points1011Base / courses1011Count : 0;
  // UC Capped GPA = (Base Points + Capped Honors Points) / Total Courses
  const cappedWeightedGpaRaw = courses1011Count > 0 ? (points1011Base + totalCappedHonors) / courses1011Count : 0;
  // UC Fully Weighted GPA = (Base Points + Honors Points) / Total Courses
  const fullyWeightedGpaRaw = courses1011Count > 0 ? (points1011Base + tenthEleventhUncappedHonorsPoints) / courses1011Count : 0;

  // Truncates to two decimals without rounding per UC rules (e.g. 200 / 52 = 3.84)
  const unweightedGpa = truncateToTwoDecimals(unweightedGpaRaw);
  const cappedWeightedGpa = truncateToTwoDecimals(cappedWeightedGpaRaw);
  const fullyWeightedGpa = truncateToTwoDecimals(fullyWeightedGpaRaw);

  // Cumulative GPAs (9-12)
  const cumulativeUnweightedGpaRaw = cumulativeCoursesCount > 0 ? cumulativeBasePoints / cumulativeCoursesCount : 0;
  const cumulativeCappedGpaRaw = cumulativeCoursesCount > 0 ? (cumulativeBasePoints + Math.min(8, cumulativeHonorsPoints)) / cumulativeCoursesCount : 0;
  const cumulativeWeightedGpaRaw = cumulativeCoursesCount > 0 ? (cumulativeBasePoints + cumulativeHonorsPoints) / cumulativeCoursesCount : 0;

  const cumulativeUnweightedGpa = truncateToTwoDecimals(cumulativeUnweightedGpaRaw);
  const cumulativeCappedGpa = truncateToTwoDecimals(cumulativeCappedGpaRaw);
  const cumulativeWeightedGpa = truncateToTwoDecimals(cumulativeWeightedGpaRaw);

  // Build A-G Progress Summary
  const agProgress: AgProgressItem[] = (["A", "B", "C", "D", "E", "F", "G"] as AgCategory[]).map(code => {
    const info = AG_CATEGORIES[code];
    const completed = agCreditsMap[code] || 0;
    const required = info.requiredYears;
    return {
      code,
      name: info.name,
      completedCredits: completed,
      requiredCredits: required,
      isSatisfied: completed >= required
    };
  });

  const allAgRequirementsMet = agProgress.every(p => p.isSatisfied);

  return {
    cappedWeightedGpa,
    fullyWeightedGpa,
    unweightedGpa,
    
    cumulativeCappedGpa,
    cumulativeWeightedGpa,
    cumulativeUnweightedGpa,

    tenthEleventhBasePoints: points1011Base,
    tenthEleventhCoursesCount: courses1011Count,
    cumulativeBasePoints,
    cumulativeCoursesCount,

    tenthEleventhCredits: credits1011,
    totalAgCredits: cumulativeCredits,
    totalNonAgCredits,

    honorsPointsApplied: totalCappedHonors,
    honorsPointsPotential: tenthEleventhUncappedHonorsPoints,
    honorsTenthGradeApplied: cappedTenthHonors,
    honorsEleventhGradeApplied: cappedEleventhHonors,
    maxHonorsAllowed: 8,

    agProgress,
    allAgRequirementsMet
  };
}
