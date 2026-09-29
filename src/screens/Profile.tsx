import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '@/i18n'
import { Ornament } from '@/components/Ornament'
import { BackendBanner } from '@/components/BackendBanner'
import { AVATARS, AVATAR_EMOJI } from '@/net/profile'
import { upgradeWithEmail, upgradeWithGoogle } from '@/net/auth'
import { fetchHistory, fetchPersonalBests, type PersonalBests } from '@/net/sync'
import type { ResultRow } from '@/net/types'
import { useAuthStore } from '@/store/useAuthStore'
import { loadProgress, totalStars } from '@/lib/progress'
import { CAMPAIGN } from '@/levels'
import { percent } from '@/lib/format'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="text-xs font-semibold text-steppe-300">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

export function Profile() {
  const t = useT()
  const { status, profile, universities, syncing, save } = useAuthStore()

  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('saka')
  const [university, setUniversity] = useState('')
  const [saved, setSaved] = useState(false)
  const [email, setEmail] = useState('')
  const [linkSent, setLinkSent] = useState(false)
  const [bests, setBests] = useState<PersonalBests | null>(null)
  const [history, setHistory] = useState<ResultRow[]>([])

  useEffect(() => {
    if (!profile) return
    setName(profile.username)
    setAvatar(profile.avatar)
    setUniversity(profile.university_id ?? '')
  }, [profile])

  useEffect(() => {
    if (!profile) return
    void fetchPersonalBests(profile.id).then(setBests)
    void fetchHistory(profile.id).then(setHistory)
  }, [profile])

  // без облака рекорды всё равно есть — берём их из локального прогресса
  const localStars = useMemo(() => totalStars(loadProgress()), [])
  const localLevels = useMemo(() => Object.keys(loadProgress()).length, [])

  const onSave = async () => {
    const ok = await save({
      username: name.trim() || 'Қонақ',
      avatar,
      university_id: university || null,
    })
    setSaved(ok)
    if (ok) window.setTimeout(() => setSaved(false), 2000)
  }

  const stats: Array<[string, string]> = [
    [t('profile.stat.stars'), `${bests?.campaignStars ?? localStars} / ${CAMPAIGN.length * 3}`],
    [t('profile.stat.levels'), `${bests?.levelsCleared ?? localLevels} / ${CAMPAIGN.length}`],
    [t('profile.stat.training'), String(bests?.bestTrainingScore ?? 0)],
    [t('profile.stat.daily'), String(bests?.bestDailyScore ?? 0)],
    [t('profile.stat.games'), String(bests?.totalGames ?? 0)],
  ]

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
        <h1 className="text-center text-3xl font-extrabold text-steppe-50">{t('profile.title')}</h1>

        <div className="mt-4">
          <BackendBanner />
        </div>

        {status === 'ready' && profile && (
          <>
            <section className="mt-6 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <Field label={t('profile.name')}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 24))}
                  className="min-h-[44px] w-full rounded-xl bg-black/40 px-3 text-sm text-steppe-50 ring-1 ring-white/15 outline-none focus:ring-gold-400"
                  aria-label={t('profile.name')}
                />
              </Field>

              <Field label={t('profile.avatar')}>
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAvatar(a)}
                      aria-pressed={avatar === a}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl transition-colors ${
                        avatar === a ? 'bg-gold-400 ring-2 ring-gold-400' : 'bg-black/40 ring-1 ring-white/15'
                      }`}
                    >
                      {AVATAR_EMOJI[a]}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={t('profile.university')}>
                <select
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="min-h-[44px] w-full rounded-xl bg-black/40 px-3 text-sm text-steppe-50 ring-1 ring-white/15 outline-none focus:ring-gold-400"
                  aria-label={t('profile.university')}
                >
                  <option value="">{t('profile.university.none')}</option>
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.city}
                    </option>
                  ))}
                </select>
              </Field>

              <button
                type="button"
                onClick={onSave}
                className="mt-5 min-h-[44px] w-full rounded-2xl bg-gold-400 font-bold text-night-900 transition-transform active:scale-95"
              >
                {saved ? t('profile.saved') : t('profile.save')}
              </button>
              {syncing && (
                <p className="mt-2 text-center text-xs text-steppe-300">{t('net.syncing')}</p>
              )}
            </section>

            {profile.is_guest && (
              <section className="mt-5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-xs font-bold uppercase tracking-widest text-gold-400">
                  {t('profile.guest')}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-steppe-300">
                  {t('profile.guest.hint')}
                </p>

                <div className="mt-4 flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('profile.email')}
                    className="min-h-[44px] min-w-0 flex-1 rounded-xl bg-black/40 px-3 text-sm text-steppe-50 ring-1 ring-white/15 outline-none focus:ring-gold-400"
                    aria-label={t('profile.email')}
                  />
                  <button
                    type="button"
                    disabled={!email.includes('@')}
                    onClick={async () => {
                      const r = await upgradeWithEmail(email.trim())
                      setLinkSent(r.ok)
                    }}
                    className="min-h-[44px] shrink-0 rounded-xl bg-gold-400 px-4 text-sm font-bold text-night-900 disabled:opacity-40"
                  >
                    {t('profile.sendLink')}
                  </button>
                </div>
                {linkSent && (
                  <p className="mt-2 text-xs leading-relaxed text-sky-450">{t('profile.linkSent')}</p>
                )}

                <button
                  type="button"
                  onClick={() => void upgradeWithGoogle()}
                  className="mt-3 min-h-[44px] w-full rounded-2xl bg-white/10 text-sm font-bold text-steppe-50 ring-1 ring-white/15"
                >
                  {t('profile.google')}
                </button>
              </section>
            )}
          </>
        )}

        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gold-400">
            {t('profile.records')}
          </h2>
          <dl className="mt-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            {stats.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between border-b border-white/10 py-2 last:border-0"
              >
                <dt className="text-sm text-steppe-300">{label}</dt>
                <dd className="text-base font-bold text-steppe-50">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gold-400">
            {t('profile.history')}
          </h2>
          {history.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-white/5 p-4 text-sm text-steppe-300 ring-1 ring-white/10">
              {t('profile.history.empty')}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
                >
                  <span className="truncate text-steppe-100">
                    {h.level_id ?? h.mode}
                    {h.stars ? ` · ★${h.stars}` : ''}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-steppe-300">
                    {h.score} · {h.throws} · {percent(h.accuracy)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {status === 'ready' && profile && !profile.is_guest && (
          <button
            type="button"
            onClick={() => void useAuthStore.getState().signOut()}
            className="mt-6 min-h-[44px] w-full rounded-2xl text-sm font-semibold text-steppe-300 hover:text-steppe-50"
          >
            {t('profile.signOut')}
          </button>
        )}
      </div>
    </div>
  )
}
