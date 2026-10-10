import React, { useState } from 'react';

interface HeroSectionProps {
  heroImageUrl: string;
}

// The whole banner is always shown (object-contain), centred over a blurred,
// enlarged copy of itself, so no screen shape crops it. Once the picture has
// loaded the box takes its shape (aspect-ratio), clamped by min/max heights, so
// only very wide or tall pictures get blurred bands. Until then (or on error)
// the box keeps the fixed heights.
const HeroSection: React.FC<HeroSectionProps> = ({ heroImageUrl }) => {
  const [ratio, setRatio] = useState<number | null>(null);
  const sizing =
    ratio === null
      ? 'h-72 md:h-96'
      : 'w-full min-h-40 max-h-72 md:min-h-[220px] md:max-h-96';
  return (
    <section
      data-testid="shop-hero"
      className={`relative overflow-hidden ${sizing}`}
      style={ratio === null ? undefined : { aspectRatio: String(ratio) }}
    >
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
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget;
          setRatio(naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : null);
        }}
        onError={() => setRatio(null)}
        className="relative w-full h-full object-contain"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
    </section>
  );
};

export default HeroSection;
