import React, { useState } from 'react';

interface HeroSectionProps {
  heroImageUrl: string;
}

// The whole banner is always shown (object-contain). Once the picture has loaded, the sharp
// frame takes its exact shape (aspect-ratio): the full window width up to 1232px (the shop
// content below: max-w-7xl minus px-6), then centred, so there is never blur above or below it;
// only a tall picture hitting the 70vh cap is narrower than its frame. A blurred, enlarged copy
// fills the full-width band behind, so blur shows left and right only. Until the picture has
// loaded (or on error) the frame keeps the fixed heights.
const HeroSection: React.FC<HeroSectionProps> = ({ heroImageUrl }) => {
  const [ratio, setRatio] = useState<number | null>(null);
  const sizing =
    ratio === null ? 'h-72 md:h-96' : 'max-h-[70vh]';
  return (
    <section data-testid="shop-hero" className="relative overflow-hidden">
      <div
        data-testid="shop-hero-backdrop"
        aria-hidden="true"
        className="absolute inset-0 bg-center bg-cover blur-2xl scale-110"
        style={{ backgroundImage: `url('${heroImageUrl}')` }}
      />
      <div className="absolute inset-0 bg-black/10" />
      <div
        data-testid="shop-hero-frame"
        className={`relative w-full max-w-[1232px] mx-auto ${sizing}`}
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
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
    </section>
  );
};

export default HeroSection;
