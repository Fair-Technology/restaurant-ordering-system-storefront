import React from 'react';

interface HeroSectionProps {
  heroImageUrl: string;
}

const HeroSection: React.FC<HeroSectionProps> = ({ heroImageUrl }) => {
  return (
    <section
      data-testid="shop-hero"
      className="relative h-72 md:h-96 bg-center bg-cover"
      style={{ backgroundImage: `url('${heroImageUrl}')` }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-gray-50/60 to-transparent" />
    </section>
  );
};

export default HeroSection;
