import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ornament } from '@/components/Ornament'
import { useT } from '@/i18n'
import { ARENA_LOOKS, CATALOG, SAKA_LOOKS, TRAIL_LOOKS, type ItemKind, type ShopItem } from '@/shop/catalog'
import { hasBackend } from '@/net/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { useShopStore } from '@/store/useShopStore'

const TABS: ItemKind[] = ['saka', 'arena', 'trail', 'pack']

/** Кружок-превью: для сақа и следа — цвет, для арены — земля и небо. */
function Swatch({ item }: { item: ShopItem }) {
  if (item.kind === 'arena') {
    const a = ARENA_LOOKS[item.id]
    return (
      <span
        className="h-11 w-11 shrink-0 rounded-xl ring-1 ring-white/20"
        style={{ background: `linear-gradient(160deg, ${a?.sky ?? '#222'} 40%, ${a?.ground ?? '#c4a678'} 41%)` }}
      />
    )
  }
  const look = item.kind === 'saka' ? SAKA_LOOKS[item.id] : TRAIL_LOOKS[item.id]
  const color = (look as { color?: string })?.color ?? '#c4a678'
  return (
    <span
      className="h-11 w-11 shrink-0 rounded-full ring-1 ring-white/20"
      style={{ background: `radial-gradient(circle at 34% 30%, #ffffffaa, ${color} 62%)` }}
    />
  )
}

export function Shop() {
  const t = useT()
  const profile = useAuthStore((s) => s.profile)
  const { owned, equipped, coins, busy, error, load, buy, equip, clearError } = useShopStore()
  const [tab, setTab] = useState<ItemKind>('saka')
  const [payFor, setPayFor] = useState<ShopItem | null>(null)

  useEffect(() => {
    void load()
  }, [load, profile?.id])

  const items = CATALOG.filter((i) => (tab === 'pack' ? i.kind === 'pack' || i.kind === 'tool' : i.kind === tab))

  const onBuy = async (item: ShopItem) => {
    // за деньги — через форму тестовой оплаты, за тиыны — сразу
    if (item.kzt > 0) {
      setPayFor(item)
      return
    }
    await buy(item.id)
  }

  const confirmPayment = async () => {
    if (!payFor) return
    const ok = await buy(payFor.id)
    if (ok) setPayFor(null)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 py-6">
      <Link to="/" className="self-start text-sm text-steppe-300">
        ← {t('common.menu')}
      </Link>

      <Ornament className="mx-auto my-4 h-3 w-40 text-gold-500/70" />
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-extrabold text-steppe-50">{t('shop.title')}</h1>
        <span className="text-sm text-steppe-200">
          <b className="text-gold-400">{coins}</b> {t('shop.coins')}
        </span>
      </div>
      <p className="mt-1 text-sm text-steppe-300">{t('shop.fair')}</p>

      <Link
        to="/pro"
        className="mt-4 flex min-h-[44px] items-center justify-between rounded-2xl bg-gold-400/15 px-4 text-sm font-bold text-gold-400 ring-1 ring-gold-400/30"
      >
        {t('pro.title')} <span aria-hidden>→</span>
      </Link>

      <div className="mt-5 flex gap-2">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`min-h-[40px] flex-1 rounded-xl text-xs font-bold ${
              tab === k ? 'bg-white/15 text-steppe-50 ring-1 ring-gold-400/40' : 'bg-white/5 text-steppe-300'
            }`}
          >
            {t(`shop.tab.${k}` as 'shop.tab.saka')}
          </button>
        ))}
      </div>

      {!hasBackend && (
        <p className="mt-5 rounded-2xl bg-white/5 p-4 text-center text-sm text-steppe-300">
          {t('shop.offline')}
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {items.map((item) => {
          const have = owned.has(item.id)
          const wearable =
            item.kind === 'saka' || item.kind === 'arena' || item.kind === 'trail'
          const on = wearable && equipped[item.kind as 'saka'] === item.id
          return (
            <li
              key={item.id}
              className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ${
                on ? 'bg-gold-400/10 ring-gold-400/40' : 'bg-night-800 ring-white/10'
              }`}
            >
              <Swatch item={item} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-steppe-50">{t(item.title)}</span>
                <span className="block truncate text-[11px] text-steppe-400">{t(item.desc)}</span>
              </span>

              {have ? (
                wearable ? (
                  <button
                    type="button"
                    disabled={on}
                    onClick={() => void equip(item.id, item.kind as 'saka')}
                    className={`min-h-[44px] shrink-0 rounded-xl px-3 text-xs font-bold ${
                      on ? 'bg-gold-400/20 text-gold-400' : 'bg-white/10 text-steppe-50 ring-1 ring-white/15'
                    }`}
                  >
                    {on ? t('shop.on') : t('shop.wear')}
                  </button>
                ) : (
                  <span className="shrink-0 text-xs font-bold text-gold-400">{t('shop.owned')}</span>
                )
              ) : (
                <button
                  type="button"
                  disabled={!hasBackend || busy === item.id}
                  onClick={() => void onBuy(item)}
                  className="min-h-[44px] shrink-0 rounded-xl bg-gold-400 px-3 text-xs font-bold text-night-900 disabled:opacity-40"
                >
                  {busy === item.id
                    ? '…'
                    : item.kzt > 0
                      ? `${item.kzt} ₸`
                      : `${item.coins} ${t('shop.coins')}`}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {error && (
        <p className="mt-4 rounded-2xl bg-sky-550/20 p-3 text-center text-sm text-sky-450">
          {t(error === 'coins' ? 'shop.noCoins' : 'shop.failed')}{' '}
          <button type="button" onClick={clearError} className="underline">
            {t('common.close')}
          </button>
        </p>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-steppe-400">{t('shop.earn')}</p>

      {/* ── Форма тестовой оплаты ─────────────────────────────────────────── */}
      {payFor && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-night-900/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-night-800 p-6 ring-1 ring-white/10">
            <p className="rounded-xl bg-gold-400 px-3 py-2 text-center text-xs font-extrabold uppercase tracking-wider text-night-900">
              {t('shop.testBanner')}
            </p>
            <h2 className="mt-4 text-center text-lg font-extrabold text-steppe-50">{t(payFor.title)}</h2>
            <p className="mt-1 text-center text-2xl font-extrabold text-gold-400">{payFor.kzt} ₸</p>

            <div className="mt-4 flex flex-col gap-2">
              <input
                inputMode="numeric"
                placeholder="4400 0000 0000 0000"
                defaultValue="4400 0000 0000 0000"
                className="min-h-[48px] rounded-2xl bg-white/10 px-4 text-steppe-50 ring-1 ring-white/15"
              />
              <div className="flex gap-2">
                <input
                  placeholder="12/29"
                  defaultValue="12/29"
                  className="min-h-[48px] w-1/2 rounded-2xl bg-white/10 px-4 text-steppe-50 ring-1 ring-white/15"
                />
                <input
                  placeholder="CVC"
                  defaultValue="123"
                  className="min-h-[48px] w-1/2 rounded-2xl bg-white/10 px-4 text-steppe-50 ring-1 ring-white/15"
                />
              </div>
            </div>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-steppe-400">
              {t('shop.testNote')}
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setPayFor(null)}
                className="min-h-[44px] flex-1 rounded-2xl bg-white/10 font-bold text-steppe-50 ring-1 ring-white/15"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={busy === payFor.id}
                onClick={() => void confirmPayment()}
                className="min-h-[44px] flex-1 rounded-2xl bg-gold-400 font-bold text-night-900 disabled:opacity-40"
              >
                {busy === payFor.id ? '…' : t('shop.pay')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
