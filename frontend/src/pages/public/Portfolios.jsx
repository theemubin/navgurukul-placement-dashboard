import { useState, useEffect, useMemo } from 'react';
import PublicLayout from '../../layouts/PublicLayout';
import PortfolioCard from '../../components/public/PortfolioCard';
import PortfolioModal from '../../components/public/PortfolioModal';
import HeroCarousel from '../../components/public/HeroCarousel';
import GetInTouchModal from '../../components/public/GetInTouchModal';

const Portfolios = () => {
    const [portfolios, setPortfolios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPortfolio, setSelectedPortfolio] = useState(null);
    const [selectedRoleContext, setSelectedRoleContext] = useState(null);
    const [placements, setPlacements] = useState([]);
    const [partners, setPartners] = useState([]);
    const [showGetInTouch, setShowGetInTouch] = useState(false);
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [showFilter, setShowFilter] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [testimonials, setTestimonials] = useState([]);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

    // Handle scroll for filter visibility
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            const portfoliosElement = document.getElementById('portfolios-grid');
            if (!portfoliosElement) return;

            const rect = portfoliosElement.getBoundingClientRect();

            // Show filter if:
            // 1. We are scrolling UP
            // 2. We are just entering the portfolios grid area
            // 3. We are near the top of the page
            if (currentScrollY < 400 || (rect.top < 300 && rect.top > -100) || currentScrollY < lastScrollY) {
                setShowFilter(true);
            } else {
                setShowFilter(false);
            }
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    // Auto-scroll logic for galleries
    useEffect(() => {
        if (loading) return;

        const interval = setInterval(() => {
            const containers = document.querySelectorAll('.gallery-container');
            containers.forEach(container => {
                if (container.dataset.paused !== 'true') {
                    const scrollAmount = 1;
                    const maxScroll = container.scrollWidth - container.clientWidth;
                    if (container.scrollLeft >= maxScroll - 1) {
                        container.scrollLeft = 0;
                    } else {
                        container.scrollLeft += scrollAmount;
                    }
                }
            });
        }, 30);

        return () => clearInterval(interval);
    }, [loading]);

    // Idle auto-scroll logic: If user doesn't scroll for 5 seconds, lift the page up
    useEffect(() => {
        let timeout;
        const handleInteraction = () => {
            clearTimeout(timeout);
            // Only set timer if we're at the very top
            if (window.scrollY < 100) {
                timeout = setTimeout(() => {
                    const nextSection = document.getElementById('portfolios');
                    if (nextSection && window.scrollY < 100) {
                        nextSection.scrollIntoView({ behavior: 'smooth' });
                    }
                }, 5000);
            }
        };

        window.addEventListener('scroll', handleInteraction, { passive: true });
        window.addEventListener('mousedown', handleInteraction, { passive: true });
        window.addEventListener('touchstart', handleInteraction, { passive: true });

        // Start the initial 5s countdown
        handleInteraction();

        return () => {
            window.removeEventListener('scroll', handleInteraction);
            window.removeEventListener('mousedown', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            clearTimeout(timeout);
        };
    }, []);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [placementsRes, partnersRes, portfoliosRes] = await Promise.all([
                    fetch(`${API_URL}/api/public/placements`).then(r => r.json()),
                    fetch(`${API_URL}/api/public/hiring-partners`).then(r => r.json()),
                    fetch(`${API_URL}/api/public/portfolios`).then(r => r.json())
                ]);

                if (placementsRes.success) setPlacements(placementsRes.placements);
                if (partnersRes.success) {
                    setPartners(partnersRes.partners || []);
                    // setTestimonials state if we had it, but actually we use partnersRes.testimonials
                }
                // Store testimonials in a state
                if (partnersRes.success) setTestimonials(partnersRes.testimonials || []);
                if (portfoliosRes.success) setPortfolios(portfoliosRes.portfolios);
            } catch (error) {
                console.error('Error fetching public data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Group portfolios by role
    const portfoliosByRole = useMemo(() => {
        const groups = {};
        portfolios.forEach(student => {
            const roles = student.openForRoles?.length > 0 ? student.openForRoles : ['General Developer'];
            roles.forEach(role => {
                if (!groups[role]) groups[role] = [];
                groups[role].push(student);
            });
        });
        return groups;
    }, [portfolios]);

    // Filter roles based on selection
    const displayedRoles = useMemo(() => {
        const allRoles = Object.entries(portfoliosByRole);
        if (selectedRoles.length === 0) return allRoles;
        return allRoles.filter(([role]) => selectedRoles.includes(role));
    }, [portfoliosByRole, selectedRoles]);

    const handleRoleToggle = (role) => {
        setSelectedRoles(prev =>
            prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role]
        );
    };

    const handleViewDetails = (portfolio, role) => {
        setSelectedPortfolio(portfolio);
        setSelectedRoleContext(role);
    };

    const handleCloseModal = () => {
        setSelectedPortfolio(null);
        setSelectedRoleContext(null);
    };

    return (
        <PublicLayout
            isPortfolioPage={true}
            hero={
                <section id="home" className="snap-start">
                    <HeroCarousel placements={placements} />
                </section>
            }
        >
            <div className="bg-gray-50 snap-y snap-mandatory scroll-pt-[80px]">
                {/* Portfolios Header Section */}
                <section id="portfolios" className="py-24 md:py-32 bg-gray-50 flex flex-col justify-center snap-start min-h-[85vh]">
                    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="mb-20 text-center">
                            <h2 className="text-5xl md:text-8xl font-black text-gray-900 mb-6 tracking-tighter uppercase leading-[0.85]">
                                Hire From Us
                            </h2>
                            <div className="h-3 w-40 bg-blue-600 mx-auto rounded-full mb-8"></div>
                            <p className="max-w-3xl mx-auto text-lg md:text-xl text-gray-600 leading-relaxed font-medium">
                                NavGurukul transforms <span className="text-gray-900 font-black">raw potential</span> into high-performing professionals. <br className="hidden md:block" />
                                You’re not just hiring talent, you’re <span className="relative inline-block"><span className="relative z-10">unlocking it.</span><span className="absolute bottom-1 left-0 w-full h-2 bg-gray-200 -z-10"></span></span>
                            </p>
                        </div>

                        {/* Partner Feedback: Now prominent below headline */}
                        <div className="max-w-6xl mx-auto px-4">
                            <div className="mb-12 flex flex-col items-center">
                                <div className="px-4 py-1 bg-gray-100 rounded-full mb-4">
                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em]">Industry Feedback</h3>
                                </div>
                                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest text-center">What our partners say about our graduates</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                                {(testimonials.length > 0 ? testimonials.slice(0, 3) : [
                                    { companyName: "Top Tech Firm", quote: "Navgurukul graduates bring a unique hunger to learn. They've become core members of our team.", authorName: "Growth Lead" },
                                    { companyName: "Global Solutions", quote: "Resilience and problem-solving mindset sets these students apart. Truly impressive curriculum.", authorName: "HR Director" },
                                    { companyName: "Innovate Labs", quote: "Quality of full-stack developers is comparable to top-tier universities. Solid foundation.", authorName: "CTO" }
                                ]).map((t, i) => (
                                    <div key={i} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col">
                                        <div className="text-gray-900 mb-6 font-serif text-4xl">"</div>
                                        <p className="text-gray-600 text-sm italic mb-8 leading-relaxed flex-1">
                                            {t.quote}
                                        </p>
                                        <div className="flex items-center gap-3 border-t border-gray-50 pt-6">
                                            {t.companyLogo ? (
                                                <img src={t.companyLogo} alt={t.companyName} className="w-10 h-10 object-contain" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-black text-gray-500 text-[10px]">
                                                    {t.companyName[0]}
                                                </div>
                                            )}
                                            <div>
                                                <div className="text-[10px] font-black text-gray-900 uppercase tracking-widest leading-none">{t.authorName || 'Partner'}</div>
                                                <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{t.companyName}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bg-white snap-start min-h-screen">
                    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
                        {loading ? (
                            <div className="flex justify-center items-center py-20">
                                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
                            </div>
                        ) : Object.keys(portfoliosByRole).length === 0 ? (
                            <div className="text-center py-20">
                                <h3 className="text-xl font-semibold text-gray-900">No students found</h3>
                            </div>
                        ) : (
                            <div className="relative">
                                {/* Filter Trigger Zone (Hidden top area) */}
                                <div
                                    className="fixed top-0 left-0 right-0 h-24 z-[55]"
                                    onMouseEnter={() => setShowFilter(true)}
                                ></div>

                                {/* Sticky Role Filter */}
                                <div className={`sticky top-[56px] md:top-[64px] z-[60] -mx-4 px-4 py-2 bg-gray-50/50 backdrop-blur-md border-b border-gray-100 mb-6 transition-all duration-500 transform ${showFilter ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
                                    }`}>
                                    <div className="max-w-[1400px] mx-auto">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">Filter Pools</p>
                                            {selectedRoles.length > 0 && (
                                                <button
                                                    onClick={() => setSelectedRoles([])}
                                                    className="text-[8px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
                                                >
                                                    Clear ({selectedRoles.length})
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex overflow-x-auto pb-1 gap-2 no-scrollbar scroll-smooth">
                                            {Object.keys(portfoliosByRole).map(role => {
                                                const isActive = selectedRoles.includes(role);
                                                return (
                                                    <button
                                                        key={role}
                                                        onClick={() => handleRoleToggle(role)}
                                                        className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[8px] md:text-[10px] font-black uppercase tracking-wider transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-sm border ${isActive
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-blue-100'
                                                            : 'bg-white text-gray-900 border-gray-100 hover:border-blue-600 hover:text-blue-600'
                                                            }`}
                                                    >
                                                        {role}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div id="portfolios-grid" className="space-y-32 mt-6">
                                    {displayedRoles.map(([role, roleStudents]) => (
                                        <div
                                            key={role}
                                            id={`role-${role.toLowerCase().replace(/\s+/g, '-')}`}
                                            className="flex flex-col md:flex-row gap-8 md:gap-16 relative"
                                        >
                                            {/* Left Side: Vertical Title Sidebar */}
                                            <div className="md:w-32 flex-shrink-0 flex md:block items-center gap-4 sticky md:top-0 h-auto md:h-screen">
                                                <div className="h-full flex md:items-center justify-center">
                                                    <h3 className="text-3xl md:text-[min(5vh,3rem)] lg:text-[min(6vh,4rem)] font-black text-gray-200 md:rotate-180 md:[writing-mode:vertical-lr] uppercase tracking-[0.1em] whitespace-nowrap leading-none select-none transition-all duration-500 hover:text-blue-600/10 cursor-default">
                                                        {role}
                                                    </h3>
                                                </div>
                                                <div className="md:hidden h-px flex-1 bg-gray-200"></div>
                                                <span className="md:hidden text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                                                    {roleStudents.length} Talent{roleStudents.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>

                                            {/* Right Side: Responsive Grid - smaller cards */}
                                            <div className="flex-1 min-w-0 group relative py-12">
                                                <div className="hidden md:flex items-center justify-between mb-10">
                                                    <div className="h-[1px] flex-1 bg-gray-100"></div>
                                                    <span className="px-6 py-2 bg-white border border-gray-100 rounded-full text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] shadow-sm">
                                                        {role} Pool ({roleStudents.length})
                                                    </span>
                                                    <div className="h-[1px] flex-1 bg-gray-100"></div>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                                                    {roleStudents.map((portfolio, idx) => (
                                                        <div key={`${role}-${portfolio._id || idx}`} className="w-full">
                                                            <PortfolioCard
                                                                portfolio={portfolio}
                                                                onViewDetails={(p) => handleViewDetails(p, role)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Testimonials removed from here - now at the top section */}

                                    {displayedRoles.length === 0 && !loading && (
                                        <div className="text-center py-40 bg-white rounded-[3rem] border-2 border-dashed border-gray-100">
                                            <div className="text-6xl mb-6">🔍</div>
                                            <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">No talents match your selection</h3>
                                            <p className="text-gray-500 mt-2">Try selecting different roles or clear the filter.</p>
                                            <button
                                                onClick={() => setSelectedRoles([])}
                                                className="mt-8 px-8 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all font-bold"
                                            >
                                                Reset Filters
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Partners & About Section - Full Screen Impact */}
                <section id="about" className="min-h-screen bg-white flex flex-col snap-start">
                    {/* Partners Scroller */}
                    <div className="py-12 bg-gray-50/50 border-y border-gray-100 overflow-hidden">
                        <div className="max-w-[1400px] mx-auto px-4 mb-8">
                            <h3 className="text-center text-xs font-black text-gray-400 uppercase tracking-[0.4em]">Our Hiring Partners</h3>
                        </div>

                        <div className="flex flex-col gap-8">
                            {/* Row 1: Left to Right */}
                            <div className="flex whitespace-nowrap">
                                <div className="flex gap-16 items-center animate-scroll-left">
                                    {partners.map((partner, i) => (
                                        partner.logo && <img key={`p1-${i}`} src={partner.logo} alt={partner.name} className="h-8 md:h-12 w-auto grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500 object-contain" />
                                    ))}
                                    {partners.map((partner, i) => (
                                        partner.logo && <img key={`p1-dup-${i}`} src={partner.logo} alt={partner.name} className="h-8 md:h-12 w-auto grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500 object-contain" />
                                    ))}
                                </div>
                            </div>
                            {/* Row 2: Right to Left */}
                            <div className="flex whitespace-nowrap">
                                <div className="flex gap-16 items-center animate-scroll-right">
                                    {[...partners].reverse().map((partner, i) => (
                                        partner.logo && <img key={`p2-${i}`} src={partner.logo} alt={partner.name} className="h-8 md:h-12 w-auto grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500 object-contain" />
                                    ))}
                                    {[...partners].reverse().map((partner, i) => (
                                        partner.logo && <img key={`p2-dup-${i}`} src={partner.logo} alt={partner.name} className="h-8 md:h-12 w-auto grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500 object-contain" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* About Content & CTA */}
                    <div className="flex-1 flex items-center py-24">
                        <div className="max-w-7xl mx-auto px-4 w-full">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                                <div>
                                    <h2 className="text-5xl md:text-7xl font-black text-gray-900 mb-8 leading-[0.9] uppercase tracking-tighter">
                                        Bridging the gap in <br />
                                        <span className="text-blue-600">Higher Education.</span>
                                    </h2>
                                    <p className="text-xl text-gray-600 leading-relaxed mb-12 max-w-xl">
                                        Navgurukul is committed to empowering students from underserved backgrounds with world-class technical skills and career-ready mindset. Our graduates are trained with modern learning methods and real-world problem solving.
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                                        <div className="space-y-1">
                                            <div className="text-4xl md:text-5xl font-black text-gray-900">840+</div>
                                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Placements</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-4xl md:text-5xl font-black text-gray-900">600+</div>
                                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Hiring Partners</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-4xl md:text-5xl font-black text-gray-900">160+</div>
                                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Cities</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative group">
                                    <div className="absolute -inset-4 bg-gray-900/10 rounded-[2rem] opacity-10 group-hover:opacity-20 transition-all blur-2xl"></div>
                                    <div className="relative bg-gray-950 rounded-[2rem] p-12 md:p-16 overflow-hidden shadow-2xl">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                                        <div className="relative z-10 text-center md:text-left">
                                            <h3 className="text-3xl md:text-4xl font-black text-white mb-4 uppercase tracking-tighter">Ready to Hire?</h3>
                                            <p className="text-gray-400 text-lg mb-10 max-w-sm">Connect with our placement team today and find your next star partner.</p>
                                            <button
                                                onClick={() => setShowGetInTouch(true)}
                                                className="inline-flex px-10 py-5 bg-white text-gray-900 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-gray-200 transition-all shadow-xl shadow-black/20"
                                            >
                                                Get in Touch
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* Modals */}
            {selectedPortfolio && (
                <PortfolioModal
                    portfolio={selectedPortfolio}
                    selectedRole={selectedRoleContext}
                    onClose={handleCloseModal}
                />
            )}

            {showGetInTouch && (
                <GetInTouchModal onClose={() => setShowGetInTouch(false)} />
            )}
        </PublicLayout>
    );
};

export default Portfolios;
