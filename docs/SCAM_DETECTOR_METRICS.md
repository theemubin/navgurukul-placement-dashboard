# Scam Detector: Analysis Metrics Documentation

## Overview
The Scam Detector uses AI and heuristic analysis to evaluate job offers across four key dimensions. Each dimension produces a score from 0-100, where higher scores indicate lower risk.

---

## The Four Analysis Metrics

### 1. **Company Legitimacy** (0-100)
**What it measures:** How real and credible the company appears

**Calculation Logic:**
```
Base Score: trustScore (0-100)
+ (Green Flags × 2)    [Positive factors boost credibility]
- (Red Flags × 3)      [Negative factors heavily reduce credibility]
Result: Clamped between 5-95
```

**Key Factors Checked:**
- Company domain legitimacy (registration age, public records)
- LinkedIn presence and company profile authenticity
- Formal company communication channels
- Official careers page or job portal listing
- Consistency of company information across sources

**Example:**
- ✅ Company has been registered for 10+ years: +credibility
- ✅ Hiring manager verified on LinkedIn with company affiliation: +credibility
- ❌ Brand new domain registered this month: -credibility
- ❌ Sender email doesn't match company domain: -credibility

---

### 2. **Offer Realism** (0-100)
**What it measures:** Whether the salary, benefits, and job terms seem realistic

**Calculation Logic:**
```
Base Score: trustScore (0-100)
+ (Green Flags × 3)    [Realistic offers get stronger boost]
- (Red Flags × 4)      [Unrealistic terms are heavily penalized]
Result: Clamped between 5-95
```

**Key Factors Checked:**
- Salary benchmarking (compared to market rates for role/location/experience)
- Reasonable benefits package
- Standard employment terms
- Clear role description and responsibilities
- No unusual payment/equity structures

**Example:**
- ✅ Senior developer role offering ₹25-35 LPA in India: realistic for market
- ❌ Graduate role offering ₹50 LPA: unrealistically high
- ✅ Structured equity vesting (4-year): +realistic
- ❌ Requires upfront payment for equipment/visa: -realistic

---

### 3. **Process Flags** (0-100)
**What it measures:** Quality and legitimacy of the recruitment process itself

**Calculation Logic:**
```
Base Score: trustScore (0-100)
+ (Green Flags × 1)    [Process legitimacy gets moderate boost]
- (Red Flags × 5)      [Process red flags are most heavily penalized]
Result: Clamped between 5-95
```

**Key Factors Checked:**
- Standard interview rounds (HR → Technical → Manager)
- Clear communication and documentation
- No pressure for immediate decisions
- Structured offer process
- Appropriate background check procedures
- No unusual requirements or shortcuts

**Example:**
- ✅ Multi-round interview process spans 2+ weeks: legitimate
- ✅ Background check by recognized agency: +process quality
- ❌ "You're hired!" with no interviews: -major red flag
- ❌ Pressure to join within 1 hour: -urgency manipulation

---

### 4. **Community Sentiment** (0-100)
**What it measures:** What community members and public sources report about this company/offer

**Calculation Logic:**
```
Base Score: trustScore (0-100)
+ (Green Flags × 2)    [Community validation provides moderate boost]
- (Red Flags × 2)      [Community warnings are significant but not as heavy]
Result: Clamped between 5-95
```

**Key Factors Checked:**
- AmbitionBox.com company reviews and ratings
- Company reputation on job portals (Naukri, LinkedIn, etc.)
- Reports from other students/candidates
- Social media company presence and engagement
- Public complaints or scam patterns
- Industry reputation

**Example:**
- ✅ Company has 4+ star rating on AmbitionBox with 500+ reviews: strong community trust
- ✅ No complaints in Cyber Crime Portal database: +community sentiment
- ❌ Multiple reports of non-payment to contractors: -sentiment
- ❌ Pattern matches known advance-fee scams: -sentiment

---

## How Scores Are Calculated: Two Pathways

### **Pathway 1: AI Analysis (Primary)**
When AI has access to the offer details:
1. AI reads and analyzes the job offer
2. AI identifies red and green flags
3. AI independently calculates each subscore (0-100)
4. AI ensures scores reflect actual findings

