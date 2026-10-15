import React from 'react';
import { Clock } from 'lucide-react';

/** When a basket dish is served ("Only Fridays 17:00–21:00"), on its own line under the name. */
const DishTimeLine: React.FC<{ text: string; clash?: boolean }> = ({ text, clash = false }) => (
  <span
    data-testid="dish-time"
    data-clash={clash ? 'true' : undefined}
    className={`flex items-center gap-1.5 text-[13px] leading-snug ${clash ? 'font-semibold text-[#8a1f12]' : 'text-[#5c524b]'}`}
  >
    <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span>{text}</span>
  </span>
);

export default DishTimeLine;
