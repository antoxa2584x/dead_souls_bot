import { ukPlural } from './plural.js';

const day = (n: number) => ukPlural(n, 'день', 'дні', 'днів');
const msg = (n: number) => ukPlural(n, 'повідомлення', 'повідомлення', 'повідомлень');
const person = (n: number) => ukPlural(n, 'людини', 'людей', 'людей');
const member = (n: number) => ukPlural(n, 'учасника', 'учасників', 'учасників');

/**
 * Ukrainian is the reference locale: its shape defines the contract every other
 * locale must satisfy (see en.ts, which is typed against it).
 */
export const uk = {
  code: 'uk',
  name: 'Українська',

  range: {
    allTime: 'весь час',
    today: 'сьогодні',
    // "останній" agrees with a singular noun, "останні" with a plural one:
    // останній 1 день · останні 2 дні · останні 5 днів · останній 21 день
    lastDays: (n: number) =>
      `${ukPlural(n, 'останній', 'останні', 'останні')} ${n} ${day(n)}`,
  },

  ago: {
    justNow: 'щойно',
    minutes: (m: number) => `${m} хв тому`,
    hoursMinutes: (h: number, m: number) => `${h} год ${m} хв тому`,
    daysHours: (d: number, h: number) => `${d} ${day(d)} ${h} год тому`,
    monthsDays: (mo: number, d: number) =>
      `${mo} ${ukPlural(mo, 'місяць', 'місяці', 'місяців')} ${d} ${day(d)} тому`,
  },

  guard: {
    groupOnly: 'Додайте мене до групи та виконайте команду там — я веду статистику лише по групах.',
    notTracked: 'Мене не налаштовано на відстеження цього чату.',
  },

  common: {
    never: 'ніколи',
    theGroup: 'група',
    unknownUser: 'невідомий',
    messagesCount: (n: number) => `${n} ${msg(n)}`,
    peopleCount: (n: number) => `${n} ${person(n)}`,
  },

  table: {
    num: '#',
    who: 'хто',
    msgs: 'повід.',
    perDay: '/день',
    days: 'днів',
  },

  stats: {
    title: (range: string) => `📊 <b>Активність групи — ${range}</b>`,
    summary: (msgs: number, people: number) =>
      `<b>${msgs}</b> ${msg(msgs)} від <b>${people}</b> ${person(people)}`,
    avgChars: (n: number) => ` · у середньому ${n} симв.`,
    daily: (n: number) => `За днями (останні ${n} ${day(n)})`,
    andMore: (n: number, period: string) =>
      `<i>…та ще ${n} — /top ${period}</i>`,
    tracking: (tracked: number, confirmed: number, since: string) =>
      `<i>Відстежую ${tracked} ${member(tracked)} (${confirmed} підтверджено) з ${since}.</i>`,
    empty: (range: string, since: string) =>
      `За період «${range}» повідомлень немає. Я спостерігаю з ${since}.`,
    topTitle: (range: string) => `🏆 <b>Найактивніші — ${range}</b>`,
    topEmpty: (range: string) => `За період «${range}» ніхто нічого не писав.`,
  },

  profile: {
    title: (name: string, range: string) => `👤 <b>${name}</b> — ${range}`,
    nothingInRange: (name: string, range: string, last: string) =>
      `<b>${name}</b> нічого не писав(-ла) за період «${range}». Останнє повідомлення: ${last}.`,
    neverPosted: (name: string) =>
      `<b>${name}</b> жодного разу не писав(-ла), відколи я спостерігаю.`,
    labels: {
      messages: 'Повідомлень',
      perWeek: 'За тиждень',
      activeDays: 'Активних днів',
      streak: 'Серія поспіль',
      avgLength: 'Середня довжина',
      peakHour: 'Пікова година',
      reactions: 'Реакції',
    },
    rank: (rank: number, total: number) => `  (#${rank} з ${total})`,
    activeDaysOf: (n: number) => ` з ${n}`,
    streakValue: (n: number) => `${n} ${day(n)}`,
    avgLengthValue: (n: number) => `${n} симв.`,
    reactionsValue: (given: number, received: number) =>
      `${given} поставлено · ${received} отримано`,
    daily: 'За днями',
    types: 'Типи',
    lastMessage: (when: string, kind: string) => `Останнє повідомлення ${when} (${kind}).`,
    tip: '<i>Порада: дайте відповідь на чиєсь повідомлення та виконайте /me, щоб побачити його статистику.</i>',
    lastPosted: (name: string, when: string, kind: string) =>
      `<b>${name}</b> востаннє писав(-ла) <b>${when}</b> — ${kind}.`,
    notPosted: (name: string) =>
      `<b>${name}</b> нічого не писав(-ла), відколи я спостерігаю.`,
    whenTitle: (who: string, range: string) => `🕒 <b>Коли пише ${who} — ${range}</b>`,
    whenEmpty: (range: string) => `За період «${range}» повідомлень немає.`,
    userNotSeen: (mention: string) =>
      `Я ще не бачив(-ла) повідомлень від ${mention} у цьому чаті, тому статистики немає. ` +
      `Дайте відповідь на одне з його повідомлень, якщо нікнейм змінився.`,
    unknownWho: 'Не вдалося визначити, хто ви.',
  },

  dead: {
    none: (days: number) =>
      `👻 Ніхто не мовчить ${days}+ ${day(days)}. Усі, кого я відстежую, писали нещодавно.`,
    title: (days: number) => `👻 <b>Мовчать ${days}+ ${day(days)}</b>`,
    neverPosted: 'Ніколи не писали',
    silent: 'Мовчать',
    lurking: 'Читають (лише реакції)',
    coverage: (known: number, total: number) =>
      `Мені відомо ${known} з ${total} ${member(total)}. ` +
      `Учасники, які приєдналися до мене й ніколи не писали та не ставили реакцій, ` +
      `невидимі для Bot API, тож цей список — нижня межа.`,
    since: (when: string) => `Спостерігаю з ${when}.`,
  },

  misc: {
    help: `<b>Dead Souls</b> — статистика активності цієї групи.

<b>/stats</b> [період] — огляд групи та найактивніші
<b>/top</b> [період] — повний рейтинг
<b>/me</b> [@user] [період] — детальний профіль (дайте відповідь, щоб обрати іншого)
<b>/last</b> [@user] — коли людина писала востаннє
<b>/when</b> [@user] [період] — активність за годинами
<b>/dead</b> [днів] — учасники, які замовкли
<b>/ach</b> [@user] — трофеї та очки
<b>/hall</b> — зала слави
<b>/settings</b> — меню налаштувань (мова, поріг мовчання)
<b>/status</b> — що бот наразі бачить

<i>період</i> = <code>week</code> (типово), <code>month</code>, <code>year</code>, <code>all</code> або кількість днів.

Я зберігаю лише метадані повідомлень — ніколи не текст.`,
    statusChatId: (id: number) => `Ідентифікатор чату: <code>${id}</code>`,
    statusSince: (when: string) => `Спостерігаю з: ${when}`,
    statusMembers: (tracked: number, confirmed: number, total: number | string) =>
      `Відомо учасників: ${tracked} (${confirmed} підтверджено) з ${total}`,
    statusTimezone: (tz: string) => `Часовий пояс: <code>${tz}</code>`,
    statusLang: (name: string) => `Мова: ${name}`,
    statusPrivacyOff: 'Режим приватності: ✅ вимкнено (бачу всі повідомлення)',
    statusPrivacyOn:
      'Режим приватності: ⚠️ УВІМКНЕНО — я бачу лише команди. ' +
      'Вимкніть його в @BotFather, потім видаліть і додайте мене знову.',
    forgetSelf: 'Видалив усе, що я зберігав про вас у цьому чаті.',
    forgetOther: (id: number) => `Видалив усе, що зберігалося про користувача ${id} у цьому чаті.`,
    forgetDenied: 'Лише налаштований адміністратор може видалити дані іншого учасника.',
    langUsage: (current: string) =>
      `Поточна мова: <b>${current}</b>\nЗмінити: <code>/lang uk</code> або <code>/lang en</code>`,
    langChanged: (name: string) => `Мову змінено на <b>${name}</b>.`,
    langDenied: 'Лише адміністратор групи може змінювати мову.',
    langUnknown: (code: string) =>
      `Невідома мова «${code}». Доступні: <code>uk</code>, <code>en</code>.`,
  },

  settings: {
    title: '⚙️ <b>Налаштування</b>',
    subtitle: 'Обраний параметр діє лише для цієї групи.',
    langButton: (name: string) => `🌐 Мова: ${name}`,
    daysButton: (n: number) => `👻 Поріг мовчання: ${n} ${day(n)}`,
    close: '✖️ Закрити',
    back: '‹ Назад',
    langTitle: '🌐 <b>Оберіть мову</b>',
    daysTitle: '👻 <b>Поріг мовчання</b>',
    daysHint:
      'Через скільки днів без повідомлень учасник потрапляє до /dead.',
    daysOption: (n: number) => `${n} ${day(n)}`,
    achButton: (on: boolean) => `🏆 Сповіщення про трофеї: ${on ? 'увімк.' : 'вимк.'}`,
    saved: '✅ Збережено',
    denied: 'Лише адміністратор групи може змінювати налаштування.',
    closed: '⚙️ Налаштування закрито.',
    current: '✓ ',
  },

  ach: {
    ui: {
      header: (name: string, level: number) => `🎮 <b>${name}</b> · РІВЕНЬ ${level}`,
      gamerscore: (score: number, total: number) => `🏆 Очки       ${score} / ${total}`,
      levelBar: (into: number, need: number) => `📈 До рівня   ${into} / ${need}`,
      maxLevel: '📈 До рівня   МАКСИМУМ',
      completion: (got: number, total: number, pct: number) =>
        `📊 Відкрито   ${got} / ${total} (${pct}%)`,
      tally: (b: number, s: number, g: number, p: number) =>
        `🥉 ${b}   🥈 ${s}   🥇 ${g}   🏆 ${p}`,
      unlockedSection: '── ВІДКРИТО ──',
      nextSection: '── НАЙБЛИЖЧІ ──',
      secretName: '??? ??? ???',
      secretDesc: 'Таємний трофей',
      andMore: (n: number) => `…та ще ${n}`,
      nothingYet: 'Жодного трофея. Напишіть щось — і почнеться.',
      toastTitle: '🏆 <b>ДОСЯГНЕННЯ ВІДКРИТО</b>',
      platinumTitle: '🏆 <b>ПЛАТИНОВИЙ ТРОФЕЙ</b>',
      toastScore: (score: number, total: number) => `Очки: ${score} / ${total}`,
      levelUp: (level: number) => `⬆️ <b>НОВИЙ РІВЕНЬ — ${level}</b>`,
      hallTitle: '🏛 <b>ЗАЛА СЛАВИ</b>',
      hallEmpty: 'Поки нікого. Трофеї з’являться, щойно почнеться активність.',
      hallRow: '#  гравець          рів.   очки',
    },
    tiers: {
      bronze: 'Бронза',
      silver: 'Срібло',
      gold: 'Золото',
      platinum: 'Платина',
    },
    list: {
      getting_started: { name: 'Перші кроки', desc: 'Пишіть 3 дні поспіль' },
      regular: { name: 'Завсідник', desc: 'Пишіть 7 днів поспіль' },
      dedicated: { name: 'Відданий справі', desc: 'Пишіть 30 днів поспіль' },
      no_days_off: { name: 'Без вихідних', desc: 'Пишіть 100 днів поспіль' },
      unbroken: { name: 'Незламний', desc: 'Пишіть щодня протягом року' },
      first_hundred: { name: 'Перша сотня', desc: 'Надішліть 100 повідомлень' },
      thousand_club: { name: 'Клуб тисячі', desc: 'Надішліть 1 000 повідомлень' },
      ten_thousand: { name: 'П’ять цифр', desc: 'Надішліть 10 000 повідомлень' },
      busy_day: { name: 'Гарячий день', desc: 'Надішліть 50 повідомлень за один день' },
      personal_best: { name: 'Особистий рекорд', desc: 'Надішліть 100 повідомлень за один день' },
      top_of_board: { name: 'На вершині', desc: 'Станьте найактивнішим за день' },
      dominance: { name: 'Домінування', desc: 'Очоліть денний рейтинг 30 разів' },
      night_shift: { name: 'Нічна зміна', desc: 'Надішліть 100 повідомлень між 00:00 і 05:00' },
      early_riser: { name: 'Рання пташка', desc: 'Надішліть 100 повідомлень між 05:00 і 08:00' },
      nocturnal: { name: 'Нічний мешканець', desc: 'Надішліть 500 повідомлень після опівночі' },
      shutterbug: { name: 'Фотограф', desc: 'Опублікуйте 100 фото' },
      cinematographer: { name: 'Кінооператор', desc: 'Опублікуйте 50 відео' },
      gif_librarian: { name: 'Хранитель гіфок', desc: 'Опублікуйте 100 гіфок' },
      wall_of_text: { name: 'Стіна тексту', desc: 'Напишіть повідомлення понад 1 000 символів' },
      sticker_collection: { name: 'Колекція стікерів', desc: 'Надішліть 250 стікерів' },
      on_air: { name: 'В ефірі', desc: 'Надішліть 100 голосових повідомлень' },
      went_viral: { name: 'Вірусний пост', desc: 'Отримайте 10 реакцій на одне повідомлення' },
      conversationalist: { name: 'Співрозмовник', desc: 'Відповідайте іншим 500 разів' },
      crowd_pleaser: { name: 'Улюбленець публіки', desc: 'Отримайте 100 реакцій' },
      supportive: { name: 'Група підтримки', desc: 'Поставте 250 реакцій' },
      second_thoughts: { name: 'Друга думка', desc: 'Відредагуйте 100 повідомлень' },
      back_from_the_dead: {
        name: 'Повернення з того світу',
        desc: 'Повернутися після 30 днів мовчання',
      },
      first_light: { name: 'Перший промінь', desc: 'Напишіть перше повідомлення дня 50 разів' },
      last_word: { name: 'Останнє слово', desc: 'Напишіть останнє повідомлення дня 50 разів' },
      old_guard: { name: 'Стара гвардія', desc: 'Бути тут через рік після першого повідомлення' },
      completionist: { name: 'Мертві душі', desc: 'Відкрийте всі інші досягнення' },
    } as Record<string, { name: string; desc: string }>,
  },

  kinds: {
    text: 'текст',
    photo: 'фото',
    video: 'відео',
    sticker: 'стікер',
    voice: 'голосове',
    video_note: 'кружечок',
    audio: 'аудіо',
    document: 'документ',
    animation: 'гіфка',
    poll: 'опитування',
    dice: 'кубик',
    contact: 'контакт',
    venue: 'місце',
    location: 'локація',
    game: 'гра',
    story: 'сторіс',
    paid_media: 'платне медіа',
    command: 'команда',
    other: 'інше',
  } as Record<string, string>,

  commands: {
    stats: 'Огляд активності групи',
    top: 'Рейтинг найактивніших учасників',
    me: 'Ваша статистика (або відповідь на чиєсь повідомлення)',
    last: 'Коли людина писала востаннє',
    when: 'Активність за годинами доби',
    dead: 'Учасники, які замовкли',
    achievements: 'Ваші трофеї та очки',
    hall: 'Зала слави за очками',
    settings: 'Налаштування бота',
    status: 'Що бот наразі бачить',
    help: 'Показати всі команди',
  },
};

export type Dict = typeof uk;
