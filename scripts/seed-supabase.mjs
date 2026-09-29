/**
 * Наполнение проекта Supabase: вузы + тестовый аккаунт для проверяющих.
 *
 * Требуется service_role ключ — он даёт полный доступ к базе и НИКОГДА
 * не должен попадать в браузер и в репозиторий.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-supabase.mjs
 *
 * Скрипт идемпотентен: повторный запуск ничего не ломает.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function readEnvFile() {
  try {
    const out = {}
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].trim()
    }
    return out
  } catch {
    return {}
  }
}

const fileEnv = readEnvFile()
const url = process.env.VITE_SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Нужны VITE_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Ключ: Supabase -> Project Settings -> API -> service_role')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const UNIVERSITIES = [
  { id: 'narxoz', name: 'Narxoz University', city: 'Алматы', sort: 1 },
  { id: 'kbtu', name: 'Kazakh-British Technical University', city: 'Алматы', sort: 2 },
  { id: 'sdu', name: 'SDU University', city: 'Қаскелең', sort: 3 },
  { id: 'aitu', name: 'Astana IT University', city: 'Астана', sort: 4 },
  { id: 'kaznu', name: 'Әл-Фараби атындағы ҚазҰУ', city: 'Алматы', sort: 5 },
  { id: 'enu', name: 'Л. Гумилев атындағы ЕҰУ', city: 'Астана', sort: 6 },
  { id: 'nu', name: 'Nazarbayev University', city: 'Астана', sort: 7 },
  { id: 'satbayev', name: 'Satbayev University', city: 'Алматы', sort: 8 },
  { id: 'kimep', name: 'KIMEP University', city: 'Алматы', sort: 9 },
  { id: 'kaztu', name: 'Қ. Жұбанов атындағы АӨУ', city: 'Ақтөбе', sort: 10 },
  { id: 'buketov', name: 'Е. Бөкетов атындағы ҚарУ', city: 'Қарағанды', sort: 11 },
  { id: 'other', name: 'Басқа / Другой / Other', city: '—', sort: 999 },
]

const TEST_EMAIL = 'reviewer@asyqleague.kz'
const TEST_PASSWORD = 'AsyqLeague2026!'

async function seedUniversities() {
  const { error } = await admin.from('universities').upsert(UNIVERSITIES, { onConflict: 'id' })
  if (error) throw new Error(`вузы: ${error.message}`)
  console.log(`вузы: записано ${UNIVERSITIES.length}`)
}

async function seedReviewer() {
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 })
  if (listError) throw new Error(`список пользователей: ${listError.message}`)

  let user = list.users.find((u) => u.email === TEST_EMAIL)
  if (user) {
    console.log('тестовый аккаунт уже есть, обновляю пароль')
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: TEST_PASSWORD })
    if (error) throw new Error(`обновление пароля: ${error.message}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { username: 'Тексеруші', locale: 'ru' },
    })
    if (error) throw new Error(`создание аккаунта: ${error.message}`)
    user = data.user
    console.log('тестовый аккаунт создан')
  }

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: user.id,
      username: 'Тексеруші',
      avatar: 'eagle',
      university_id: 'narxoz',
      locale: 'ru',
      is_guest: false,
    },
    { onConflict: 'id' },
  )
  if (profileError) throw new Error(`профиль: ${profileError.message}`)

  // немного прогресса, чтобы проверяющему было что посмотреть
  const progress = [
    { user_id: user.id, level_id: 'aul-1', stars: 3, best_throws: 1 },
    { user_id: user.id, level_id: 'aul-2', stars: 3, best_throws: 2 },
    { user_id: user.id, level_id: 'aul-3', stars: 2, best_throws: 3 },
  ]
  const { error: progressError } = await admin
    .from('progress')
    .upsert(progress, { onConflict: 'user_id,level_id' })
  if (progressError) throw new Error(`прогресс: ${progressError.message}`)

  console.log(`\nТестовый доступ для проверяющих:\n  почта:  ${TEST_EMAIL}\n  пароль: ${TEST_PASSWORD}`)
}

try {
  await seedUniversities()
  await seedReviewer()
  console.log('\nГотово.')
} catch (e) {
  console.error('\nОшибка:', e.message)
  process.exit(1)
}
