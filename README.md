<div align="center">

# GPA Tracker & Academic Ledger (Advanced)

**A sovereign, privacy-first academic tracking suite with multi-system GPA calculations, Gemini 3.5 Flash-Lite AI transcript auto-scanning, and synchronized multi-semester audit ledgers.**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Gemini 3.5 Flash-Lite](https://img.shields.io/badge/AI-Gemini%203.5%20Flash--Lite-f59e0b?style=flat&logo=google)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

</div>

---

## 🌟 Overview

**GPA Tracker & Academic Ledger (Advanced)** is an all-in-one digital academic ledger crafted for high school and university students, college applicants, and academic advisors. Whether preparing official admissions submissions for the **University of California (UC)** system or auditing standard **High School Weighted/Unweighted transcripts**, this platform gives you complete control, full transparency, and zero data leakage.

---

## 🚀 Key Features

### 1. 🤖 Gemini 3.5 Flash-Lite AI Transcript Scanner
- **Full Optical Document Understanding**: Upload photos, scanned PDFs, or screenshots of multi-year academic transcripts.
- **Intelligent Field Mapping**: Automatically identifies academic terms (Grade 9, 10, 11, 12, Semesters 1 & 2), course titles, subject categories, and letter grades.
- **Credit Period Distinction**: Distinguishes between completed course credits/periods (e.g. `1 credit`, `4 periods`) and grade points (`3.67`, `4.00`), preventing credit inflation.
- **Automated UC A-G Detection**: Analyzes course names (e.g., *AP Calculus BC* &rarr; Area C: Mathematics, *English Literature* &rarr; Area B: English, *AP Physics 1* &rarr; Area D: Laboratory Science, *Physical Education* &rarr; Non-A-G).

### 2. 🏛️ Official University of California (UC) GPA Engine
Calculates the three official University of California admissions metrics per California state guidelines:
- **UC Capped Weighted GPA** *(Primary Admissions Benchmark)*:
  $$\text{UC Capped GPA} = \frac{\text{10th \& 11th Base Points} + \text{Honors Points (Max 8)}}{\text{Total 10th \& 11th A-G Courses}}$$
  - Honors points are capped at a maximum of **8 semester points** (max 4 from 10th grade).
  - Only grades $A$, $B$, and $C$ earn honors points ($+1.0$).
  - Truncates to two decimal places without rounding (e.g., $200 \div 52 = 3.84$).
- **UC Unweighted GPA**:
  $$\text{UC Unweighted GPA} = \frac{\text{10th \& 11th Base Points}}{\text{Total 10th \& 11th A-G Courses}}$$
- **UC Fully Weighted GPA (Uncapped)**:
  $$\text{UC Fully Weighted GPA} = \frac{\text{10th \& 11th Base Points} + \text{All AP/IB Honors Points}}{\text{Total 10th \& 11th A-G Courses}}$$
- **Cumulative UC High School Scale (Grades 9–12)**: Audits cumulative A-G progress across all high school years.
- **A-G Subject Progress Tracker**: Visual progress bar tracking minimum requirements across Areas A through G.

### 3. 📈 High School Standard GPA (Weighted and Unweighted)
- **Large Unweighted GPA Hero**: Clean typography highlighting the official unweighted GPA (4.33 scale and 4.00 collegiate standard).
- **Standard Weighted GPA**: Honors ($+0.5$), AP/IB ($+1.0$), or custom boost values.
- **Quality Points Calculation**:
  $$\text{Quality Points (QP)} = \sum (\text{Grade Point} \times \text{Credits})$$
- **Linear GPA Scaling (Optional)**: Smooth interpolation across score percentages ($0-100\%$) for institutions using continuous point scales.

### 4. 📋 Dual Multi-Semester Layouts
- **Combined 2-Semester Year View**:
  - Groups terms by academic year (e.g., Grade 10, Grade 11).
  - Pairs subjects across Semester 1 and Semester 2 side by side in aligned rows, mirroring official school transcripts.
  - Allows filling both semesters simultaneously without jumping between separate tabs.
- **Single Semesters View**:
  - Traditional sequential semester view for granular, term-by-term entry.
- **2-Row Semester Summary Audit**:
  - Compares Semester 1 vs Semester 2 side by side with total courses, credits, score average, unweighted GPA, and weighted GPA.
  - Toggle between **2-Row Summary**, **Compact Badge**, or **Hidden**.

### 5. 📊 Live Academic Ledger and Score Distribution
- **Detailed Metric Sums**: Total courses completed, cumulative credits, score percentage average ($0-100\%$), unweighted QP sum, and weighted QP sum.
- **Score Extremes**: Identifies highest-scoring and lowest-scoring courses across your transcript.
- **Grade Distribution Spectrum**: Real-time counter of letter grade counts ($A+, A, A-, B+, B, B-, C+, C, C-, D, F$).
- **Semester Ledger Table**: At-a-glance comparison table of every semester term on record.

### 6. 🔒 100% Sovereign Offline Local Storage
- **Zero Server Retention**: Academic transcripts, scores, and personal reflections are stored directly in your browser (`localStorage`).
- **Milestone Snapshot Restores**: Save versions of your transcript at key milestones (e.g. "Pre-Midterms", "College App Submission") and restore any scenario with 1 click.
- **ManageBac & CSV Synchronization**: Import and export your courses in standard tabular formats.

---

## 📐 GPA Grading Scales

| Percent Range | Letter Grade | Standard 4.33 Scale | Collegiate 4.0 Scale | UC Base Point | UC AP/IB Honors |
|:---:|:---:|:---:|:---:|:---:|:---:|
| 97% – 100% | A+ | 4.33 | 4.00 | 4.0 | 5.0 |
| 93% – 96% | A | 4.00 | 4.00 | 4.0 | 5.0 |
| 90% – 92% | A- | 3.67 | 4.00 | 4.0 | 5.0 |
| 87% – 89% | B+ | 3.33 | 3.00 | 3.0 | 4.0 |
| 83% – 86% | B | 3.00 | 3.00 | 3.0 | 4.0 |
| 80% – 82% | B- | 2.67 | 3.00 | 3.0 | 4.0 |
| 77% – 79% | C+ | 2.33 | 2.00 | 2.0 | 3.0 |
| 73% – 76% | C | 2.00 | 2.00 | 2.0 | 3.0 |
| 70% – 72% | C- | 1.67 | 2.00 | 2.0 | 3.0 |
| 60% – 69% | D | 1.00 | 1.00 | 1.0 | 1.0 |
| Below 60% | F | 0.00 | 0.00 | 0.0 | 0.0 |

---

## 🛠️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.17 or higher recommended)
- `npm` or `pnpm`

### 1. Clone the repository
```bash
git clone https://github.com/your-username/gpa-calculator-advance-.git
cd gpa-calculator-advance-
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Gemini AI API Key
Create a `.env.local` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
> Obtain a Gemini API key free from [Google AI Studio](https://aistudio.google.com/).

### 4. Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for production
```bash
npm run build
npm start
```

---

## 📁 Project Architecture

```
gpa-calculator-advance-/
├── app/
│   ├── api/
│   │   ├── transcript-ai/   # Gemini 3.5 Flash-Lite OCR transcript processor
│   │   │   └── route.ts
│   │   └── mentor/          # AI Academic Advisor & reflection auditor
│   │       └── route.ts
│   ├── favicon.ico
│   ├── globals.css          # Modern glassmorphism & typography design tokens
│   ├── layout.tsx           # Application layout wrapper
│   └── page.tsx             # Main client component (Ledger, Dashboard, Dual Views)
├── scripts/
│   └── test-uc.mjs          # Math verification test suite for UC & HS calculations
├── .env.local               # Local environment secrets (not committed to git)
├── next.config.ts           # Next.js 15 configuration
├── package.json
├── README.md
└── tsconfig.json
```

---

## 🧪 Verification & Testing

Verify that all GPA mathematical formulas pass official benchmarks:
```bash
node scripts/test-uc.mjs
```
Expected output:
```
All UC GPA and Standard GPA calculation tests passed successfully!
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
