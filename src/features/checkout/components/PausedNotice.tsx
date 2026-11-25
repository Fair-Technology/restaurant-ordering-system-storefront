import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CirclePause, Phone } from 'lucide-react';
import { telHref } from '../../../utils/openingHours';
import type { OrderCopy } from '../../../utils/orderCopy';

interface PausedNoticeProps {
  /** "alert" when the card just interrupted an action (refused quote or Pay), "status" when known on load */
  role: 'status' | 'alert';
  title: string;
  message: string;
  backAt: string | null;
  phone: string | null;
  backToMenuHref: string;
  copy: OrderCopy;
}

/** Calm card that replaces the checkout form while the shop is not taking orders. */
const PausedNotice: React.FC<PausedNoticeProps> = ({ role, title, message, backAt, phone, backToMenuHref, copy }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The card is mounted when the pause appears, so mounting as an alert means a refusal just happened
  useEffect(() => {
    if (role === 'alert') headingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      role={role}
      data-testid="checkout-paused"
      className="flex flex-col items-center gap-4 rounded-[20px] border border-[#efe7de] bg-white p-8 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f4efe9] text-[#4a413b]">
        <CirclePause className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-[22px] font-semibold leading-tight text-gray-900 outline-none"
      >
        {title}
      </h2>
      <div className="flex flex-col gap-1.5 text-[15px] leading-relaxed text-[#5c524b]">
        <p>{message}</p>
        {backAt && <p>{copy.noticePausedBackAt(backAt)}</p>}
      </div>
      <div className="flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          to={backToMenuHref}
          className="flex h-12 items-center justify-center rounded-full bg-gray-900 px-6 text-[15px] font-bold text-white"
        >
          {copy.backToMenu}
        </Link>
        {phone && (
          <a
            href={telHref(phone)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-gray-900 bg-white px-6 text-[15px] font-bold text-gray-900"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {copy.noticeCallUs} {phone}
          </a>
        )}
      </div>
    </section>
  );
};

export default PausedNotice;