### **Pathway 2: Heuristic Fallback (When AI unavailable)**
If AI service is unavailable, the system uses pattern-matching:
1. Regex patterns scan for known scam indicators
2. Text matching identifies red flags and green flags
3. **Fallback Formula** (shown above) mathematically combines:
   - Base trustScore (0-100)
   - Count of green flags × multiplier
   - Count of red flags × multiplier
4. Result is clamped between 5-95 to prevent extreme edge cases

---

## Score Interpretation Guide

### **Composite Trust Score Thresholds:**

| Score Range | Verdict | Interpretation |
|-----------|---------|-----------------|
| **72-100** | ✅ SAFE | Low scam risk, appears legitimate. Still verify independently. |
| **40-71** | ⚠️ WARNING | Mixed signals. Verify company and role independently before proceeding. |
| **0-39** | ❌ DANGER | Multiple scam indicators. STOP and report to authorities. Do not share documents/money. |

### **Individual Metric Color Codes:**

- **80-100**: 🟢 Green - Strong indicator
- **50-79**: 🟡 Yellow - Mixed signals, needs verification
- **0-49**: 🔴 Red - Serious concern

---

## Real-World Examples

### **Example 1: Suspicious Email Scam**
```
Input: Email from "hiring@goooogle.com" about senior role, ₹1 Lac/month, no interview
Flags Detected:
  Red: Domain typo (goooogle), no interview process, no company info, urgency pressure
  Green: None
Calculation:
  - Company Legitimacy: 15 (trustScore 35 - (4×3)) → 5 (minimum clamped)
  - Offer Realism: 20 (unrealistically high, no standard interview)
  - Process Flags: 10 (no structured process)
  - Community Sentiment: 25 (multiple scam indicators)
Result: DANGER verdict ✅
```

### **Example 2: Legitimate Senior Role**
```
Input: Offer from Google, ₹80 LPA role, 3-round interviews spanning 3 weeks
Flags Detected:
  Red: Slightly high salary (but within senior range)
  Green: Domain match, LinkedIn verification, structured process, company reputation
Calculation:
  - Company Legitimacy: 92 (trustScore 80 + (4×2) - (1×3))
  - Offer Realism: 88 (trustScore 80 + (4×3) - (1×4))
  - Process Flags: 89 (trustScore 80 + (4×1) - (1×5))
  - Community Sentiment: 94 (trustScore 80 + (4×2) - (1×2))
Result: SAFE verdict ✅
```

---

## Important Caveats

1. **AI Web Search Limitation**: AI-based analysis depends on current web data availability. Some companies may not have extensive online presence.

2. **Heuristic Limitations**: Fallback scoring uses pattern matching and cannot understand context. Always verify final information independently.

3. **Regional Variations**: Offers that are legitimate in one region might be unusual in another. Consider your location when evaluating.

4. **No Guarantee**: This tool detects **common patterns**, but scammers constantly evolve tactics. Always independently verify:
   - Company domain on official website
   - Hiring manager's LinkedIn profile
   - Company reviews on AmbitionBox/Naukri
   - Direct contact with company HR

5. **Community Reports**: User-submitted flags help improve future analysis but are not verified in real-time.

---

## Mathematical Details

### **Min-Max Clamping (5-95 Range)**
Why 5-95 instead of 0-100?
- **0 is too extreme**: Even very suspicious offers aren't 100% guaranteed scams without verification
- **100 is too extreme**: Even legitimate offers could have something unknown about them
- **5-95 range**: Reduces false confidence in either direction, encourages independent verification

### **Flag Multiplier Design**
- **Company Legitimacy**: 3× penalty for red flags (company identity is critical)
- **Offer Realism**: 4× penalty for red flags (impossible salaries are strong scam indicators)
- **Process Flags**: 5× penalty for red flags (skipped process is biggest warning)
- **Community Sentiment**: 2× penalty for red flags (community knowledge is more nuanced)

---

## How This Data Helps the Platform

- **Pattern Recognition**: System learns new scam patterns from user reports
- **Aggregate Signals**: Multiple reports of the same company flag problematic trends
- **Student Protection**: Early warning system for entire community
- **Feedback Loop**: Your reports help improve analysis for all students

---

## Questions?

See the [Educational Guide](/student/scam-education) for more detailed explanations with examples, or check out [ScamRadar FAQ](/docs/scam-faq) for common concerns.
