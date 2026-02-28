// ===== TYPES =====
export interface PostItem {
  id: string;
  content: string;
  topic: string;
  image?: string | null;
  imageRating?: 'liked' | 'disliked' | null;
}

export interface SavedPost {
  id: string;
  content: string;
  topic: string;
  image?: string | null;
  savedAt: number;
}

export interface ImagePreference {
  topic: string;
  liked: boolean;
  reason?: string;
}

export interface Memory {
  spec: string;
  goldenRules: string[];
  avoidRules: string[];
  likedPosts: PostItem[];
  dislikedPosts: PostItem[];
  dislikeReasons: string[];
  totalLiked: number;
  totalDisliked: number;
  round: number;
  // Image AI Agent memory
  imagePreferences: ImagePreference[];
  imageStyleRules: string[];
  imageAvoidRules: string[];
  // Saved posts
  savedPosts: SavedPost[];
}

// ===== SEED POSTS =====
export const SEED_POSTS: PostItem[] = [
  {
    id: 'seed-0',
    topic: 'دراسة السوق',
    content: `تبغى تعرف معلومات أكثر قبل البدء في مشروعك؟
ولدراسة السوق والشريحة المستهدفة؟
موقع تفاعلي (أطلس الأعمال) يسحب لك البيانات من المصادر الموثوقة ويخليها في متناول يدك.

مفيد الموقع لأي شخص داخل في مجال المشاريع أو ينوي الدخول`,
  },
  {
    id: 'seed-1',
    topic: 'التعلم من الفشل',
    content: `لمن يريد تأسيس شركات جديدة:

هذا ملف يوجد به 925 شركة مدعومة من صناديق VC ولكن فشلت

هذه الشركات جمعت ما بينها اجمالي 40.6 مليار دولار واسباب فشلها مختلفة

تستطيع اخذ اي فكرة و التعديل عليها`,
  },
  {
    id: 'seed-2',
    topic: 'التحقق من الفكرة',
    content: `كيف تعرف إذا الفكرة اللي عندك تصلح بزنس؟

الجواب:
إذا سويتها بأقل التكاليف و فيه أحد أعطاك فلوس

الطريقة الخاطئة: أبني سيستم مكلف جدا و اكتشف محد يبي المنتج

الطريقة الصحيحة:
1. أتواصل مع الطرفين و أعرف المشكلة
2. أحل المشكلة بأقل التكاليف
3. في حال الناس دفعوا معناها المنتج يحل مشكلة`,
  },
  {
    id: 'seed-3',
    topic: 'البساطة في التصميم',
    content: `هنالك قاعدة بالتصميم بمسمى KISS Principle
Keep it simple stupid

وتقول الفكرة أنه وعندما تصمم شيئا لا تعقده وتضيف له كل شيء يمكن إضافته بل إجعله بسيطا بأكبر قدر وأن الأنظمة تعمل بشكل أفضل كلما كانت أسهل للمستخدم`,
  },
  {
    id: 'seed-4',
    topic: 'المنتجات الممله',
    content: `يمكن أسرع طريقة تجيب فيها ملايين هي أنك تبيع منتج ممل

ممل جدا

تخيل أنك تبيع منديل وقدرت تقنع آلاف الناس أنهم يتركون منديل البقالة عشان يطلبون منديلك

هذا الشغل الأسطوري اللي سووه قوفي

منتج واحد ممل
هذا المنتج يفوق التوقعات بالجودة
هذا المنتج فيه ميزة ماتخطر عالبال
هذا المنتج سعره أغلى
هذا المنتج تغليفه مميز
ترويج رقمي شاطر
ميزانية تسويق كريمة جدا`,
  },
];

