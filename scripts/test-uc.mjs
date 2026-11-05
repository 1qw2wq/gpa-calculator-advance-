// Mathematical verification for University of California (UC) GPA calculation
import { scoreToUcGradePoint, detectAgCategoryFromName, calculateUcGpa } from "../lib/uc-gpa.ts";

console.log("=== Testing UC Grade Points (Ignoring +/-) ===");
const tests = [
  { score: 98, expected: 4.0 }, // A+
  { score: 95, expected: 4.0 }, // A
  { score: 91, expected: 4.0 }, // A-
  { score: 88, expected: 3.0 }, // B+
  { score: 84, expected: 3.0 }, // B
  { score: 80, expected: 3.0 }, // B-
  { score: 78, expected: 2.0 }, // C+
  { score: 72, expected: 2.0 }, // C
  { score: 65, expected: 1.0 }, // D
  { score: 55, expected: 0.0 }, // F
  { score: "A", expected: 4.0 },
  { score: "B+", expected: 3.0 },
  { score: "C-", expected: 2.0 },
];

let allPassed = true;
tests.forEach(t => {
  const result = scoreToUcGradePoint(t.score);
  const pass = result === t.expected;
  if (!pass) {
    console.error(`FAIL: score ${t.score} -> got ${result}, expected ${t.expected}`);
    allPassed = false;
  }
});
if (allPassed) console.log("✔ All UC grade point normalization tests passed!");

console.log("\n=== Testing A-G Categorization Heuristic ===");
const agTests = [
  { course: "AP US History", expected: "A" },
  { course: "AP English Literature", expected: "B" },
  { course: "AP Calculus BC", expected: "C" },
  { score: 95, course: "AP Chemistry", expected: "D" },
  { course: "Spanish 3", expected: "E" },
  { course: "AP Studio Art", expected: "F" },
  { course: "AP Computer Science A", expected: "G" },
  { course: "Physical Education 10", expected: "Non-AG" },
  { course: "Health & Wellness", expected: "Non-AG" },
];

agTests.forEach(t => {
  const cat = detectAgCategoryFromName(t.course);
  const pass = cat === t.expected;
  if (!pass) {
    console.error(`FAIL: course "${t.course}" -> got ${cat}, expected ${t.expected}`);
    allPassed = false;
  } else {
    console.log(`✔ "${t.course}" -> [${cat}]`);
  }
});

console.log("\n=== Testing UC Capped & Fully Weighted GPA Engine ===");
// Case: Student takes 10 honors/AP courses across 10th and 11th grade:
// 10th grade: 5 AP courses, all A's (4.0 base + honors boost).
// 11th grade: 5 AP courses, all A's (4.0 base + honors boost).
// Total courses = 10 (each 1 credit).
// Total unweighted points = 40.0.
// Honors potential = 10.0.
// 10th grade sub-cap: max 4.0 bonus points.
// Combined total cap: max 8.0 bonus points.
// Capped points = 40.0 + 8.0 = 48.0.
// Capped GPA = 48.0 / 10 = 4.80.
// Fully Weighted GPA = (40.0 + 10.0) / 10 = 5.00.
// Unweighted GPA = 40.0 / 10 = 4.00.

const mockTerms = [
  {
    id: "term-g9",
    title: "Grade 9 Semester 1",
    gradeLevel: "9",
    courses: [
      { id: "c1", courseName: "English 9", score: "95", credit: "1.0", level: "Regular", agCategory: "B" },
      { id: "c2", courseName: "Physical Education", score: "98", credit: "1.0", level: "Regular", agCategory: "Non-AG" } // should be excluded!
    ]
  },
  {
    id: "term-g10",
    title: "Grade 10 Year",
    gradeLevel: "10",
    courses: [
      { id: "c3", courseName: "AP World History", score: "95", credit: "1.0", level: "AP/IB", agCategory: "A" },
      { id: "c4", courseName: "AP European History", score: "94", credit: "1.0", level: "AP/IB", agCategory: "A" },
      { id: "c5", courseName: "AP Calculus AB", score: "93", credit: "1.0", level: "AP/IB", agCategory: "C" },
      { id: "c6", courseName: "AP Chemistry", score: "92", credit: "1.0", level: "AP/IB", agCategory: "D" },
      { id: "c7", courseName: "AP Biology", score: "91", credit: "1.0", level: "AP/IB", agCategory: "D" },
      { id: "c8", courseName: "PE 10", score: "99", credit: "1.0", level: "Regular", agCategory: "Non-AG" } // excluded
    ]
  },
  {
    id: "term-g11",
    title: "Grade 11 Year",
    gradeLevel: "11",
    courses: [
      { id: "c9", courseName: "AP US History", score: "95", credit: "1.0", level: "AP/IB", agCategory: "A" },
      { id: "c10", courseName: "AP English Lang", score: "94", credit: "1.0", level: "AP/IB", agCategory: "B" },
      { id: "c11", courseName: "AP Calculus BC", score: "93", credit: "1.0", level: "AP/IB", agCategory: "C" },
      { id: "c12", courseName: "AP Physics C", score: "92", credit: "1.0", level: "AP/IB", agCategory: "D" },
      { id: "c13", courseName: "AP Spanish", score: "91", credit: "1.0", level: "AP/IB", agCategory: "E" }
    ]
  }
];

const result = calculateUcGpa(mockTerms);
console.log("Calculated UC Result:", JSON.stringify(result, null, 2));

if (result.unweightedGpa === "4.00" && result.cappedWeightedGpa === "4.80" && result.fullyWeightedGpa === "5.00") {
  console.log("\n🎉 PERFECT! All UC Capped, Fully Weighted, and Unweighted GPA mathematical rules verified!");
} else {
  console.error("Mismatch in GPA results!");
}
