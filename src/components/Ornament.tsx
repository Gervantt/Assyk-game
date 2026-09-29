/** Қошқар мүйіз — тонкая декоративная полоса. Не перегружаем интерфейс. */
export function Ornament({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 12"
      aria-hidden
      className={className}
      preserveAspectRatio="xMidYMid meet"
      fill="none"
    >
      {[0, 30, 60, 90].map((x) => (
        <g key={x} transform={`translate(${x} 0)`} stroke="currentColor" strokeWidth="1.1">
          <path d="M3 9 C3 3, 9 3, 9 7 C9 10, 13 10, 13 6" />
          <path d="M27 9 C27 3, 21 3, 21 7 C21 10, 17 10, 17 6" />
          <circle cx="15" cy="4" r="1.3" fill="currentColor" stroke="none" />
        </g>
      ))}
    </svg>
  )
}
