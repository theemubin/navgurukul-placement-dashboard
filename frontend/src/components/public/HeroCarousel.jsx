import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const HeroCarousel = ({ placements = [] }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);

    // Auto-advance carousel every 5 seconds
    useEffect(() => {
        if (!isAutoPlaying || placements.length === 0) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % placements.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [isAutoPlaying, placements.length]);

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + placements.length) % placements.length);
        setIsAutoPlaying(false);
    };

    const goToNext = () => {
        setCurrentIndex((prev) => (prev + 1) % placements.length);
        setIsAutoPlaying(false);
    };

    const goToSlide = (index) => {
        setCurrentIndex(index);
        setIsAutoPlaying(false);
    };

    if (!placements || placements.length === 0) {
        return (
            <div className="relative h-screen w-full bg-gray-950 flex items-center justify-center">
                <div className="text-center text-white px-4">
                    <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tighter uppercase">
                        Empowering Dreams <br /> Through Education
                    </h1>
                    <p className="text-xl md:text-2xl opacity-90">
                        Discover talented graduates ready to make an impact
                    </p>
                </div>
            </div>
        );
    }

    const currentPlacement = placements[currentIndex];

    // Neutral fallback avatars
    const defaultAvatarImage = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentPlacement.studentName) + '&background=E5E7EB&color=000&size=128';

    return (
        <div className="relative h-screen w-full overflow-hidden bg-gray-900">
            {placements.map((placement, index) => (
                <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                >
                    {/* Background Image with Overlay */}
                    <div className="absolute inset-0">
                        {placement.studentImage ? (
                            <img
                                src={placement.studentImage}
                                alt={placement.studentName}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-900/60 via-purple-900/60 to-pink-900/60" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="relative h-full flex items-center">
                        <div className="container mx-auto px-6 md:px-12 lg:px-20">
                            <div className={`max-w-4xl transition-all duration-700 delay-300 ${index === currentIndex ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                                }`}>
                                {/* Company Logo */}
                                {placement.companyLogo && (
                                    <div className="mb-8 bg-white/10 backdrop-blur-sm rounded-2xl p-4 inline-block">
                                        <img
                                            src={placement.companyLogo}
                                            alt={placement.companyName}
                                            className="h-12 md:h-16 w-auto object-contain"
                                            onError={(e) => e.target.style.display = 'none'}
                                        />
                                    </div>
                                )}

                                {/* Quote */}
                                <div className="mb-8">
                                    <div className="text-blue-400 mb-4 scale-75 origin-left">
                                        <svg
                                            className="w-12 h-12"
                                            fill="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21H14.017ZM14.017 14V11C14.017 9.89543 14.9124 9 16.017 9H19.017C20.1216 9 21.017 9.89543 21.017 11V14H14.017ZM4.01705 21L4.01705 18C4.01705 16.8954 4.91248 16 6.01705 16H9.01705C10.1216 16 11.017 16.8954 11.017 18V21H4.01705ZM4.01705 14V11C4.01705 9.89543 4.91248 9 6.01705 9H9.01705C10.1216 9 11.017 9.89543 11.017 11V14H4.01705Z" />
                                        </svg>
                                    </div>
                                    <blockquote className="text-3xl md:text-5xl font-bold text-white leading-tight mb-8 drop-shadow-lg">
                                        "{placement.quote || 'Navgurukul gave me the skills and confidence to pursue my dreams in tech.'}"
                                    </blockquote>
                                </div>

                                {/* Student Info */}
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
                                        <img
                                            src={placement.studentAvatar || defaultAvatarImage}
                                            alt={placement.studentName}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = defaultAvatarImage;
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-bold text-white mb-0.5">
                                            {placement.studentName}
                                        </h3>
                                        <p className="text-blue-300 text-base md:text-lg font-medium opacity-90">
                                            {placement.role} at {placement.companyName}
                                        </p>
                                    </div>
                                </div>

                                {/* Placement Details */}
                                <div className="flex flex-wrap gap-4 text-white/90">
                                    {placement.package && (
                                        <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
                                            <span className="text-sm opacity-80">Package:</span>
                                            <span className="ml-2 font-semibold text-sm">₹{placement.package} LPA</span>
                                        </div>
                                    )}
                                    {placement.campus && (
                                        <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
                                            <span className="text-sm opacity-80">Campus:</span>
                                            <span className="ml-2 font-semibold text-sm">{placement.campus}</span>
                                        </div>
                                    )}
                                    {placement.batch && (
                                        <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
                                            <span className="text-sm opacity-80">Batch:</span>
                                            <span className="ml-2 font-semibold text-sm">{placement.batch}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}


            {/* Dots Indicator */}
            {placements.length > 1 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
                    {placements.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`transition-all duration-300 rounded-full ${index === currentIndex
                                ? 'w-12 h-3 bg-white'
                                : 'w-3 h-3 bg-white/50 hover:bg-white/70'
                                }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}

        </div>
    );
};

export default HeroCarousel;
