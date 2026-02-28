import React, { useState } from 'react';
import { ArrowLeft, BarChart3, Lightbulb, Shield, AlertTriangle, CheckCircle2, TrendingUp, HelpCircle, Layout, Settings, BookOpen, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { MiniCircularProgress } from '../../components/CircularProgress';

const ScamEducation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedExample, setExpandedExample] = useState(null);

  const metrics = [
    {
      name: 'Company Legitimacy',
      description: 'How real and credible the company appears',
      icon: Shield,
      color: 'blue',
      calculation: 'trustScore + (greenFlags × 2) - (redFlags × 3)',
      factors: [
        'Domain registration age (10+ years = good)',
        'LinkedIn company profile verification',
        'Official careers page presence',
        'Job portal listings (Naukri, LinkedIn)',
        'Consistency across sources'
      ],
      examples: {
        positive: ['Google with 20+ year domain', 'Hiring manager verified on LinkedIn', 'Official careers page'],
        negative: ['Brand new domain this month', 'Gmail address for corporate hiring', 'No company info available']
      }
    },
    {
      name: 'Offer Realism',
      description: 'Whether salary and benefits seem realistic',
      icon: TrendingUp,
      color: 'green',
      calculation: 'trustScore + (greenFlags × 3) - (redFlags × 4)',
      factors: [
        'Salary benchmarking (vs. market rate)',
        'Benefits package reasonableness',
        'Standard employment terms',
        'Clear role description',
        'No unusual payment structures'
      ],
      examples: {
        positive: ['Senior dev at ₹25-35 LPA in India', 'Structured 4-year equity vesting', 'Standard health insurance + bonus'],
        negative: ['Graduate role at ₹50 LPA', 'Requires upfront equipment payment', '₹10 LPA for Senior role']
      }
    },
    {
      name: 'Process Flags',
      description: 'Quality of the recruitment process',
      icon: BarChart3,
      color: 'amber',
      calculation: 'trustScore + (greenFlags × 1) - (redFlags × 5)',
      factors: [
        'Multiple interview rounds',
        'Clear communication timeline',
        'No pressure for immediate decisions',
        'Structured offer process',
        'Professional background checks'
      ],
      examples: {
        positive: ['3-round interview over 2+ weeks', 'Formal offer letter with clear terms', 'Background check by recognized agency'],
        negative: ['"You\'re hired!" with no interviews', 'Pressure to join within 1 hour', 'Vague promises of "good salary"']
      }
    },
    {
      name: 'Community Sentiment',
      description: 'What others report about the company',
      icon: Lightbulb,
      color: 'purple',
      calculation: 'trustScore + (greenFlags × 2) - (redFlags × 2)',
      factors: [
        'AmbitionBox ratings (4+ stars = good)',
        'No complaints in Cyber Crime Database',
        'Student/peer reports',
        'Social media presence',
        'Known scam pattern matches'
      ],
      examples: {
        positive: ['4+ stars on AmbitionBox with 500+ reviews', 'No scam reports', 'Active company social media'],
        negative: ['Multiple non-payment complaints', 'Pattern matches advance-fee scam', 'Negative reviews on job portals']
      }
    }
  ];

  const examples = [
    {
      title: 'Clear Scam: Poor Domain Typo',
      verdict: 'DANGER',
      offers: 'goooogle.com | ₹1 Lac/month | No interview | Urgent decision',
      calculation: {
        redFlags: 4,
        greenFlags: 0,
        trustScore: 35,
        formula: '35 + (0×2) - (4×3) = 23 → clamped to 5'
      },
      metrics: {
        companyLegitimacy: 5,
        offerRealism: 15,
        processFlags: 10,
        communitySentiment: 20
      },
      explanation: 'Domain typo, unrealistic salary, no interview, urgency pressure - multiple critical red flags'
    },
    {
      title: 'Legitimate Offer: Established Company',
      verdict: 'SAFE',
      offers: 'google.com | ₹80 LPA | 3-round interviews over 3 weeks',
      calculation: {
        redFlags: 0,
        greenFlags: 5,
        trustScore: 85,
        formula: '85 + (5×2) - (0×3) = 95 → clamped to 95'
      },
      metrics: {
        companyLegitimacy: 95,
        offerRealism: 90,
        processFlags: 92,
        communitySentiment: 95
      },
      explanation: 'Established company, realistic salary for level, structured process, excellent reputation'
    },
    {
      title: 'Mixed Signals: Startup Offer',
      verdict: 'WARNING',
      offers: 'startup.com | ₹18 LPA | 2 rounds | Equity offered',
      calculation: {
        redFlags: 2,
        greenFlags: 2,
        trustScore: 62,
        formula: '62 + (2×2) - (2×3) = 60 → result 60'
      },
      metrics: {
        companyLegitimacy: 65,
        offerRealism: 58,
        processFlags: 68,
        communitySentiment: 62
      },
      explanation: 'Legitimate startup but less established. Needs independent verification of equity terms and runway.'
    }
  ];

  const getDashboardPath = () => {
    const role = user?.role;
    const dashboardMap = {
      student: '/student',
      campus_poc: '/campus-poc',
      coordinator: '/coordinator',
      manager: '/manager'
    };
    return dashboardMap[role] || '/student';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-8">
        <div className="max-w-6xl mx-auto px-4">
          <button
            onClick={() => navigate(getDashboardPath())}
            className="flex items-center gap-2 mb-4 hover:opacity-80 transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold mb-2">Scam Detector (Beta): Educational Guide</h1>
          <p className="text-blue-100 text-lg">Understand how ScamRadar analyzes job offers to keep you safe.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {[
            { id: 'overview', label: 'Overview', icon: Layout },
            { id: 'metrics', label: 'Four Metrics', icon: Settings },
            { id: 'examples', label: 'Real Examples', icon: BookOpen },
            { id: 'faq', label: 'FAQ', icon: MessageCircle }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {
          activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl border border-gray-200 p-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">How ScamRadar Works</h2>
                <p className="text-gray-700 text-lg mb-6">
                  ScamRadar analyzes job offers across <strong>four key dimensions</strong> to detect scam patterns. Each dimension generates a score from 0-100, where higher is safer.
                </p>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                    <div className="flex items-start gap-3 mb-3">
                      <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-bold text-gray-900">Three Score Ranges</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700 mt-1">
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> 72-100: Safe</span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> 40-71: Warning</span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> 0-39: Danger</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border border-amber-200">
                    <div className="flex items-start gap-3 mb-3">
                      <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                      <div>
                        <h3 className="font-bold text-gray-900">Always Verify</h3>
                        <p className="text-sm text-gray-700 mt-1">
                          Even "Safe" offers should be independently verified before accepting.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-4">The Calculation Process</h3>
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 font-mono text-sm mb-6">
                  <div className="space-y-2">
                    <p className="text-gray-600">Base Score = AI analysis of trustworthiness (0-100)</p>
                    <p className="text-gray-600">Green Flags = Positive legitimacy indicators</p>
                    <p className="text-gray-600">Red Flags = Scam warning signs</p>
                    <p className="text-green-700 font-bold mt-4">
                      Each Score = Base + (Greens × Multiplier) - (Reds × Multiplier)
                    </p>
                    <p className="text-gray-600">Result = Clamped between 5-95</p>
                  </div>
                </div>

                <p className="text-gray-600 italic">
                  <strong>Why 5-95 instead of 0-100?</strong> To avoid false confidence. Even very suspicious offers might have some legitimate aspect, and even legitimate offers could have unknowns.
                </p>
              </div>
            </div>
          )
        }

        {/* TAB 2: METRICS */}
        {
          activeTab === 'metrics' && (
            <div className="space-y-8">
              {metrics.map((metric, idx) => {
                const Icon = metric.icon;
                return (
                  <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition">
                    <div className={`bg-gradient-to-r from-${metric.color}-500 to-${metric.color}-600 text-white p-6`}>
                      <div className="flex items-start gap-4">
                        <Icon className="w-8 h-8 flex-shrink-0" />
                        <div>
                          <h3 className="text-2xl font-bold">{metric.name}</h3>
                          <p className="text-sm opacity-90 mt-1">{metric.description}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Calculation */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4" />
                          Calculation Formula
                        </h4>
                        <div className="bg-gray-50 rounded p-3 font-mono text-sm border-l-4 border-gray-400">
                          {metric.calculation}
                        </div>
                      </div>

                      {/* Factors */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4" />
                          Key Factors Checked
                        </h4>
                        <ul className="grid md:grid-cols-2 gap-2">
                          {metric.factors.map((factor, i) => (
                            <li key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5" />
                              <span className="text-gray-700 text-sm">{factor}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Examples */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                          <h5 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Positive Examples
                          </h5>
                          <ul className="space-y-2">
                            {metric.examples.positive.map((example, i) => (
                              <li key={i} className="text-sm text-green-800">• {example}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                          <h5 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Red Flag Examples
                          </h5>
                          <ul className="space-y-2">
                            {metric.examples.negative.map((example, i) => (
                              <li key={i} className="text-sm text-red-800">• {example}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }

        {/* TAB 3: EXAMPLES */}
        {
          activeTab === 'examples' && (
            <div className="space-y-6">
              {examples.map((example, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className={`p-6 ${example.verdict === 'DANGER' ? 'bg-red-50 border-b border-red-200' :
                    example.verdict === 'SAFE' ? 'bg-green-50 border-b border-green-200' :
                      'bg-amber-50 border-b border-amber-200'
                    }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{example.title}</h3>
                        <p className="text-gray-600 mb-3"><strong>Offer Details:</strong> {example.offers}</p>
                      </div>
                      <div className={`px-4 py-2 rounded-lg font-bold text-white ${example.verdict === 'DANGER' ? 'bg-red-600' :
                        example.verdict === 'SAFE' ? 'bg-green-600' :
                          'bg-amber-600'
                        }`}>
                        {example.verdict}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Calculation Breakdown */}
                    <div>
                      <h4 className="font-bold text-gray-900 mb-3">Calculation Breakdown</h4>
                      <div className="grid md:grid-cols-4 gap-3 mb-3">
                        <div className="bg-blue-50 rounded p-3 text-center">
                          <p className="text-2xl font-bold text-blue-700">{example.calculation.trustScore}</p>
                          <p className="text-xs text-gray-600">Base Trust Score</p>
                        </div>
                        <div className="bg-green-50 rounded p-3 text-center">
                          <p className="text-2xl font-bold text-green-700">+{example.calculation.greenFlags}</p>
                          <p className="text-xs text-gray-600">Green Flags</p>
                        </div>
                        <div className="bg-red-50 rounded p-3 text-center">
                          <p className="text-2xl font-bold text-red-700">-{example.calculation.redFlags}</p>
                          <p className="text-xs text-gray-600">Red Flags</p>
                        </div>
                        <div className={`rounded p-3 text-center font-bold ${example.verdict === 'DANGER' ? 'bg-red-100' :
                          example.verdict === 'SAFE' ? 'bg-green-100' :
                            'bg-amber-100'
                          }`}>
                          <p className="text-sm">{example.calculation.formula}</p>
                        </div>
                      </div>
                    </div>

                    {/* Score Breakdown */}
                    <div>
                      <h4 className="font-bold text-gray-900 mb-4">Individual Metric Scores</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <MiniCircularProgress
                            value={example.metrics.companyLegitimacy}
                            label="Company"
                            size={50}
                          />
                        </div>
                        <div className="text-center">
                          <MiniCircularProgress
                            value={example.metrics.offerRealism}
                            label="Offer"
                            size={50}
                          />
                        </div>
                        <div className="text-center">
                          <MiniCircularProgress
                            value={example.metrics.processFlags}
                            label="Process"
                            size={50}
                          />
                        </div>
                        <div className="text-center">
                          <MiniCircularProgress
                            value={example.metrics.communitySentiment}
                            label="Sentiment"
                            size={50}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4" />
                        Analysis Explanation
                      </h4>
                      <p className="text-blue-800">{example.explanation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        }

        {/* TAB 4: FAQ */}
        {
          activeTab === 'faq' && (
            <div className="space-y-4">
              {[
                {
                  q: 'Why does my legitimate job offer show a "Warning"?',
                  a: 'Legitimate startups or smaller companies might score lower if they have less online presence or unusual equity structures. The "Warning" doesn\'t mean it\'s a scam—it means you should independently verify details with the company HR directly.'
                },
                {
                  q: 'What if my score is 100%?',
                  a: 'Scores max out at 95% by design. Even perfect-looking offers from major companies should be verified independently. You never know what you don\'t know, so always confirm salary, role, and reporting structure before accepting.'
                },
                {
                  q: 'How often is the AI updated?',
                  a: 'The AI model is updated monthly with new scam patterns learned from community reports. Your feedback helps protect future students.'
                },
                {
                  q: 'What if I disagree with the verdict?',
                  a: 'You can report inaccuracies or add additional context via the "Report Issue" button. This helps us improve the detection algorithm.'
                },
                {
                  q: 'Can scammers trick the system?',
                  a: 'Advanced scammers can mimic legitimate companies, but they usually slip up on process flags or salary realism. The system is designed to catch 95%+ of common scam patterns. Always verify independently.'
                },
                {
                  q: 'Why not just give me a yes/no answer?',
                  a: 'Reality is nuanced. A startup might be legitimate but risky. A big company might have unfair terms. The four-metric breakdown helps you understand specifically which areas need verification.'
                },
                {
                  q: 'What should I do if I get a "DANGER" verdict?',
                  a: '1) Do not share any money or documents\n2) Do not click links in emails (go directly to company website)\n3) Verify via official company channels\n4) Report to helpline 1930 if you suspect fraud'
                },
                {
                  q: 'Is "Community Sentiment" based on real reviews?',
                  a: 'It combines public data from AmbitionBox, Naukri, LinkedIn, and community reports. While helpful, always verify current information as companies change over time.'
                }
              ].map((item, idx) => (
                <div key={idx} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedExample(expandedExample === idx ? null : idx)}
                    className="w-full p-4 flex items-start justify-between hover:bg-gray-50 transition text-left"
                  >
                    <h4 className="font-bold text-gray-900 flex-1">{item.q}</h4>
                    <span className="text-2xl ml-4 text-gray-400">{expandedExample === idx ? '−' : '+'}</span>
                  </button>
                  {expandedExample === idx && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-200 bg-gray-50">
                      <p className="text-gray-700 whitespace-pre-line">{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </div >

      {/* Footer CTA */}
      < div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-12 mt-12" >
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Protect Yourself?</h2>
          <p className="text-lg opacity-90 mb-6">
            Use ScamRadar to analyze your job offers and stay safe from common scam patterns.
          </p>
          <button
            onClick={() => navigate('/student/scam-detector')}
            className="bg-white text-blue-600 px-8 py-3 rounded-lg font-bold hover:bg-gray-100 transition"
          >
            Try ScamRadar Now
          </button>
        </div>
      </div >
    </div >
  );
};

export default ScamEducation;
