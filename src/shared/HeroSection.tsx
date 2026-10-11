import React from 'react';
import { COVER_IMAGE } from '../constants/image-shapes';

interface HeroSectionProps {
  heroImageUrl: string;
}

// The banner has one fixed shape: 2:1 on phones (full width), 3:1 from sm up (as wide as the
// menu below, max-w-7xl). The picture fills it with object-fit: cover, centred, so new covers
// (already 3:1) fit exactly and old, differently shaped covers are cropped neatly. Phones show
// the centre 2:1 part of a 3:1 cover. The ratios come from constants/image-shapes.ts.
const HeroSection: React.FC<HeroSectionProps> = ({ heroImageUrl }) => (
  <section data-testid="shop-hero" className="relative overflow-hidden">
    <div
      data-testid="shop-hero-frame"
      className="relative mx-auto aspect-[var(--hero-phone-ratio)] w-full max-w-7xl overflow-hidden bg-[#f6f1eb] sm:aspect-[var(--hero-ratio)]"
      style={
        {
          '--hero-phone-ratio': COVER_IMAGE.phoneRatio,
          '--hero-ratio': COVER_IMAGE.ratio,
        } as React.CSSProperties
      }
    >
      <img
        data-testid="shop-hero-image"
        src={heroImageUrl}
        alt=""
        className="h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent" />
    </div>
  </section>
);

export default HeroSection;
