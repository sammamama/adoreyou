import Image from 'next/image';
import Link from 'next/link';

// Logo mark + "AdoreYou" wordmark — the top-left header link on every page.
// The image tracks the text size via em units, so callers size it with a
// text-* class.
export default function Wordmark({
  className = 'text-2xl',
}: {
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 font-serif ${className}`}
    >
      <Image
        src="/logo-mark.png"
        alt=""
        width={64}
        height={64}
        className="h-[1.2em] w-[1.2em] rounded-full"
      />
      <span>
        Adore<span className="italic text-accent">You</span>
      </span>
    </Link>
  );
}
