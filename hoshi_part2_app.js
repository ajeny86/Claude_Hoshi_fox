(() => {
  'use strict';

  window.__HOSHI_PART2_V2__ = true;
  const LANGUAGE_KEY = 'hoshi-language-choice';
  const savedLanguage = (() => {
    try {
      return localStorage.getItem(LANGUAGE_KEY)
        || sessionStorage.getItem(LANGUAGE_KEY)
        || '';
    } catch (error) {
      return '';
    }
  })();
  let selectedLanguage = ['ru', 'en'].includes(savedLanguage) ? savedLanguage : 'ru';
  document.documentElement.lang = selectedLanguage;
  document.title = selectedLanguage === 'en'
    ? 'Hoshi’s Journey — Japanese Traditions'
    : 'Путь Хоси — японские традиции';

  const ua = navigator.userAgent || '';
  if (/Telegram/i.test(ua) || (/iPhone|iPad|iPod/i.test(ua) && !/Safari/i.test(ua))) {
    document.documentElement.classList.add('ios-inapp-browser');
  }

  const CHAPTER_DEFINITIONS = Object.freeze({
    1: Object.freeze({
      screenCount: 7,
      title: { ru: 'Праздник лепестков', en: 'Festival of Petals' }
    }),
    2: Object.freeze({
      screenCount: 7,
      title: { ru: 'Небесная почта', en: 'Heavenly Post' }
    }),
    3: Object.freeze({
      screenCount: 7,
      title: { ru: 'Дорога для луны', en: 'A Road for the Moon' }
    }),
    4: Object.freeze({
      screenCount: 0,
      title: { ru: 'Сэцубун', en: 'Setsubun' }
    })
  });
  const chapterDefinition = chapterNumber => CHAPTER_DEFINITIONS[Number(chapterNumber)] || CHAPTER_DEFINITIONS[1];

  const chapterTemplate = chapterNumber => ({
    chapter: Number(chapterNumber) || 1,
    screen: 1,
    branches: [],
    words: [],
    foundWords: [],
    solved: {
      screen3: false,
      screen4: false,
      screen5: false,
      screen6a: false,
      screen6b: false
    },
    feather: false,
    screen6Step: 1,
    rewardReal: false,
    factOpen: [],
    reward: false,
    completed: false
  });

  const rootTemplate = () => ({
    version: 2,
    view: 'map',
    currentChapter: 1,
    chapters: {
      1: chapterTemplate(1),
      2: chapterTemplate(2),
      3: chapterTemplate(3),
      4: chapterTemplate(4)
    }
  });

  const STORAGE_KEY = `hoshi-part2-progress-v2-${selectedLanguage}`;
  const LEGACY_LANGUAGE_KEY = `hoshi-part2-hanami-v1-${selectedLanguage}`;
  const LEGACY_BASE_KEY = 'hoshi-part2-hanami-v1';

  const normalizeChapter = (saved, chapterNumber) => {
    const base = chapterTemplate(chapterNumber);
    const source = saved || {};
    return {
      ...base,
      ...source,
      solved: { ...base.solved, ...(source.solved || {}) },
      branches: Array.isArray(source.branches) ? source.branches : [],
      words: Array.isArray(source.words) ? source.words : [],
      foundWords: Array.isArray(source.foundWords) ? source.foundWords : [],
      factOpen: Array.isArray(source.factOpen) ? source.factOpen : [],
      reward: Boolean(source.reward ?? source.rewardReal),
      completed: Boolean(source.completed ?? source.chapterCompleted)
    };
  };

  const normalizeRootState = (saved, base) => {
    const current = saved?.chapters ? saved : base;
    return {
      ...base,
      ...current,
      chapters: {
        1: normalizeChapter(current.chapters?.[1], 1),
        2: normalizeChapter(current.chapters?.[2], 2),
        3: normalizeChapter(current.chapters?.[3], 3),
        4: normalizeChapter(current.chapters?.[4], 4)
      }
    };
  };

  const migrateLegacyState = () => {
    const current = window.HoshiCore.readRaw(STORAGE_KEY);
    if (!current.ok || current.value) return;
    const languageLegacy = window.HoshiCore.readRaw(LEGACY_LANGUAGE_KEY);
    const baseLegacy = selectedLanguage === 'ru'
      ? window.HoshiCore.readRaw(LEGACY_BASE_KEY)
      : { ok: true, value: null };
    const legacyRaw = languageLegacy.value || baseLegacy.value;
    if (!legacyRaw) return;
    try {
      const migrated = rootTemplate();
      migrated.chapters[1] = normalizeChapter(JSON.parse(legacyRaw), 1);
      window.HoshiCore.writeRaw(STORAGE_KEY, JSON.stringify(migrated), selectedLanguage);
    } catch (error) {}
  };

  migrateLegacyState();
  const progressStore = window.HoshiCore.createProgressStore({
    key: STORAGE_KEY,
    defaults: rootTemplate,
    normalize: normalizeRootState,
    language: selectedLanguage
  });
  let rootState = progressStore.load();
  rootState.view = rootState.view === 'chapter' ? 'chapter' : 'map';
  const implementedChapters = new Set(
    [...document.querySelectorAll('[data-menu-chapter]:not([disabled])')]
      .map(button => Number(button.dataset.menuChapter))
      .filter(Number.isFinite)
  );
  if (!implementedChapters.size) implementedChapters.add(1);
  let currentChapter = implementedChapters.has(Number(rootState.currentChapter))
    ? Number(rootState.currentChapter)
    : 1;
  const chapterController = window.HoshiCore.createChapterController({
    initial: currentChapter,
    available: implementedChapters
  });
  rootState.currentChapter = currentChapter;
  let state = rootState.chapters[currentChapter];

  const initialChapterView = document.querySelector('[data-chapter-view]');
  const chapterSources = new Map();
  const firstChapterSource = document.createElement('template');
  firstChapterSource.content.append(...[...initialChapterView.childNodes].map(node => node.cloneNode(true)));
  chapterSources.set(1, firstChapterSource);
  document.querySelectorAll('template[data-chapter-content]').forEach(source => {
    chapterSources.set(Number(source.dataset.chapterContent), source);
  });

  const mountChapterContent = chapterNumber => {
    const source = chapterSources.get(Number(chapterNumber));
    if (!source) return false;
    initialChapterView.replaceChildren(source.content.cloneNode(true));
    const definition = chapterDefinition(chapterNumber);
    initialChapterView.setAttribute(
      'aria-label',
      selectedLanguage === 'en'
        ? `Chapter ${chapterNumber}: ${definition.title.en}`
        : `Глава ${chapterNumber}: ${definition.title.ru}`
    );
    return true;
  };

  mountChapterContent(currentChapter);

  const save = () => {
    rootState.currentChapter = currentChapter;
    rootState.chapters[currentChapter] = state;
    progressStore.save(rootState);
  };

  const uiByLanguage = {
    ru: {
      menu: 'Главы',
      journey: 'Путешествие Хоси',
      allChapters: 'Все главы',
      guide: 'Памятка для родителей',
      guideCopy: 'Как бережно помогать при чтении',
      map: 'К карте путешествия',
      mapCopy: 'Выбрать место на карте',
      switchTitle: 'Английский прогресс',
      switchCopy: 'Перейти к прогрессу на английском языке',
      switchBadge: 'EN',
      open: 'Открыть главу',
      started: 'Глава начата',
      complete: 'Глава пройдена',
      soon: 'В разработке',
      restart: 'Заново',
      chapterTitle: 'Праздник лепестков',
      reward: 'Награда главы 1',
      screen: (number, total) => `Экран ${number} из ${total}`,
      progress: 'Прогресс',
      pathOpen: 'Путь открыт',
      correct: 'Верно!',
      thinkAgain: 'Подумай ещё…',
      branchStatus: count => `Найдено: ${count} из 3`,
      multiStatus: count => `Выбрано: ${count} из 2`,
      twoSelected: 'Сначала убери один выбранный вариант.',
      multiCorrect: 'Верно! Помощь — это сделать то, о чём попросили.',
      multiHint: 'Перечитай варианты и выбери два действия, после которых друзьям действительно стало бы легче.',
      grammarCorrect: 'Верно! Все окончания прочитаны внимательно.',
      grammarHint: 'Посмотри, кто выполняет действие: один герой или несколько?',
      grammarRetry: 'Исправь серые варианты: выбери другое слово и снова нажми «Проверить».',
      rewardBack: 'Вернуться к героям',
      rewardReal: 'А как это выглядит в Японии?',
      readingTogether: 'Совместное чтение',
      parentTitle: 'Как помогать ребёнку при чтении',
      parentIntro: 'Короткая памятка для спокойного чтения без гонки за скоростью.',
      restartTitle: 'Начать главу заново?',
      restartCopy: 'Прогресс текущей главы сбросится. Другие главы сохранятся.',
      restartConfirm: 'Начать заново',
      cancel: 'Отмена',
      close: 'Закрыть',
      guideItems: [
        'Сначала дайте ребёнку попробовать прочитать слово самостоятельно.',
        'Не называйте всё слово сразу. Помогите прочитать первую часть, затем обратите внимание на конец слова.',
        'Соедините части и спокойно прочитайте слово целиком.',
        'После исправления вернитесь к предложению, но не заставляйте перечитывать большой отрывок.',
        'Если ребёнок сам заметил ошибку и исправился, не возвращайтесь к ней ещё раз. Это уже успешное чтение.',
        'Отмечайте усилие, внимательность и самостоятельное исправление, а не скорость.',
        'Если ребёнок устал, остановитесь на текущем экране. Прогресс сохранится.'
      ],
      hints: {
        screen3: 'Перечитай, что Куро сделал сразу после своего появления.',
        screen6a: 'Перечитай первую реплику Хоси.',
        screen6b: 'Сравни ответ Куро с текстом.'
      }
    },
    en: {
      menu: 'Chapters',
      journey: 'Hoshi’s Journey',
      allChapters: 'All Chapters',
      guide: 'Guide for Parents',
      guideCopy: 'How to support a child while reading',
      map: 'Back to the journey map',
      mapCopy: 'Choose a place on the map',
      switchTitle: 'Russian progress',
      switchCopy: 'Switch to progress in Russian',
      switchBadge: 'RU',
      open: 'Open chapter',
      started: 'Chapter started',
      complete: 'Chapter complete',
      soon: 'In development',
      restart: 'Restart',
      chapterTitle: 'Petal Festival',
      reward: 'Chapter 1 reward',
      screen: (number, total) => `Screen ${number} of ${total}`,
      progress: 'Progress',
      pathOpen: 'Path unlocked',
      correct: 'Correct!',
      thinkAgain: 'Think again…',
      branchStatus: count => `Found: ${count} of 3`,
      multiStatus: count => `Selected: ${count} of 2`,
      twoSelected: 'Remove one selected answer first.',
      multiCorrect: 'Correct! Helping means doing what someone asked you to do.',
      multiHint: 'Read the options again and choose the two actions that would truly make things easier for the friends.',
      grammarCorrect: 'Correct! Every word was read carefully.',
      grammarHint: 'Look closely at the exact word used in the sentence.',
      grammarRetry: 'Change the grey answers, choose another word, and press “Check” again.',
      rewardBack: 'Back to the characters',
      rewardReal: 'What does this look like in Japan?',
      readingTogether: 'Reading together',
      parentTitle: 'How to support a child while reading',
      parentIntro: 'A short guide for calm reading without racing for speed.',
      restartTitle: 'Restart this chapter?',
      restartCopy: 'This chapter’s progress will reset. Other chapters will stay saved.',
      restartConfirm: 'Restart',
      cancel: 'Cancel',
      close: 'Close',
      guideItems: [
        'First, give the child time to try reading the word independently.',
        'Do not say the whole word immediately. Help with the first part, then draw attention to the ending.',
        'Blend the parts and calmly read the whole word.',
        'After correcting the word, return to the sentence, but do not make the child reread a long passage.',
        'If the child notices and corrects an error independently, do not revisit it. That is already successful reading.',
        'Notice effort, attention, and self-correction rather than speed.',
        'If the child is tired, stop on the current screen. Progress will be saved.'
      ],
      hints: {
        screen3: 'Read what Kuro did immediately after he appeared.',
        screen6a: 'Read Hoshi’s first line again.',
        screen6b: 'Compare Kuro’s answer with the story.'
      }
    }
  };
  const baseUi = uiByLanguage[selectedLanguage];
  const ui = { ...baseUi, hints: { ...baseUi.hints } };
  const refreshChapterUi = () => {
    const definition = chapterDefinition(currentChapter);
    Object.assign(ui, {
      chapterTitle: definition.title[selectedLanguage],
      reward: baseUi.reward,
      multiCorrect: baseUi.multiCorrect,
      multiHint: baseUi.multiHint,
      grammarCorrect: baseUi.grammarCorrect,
      hints: { ...baseUi.hints }
    });
    if (currentChapter === 3) {
      Object.assign(ui, selectedLanguage === 'en' ? {
        chapterTitle: 'A Road for the Moon',
        reward: 'Chapter 3 reward'
      } : {
        chapterTitle: 'Дорога для луны',
        reward: 'Награда главы 3'
      });
      return;
    }
    if (currentChapter !== 2) return;
    Object.assign(ui, selectedLanguage === 'en' ? {
      chapterTitle: 'Heavenly Post',
      reward: 'Chapter 2 reward',
      multiCorrect: 'Correct! Kuro needed to ask before taking the tanzaku.',
      multiHint: 'Choose the two questions that would help Kuro understand what the others wanted.',
      grammarCorrect: 'Correct! Every ending matches the character doing the action.',
      hints: {
        screen3: 'Read Grandma’s advice before everyone begins writing.',
        screen6a: 'Notice how Kuro presents the first flight.',
        screen6b: 'Read the instruction above the answers once more.'
      }
    } : {
      chapterTitle: 'Небесная почта',
      reward: 'Награда главы 2',
      multiCorrect: 'Верно! Куро стоило сначала спросить, прежде чем забирать тандзаку.',
      multiHint: 'Выбери два вопроса, которые помогли бы Куро понять, чего хотели остальные.',
      grammarCorrect: 'Верно! Все окончания подходят к тому, кто выполняет действие.',
      hints: {
        screen3: 'Перечитай совет бабушки перед тем, как друзья начали писать.',
        screen6a: 'Обрати внимание, как Куро представляет первый полёт.',
        screen6b: 'Ещё раз прочитай задание над вариантами.'
      }
    });
  };
  refreshChapterUi();

  const EN_TEXT = new Map(Object.entries({
    'Часть 1 · Японские духи': 'Part 1 · Japanese Spirits',
    'Часть 2 · Японские традиции': 'Part 2 · Japanese Traditions',
    'Часть 2': 'Part 2',
    'Японские традиции': 'Japanese Traditions',
    'Глава 1': 'Chapter 1',
    'Глава 2': 'Chapter 2',
    'Глава 3': 'Chapter 3',
    'Глава 4': 'Chapter 4',
    'Финал': 'Finale',
    'Ханами': 'Hanami',
    'Танабата': 'Tanabata',
    'Цукими': 'Tsukimi',
    'Сэцубун': 'Setsubun',
    'Русский прогресс': 'Russian progress',
    'Тайна Куро': 'Kuro’s Secret',
    'Глава 1 · Экран 1': 'Chapter 1 · Screen 1',
    'Глава 1 · Экран 2': 'Chapter 1 · Screen 2',
    'Глава 1 · Экран 3': 'Chapter 1 · Screen 3',
    'Глава 1 · Экран 4': 'Chapter 1 · Screen 4',
    'Глава 1 · Экран 5': 'Chapter 1 · Screen 5',
    'Глава 1 · Экран 6': 'Chapter 1 · Screen 6',
    'Глава 1 · Экран 7': 'Chapter 1 · Screen 7',
    'Награда главы 1': 'Chapter 1 Reward',
    'Розовое облако': 'The Pink Cloud',
    'Будущая иллюстрация: Хоси замечает цветущую сакуру': 'Future illustration: Hoshi notices the cherry blossoms',
    'Пока здесь проверяется механика поиска.': 'This placeholder is being used to test the search activity.',
    'Нажми на три цветущие ветки на картинке': 'Tap the three flowering branches in the picture',
    'После путешествия через заснеженный лес и Долину туманов у Хоси появились настоящие друзья.': 'After travelling through the snowy forest and the Valley of Mist, Hoshi had found true friends.',
    'Тем временем зима понемногу отступала. Снег растаял, и однажды утром началось новое приключение.': 'Meanwhile, winter slowly faded. The snow melted, and one morning a new adventure began.',
    'На рассвете Хоси увидела над лесом розовое облако.': 'At dawn, Hoshi saw a pink cloud above the forest.',
    'Но облако не плыло по небу. Оно тихо качалось над деревьями.': 'But the cloud was not floating across the sky. It was gently swaying above the trees.',
    '— Сакура расцвела! — догадалась Хоси.': '“The cherry trees are blooming!” Hoshi realised.',
    'Она позвала Понту и Бико на весенний праздник.': 'She invited Ponta and Biko to the spring celebration.',
    'Посмотрим поближе': 'Let’s take a closer look',
    'Слова перед праздником': 'Words Before the Festival',
    'Эти слова скоро встретятся в истории': 'These words will appear in the story',
    'Нажми на слово: оно раскроется по слогам. Нажми ещё раз, чтобы собрать его целиком.': 'Tap a word to split it into parts. Tap it again to put the whole word back together.',
    'любоваться': 'admire',
    'расстелили': 'spread out',
    'закружились': 'swirled',
    'Под цветущим деревом друзья расстелили покрывало.': 'Under a flowering tree, the friends worked together to spread out a blanket.',
    'Понта поставил корзинку с угощением. Бико осторожно положила рядом чашки.': 'Ponta set down a basket of treats. Biko carefully placed the cups beside it.',
    '— Сегодня у нас ханами, — сказала Хоси. — Будем любоваться сакурой.': '“Today we are celebrating hanami,” said Hoshi. “We will admire the cherry blossoms.”',
    'Несколько лепестков уже закружились в воздухе.': 'Several petals were already swirling in the air.',
    'Всё готово': 'Everything is ready',
    'Незваный знаток': 'The Uninvited Expert',
    'Будущая иллюстрация: первое появление Куро': 'Future illustration: Kuro’s first appearance',
    'Чёрная птица спускается с ветки к героям.': 'A black bird flies down from a branch towards the friends.',
    'Друзья ещё не успели сесть, как над ними промелькнула чёрная тень.': 'Before the friends could sit down, a black shadow flashed above them.',
    '— Эй-эй-эй! Стоп-стоп-стоп!': '“Hey, hey, hey! Stop, stop, stop!”',
    'На ветку опустилась чёрная птица в тёмно-синей одежде.': 'A black bird in dark blue clothes landed on a branch.',
    '— Я Куро, великий знаток праздников. Вы всё приготовили неправильно!': '“I am Kuro, the great festival expert. You prepared everything incorrectly!”',
    'Он спрыгнул на землю и потянул покрывало в сторону.': 'He jumped to the ground and pulled the blanket aside.',
    '— Здесь мало лепестков. Сейчас я всё исправлю. Не благодарите.': '“There are not enough petals here. I will fix everything. No need to thank me.”',
    'Друзья переглянулись. Неужели Куро действительно знал, как проводить ханами?': 'The friends exchanged glances. Did Kuro really know how to celebrate hanami?',
    'Что Куро решил сделать, не спросив остальных?': 'What did Kuro decide to do without asking the others?',
    'Позвать ещё гостей': 'Invite more guests',
    'Передвинуть покрывало': 'Move the blanket',
    'Принести чашки': 'Bring the cups',
    'Собрать опавшие лепестки': 'Collect fallen petals',
    'Проверить': 'Check',
    'Посмотрим, как он поможет': 'Let’s see what he does',
    'Помощь или вмешательство?': 'Helping or Interfering?',
    'Хотя друзья уже расстелили покрывало, Куро потянул его к другому дереву.': 'Although the friends had already spread out the blanket, Kuro pulled it towards another tree.',
    'Потом он передвинул корзинку на солнце и переставил все чашки.': 'Then he moved the basket into the sun and rearranged all the cups.',
    '— Может быть, сначала спросишь нас? — тихо сказала Бико.': '“Perhaps you could ask us first?” Biko said quietly.',
    '— Некогда! Лепесткам тоже нужна помощь.': '“No time! The petals need help too.”',
    'Куро подлетел к нижней ветке сакуры и протянул к ней крыло.': 'Kuro flew to a low cherry branch and reached towards it with one wing.',
    '— Сейчас устроим настоящий розовый дождь!': '“Now we will make a real pink rainstorm!”',
    'Какие два действия действительно были бы помощью?': 'Which two actions would truly be helpful?',
    'Выбери два ответа.': 'Choose two answers.',
    'Поставить корзинку туда, куда попросили': 'Put the basket where the friends asked',
    'Передвинуть всё по-своему': 'Move everything his own way',
    'Принести то, о чём попросили': 'Bring what someone asked for',
    'Потрясти цветущую ветку': 'Shake a flowering branch',
    'Остановим Куро': 'Let’s stop Kuro',
    'Розовый дождь': 'Pink Rain',
    'Куро уже потянулся к ветке.': 'Kuro was already reaching for the branch.',
    '— Эй-эй-эй! Теперь действительно стоп! — крикнул Понта.': '“Hey, hey, hey! Now you really must stop!” Ponta shouted.',
    '— Не трогай сакуру! — добавила Хоси.': '“Do not touch the cherry tree!” Hoshi added.',
    'Но в этот момент налетел ветер.': 'Just then, a gust of wind arrived.',
    'Продолжи историю': 'Continue the Story',
    'Выбери целое слово для каждого предложения.': 'Choose the exact whole word for each sentence.',
    'Ветка…': 'The branch…',
    'Лепестки…': 'The petals…',
    'Бико…': 'Biko…',
    'Ветка качнулась. Лепестки закружились над поляной и медленно опустились на покрывало.': 'The branch swayed. Petals swirled above the clearing and slowly settled on the blanket.',
    'Бико встрепенулась и замерла от восхищения. Понта попытался поймать лепесток носом.': 'Biko perked up and froze in wonder. Ponta tried to catch a petal on his nose.',
    'Куро гордо расправил крылья.': 'Kuro proudly spread his wings.',
    '— Видели? Всё получилось благодаря мне!': '“Did you see that? It all worked because of me!”',
    'Будущая статичная иллюстрация': 'Future static illustration',
    'Лепесток лежит на носу Понты, Бико смотрит на цветы, а Хоси — на Куро. Без анимации.': 'A petal rests on Ponta’s nose, Biko looks at the flowers, and Hoshi looks at Kuro. No animation.',
    'Так ли это?': 'Is that really true?',
    'Блестящее объяснение Куро': 'Kuro’s Brilliant Explanation',
    'Хоси внимательно посмотрела на Куро.': 'Hoshi looked carefully at Kuro.',
    '— Ветер поднял лепестки раньше, чем ты тронул ветку.': '“The wind lifted the petals before you touched the branch.”',
    '— Именно так я всё и задумал, — ответил Куро.': '“That is exactly what I planned,” Kuro replied.',
    '— А корзинку зачем поставил на солнце? — спросил Понта.': '“Then why did you put the basket in the sun?” Ponta asked.',
    '— Чтобы угощение стало теплее.': '“To make the treats warmer.”',
    '— И покрывало передвинул?': '“And why did you move the blanket?”',
    '— Я проверял, заметите ли вы.': '“I was checking whether you would notice.”',
    'Бико прикрыла рот лапками, чтобы не рассмеяться.': 'Biko covered her mouth with her paws so she would not laugh.',
    'Что произошло на самом деле?': 'What really happened?',
    'Куро встряхнул ветку': 'Kuro shook the branch',
    'Ветер поднял лепестки': 'The wind lifted the petals',
    'Хоси подбросила лепестки': 'Hoshi tossed the petals',
    'Следующий вопрос': 'Next question',
    'Как Куро попытался выдать это за свой план?': 'How did Kuro pretend it had been his plan?',
    '«Именно так я всё и задумал»': '“That is exactly what I planned”',
    '«Я не заметил ветра»': '“I did not notice the wind”',
    '«Это сделала Хоси»': '“Hoshi did it”',
    '— Удобно ты всё задумал. Особенно ветер, — сказал Понта.': '“A very convenient plan. Especially the wind,” said Ponta.',
    'Что ответит Куро?': 'What will Kuro say?',
    'Чёрное перо': 'The Black Feather',
    'Хоси подняла с покрывала розовый лепесток.': 'Hoshi picked up a pink petal from the blanket.',
    '— Розовый дождь не нужно устраивать, — сказала она. — На ханами приходят любоваться цветами. Сакура справится сама.': '“There is no need to make pink rain,” she said. “People come to hanami to admire the flowers. The cherry tree can manage on its own.”',
    'Куро посмотрел на ветку, которую едва не потревожил.': 'Kuro looked at the branch he had almost disturbed.',
    '— Я просто хотел сделать праздник зрелищнее. А вы всё делаете по старым правилам.': '“I only wanted to make the festival more spectacular. You do everything by old rules.”',
    '— Традиции появились не просто так, — ответила Хоси. — Они помогают любоваться цветами и беречь деревья.': '“Traditions exist for a reason,” Hoshi replied. “They help us enjoy the flowers and protect the trees.”',
    'Куро поправил маленькую шапочку.': 'Kuro adjusted his little hat.',
    '— Я это знал. Просто хотел проверить вас.': '“I knew that. I only wanted to test you.”',
    '— И как, мы справились? — спросил Понта.': '“So, did we pass?” Ponta asked.',
    '— Вам ещё нужно потренироваться, — важно ответил Куро.': '“You still need more practice,” Kuro replied grandly.',
    'Он взмахнул крыльями и исчез между деревьями.': 'He flapped his wings and disappeared between the trees.',
    'На покрывале осталось одно чёрное перо.': 'One black feather remained on the blanket.',
    'Коснись чёрного пера': 'Tap the black feather',
    'Нажми на чёрное перо': 'Tap the black feather',
    'Найди чёрное перо на картинке и нажми на него': 'Find the black feather in the picture and tap it',
    'Первая улика': 'First clue',
    'Первая улика найдена': 'First clue found',
    'Открыть награду': 'Open the reward',
    'Настоящее ханами': 'Real Hanami',
    'Будущая сказочная иллюстрация': 'Future story illustration',
    'Хоси, Понта и Бико под сакурой. Куро наблюдает с дальней ветки.': 'Hoshi, Ponta, and Biko sit beneath the cherry blossoms. Kuro watches from a distant branch.',
    'Место для настоящей фотографии ханами в Японии': 'Place for a real photograph of hanami in Japan',
    'Нажми на иллюстрацию — карточка перевернётся': 'Tap the illustration to turn the card over',
    'Что означает «ханами»?': 'What does “hanami” mean?',
    '«Хана» по-японски означает «цветы», а «ми» — «смотреть». Получается: «любоваться цветами».': 'In Japanese, “hana” means “flowers,” and “mi” means “to look.” Together, hanami means “admiring the flowers.”',
    'Почему все ждут сакуру?': 'Why does everyone wait for the cherry blossoms?',
    'Сакура цветёт совсем недолго. Поэтому японцы стараются не пропустить эти несколько красивых дней.': 'Cherry blossoms last only a short time, so people in Japan try not to miss these few beautiful days.',
    'Что делают на ханами?': 'What do people do at hanami?',
    'Люди гуляют, устраивают пикники и рассматривают цветущие деревья. А вечером сакуру иногда подсвечивают фонарями — это называется ёдзакура.': 'People take walks, have picnics, and admire the blooming trees. In the evening, cherry blossoms are sometimes lit by lanterns — this is called yozakura.',
    'А как это выглядит в Японии?': 'What does this look like in Japan?',
    'Вернуться на карту': 'Back to the map'
  }));

  const translateTextNodes = () => {
    if (selectedLanguage !== 'en') return;

    document.querySelectorAll('[data-en]').forEach(element => {
      element.textContent = element.dataset.en;
    });

    document.querySelectorAll('[data-en-alt]').forEach(element => {
      element.alt = element.dataset.enAlt;
    });

    document.querySelectorAll('[data-en-aria-label]').forEach(element => {
      element.setAttribute('aria-label', element.dataset.enAriaLabel);
    });

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const value = node.nodeValue;
      const trimmed = value.trim();
      const translated = EN_TEXT.get(trimmed);
      if (!translated) return;
      node.nodeValue = value.replace(trimmed, translated);
    });

    const words = {
      admire: ['together', 'to-geth-er'],
      spread: ['carefully', 'care-ful-ly'],
      swirled: ['celebrating', 'cel-e-brat-ing']
    };
    document.querySelectorAll('[data-word]').forEach(button => {
      const translatedWord = words[button.dataset.word];
      const whole = button.dataset.enWhole || translatedWord?.[0] || button.dataset.whole;
      const parts = button.dataset.enParts || translatedWord?.[1] || button.dataset.parts;
      button.dataset.whole = whole;
      button.dataset.parts = parts;
      button.textContent = whole;
    });

    const grammarRows = [...document.querySelectorAll('[data-grammar-row]')];
    const grammar = [
      { correct: 'swayed', choices: ['swayed', 'sway'] },
      { correct: 'swirled', choices: ['swirl', 'swirled'] },
      { correct: 'froze', choices: ['freezes', 'froze'] }
    ];
    if (currentChapter === 1) {
      grammarRows.forEach((row, rowIndex) => {
        row.dataset.correctValue = grammar[rowIndex].correct;
        row.querySelectorAll('.grammar-choice').forEach((choice, choiceIndex) => {
          const value = grammar[rowIndex].choices[choiceIndex];
          choice.dataset.value = value;
          choice.textContent = value;
        });
      });
    }

    const attributeTranslations = {
      'Выбор части путешествия': 'Choose a journey part',
      'Выбор языкового прогресса': 'Choose language progress',
      'Карта второй части путешествия Хоси': 'Map of part two of Hoshi’s journey',
      'Глава 1: Праздник лепестков': 'Chapter 1: Petal Festival',
      'Заглушка будущей иллюстрации с цветущей сакурой': 'Placeholder for a future illustration of blooming cherry trees',
      'Карта японских традиций: ханами, Танабата, Цукими, Сэцубун и финальная встреча с Куро': 'Map of Japanese traditions: Hanami, Tanabata, Tsukimi, Setsubun, and the final meeting with Kuro',
      'Открыть главу 1: Ханами': 'Open Chapter 1: Hanami',
      'Глава 2: Танабата, в разработке': 'Chapter 2: Tanabata, in development',
      'Глава 3: Цукими, в разработке': 'Chapter 3: Tsukimi, in development',
      'Глава 4: Сэцубун, в разработке': 'Chapter 4: Setsubun, in development',
      'Финал: тайна Куро, в разработке': 'Finale: Kuro’s Secret, in development',
      'Открыть список глав': 'Open chapter list',
      'Начать текущую главу заново': 'Restart the current chapter',
      'Закрыть список глав': 'Close chapter list',
      'Закрыть памятку': 'Close parent guide',
      'Закрыть': 'Close',
      'Отмена': 'Cancel',
      'Собрать чёрное перо': 'Collect the black feather',
      'Перевернуть карточку и увидеть настоящее ханами': 'Turn the card over to see real hanami',
      'Хоси рассматривает три цветущие ветки сакуры рядом со своим храмом': 'Hoshi looks at three flowering cherry branches beside her shrine',
      'Куро впервые появляется перед Хоси, Понтой и Бико на празднике ханами': 'Kuro appears before Hoshi, Ponta, and Biko for the first time at their hanami picnic',
      'Хоси, Понта и Бико радуются лепесткам сакуры, которые подхватил ветер': 'Hoshi, Ponta, and Biko delight in the cherry petals carried by the wind',
      'Хоси объясняет Куро традицию ханами; рядом с Куро на покрывале лежит чёрное перо': 'Hoshi explains the hanami tradition to Kuro; a black feather lies on the blanket beside him',
      'Выбрать длинную верхнюю ветку сакуры': 'Select the long upper cherry branch',
      'Выбрать короткую верхнюю ветку сакуры': 'Select the short upper cherry branch',
      'Выбрать нижнюю ветку сакуры': 'Select the lower cherry branch'
      , 'Заглушка будущей иллюстрации': 'Future illustration placeholder'
      , 'Временные зоны задания': 'Temporary activity areas'
      , 'Перевернуть карточку и увидеть настоящую Танабату': 'Turn the card over to see a real Tanabata celebration'
    };
    document.querySelectorAll('[aria-label]').forEach(element => {
      const translated = attributeTranslations[element.getAttribute('aria-label')];
      if (translated) element.setAttribute('aria-label', translated);
    });
    const mapIllustration = document.querySelector('[data-map-image]');
    if (mapIllustration) {
      mapIllustration.alt = 'Map of Japanese traditions: Hanami, Tanabata, Tsukimi, Setsubun, and the final meeting with Kuro';
    }
  };

  const mapView = document.querySelector('[data-map-view]');
  const chapterView = document.querySelector('[data-chapter-view]');
  const partSwitch = document.querySelector('.part-switch');
  let progressLabel;
  let progressReadable;
  let progressStatus;
  let progressFlames = [];
  const refreshChapterElements = () => {
    progressLabel = chapterView.querySelector('[data-progress-label]');
    progressReadable = chapterView.querySelector('[data-progress-readable]');
    progressStatus = chapterView.querySelector('[data-progress-status]');
    progressFlames = [...chapterView.querySelectorAll('.progress-flame')];
  };
  refreshChapterElements();
  const currentChapterMapStop = () =>
    document.querySelector(`[data-open-chapter="${currentChapter}"]`);
  const chapterDialog = document.querySelector('[data-chapter-dialog]');
  const parentGuideDialog = document.querySelector('[data-parent-guide-dialog]');
  const restartDialog = document.querySelector('[data-restart-dialog]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  const applyDocumentMetadata = () => {
    const english = selectedLanguage === 'en';
    const title = english
      ? 'Hoshi’s Journey — Japanese Traditions'
      : 'Путь Хоси — японские традиции';
    const description = english
      ? 'Part two of Hoshi’s interactive journey: Japanese traditions, story reading, and close-reading activities.'
      : 'Вторая часть интерактивного путешествия Хоси: японские традиции, сюжетное чтение и задания на внимательность.';
    const socialDescription = english
      ? 'Interactive stories and close-reading activities for children.'
      : 'Интерактивные истории и задания для внимательного чтения.';

    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', socialDescription);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', socialDescription);

    const structuredData = document.querySelector('script[type="application/ld+json"]');
    if (structuredData) {
      try {
        const data = JSON.parse(structuredData.textContent);
        data.name = title;
        data.description = description;
        structuredData.textContent = JSON.stringify(data);
      } catch (error) {}
    }
  };

  const applyInterfaceLanguage = () => {
    applyDocumentMetadata();
    setText('[data-menu-button-label]', ui.menu);
    setText('[data-journey-kicker]', ui.journey);
    setText('[data-all-chapters-title]', ui.allChapters);
    setText('[data-guide-title]', ui.guide);
    setText('[data-guide-copy]', ui.guideCopy);
    setText('[data-map-link-title]', ui.map);
    setText('[data-map-link-copy]', ui.mapCopy);
    setText('[data-language-badge]', ui.switchBadge);
    setText('[data-language-switch-title]', ui.switchTitle);
    setText('[data-language-switch-copy]', ui.switchCopy);
    setText('[data-toolbar-chapter-title]', ui.chapterTitle);
    setText('[data-restart-label]', ui.restart);
    setText('[data-progress-title]', ui.progress);
    setText('[data-reading-together]', ui.readingTogether);
    setText('[data-parent-guide-title]', ui.parentTitle);
    setText('[data-parent-guide-intro]', ui.parentIntro);
    setText('[data-restart-title]', ui.restartTitle);
    setText('[data-restart-copy]', ui.restartCopy);
    setText('[data-restart-confirm]', ui.restartConfirm);
    setText(
      '[data-multi-status]',
      ui.multiStatus(document.querySelectorAll('[data-multi-task] .answer.selected').length)
    );

    restartDialog.querySelectorAll('[data-restart-cancel]').forEach(button => {
      if (button.classList.contains('restart-cancel')) button.textContent = ui.cancel;
      button.setAttribute('aria-label', ui.cancel);
    });
    document.querySelectorAll('[data-guide-item]').forEach((item, index) => {
      item.textContent = ui.guideItems[index];
    });
    document.querySelectorAll('.dialog-close').forEach(button => {
      button.setAttribute('aria-label', ui.close);
    });
    document.querySelectorAll('[data-chapter-status]').forEach(status => {
      status.textContent = status.dataset.chapterStatus === '1' ? ui.open : ui.soon;
    });
    document.querySelectorAll('[data-map-development]').forEach(status => {
      status.textContent = ui.soon;
    });
  };

  const shuffled = values => {
    const list = [...values];
    for (let index = list.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [list[index], list[other]] = [list[other], list[index]];
    }
    return list;
  };

  const shuffleChapterOptions = () => {
    chapterView.querySelectorAll('[data-shuffle]').forEach(container => {
      shuffled(container.children).forEach(child => container.append(child));
    });
  };

  const currentScreen = () => chapterView.querySelector(`[data-screen="${state.screen}"]`);

  const updateProgress = () => {
    const screenCount = chapterDefinition(currentChapter).screenCount;
    const rewardScreen = screenCount + 1;
    const readableScreen = Math.min(state.screen, screenCount);
    progressLabel.textContent = state.screen === rewardScreen ? ui.reward : ui.screen(state.screen, screenCount);
    progressReadable.textContent = `${readableScreen} / ${screenCount}`;
    progressStatus.textContent = state.screen === rewardScreen ? ui.reward : ui.screen(state.screen, screenCount);
    progressFlames.forEach((flame, index) => {
      flame.hidden = index >= screenCount;
      flame.classList.toggle('on', index < readableScreen && index < screenCount);
    });
  };

  const updateNavigationState = () => {
    document.querySelectorAll('[data-menu-chapter]').forEach(chapterCard => {
      const chapterNumber = Number(chapterCard.dataset.menuChapter);
      const chapterState = rootState.chapters[chapterNumber];
      const isCurrent = chapterNumber === currentChapter;
      chapterCard.classList.toggle('completed', Boolean(chapterState?.completed));
      chapterCard.classList.toggle('current', isCurrent);
      if (isCurrent) chapterCard.setAttribute('aria-current', 'page');
      else chapterCard.removeAttribute('aria-current');

      const status = chapterCard.querySelector('[data-chapter-status]');
      if (!status) return;
      status.textContent = chapterCard.disabled
        ? ui.soon
        : chapterState?.completed
          ? ui.complete
          : chapterState?.screen > 1
            ? ui.started
            : ui.open;
    });
    const chapterNames = selectedLanguage === 'en'
      ? { 1: 'Hanami', 2: 'Tanabata', 3: 'Tsukimi' }
      : { 1: 'Ханами', 2: 'Танабата', 3: 'Цукими' };
    document.querySelectorAll('[data-open-chapter]').forEach(chapterMapStop => {
      const chapterNumber = Number(chapterMapStop.dataset.openChapter);
      const chapterState = rootState.chapters[chapterNumber];
      chapterMapStop.classList.toggle('completed', Boolean(chapterState?.completed));
      chapterMapStop.classList.toggle('started', Boolean(chapterState?.screen > 1 && !chapterState?.completed));
      chapterMapStop.setAttribute(
        'aria-label',
        selectedLanguage === 'en'
          ? `Open Chapter ${chapterNumber}: ${chapterNames[chapterNumber]}. ${chapterState?.completed ? ui.complete : chapterState?.screen > 1 ? ui.started : ui.open}`
          : `Открыть главу ${chapterNumber}: ${chapterNames[chapterNumber]}. ${chapterState?.completed ? ui.complete : chapterState?.screen > 1 ? ui.started : ui.open}`
      );
    });
  };

  let returnFocus = null;
  const openDialog = (dialog, trigger) => {
    returnFocus = trigger || document.activeElement;
    dialog.hidden = false;
    document.body.classList.add('dialog-open');
    dialog.querySelector('[role="dialog"] button:not([disabled])')?.focus();
  };

  const closeDialog = (dialog, { restoreFocus = true } = {}) => {
    const wasOpen = !dialog.hidden;
    dialog.hidden = true;
    if ([chapterDialog, parentGuideDialog, restartDialog].every(item => item.hidden)) {
      document.body.classList.remove('dialog-open');
    }
    if (wasOpen && restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  };

  const openChapterDialog = () => {
    updateNavigationState();
    document.querySelector('[data-chapter-menu]').setAttribute('aria-expanded', 'true');
    openDialog(chapterDialog, document.querySelector('[data-chapter-menu]'));
  };
  const closeChapterDialog = (options = {}) => {
    document.querySelector('[data-chapter-menu]').setAttribute('aria-expanded', 'false');
    closeDialog(chapterDialog, options);
  };
  const openParentGuide = () => {
    chapterDialog.hidden = true;
    document.querySelector('[data-chapter-menu]').setAttribute('aria-expanded', 'false');
    openDialog(parentGuideDialog, document.querySelector('[data-chapter-menu]'));
  };
  const closeParentGuide = () => closeDialog(parentGuideDialog);
  const openRestartDialog = () => {
    document.querySelector('[data-chapter-menu]')?.setAttribute('aria-expanded', 'false');
    openDialog(restartDialog, document.activeElement);
  };
  const closeRestartDialog = () => closeDialog(restartDialog);

  const focusHeading = screen => window.HoshiCore.focusFirstHeading(screen);

  const showScreen = (number, scroll = true) => {
    const rewardScreen = chapterDefinition(currentChapter).screenCount + 1;
    state.screen = Math.max(1, Math.min(rewardScreen, Number(number) || 1));
    chapterView.querySelectorAll('[data-screen]').forEach(screen => {
      screen.hidden = Number(screen.dataset.screen) > state.screen;
    });
    chapterView.querySelectorAll('[data-next-screen]').forEach(button => {
      const destination = Number(button.dataset.nextScreen);
      if (destination <= state.screen) {
        button.hidden = false;
        button.disabled = true;
        button.classList.add('opened');
        button.textContent = ui.pathOpen;
      }
    });
    updateProgress();
    save();
    updateNavigationState();
    if (scroll) {
      requestAnimationFrame(() => {
        const screen = currentScreen();
        screen?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
        setTimeout(() => focusHeading(screen), reducedMotion ? 0 : 350);
      });
    }
  };

  const showChapter = () => {
    closeChapterDialog({ restoreFocus: false });
    rootState.view = 'chapter';
    save();
    document.body.classList.remove('map-view-open');
    mapView.hidden = true;
    partSwitch.hidden = true;
    document.querySelector('.site-credit').hidden = true;
    chapterView.hidden = false;
    showScreen(state.screen, false);
    restore();
    requestAnimationFrame(() => {
      const screen = currentScreen();
      screen?.scrollIntoView({ behavior: 'auto', block: 'start' });
      focusHeading(screen);
    });
  };

  const prepareMountedChapter = () => {
    refreshChapterElements();
    refreshChapterUi();
    translateTextNodes();
    applyInterfaceLanguage();
    shuffleChapterOptions();
    bindChapterInteractions();
  };

  const openChapter = chapterNumber => {
    const nextChapter = Number(chapterNumber);
    const previousChapter = currentChapter;
    if (!chapterController.open(nextChapter)) return;
    currentChapter = chapterController.current;
    if (currentChapter !== previousChapter) {
      rootState.chapters[previousChapter] = state;
      rootState.currentChapter = currentChapter;
      rootState.view = 'chapter';
      state = rootState.chapters[currentChapter];
      save();
      mountChapterContent(currentChapter);
      prepareMountedChapter();
      showChapter();
      return;
    }
    currentChapter = nextChapter;
    rootState.currentChapter = currentChapter;
    state = rootState.chapters[currentChapter];
    showChapter();
  };

  const showMap = () => {
    closeChapterDialog({ restoreFocus: false });
    rootState.view = 'map';
    save();
    document.body.classList.add('map-view-open');
    chapterView.hidden = true;
    partSwitch.hidden = false;
    mapView.hidden = false;
    document.querySelector('.site-credit').hidden = false;
    updateNavigationState();
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    requestAnimationFrame(() => focusHeading(mapView));
  };

  const showFeedback = (task, message, good = false) => {
    const feedback = task.querySelector('[data-feedback]');
    if (!feedback) return;
    feedback.hidden = false;
    feedback.classList.toggle('good', good);
    feedback.classList.toggle('bad', !good);
    feedback.textContent = message;
  };

  const revealNext = screenNumber => {
    const button = chapterView.querySelector(`[data-screen="${screenNumber}"] [data-next-screen]`);
    if (button && Number(button.dataset.nextScreen) > state.screen) button.hidden = false;
  };

  const restoreBranches = () => {
    document.querySelectorAll('[data-branch]').forEach(button => {
      button.classList.toggle('found', state.branches.includes(button.dataset.branch));
    });
    const count = new Set(state.branches).size;
    const branchStatus = document.querySelector('[data-branch-status]');
    if (branchStatus) {
      branchStatus.textContent = ui.branchStatus(count);
      branchStatus.dataset.found = String(count);
    }
    if (count === 3) revealNext(1);
  };

  const restoreWords = () => {
    document.querySelectorAll('[data-word]').forEach(button => {
      const complete = state.words.includes(button.dataset.word);
      button.classList.toggle('viewed', complete);
      if (button.dataset.showingParts !== 'true' && button.dataset.showingParts !== 'false') {
        button.dataset.showingParts = 'false';
        button.textContent = button.dataset.whole;
      }
    });
    const story = document.querySelector('[data-screen2-story]');
    if (!story) return;
    const complete = new Set(state.words).size === 3;
    story.hidden = !complete;
    if (complete) revealNext(2);
  };

  const restoreFoundWords = () => {
    const buttons = [...chapterView.querySelectorAll('[data-find-word]')];
    if (!buttons.length) return;
    buttons.forEach(button => {
      button.classList.toggle('found', state.foundWords.includes(button.dataset.findWord));
    });
    chapterView.querySelectorAll('[data-find-target]').forEach(target => {
      target.classList.toggle('found', state.foundWords.includes(target.dataset.findTarget));
    });
    const status = chapterView.querySelector('[data-find-word-status]');
    const count = new Set(state.foundWords).size;
    if (status) {
      status.textContent = selectedLanguage === 'en'
        ? `Found: ${count} of ${buttons.length}`
        : `Найдено: ${count} из ${buttons.length}`;
    }
    if (count === buttons.length) revealNext(5);
  };

  const completeSingleTask = key => {
    const task = document.querySelector(`[data-single-task="${key}"]`);
    if (!task) return;
    const correctValue = task.dataset.correctValue;
    task.querySelectorAll('.answer').forEach(answer => {
      answer.disabled = true;
      answer.classList.remove('selected', 'wrong-choice');
      answer.classList.toggle('correct', answer.dataset.value === correctValue);
    });
    task.querySelector('[data-check]').hidden = true;
    if (!task.hasAttribute('data-silent-success') && !(currentChapter === 2 && (key === 'screen6a' || key === 'screen6b'))) {
      showFeedback(task, ui.correct, true);
    }

    const completeNext = Number(task.dataset.completeNext);
    if (completeNext) revealNext(completeNext);
    else if (key === 'screen3') revealNext(3);
    if (key === 'screen6a') {
      document.querySelector('[data-truth-line]').classList.add('highlight-line');
      document.querySelector('[data-screen6-next-step]').hidden = false;
    }
    if (key === 'screen6b') {
      document.querySelector('[data-excuse-line]').classList.add('highlight-line');
      const reaction = document.querySelector('[data-ponta-reaction]');
      if (reaction) reaction.hidden = false;
      revealNext(6);
    }
  };

  const restoreSolvedTasks = () => {
    chapterView.querySelectorAll('[data-single-task]').forEach(task => {
      if (state.solved[task.dataset.singleTask]) completeSingleTask(task.dataset.singleTask);
    });

    chapterView.querySelectorAll('[data-multi-task]').forEach(task => {
      const solvedKey = task.dataset.solvedKey || 'screen4';
      if (!state.solved[solvedKey]) return;
      task.querySelectorAll('.answer').forEach(answer => {
        answer.disabled = true;
        answer.classList.remove('selected', 'wrong-choice');
        answer.classList.toggle('correct', answer.dataset.correct === 'true');
      });
      task.querySelector('[data-check]').disabled = true;
      task.querySelector('[data-multi-status]').textContent = ui.multiStatus(2);
      const success = selectedLanguage === 'en'
        ? task.dataset.enSuccessMessage
        : task.dataset.successMessage;
      showFeedback(task, success || ui.multiCorrect, true);
      revealNext(Number(task.dataset.completeNext) || 4);
    });

    chapterView.querySelectorAll('[data-grammar-task]').forEach(task => {
      const solvedKey = task.dataset.solvedKey || 'screen5';
      if (!state.solved[solvedKey]) return;
      task.querySelectorAll('[data-grammar-row]').forEach(row => {
        row.querySelectorAll('.grammar-choice').forEach(choice => {
          choice.disabled = true;
          choice.classList.remove('selected', 'wrong-choice');
          choice.classList.toggle('correct', choice.dataset.value === row.dataset.correctValue);
        });
      });
      task.querySelector('[data-check]').disabled = true;
      showFeedback(task, ui.grammarCorrect, true);
      document.querySelector('[data-screen5-continuation]').hidden = false;
      revealNext(5);
    });
  };

  const restoreFeather = () => {
    const feather = document.querySelector('[data-feather]');
    const hint = document.querySelector('[data-feather-hint]');
    const slot = document.querySelector('[data-clue-slot]');
    if (!feather || !slot) return;
    feather.classList.toggle('collected', state.feather);
    if (hint) hint.hidden = state.feather;
    slot.classList.toggle('collected', state.feather);
    if (state.feather) revealNext(7);
  };

  const restoreScreen6 = () => {
    const step = Math.max(1, Math.min(2, Number(state.screen6Step) || 1));
    document.querySelectorAll('[data-screen6-step]').forEach(panel => {
      panel.hidden = Number(panel.dataset.screen6Step) !== step;
    });
  };

  const restoreReward = () => {
    const card = document.querySelector('[data-reward-card]');
    const hint = document.querySelector('[data-reward-hint]');
    if (!card || !hint) return;
    card.classList.toggle('flipped', state.rewardReal);
    card.setAttribute('aria-pressed', String(state.rewardReal));
    hint.textContent = selectedLanguage === 'en'
      ? 'Tap the illustration to turn the card over'
      : 'Нажми на иллюстрацию, чтобы карточка перевернулась';

    const openedFacts = new Set(state.factOpen);
    document.querySelectorAll('[data-hanami-fact]').forEach((button, index) => {
      const open = openedFacts.has(index);
      button.setAttribute('aria-expanded', String(open));
      button.closest('.hanami-fact').querySelector('[data-hanami-answer]').hidden = !open;
    });
  };

  function restore() {
    restoreBranches();
    restoreWords();
    restoreFoundWords();
    restoreSolvedTasks();
    restoreScreen6();
    restoreFeather();
    restoreReward();
    updateProgress();
  }

  const selectLanguage = language => {
    if (!['ru', 'en'].includes(language)) return;
    if (!window.HoshiCore.writeRaw(LANGUAGE_KEY, language, language)) return;
    location.reload();
  };

  function bindStaticInteractions() {
    mapView.querySelectorAll('[data-open-chapter]').forEach(button => {
      button.addEventListener('click', () => openChapter(button.dataset.openChapter));
    });
    chapterDialog.querySelectorAll('[data-chapter-dialog-close]').forEach(button => {
      button.addEventListener('click', closeChapterDialog);
    });
    document.querySelector('[data-parent-guide-open]').addEventListener('click', openParentGuide);
    parentGuideDialog.querySelectorAll('[data-parent-guide-close]').forEach(button => {
      button.addEventListener('click', closeParentGuide);
    });
    document.querySelector('[data-menu-back-map]').addEventListener('click', showMap);
    document.querySelectorAll('[data-menu-chapter]:not([disabled])').forEach(button => {
      button.addEventListener('click', () => openChapter(button.dataset.menuChapter));
    });
    document.querySelector('[data-switch-language]').addEventListener('click', () => {
      selectLanguage(selectedLanguage === 'en' ? 'ru' : 'en');
    });
    restartDialog.querySelectorAll('[data-restart-cancel]').forEach(button => {
      button.addEventListener('click', closeRestartDialog);
    });
    document.querySelector('[data-restart-confirm]').addEventListener('click', () => {
      rootState.chapters[currentChapter] = chapterTemplate(currentChapter);
      state = rootState.chapters[currentChapter];
      save();
      mountChapterContent(currentChapter);
      prepareMountedChapter();
      closeRestartDialog();
      showChapter();
    });
  }

  function bindChapterInteractions() {
    chapterView.querySelectorAll('[data-open-chapter]').forEach(button => {
      button.addEventListener('click', () => openChapter(button.dataset.openChapter));
    });
    chapterView.querySelectorAll('[data-back-map]').forEach(button => button.addEventListener('click', showMap));
    chapterView.querySelector('[data-chapter-menu]')?.addEventListener('click', openChapterDialog);
    chapterView.querySelector('[data-restart]')?.addEventListener('click', openRestartDialog);

    chapterView.querySelectorAll('[data-next-screen]').forEach(button => {
      button.addEventListener('click', () => {
      if (button.disabled) return;
      button.classList.add('opened');
      button.textContent = ui.pathOpen;
      button.disabled = true;
      const next = Number(button.dataset.nextScreen);
      if (next === chapterDefinition(currentChapter).screenCount + 1) {
        state.reward = true;
        state.completed = true;
      }
      showScreen(next);
      restore();
      });
    });

    chapterView.querySelector('[data-screen6-next-step]')?.addEventListener('click', () => {
      state.screen6Step = 2;
      save();
      restoreScreen6();
      const panel = chapterView.querySelector('[data-screen6-step="2"]');
      panel.querySelector('h3').tabIndex = -1;
      panel.querySelector('h3').focus();
    });

    chapterView.querySelectorAll('[data-branch]').forEach(button => {
      button.addEventListener('click', () => {
        if (!state.branches.includes(button.dataset.branch)) {
          state.branches.push(button.dataset.branch);
          save();
        }
        restoreBranches();
      });
    });

    chapterView.querySelectorAll('[data-word]').forEach(button => {
      button.addEventListener('click', () => {
        const showingParts = button.dataset.showingParts === 'true';
        if (!showingParts) {
          button.dataset.showingParts = 'true';
          button.textContent = button.dataset.parts;
        } else {
          button.dataset.showingParts = 'false';
          button.textContent = button.dataset.whole;
          if (!state.words.includes(button.dataset.word)) {
            state.words.push(button.dataset.word);
            save();
          }
        }
        restoreWords();
      });
    });

    chapterView.querySelectorAll('[data-word-hunt] .search-word').forEach(button => {
      button.addEventListener('click', () => {
        if (!button.dataset.findWord) {
          button.classList.remove('miss');
          void button.offsetWidth;
          button.classList.add('miss');
          return;
        }
        const isNewWord = !state.foundWords.includes(button.dataset.findWord);
        if (isNewWord) {
          state.foundWords.push(button.dataset.findWord);
          save();
        }
        restoreFoundWords();
      });
    });

    chapterView.querySelectorAll('[data-single-task]').forEach(task => {
      const key = task.dataset.singleTask;
      const check = task.querySelector('[data-check]');
      check.hidden = true;
      task.querySelectorAll('.answer').forEach(answer => {
        answer.addEventListener('click', () => {
          if (state.solved[key]) return;
          task.querySelectorAll('.answer').forEach(item => {
            item.classList.remove('selected', 'wrong-choice');
          });
          answer.classList.add('selected');
          if (answer.dataset.value === task.dataset.correctValue) {
            state.solved[key] = true;
            save();
            completeSingleTask(key);
          } else {
            answer.classList.remove('selected');
            answer.classList.add('wrong-choice');
            const localHint = selectedLanguage === 'en'
              ? task.dataset.enRetryMessage
              : task.dataset.retryMessage;
            showFeedback(task, localHint || `${ui.thinkAgain} ${ui.hints[key] || ''}`.trim(), false);
          }
        });
      });
    });

    const multiTask = chapterView.querySelector('[data-multi-task]');
    if (multiTask) {
      const solvedKey = multiTask.dataset.solvedKey || 'screen4';
      const multiCheck = multiTask.querySelector('[data-check]');
      const updateMultiStatus = () => {
        const count = multiTask.querySelectorAll('.answer.selected').length;
        const status = multiTask.querySelector('[data-multi-status]');
        if (status) status.textContent = ui.multiStatus(count);
      };
      multiTask.querySelectorAll('.answer').forEach(answer => {
        answer.addEventListener('click', () => {
          const selected = [...multiTask.querySelectorAll('.answer.selected')];
          if (!answer.classList.contains('selected') && selected.length === 2) {
            showFeedback(multiTask, ui.twoSelected, false);
            return;
          }
          answer.classList.remove('wrong-choice');
          answer.classList.toggle('selected');
          multiCheck.disabled = multiTask.querySelectorAll('.answer.selected').length !== 2;
          updateMultiStatus();
        });
      });
      multiCheck.addEventListener('click', () => {
        const selected = [...multiTask.querySelectorAll('.answer.selected')];
        const correct = selected.length === 2 && selected.every(answer => answer.dataset.correct === 'true');
        if (correct) {
          state.solved[solvedKey] = true;
          save();
          restoreSolvedTasks();
        } else {
          selected.forEach(answer => {
            answer.classList.remove('selected');
            answer.classList.add('wrong-choice');
          });
          multiCheck.disabled = true;
          updateMultiStatus();
          const retry = selectedLanguage === 'en'
            ? multiTask.dataset.enRetryMessage
            : multiTask.dataset.retryMessage;
          showFeedback(multiTask, retry || ui.multiHint, false);
        }
      });
    }

    const grammarTask = chapterView.querySelector('[data-grammar-task]');
    if (grammarTask) {
      const grammarCheck = grammarTask.querySelector('[data-check]');
      grammarTask.querySelectorAll('[data-grammar-row]').forEach(row => {
        row.querySelectorAll('.grammar-choice').forEach(choice => {
          choice.addEventListener('click', () => {
            row.classList.remove('needs-retry');
            row.querySelectorAll('.grammar-choice').forEach(item => {
              item.classList.remove('selected', 'wrong-choice');
            });
            choice.classList.add('selected');
            grammarCheck.disabled = [...grammarTask.querySelectorAll('[data-grammar-row]')]
              .some(item => !item.querySelector('.grammar-choice.selected'));
          });
        });
      });
      grammarCheck.addEventListener('click', () => {
        const rows = [...grammarTask.querySelectorAll('[data-grammar-row]')];
        const correct = rows.every(row =>
          row.querySelector('.grammar-choice.selected')?.dataset.value === row.dataset.correctValue
        );
        if (correct) {
          state.solved.screen5 = true;
          save();
          restoreSolvedTasks();
        } else {
          let firstRetryRow = null;
          rows.forEach(row => {
            const choice = row.querySelector('.grammar-choice.selected');
            if (choice?.dataset.value !== row.dataset.correctValue) {
              firstRetryRow ||= row;
              row.classList.add('needs-retry');
              choice?.classList.remove('selected');
              choice?.classList.add('wrong-choice');
            } else {
              row.classList.remove('needs-retry');
            }
          });
          grammarCheck.disabled = true;
          showFeedback(grammarTask, `${ui.grammarHint} ${ui.grammarRetry}`, false);
          firstRetryRow?.querySelector('.grammar-choice:not(.wrong-choice)')?.focus();
        }
      });
    }

    chapterView.querySelector('[data-feather]')?.addEventListener('click', () => {
      state.feather = true;
      save();
      restoreFeather();
    });

    const rewardCard = chapterView.querySelector('[data-reward-card]');
    if (rewardCard) {
      const flipRewardCard = () => {
        state.rewardReal = !state.rewardReal;
        state.reward = true;
        state.completed = true;
        save();
        updateNavigationState();
        restoreReward();
      };
      rewardCard.addEventListener('click', flipRewardCard);
      rewardCard.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        flipRewardCard();
      });
    }

    chapterView.querySelectorAll('[data-hanami-fact]').forEach((button, index) => {
      button.addEventListener('click', () => {
        const opened = new Set(state.factOpen);
        if (opened.has(index)) opened.delete(index);
        else opened.add(index);
        state.factOpen = [...opened];
        save();
        restoreReward();
      });
    });
  }

  document.addEventListener('keydown', event => {
    const open = [restartDialog, parentGuideDialog, chapterDialog]
      .filter(Boolean)
      .find(dialog => !dialog.hidden);
    if (!open) return;
    if (event.key === 'Escape') {
      if (open === restartDialog) closeRestartDialog();
      else if (open === parentGuideDialog) closeParentGuide();
      else closeChapterDialog();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...open.querySelectorAll('button:not([disabled]):not([hidden]), a[href]')]
      .filter(element => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  bindStaticInteractions();
  prepareMountedChapter();
  updateNavigationState();
  rootState.view === 'chapter' ? showChapter() : showMap();
})();