// ===== ONBOARDING QUESTIONS =====
export const ONBOARD_QUESTIONS = [
  {
    q: 'أي بداية تفضل؟',
    a: {
      label: 'سؤال مباشر',
      text: 'هل تعرف ليش 90% من المشاريع تفشل في أول سنتين؟\n\nالسبب أبسط مما تتوقع...',
      rule: 'ابدأ بسؤال مباشر يثير الفضول',
    },
    b: {
      label: 'قصة شخصية',
      text: 'قبل 3 سنوات كنت أشتغل وظيفة 9-5 وراتبي ما يكفي نص الشهر.\n\nقررت أبدأ مشروعي الخاص بـ 500 ريال فقط...',
      rule: 'ابدأ بقصة شخصية قصيرة',
    },
  },
  {
    q: 'أي طول بوست؟',
    a: {
      label: 'قصير ومختصر',
      text: 'أكبر درس تعلمته:\n\nلا تبني منتج أحد ما طلبه.\n\nاسأل أولا. ابني ثانيا.',
      rule: 'اكتب بوستات قصيرة 3-5 أسطر',
    },
    b: {
      label: 'طويل ومفصل',
      text: 'في 2023 قابلت أكثر من 200 رائد أعمال سعودي.\n\nسألت كل واحد فيهم: وش أكبر غلطة سويتها؟\n\nالإجابات كانت متشابهة:\n\n1. بدأوا بالمنتج قبل السوق\n2. وظفوا بسرعة\n3. ما عرفوا متى يوقفون\n4. تجاهلوا الأرقام\n5. خافوا يغيرون الخطة',
      rule: 'اكتب بوستات طويلة مفصلة 12-20 سطر',
    },
  },
  {
    q: 'إيموجي وهاشتاقات؟',
    a: {
      label: 'نظيف بدون',
      text: 'الفرق بين الناجح والفاشل ليس الفكرة.\n\nالفرق هو التنفيذ. والتنفيذ يحتاج صبر.',
      rule: 'لا تستخدم إيموجي. لا تستخدم هاشتاقات',
    },
    b: {
      label: 'حيوي بإيموجي',
      text: 'الفرق بين الناجح والفاشل ليس الفكرة 💡\n\nالفرق هو التنفيذ 🚀 والتنفيذ يحتاج صبر ⏳\n\n#ريادة_الأعمال #السعودية #رؤية2030',
      rule: 'استخدم 2-3 إيموجي كحد أقصى. أضف 3-4 هاشتاقات',
    },
  },
  {
    q: 'أي تنسيق؟',
    a: {
      label: 'نقاط مرقمة',
      text: '5 أشياء تمنيت أحد قالها لي:\n\n1. لا تستلف عشان تبدأ\n2. ابدأ وأنت على رأس عملك\n3. أول عميل أهم من أول منتج\n4. الشراكة زي الزواج\n5. البيانات ما تكذب',
      rule: 'استخدم نقاط مرقمة عند سرد النصائح',
    },
    b: {
      label: 'سرد قصصي',
      text: 'أول مشروع لي كان كارثة.\n\nصرفت كل مدخراتي على منتج ما أحد يبيه. استلفت من أهلي. وفي النهاية سكرت المحل بعد 8 أشهر.\n\nبس هالتجربة علمتني شي ما يتعلم من الكتب.',
      rule: 'استخدم السرد القصصي المتصل بدون ترقيم',
    },
  },
  {
    q: 'أي نبرة؟',
    a: {
      label: 'سعودية بيضاء',
      text: 'يا جماعة الخير\n\nكل يوم أشوف واحد يقول ابي أبدأ مشروع بس ما أعرف من وين.\n\nخلني أختصر عليك: روح اسأل 10 أشخاص وش أكثر شي يزعجهم.',
      rule: 'استخدم لهجة سعودية بيضاء. تجنب الفصحى الثقيلة والمصرية تماما',
    },
    b: {
      label: 'مهني رسمي',
      text: 'وفقا لتقرير منشآت الأخير ارتفع عدد السجلات التجارية بنسبة 34% خلال العام الماضي.\n\nهذا مؤشر إيجابي لبيئة ريادة الأعمال لكنه يطرح تحديات في المنافسة.',
      rule: 'استخدم لغة مهنية رسمية بدون عامية',
    },
  },
];

// ===== DEFAULT MEMORY =====
export function createDefaultMemory(): Memory {
  return {
    spec: '',
    goldenRules: [],
    avoidRules: [],
    likedPosts: [...SEED_POSTS],
    dislikedPosts: [],
    dislikeReasons: [],
    totalLiked: SEED_POSTS.length,
    totalDisliked: 0,
    round: 0,
    imagePreferences: [],
    imageStyleRules: [],
    imageAvoidRules: [],
    savedPosts: [],
  };
}

// ===== LOCAL STORAGE =====
const STORAGE_KEY = 'basma-memory';

export function loadMemory(): Memory | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Migrate old memory format
    if (!parsed.imagePreferences) parsed.imagePreferences = [];
    if (!parsed.imageStyleRules) parsed.imageStyleRules = [];
    if (!parsed.imageAvoidRules) parsed.imageAvoidRules = [];
    if (!parsed.savedPosts) parsed.savedPosts = [];
    return parsed;
  } catch { return null; }
}

export function saveMemory(mem: Memory) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mem));
  } catch {}
}

export function clearMemory() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
