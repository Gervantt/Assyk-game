/** Все строки UI. Хардкод текстов в компонентах запрещён. */
export const LOCALES = ['kk', 'ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_NAMES: Record<Locale, string> = {
  kk: 'Қазақша',
  ru: 'Русский',
  en: 'English',
}

export const dict = {
  'app.title': { kk: 'Asyq League', ru: 'Asyq League', en: 'Asyq League' },
  'app.tagline': {
    kk: 'Көзде. Ат. Ұтып ал.',
    ru: 'Прицелься. Бросай. Выбивай.',
    en: 'Aim. Throw. Knock them out.',
  },
  'app.subtitle': {
    kk: 'Қазақтың «Асық ату» ойынының заманауи нұсқасы',
    ru: 'Современная версия казахской игры «Асық ату»',
    en: 'A modern take on the Kazakh game of Asyq Atu',
  },

  'mode.training': { kk: 'Жаттығу', ru: 'Тренировка', en: 'Training' },
  'mode.training.desc': {
    kk: '5 асық, 5 лақтыру. Нәтижеңді жақсарт.',
    ru: '5 асыков, 5 бросков. Побей свой рекорд.',
    en: '5 asyqs, 5 throws. Beat your record.',
  },
  'mode.hotseat': { kk: 'Екеуара', ru: 'Вдвоём', en: 'Hot-seat' },
  'mode.hotseat.desc': {
    kk: 'Бір құрылғыда кезекпен ойнаңдар.',
    ru: 'По очереди на одном устройстве.',
    en: 'Take turns on one device.',
  },
  'mode.rules': { kk: 'Ережелер', ru: 'Правила', en: 'Rules' },

  'hud.score': { kk: 'Ұпай', ru: 'Счёт', en: 'Score' },
  'hud.throws': { kk: 'Лақтыру', ru: 'Броски', en: 'Throws' },
  'hud.inKon': { kk: 'Қонда', ru: 'В кону', en: 'In the kon' },
  'hud.turn': { kk: 'Кезек', ru: 'Ход', en: 'Turn' },
  'hud.power': { kk: 'Күш', ru: 'Сила', en: 'Power' },
  'hud.topView': { kk: 'Жоғарыдан', ru: 'Сверху', en: 'Top view' },
  'hud.playerView': { kk: 'Ойыншыдан', ru: 'От игрока', en: 'Player view' },
  'hud.menu': { kk: 'Мәзір', ru: 'Меню', en: 'Menu' },
  'hud.best': { kk: 'Рекорд', ru: 'Рекорд', en: 'Best' },

  'aim.hint': {
    kk: 'Экранды басып тұрып, артқа тарт та жібер',
    ru: 'Зажми и потяни назад, затем отпусти',
    en: 'Press, drag back and release',
  },
  'aim.hintKeyboard': {
    kk: '← → бұрыш, бос орынды ұста — күш',
    ru: '← → угол, пробел удерживать — сила',
    en: '← → angle, hold Space for power',
  },
  'aim.cancel': { kk: 'Болдырмау үшін саусақты ортаға қайтар', ru: 'Верни палец в центр — бросок отменится', en: 'Return to centre to cancel' },

  'event.knock': { kk: 'Ұтып алдың!', ru: 'Выбил!', en: 'Knocked out!' },
  'event.qos': { kk: 'Қос!', ru: 'Қос!', en: 'Қos!' },
  'event.keremet': { kk: 'Керемет!', ru: 'Керемет!', en: 'Keremet!' },
  'event.miss': { kk: 'Тиген жоқ', ru: 'Мимо', en: 'Miss' },
  'event.penalty': { kk: 'Сақа қонда қалды: −1', ru: 'Сақа осталась в кону: −1', en: 'Saqa stopped inside: −1' },
  'event.sakaLost': { kk: 'Тым күшті — сақа ұшып кетті', ru: 'Слишком сильно — сақа улетела', en: 'Too strong — the saqa flew away' },

  'result.title': { kk: 'Нәтиже', ru: 'Итоги', en: 'Results' },
  'result.score': { kk: 'Ұтып алған асық', ru: 'Выбито асыков', en: 'Asyqs won' },
  'result.accuracy': { kk: 'Дәлдік', ru: 'Точность', en: 'Accuracy' },
  'result.bestThrow': { kk: 'Үздік лақтыру', ru: 'Лучший бросок', en: 'Best throw' },
  'result.streak': { kk: 'Ең ұзын серия', ru: 'Лучшая серия', en: 'Best streak' },
  'result.penalties': { kk: 'Айыппұл', ru: 'Штрафы', en: 'Penalties' },
  'result.again': { kk: 'Тағы бір рет', ru: 'Ещё раз', en: 'Play again' },
  'result.home': { kk: 'Басты бет', ru: 'На главную', en: 'Home' },
  'result.newBest': { kk: 'Жаңа рекорд!', ru: 'Новый рекорд!', en: 'New best!' },
  'result.winner': { kk: '{name} жеңді!', ru: 'Победил(а) {name}!', en: '{name} wins!' },
  'result.draw': { kk: 'Тең түсті — шешуші лақтыру', ru: 'Ничья — решающий бросок', en: 'Draw — decisive throw' },

  'player.you': { kk: 'Сен', ru: 'Ты', en: 'You' },
  'player.one': { kk: '1-ойыншы', ru: 'Игрок 1', en: 'Player 1' },
  'player.two': { kk: '2-ойыншы', ru: 'Игрок 2', en: 'Player 2' },

  'rules.title': { kk: 'Ойын ережелері', ru: 'Правила игры', en: 'Game rules' },
  'rules.base': { kk: 'Дәстүрлі ережелер', ru: 'Традиционные правила', en: 'Traditional rules' },
  'rules.extra': { kk: 'Авторлық қосымшалар', ru: 'Авторские дополнения', en: 'Our additions' },
  'rules.back': { kk: 'Артқа', ru: 'Назад', en: 'Back' },
  'rules.1': {
    kk: 'Асықтар қонға — бормен сызылған шеңберге — қатармен қойылады.',
    ru: 'Асыки выставляются в кон — круг, очерченный мелом.',
    en: 'The asyqs are set inside the kon — a circle drawn in chalk.',
  },
  'rules.2': {
    kk: 'Ойыншы сызықтан сақаны лақтырады: бағыт пен күшті өзі таңдайды.',
    ru: 'Игрок бросает сақа от линии броска: выбирает направление и силу.',
    en: 'You throw the saqa from the line, choosing direction and power.',
  },
  'rules.3': {
    kk: 'Орталығы қоннан шықса — асық ұтылды, +1 ұпай. Әр асық бір-ақ рет ұпай береді.',
    ru: 'Асык выбит, когда его центр покинул кон: +1 очко. Каждый асык приносит очко только один раз.',
    en: 'An asyq counts as won when its centre leaves the kon: +1 point, once per asyq.',
  },
  'rules.4': {
    kk: 'Кемінде біреуін ұтсаң — тағы лақтырасың. Тимесе — кезек қарсыласқа.',
    ru: 'Выбил хотя бы один — бросаешь ещё раз. Промах — ход переходит сопернику.',
    en: 'Knock at least one out and you throw again. Miss and the turn passes.',
  },
  'rules.5': {
    kk: 'Сақа қонның ішінде тоқтаса — айыппұл: −1 ұпай, бір асық қонға қайтады.',
    ru: 'Сақа остановилась внутри кона — штраф: −1 очко, один асык возвращается в кон.',
    en: 'If the saqa stops inside the kon: −1 point and one asyq returns to the kon.',
  },
  'rules.5note': {
    kk: 'Бұл ереже ауладан ауылға өзгереді — жеке матчта сөндіруге болады.',
    ru: 'В разных дворах это правило разное — в частном матче его можно отключить.',
    en: 'This rule varies by yard — it can be switched off in a private match.',
  },
  'rules.6': {
    kk: 'Қон босағанда раунд бітеді. Асығы көп ойыншы жеңеді.',
    ru: 'Раунд заканчивается, когда кон пуст. Побеждает тот, у кого больше асыков.',
    en: 'The round ends when the kon is empty. Most asyqs wins.',
  },
  'rules.7': {
    kk: 'Кезектілік: сақаны жоғары лақтырады — алшы > тәйкі > бүк > шік.',
    ru: 'Очерёдность: подбрасывают сақа — алшы > тәйкі > бүк > шік.',
    en: 'Turn order is decided by a toss: alshy > tayki > buk > shik.',
  },
  'rules.extra.combo': {
    kk: 'Бір лақтыруда 2 асық — «Қос!», 3 және одан көп — «Керемет!».',
    ru: 'Комбо: 2 асыка одним броском — «Қос!», 3+ — «Керемет!».',
    en: 'Combos: two in one throw is «Qos!», three or more is «Keremet!».',
  },
  'rules.extra.physics': {
    kk: 'Лақтыру тек бағыт пен күшке тәуелді: физика детерминирленген.',
    ru: 'Бросок зависит только от направления и силы: физика детерминирована.',
    en: 'A throw depends only on direction and power: the physics is deterministic.',
  },
  'rules.extra.next': {
    kk: 'Алда: күнделікті сынақ, университеттер лигасы, деңгей редакторы.',
    ru: 'Впереди: ежедневное испытание, лига университетов, редактор уровней.',
    en: 'Coming next: daily challenge, university league, level editor.',
  },

  'common.play': { kk: 'Ойнау', ru: 'Играть', en: 'Play' },
  'common.loading': { kk: 'Жүктелуде…', ru: 'Загрузка…', en: 'Loading…' },
  'common.of': { kk: '/', ru: '/', en: '/' },
} as const

export type DictKey = keyof typeof dict
