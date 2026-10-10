import React from 'react';

interface HeroSectionProps {
  heroImageUrl: string;
}

// The whole banner is always shown (object-contain), centred over a blurred,
// enlarged copy of itself, so no screen shape crops it.
const HeroSection: React.FC<HeroSectionProps> = ({ heroImageUrl }) => {
  return (
    <section data-testid="shop-hero" className="relative h-72 md:h-96 overflow-hidden">
      <div
        data-testid="shop-hero-backdrop"
        aria-hidden="true"
        className="absolute inset-0 bg-center bg-cover blur-2xl scale-110"
        style={{ backgroundImage: `url('${heroImageUrl}')` }}
      />
      <div className="absolute inset-0 bg-black/10" />
      <img
        data-testid="shop-hero-image"
        src={heroImageUrl}
        alt=""
        className="relative w-full h-full object-contain"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-50/60 to-transparent" />
    </section>
  );
};

export default HeroSection;
