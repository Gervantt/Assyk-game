import { Link } from 'react-router-dom'
import { useT } from '@/i18n'
import type { DictKey } from '@/i18n'
import { Ornament } from '@/components/Ornament'

const BASE: DictKey[] = ['rules.1', 'rules.2', 'rules.3', 'rules.4', 'rules.5', 'rules.6', 'rules.7']
const EXTRA: DictKey[] = ['rules.extra.combo', 'rules.extra.physics', 'rules.extra.next']

export function Rules() {
  const t = useT()
  return (
    <div className="min-h-full overflow-y-auto bg-night-900">
      <div className="mx-auto w-full max-w-md px-5 py-8">
        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center rounded-full bg-white/5 px-4 text-sm font-semibold text-steppe-50 ring-1 ring-white/10"
        >
          ← {t('rules.back')}
        </Link>

        <Ornament className="mx-auto my-5 h-3 w-40 text-gold-500/70" />
        <h1 className="text-center text-3xl font-extrabold text-steppe-50">{t('rules.title')}</h1>

        <h2 className="mt-7 text-xs font-bold uppercase tracking-widest text-gold-400">
          {t('rules.base')}
        </h2>
        <ol className="mt-3 flex flex-col gap-3">
          {BASE.map((k, i) => (
            <li key={k} className="flex gap-3 text-sm leading-relaxed text-steppe-100">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-gold-400">
                {i + 1}
              </span>
              <span>
                {t(k)}
                {k === 'rules.5' && (
                  <em className="mt-1 block not-italic text-xs text-steppe-300">{t('rules.5note')}</em>
                )}
              </span>
            </li>
          ))}
        </ol>

        <h2 className="mt-8 text-xs font-bold uppercase tracking-widest text-sky-450">
          {t('rules.extra')}
        </h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
          {EXTRA.map((k) => (
            <li key={k} className="text-sm leading-relaxed text-steppe-100">
              {t(k)}
            </li>
          ))}
        </ul>

        <p className="mt-8 rounded-2xl bg-white/5 p-4 text-xs leading-relaxed text-steppe-300">
          {t('aim.hint')}. {t('aim.hintKeyboard')}.
        </p>
      </div>
    </div>
  )
}
