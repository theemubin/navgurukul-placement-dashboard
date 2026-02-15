import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const PublicLayout = ({ children, hero, isPortfolioPage = false }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const showCompact = isScrolled;

    return (
        <div className="min-h-screen flex flex-col bg-white">
            {/* Optional Hero Section */}
            {hero && (
                <div className="w-full">
                    {hero}
                </div>
            )}

            {/* Header - Transparent/Glassmorphism */}
            <header className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${showCompact
                ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 py-1 md:py-1.5'
                : 'bg-transparent py-4 md:py-6'
                }`}>
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className={`flex justify-between items-center transition-all duration-500 ${showCompact ? 'h-12' : 'h-16'}`}>
                        {/* Logo (Left) */}
                        <Link to="/" className="flex items-center space-x-2 group">
                            <img
                                src="/ng-logo-horizontal.avif"
                                alt="Navgurukul"
                                className={`w-auto object-contain transition-all duration-500 ${showCompact
                                    ? 'h-6 md:h-8 brightness-100 invert-0'
                                    : 'h-8 md:h-12 brightness-0 invert'
                                    } group-hover:brightness-100 group-hover:invert-0`}
                            />
                        </Link>

                        {/* Right: Hamburger Menu */}
                        <div className="flex items-center">
                            <button
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className={`p-2 rounded-full transition-all ${isScrolled ? 'text-gray-900 hover:bg-gray-100' : 'text-white hover:bg-white/20'
                                    }`}
                            >
                                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Subtle Hamburger Overlay */}
                <div className={`fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[-1] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`} onClick={() => setIsMenuOpen(false)}></div>

                <div className={`absolute top-full right-4 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all duration-300 origin-top-right ${isMenuOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
                    }`}>
                    <nav className="p-4 flex flex-col space-y-2">
                        <a href="#home" onClick={() => setIsMenuOpen(false)} className="px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all font-semibold uppercase tracking-wider text-xs">
                            Home
                        </a>
                        <a href="#about" onClick={() => setIsMenuOpen(false)} className="px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all font-semibold uppercase tracking-wider text-xs">
                            About
                        </a>
                        <a href="#portfolios" onClick={() => setIsMenuOpen(false)} className="px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all font-semibold uppercase tracking-wider text-xs">
                            Portfolios
                        </a>
                        <a href="#contact" onClick={() => setIsMenuOpen(false)} className="px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all font-semibold uppercase tracking-wider text-xs">
                            Contact
                        </a>
                        <div className="h-px bg-gray-100 my-2"></div>
                        <Link to="/login" onClick={() => setIsMenuOpen(false)} className="px-4 py-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-bold uppercase tracking-wider text-xs flex items-center justify-between">
                            Staff Login
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-gray-900 text-white py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-12">
                        {/* About Section - Wrapped */}
                        <div className="max-w-2xl">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] mb-4">About Navgurukul</h3>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                Navgurukul is a non-profit organization working towards bridging the gap between underserved communities and the high-growth tech industry through innovative, residential higher education programs.
                            </p>
                        </div>

                        {/* Our Initiatives Section - One Row Logos */}
                        <div>
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em] mb-8">Our Initiatives</h3>
                            <div className="flex flex-wrap items-center gap-8 md:gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
                                <span className="text-sm font-black text-white uppercase tracking-widest whitespace-nowrap">Residential <br /> Programs</span>
                                <img src="https://app.zuvy.org/_next/image?url=%2Fzuvy-logo-horizontal.png&w=96&q=75" alt="Zuvy" className="h-6 w-auto object-contain brightness-0 invert" />
                                <span className="text-xl font-black text-white uppercase tracking-tighter italic">SOSC</span>
                                <img src="https://thesama.in/static/media/samalogo.051f0385236d4f6fdd05.png" alt="Sama" className="h-6 w-auto object-contain brightness-0 invert" />
                                <div className="flex flex-col items-start">
                                    <img src="https://static.wixstatic.com/media/1398bd_f5b26d7ad1f146bfbed723b18e00b69c~mv2.png/v1/fill/w_234,h_54,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/ng-logo-horizontal.png" alt="AI Learning Lab" className="h-6 w-auto object-contain brightness-0 invert" />
                                    <span className="text-[8px] font-black uppercase tracking-widest mt-1 text-white/50">AI Learning Lab</span>
                                </div>
                                <div className="flex flex-col items-start border-l border-white/10 pl-8">
                                    <img src="https://static.wixstatic.com/media/1398bd_f5b26d7ad1f146bfbed723b18e00b69c~mv2.png/v1/fill/w_234,h_54,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/ng-logo-horizontal.png" alt="Navigo" className="h-6 w-auto object-contain brightness-0 invert" />
                                    <span className="text-[8px] font-black uppercase tracking-widest mt-1 text-white/50">Navigo</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Copyright */}
                    <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400 text-sm">
                        <p>&copy; {new Date().getFullYear()} Navgurukul. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PublicLayout;
