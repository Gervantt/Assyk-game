/** Три звезды: заполненные — заработанные. */
export function Stars({ value, size = 18 }: { value: 0 | 1 | 2 | 3; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} / 3`}>
      {[1, 2, 3].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden
          className={i <= value ? 'text-gold-400' : 'text-white/15'}
        >
          <path
            fill="currentColor"
            d="M12 2.6l2.83 5.73 6.32.92-4.57 4.46 1.08 6.3L12 17.03l-5.66 2.98 1.08-6.3-4.57-4.46 6.32-.92z"
          />
        </svg>
      ))}
    </span>
  )
}
