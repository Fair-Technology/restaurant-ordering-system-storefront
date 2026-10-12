import React from 'react';

/*
 * Loading placeholders with the same shapes as the finished pages (top bar, cover, logo badge,
 * name, pills, category bar, dish cards / the checkout columns), so nothing jumps when the
 * content arrives. The shop's logo isn't known yet at this point, so the logo loader can't be used.
 */

const Block: React.FC<{ className: string }> = ({ className }) => <div className={`skeleton ${className}`} />;

export const SkeletonNavBar: React.FC = () => (
  <header className="border-b border-[#f1ebe4] bg-white">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
      <Block className="h-9 w-24 rounded-[10px] sm:w-[120px]" />
      <div className="flex items-center gap-2.5">
        <Block className="hidden h-10 w-[92px] rounded-full sm:block" />
        <Block className="h-11 w-[72px] rounded-full sm:w-[140px]" />
      </div>
    </div>
  </header>
);

/** Cover (2:1 on phones, 3:1 from sm), logo badge, name and pills — as in HeroSection + ShopIntro. */
const SkeletonShopHead: React.FC = () => (
  <>
    <div className="mx-auto max-w-7xl">
      <Block className="aspect-[2/1] w-full sm:aspect-[3/1]" />
    </div>
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        <div className="-mt-[56px] h-[88px] w-[88px] shrink-0 rounded-full bg-white p-1 shadow-[0_4px_16px_rgba(31,26,23,0.10)] md:-mt-[42px] md:h-28 md:w-28">
          <Block className="h-full w-full rounded-full" />
        </div>
        <div className="order-3 flex w-full flex-col gap-2 md:order-none md:w-auto md:flex-1 md:pt-4">
          <Block className="h-7 w-52 rounded-lg md:h-8 md:w-60" />
          <Block className="h-3.5 w-40 rounded-md md:w-52" />
        </div>
        <div className="order-4 flex w-full gap-2 md:pl-[132px] lg:order-none lg:w-auto lg:pl-0 lg:pt-6">
          <Block className="h-7 w-28 rounded-full" />
          <Block className="h-7 w-16 rounded-full" />
        </div>
      </div>
    </div>
  </>
);

export const SkeletonCategoryBar: React.FC = () => (
  <div className="mt-5 border-y border-[#f1ebe4] bg-white">
    <div className="mx-auto flex max-w-7xl gap-2 overflow-hidden px-4 py-3 sm:px-6">
      {['w-[90px]', 'w-[110px]', 'w-20', 'w-24'].map((w, i) => (
        <Block key={i} className={`h-10 shrink-0 rounded-full ${w}`} />
      ))}
    </div>
  </div>
);

/** A dish: a row with the photo on the right on phones, a card from sm (like ProductCard). */
export const SkeletonProductCard: React.FC = () => (
  <div className="flex flex-row-reverse gap-3.5 border-b border-[#f1ebe4] py-4 sm:flex-col sm:gap-0 sm:overflow-hidden sm:rounded-[18px] sm:border sm:border-[#efe7de] sm:py-0">
    <Block className="h-[108px] w-[108px] shrink-0 rounded-[14px] sm:aspect-[4/3] sm:h-auto sm:w-full sm:rounded-none" />
    <div className="flex flex-1 flex-col gap-2 sm:p-4">
      <Block className="h-4 w-3/5 rounded-md" />
      <Block className="h-3 w-11/12 rounded-md" />
      <Block className="h-3 w-2/3 rounded-md sm:hidden" />
      <Block className="h-4 w-1/4 rounded-md" />
    </div>
  </div>
);

export const ShopPageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-white" aria-busy="true">
    <SkeletonNavBar />
    <SkeletonShopHead />
    <SkeletonCategoryBar />
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8">
      <Block className="mb-4 h-7 w-32 rounded-lg sm:mb-5" />
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonProductCard key={i} />
        ))}
      </div>
    </div>
  </div>
);

const SkeletonLine: React.FC = () => (
  <div className="flex gap-3">
    <Block className="h-[45px] w-[60px] shrink-0 rounded-[10px] sm:h-12 sm:w-16" />
    <div className="flex flex-1 flex-col gap-2">
      <Block className="h-3.5 w-1/2 rounded-md" />
      <Block className="h-3 w-3/4 rounded-md" />
    </div>
  </div>
);

/** Back link, title, then the basket + details column and the summary card (as on CheckoutPage). */
export const CheckoutPageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-white" aria-busy="true">
    <SkeletonNavBar />
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:pt-7">
      <Block className="h-3.5 w-36 rounded-md" />
      <Block className="mt-3 h-8 w-48 rounded-lg sm:h-9 sm:w-56" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-[18px] border border-[#efe7de] p-4 sm:p-5">
            <Block className="h-[18px] w-28 rounded-md" />
            <SkeletonLine />
            <SkeletonLine />
          </div>
          <div className="grid grid-cols-1 gap-3 rounded-[18px] border border-[#efe7de] p-4 sm:grid-cols-2 sm:p-5">
            {Array.from({ length: 4 }, (_, i) => (
              <Block key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="hidden flex-col gap-3 self-start rounded-[18px] border border-[#efe7de] p-5 lg:flex">
          <Block className="h-[18px] w-3/5 rounded-md" />
          <Block className="h-3 rounded-md" />
          <Block className="h-3 rounded-md" />
          <Block className="mt-2 h-[52px] rounded-full" />
        </div>
      </div>
    </div>
  </div>
);
