import { Link } from 'react-router-dom'
import { Ornament } from '@/components/Ornament'
import { useT } from '@/i18n'
import { ARENA_LOOKS, SAKA_LOOKS } from '@/shop/catalog'
import type { DictKey } from '@/i18n'

const BENEFITS: Array<{ key: DictKey; desc: DictKey }> = [
  { key: 'pro.b1', desc: 'pro.b1.d' },
  { key: 'pro.b2', desc: 'pro.b2.d' },
  { key: 'pro.b3', desc: 'pro.b3.d' },
  { key: 'pro.b4', desc: 'pro.b4.d' },
]

export function Pro() {
  const t = useT()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-6">
      <Link to="/shop" className="self-start text-sm text-steppe-300">
        ← {t('shop.title')}
      </Link>

      <Ornament className="mx-auto my-4 h-3 w-40 text-gold-500/70" />
      <h1 className="text-center text-2xl font-extrabold text-steppe-50">{t('pro.title')}</h1>
      <p className="mt-2 text-center text-sm text-steppe-300">{t('pro.subtitle')}</p>

      <p className="mt-4 rounded-2xl bg-gold-400 px-4 py-2 text-center text-xs font-extrabold uppercase tracking-wider text-night-900">
        {t('shop.testBanner')}
      </p>

      {/* Превью: видно, что именно покупаешь */}
      <div className="mt-5 flex gap-3">
        {['saka.gold', 'saka.oyu', 'saka.silver'].map((id) => (
          <div key={id} className="flex-1 rounded-2xl bg-night-800 p-3 text-center ring-1 ring-white/10">
            <span
              className="mx-auto block h-12 w-12 rounded-full ring-1 ring-white/20"
              style={{
                background: `radial-gradient(circle at 34% 30%, #ffffffaa, ${SAKA_LOOKS[id]?.color} 62%)`,
              }}
            />
            <span className="mt-2 block text-[10px] text-steppe-400">
              {t(`shop.${id.replace('.', '.')}` as 'shop.saka.gold')}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-3">
        {['arena.jailau', 'arena.winter'].map((id) => (
          <div key={id} className="flex-1 rounded-2xl bg-night-800 p-3 text-center ring-1 ring-white/10">
            <span
              className="mx-auto block h-12 w-full rounded-xl ring-1 ring-white/20"
              style={{
                background: `linear-gradient(160deg, ${ARENA_LOOKS[id]?.sky} 40%, ${ARENA_LOOKS[id]?.ground} 41%)`,
              }}
            />
            <span className="mt-2 block text-[10px] text-steppe-400">
              {t(`shop.${id}` as 'shop.arena.jailau')}
            </span>
          </div>
        ))}
      </div>

      <ul className="mt-6 flex flex-col gap-3">
        {BENEFITS.map((b) => (
          <li key={b.key} className="rounded-2xl bg-night-800 p-4 ring-1 ring-white/10">
            <p className="text-sm font-bold text-steppe-50">{t(b.key)}</p>
            <p className="mt-1 text-xs leading-relaxed text-steppe-400">{t(b.desc)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl bg-white/5 p-4">
        <p className="text-sm font-bold text-gold-400">{t('pro.noP2W')}</p>
        <p className="mt-1 text-xs leading-relaxed text-steppe-300">{t('pro.noP2W.d')}</p>
      </div>

      <Link
        to="/shop"
        className="mt-6 flex min-h-[52px] items-center justify-center rounded-2xl bg-gold-400 text-lg font-bold text-night-900"
      >
        {t('pro.toShop')}
      </Link>
    </div>
  )
}
