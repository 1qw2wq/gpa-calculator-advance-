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
  // Official 10th-11th grade GPAs
  cappedWeightedGpa: string;
  fullyWeightedGpa: string;
  unweightedGpa: string;
  
  // Cumulative 9th-12th grade GPAs (for overall context)
  cumulativeCappedGpa: string;
  cumulativeWeightedGpa: string;
  cumulativeUnweightedGpa: string;

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
  // 10th & 11th Grade Accounting
  let points1011Unweighted = 0;
  let credits1011 = 0;

  let tenthGradeHonorsPoints = 0;
  let eleventhGradeHonorsPoints = 0;
  let tenthEleventhUncappedHonorsPoints = 0;

  // Cumulative (9-12) Accounting
  let cumulativeUnweightedPoints = 0;
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
      if (isNaN(credit) || credit <= 0) return;

      const agCategory = course.agCategory || detectAgCategoryFromName(course.courseName);

      // Track non-A-G credits separately
      if (agCategory === "Non-AG") {
        totalNonAgCredits += credit;
        agCreditsMap["Non-AG"] += credit;
        return; // Excluded from all UC GPA calculations
      }

      // Track A-G subject completion across high school
      agCreditsMap[agCategory] = (agCreditsMap[agCategory] || 0) + credit;

      const basePoint = scoreToUcGradePoint(course.score);
      const isPassForHonors = basePoint >= 2.0; // Must be C or better (A, B, C)
      const isHonorsCourse = course.level === "AP/IB" || course.level === "Honors";

      // Cumulative (9-12)
      cumulativeUnweightedPoints += basePoint * credit;
      cumulativeCredits += credit;

      if (isHonorsCourse && isPassForHonors) {
        cumulativeHonorsPoints += 1.0 * credit;
      }

      // 10th & 11th Grade UC Focus Window
      if (isTenthOrEleventh) {
        points1011Unweighted += basePoint * credit;
        credits1011 += credit;

        if (isHonorsCourse && isPassForHonors) {
          tenthEleventhUncappedHonorsPoints += 1.0 * credit;
          if (gradeLevel === "10") {
            tenthGradeHonorsPoints += 1.0 * credit;
          } else if (gradeLevel === "11") {
            eleventhGradeHonorsPoints += 1.0 * credit;
          }
        }
      }
    });
  });

  // Calculate Capped Honors Points:
  // - Max 4 semester points from 10th grade
  // - Max 8 semester points combined total
  const cappedTenthHonors = Math.min(4.0, tenthGradeHonorsPoints);
  const remainingAllowance = Math.max(0, 8.0 - cappedTenthHonors);
  const cappedEleventhHonors = Math.min(remainingAllowance, eleventhGradeHonorsPoints);
  const totalCappedHonors = cappedTenthHonors + cappedEleventhHonors;

  // 10th-11th Official GPAs
  const cappedWeightedGpa = credits1011 > 0 ? (points1011Unweighted + totalCappedHonors) / credits1011 : 0;
  const fullyWeightedGpa = credits1011 > 0 ? (points1011Unweighted + tenthEleventhUncappedHonorsPoints) / credits1011 : 0;
  const unweightedGpa = credits1011 > 0 ? points1011Unweighted / credits1011 : 0;

  // Cumulative GPAs (9-12)
  const cumulativeCappedGpa = cumulativeCredits > 0 ? (cumulativeUnweightedPoints + Math.min(8.0, cumulativeHonorsPoints)) / cumulativeCredits : 0;
  const cumulativeWeightedGpa = cumulativeCredits > 0 ? (cumulativeUnweightedPoints + cumulativeHonorsPoints) / cumulativeCredits : 0;
  const cumulativeUnweightedGpa = cumulativeCredits > 0 ? cumulativeUnweightedPoints / cumulativeCredits : 0;

  // Build A-G Progress Summary
  // Standard California high school: 1 year = 2 credits (or 2 semesters).
  // If user enters 1 credit per year, we adapt accordingly.
  const agProgress: AgProgressItem[] = (["A", "B", "C", "D", "E", "F", "G"] as AgCategory[]).map(code => {
    const info = AG_CATEGORIES[code];
    const completed = agCreditsMap[code] || 0;
    // Assuming 1 semester = 0.5 year = 1 credit or 0.5 credit. We test against required semesters.
    // If credit is entered as 1.0 per semester or 0.5 per semester, info.requiredYears is key.
    const required = info.requiredYears; // In years
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
    cappedWeightedGpa: cappedWeightedGpa.toFixed(2),
    fullyWeightedGpa: fullyWeightedGpa.toFixed(2),
    unweightedGpa: unweightedGpa.toFixed(2),
    
    cumulativeCappedGpa: cumulativeCappedGpa.toFixed(2),
    cumulativeWeightedGpa: cumulativeWeightedGpa.toFixed(2),
    cumulativeUnweightedGpa: cumulativeUnweightedGpa.toFixed(2),

    tenthEleventhCredits: credits1011,
    totalAgCredits: cumulativeCredits,
    totalNonAgCredits,

    honorsPointsApplied: totalCappedHonors,
    honorsPointsPotential: tenthEleventhUncappedHonorsPoints,
    honorsTenthGradeApplied: cappedTenthHonors,
    honorsEleventhGradeApplied: cappedEleventhHonors,
    maxHonorsAllowed: 8.0,

    agProgress,
    allAgRequirementsMet
  };
}
