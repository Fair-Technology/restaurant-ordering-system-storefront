import React, { useState } from 'react';

interface HeroSectionProps {
  heroImageUrl: string;
}

// The whole banner is always shown (object-contain). A blurred, enlarged copy of
// it fills the full-width band behind. Once the picture has loaded, the sharp
// frame takes its shape (aspect-ratio): on phones clamped to 160-288px, from md up
// as wide as the shop content below (max-w-7xl, px-6) with only a 70vh cap for
// tall pictures. Until then (or on error) the frame keeps the fixed heights.
const HeroSection: React.FC<HeroSectionProps> = ({ heroImageUrl }) => {
  const [ratio, setRatio] = useState<number | null>(null);
  const sizing =
    ratio === null
      ? 'h-72 md:h-96'
      : 'w-full min-h-40 max-h-72 md:min-h-0 md:max-h-[70vh]';
  return (
    <section data-testid="shop-hero" className="relative overflow-hidden">
      <div
        data-testid="shop-hero-backdrop"
        aria-hidden="true"
        className="absolute inset-0 bg-center bg-cover blur-2xl scale-110"
        style={{ backgroundImage: `url('${heroImageUrl}')` }}
      />
      <div className="absolute inset-0 bg-black/10" />
      <div className="relative md:max-w-7xl md:mx-auto md:px-6">
        <div
          data-testid="shop-hero-frame"
          className={sizing}
          style={ratio === null ? undefined : { aspectRatio: String(ratio) }}
        >
          <img
            data-testid="shop-hero-image"
            src={heroImageUrl}
            alt=""
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              setRatio(
                naturalWidth > 0 && naturalHeight > 0
                  ? naturalWidth / naturalHeight
                  : null,
              );
            }}
            onError={() => setRatio(null)}
            className="w-full h-full object-contain"
          />
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
    </section>
  );
};

export default HeroSection;
