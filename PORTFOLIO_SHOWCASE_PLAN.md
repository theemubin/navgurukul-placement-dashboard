# Public Portfolio Showcase Implementation Plan

## Overview
Create a public-facing portfolio showcase page inspired by https://portfolio-dharamshala.vercel.app/#portfolios

## Key Features

### 1. Public Access (No Authentication Required)
- Accessible at `/portfolios` route
- No login required to view student profiles
- Login buttons in footer for staff access

### 2. Student Profile Cards
- **Profile Picture**: From `user.avatar` (max 100KB, enforced in profile upload)
- **Name**: `firstName lastName`
- **Role/Specialization**: Derived from `openForRoles` or skills
- **Skill Tags**: Display top technical skills from `studentProfile.technicalSkills`
- **Batch/Cycle**: From `placementCycle` or graduation year
- **Campus**: From `campus.name`
- **View Profile Button**: Opens detailed modal

### 3. Detailed Profile Modal
- **Profile Picture & Basic Info**
- **GitHub Link**: `studentProfile.github` (clickable)
- **Portfolio Link**: `studentProfile.portfolio` (clickable)
- **Resume**: `studentProfile.resumeLink` - **View mode only** (embedded PDF viewer, no download)
- **Skills**: Technical, Soft, Office skills with ratings
- **Education**: 10th, 12th, Higher Education
- **Languages**: Multi-language proficiency
- **About**: `studentProfile.about`

### 4. Filters
- **Campus Filter**: Dropdown to filter by campus
- **Skills Filter**: Multi-select for technical skills
- **Role Filter**: Filter by openForRoles
- **Clear All Filters** button

### 5. Design Requirements
- Modern gradient background (pastel tones)
- Responsive grid layout
- Smooth animations and hover effects
- Premium, professional aesthetic
- Mobile-friendly

## Technical Implementation

### Backend
1. **New Route**: `GET /api/public/portfolios`
   - No authentication required
   - Returns only approved student profiles (`profileStatus: 'approved'`)
   - Only active students (`isActive: true`)
   - Excludes sensitive data (password, email, phone)
   - Includes: avatar, name, skills, campus, github, portfolio, resumeLink

2. **Resume Viewer**: Ensure resumeLink is accessible for embedding

### Frontend
1. **New Page**: `/frontend/src/pages/public/Portfolios.jsx`
2. **Components**:
   - `PortfolioCard.jsx` - Individual student card
   - `PortfolioModal.jsx` - Detailed profile modal
   - `PortfolioFilters.jsx` - Filter controls
   - `PublicLayout.jsx` - Layout with footer login buttons

3. **Routing**: Add public route in App.jsx (no ProtectedRoute wrapper)

### Design System
- Use gradient backgrounds
- Card-based layout with shadows
- Skill tags with color coding
- Smooth transitions
- Professional typography

## File Structure
```
backend/
  routes/
    public.js (NEW)
    
frontend/
  src/
    pages/
      public/
        Portfolios.jsx (NEW)
    components/
      public/
        PortfolioCard.jsx (NEW)
        PortfolioModal.jsx (NEW)
        PortfolioFilters.jsx (NEW)
    layouts/
      PublicLayout.jsx (NEW)
```

## Implementation Steps
1. Create backend public API route
2. Create PublicLayout component
3. Create PortfolioCard component
4. Create PortfolioFilters component
5. Create PortfolioModal component
6. Create main Portfolios page
7. Add route to App.jsx
8. Test and refine design
