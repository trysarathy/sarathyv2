export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Social',
  'Home',
  'Family',
  'Shopping',
  'Health',
  'Education',
  'Entertainment',
  'Other',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  Food: '🍔',
  Transport: '🚕',
  Social: '👥',
  Home: '🏠',
  Family: '❤️',
  Shopping: '🛍️',
  Health: '💊',
  Education: '🎓',
  Entertainment: '🎬',
  Other: '📌',
}

/** Student-specific subcategories per main category (first item = default). */
export const EXPENSE_SUBCATEGORIES: Record<ExpenseCategory, readonly string[]> = {
  Food: ['Hawker', 'Restaurant', 'Groceries', 'Bubble Tea', 'Delivery', 'Coffee'],
  Transport: ['MRT/Bus', 'Grab', 'Taxi', 'Petrol', 'Parking', 'Flight'],
  Shopping: ['Clothes', 'Electronics', 'Books', 'Stationery', 'Online Shopping'],
  Home: ['Rent', 'Utilities', 'Wifi', 'Household'],
  Health: ['Pharmacy', 'Doctor', 'Gym', 'Mental Health'],
  Social: ['Dates', 'Friends', 'Events', 'Alcohol'],
  Education: ['Tuition', 'Books', 'Courses', 'School Fees'],
  Family: ['Send Home', 'Gifts', 'Family Support'],
  Entertainment: ['Movies', 'Games', 'Streaming', 'Sports'],
  Other: ['Miscellaneous', 'Work', 'Insurance'],
} as const

export function getDefaultSubcategory(category: string): string {
  const cat = normalizeExpenseCategory(category)
  return EXPENSE_SUBCATEGORIES[cat][0]
}

export function getSubcategories(category: string): readonly string[] {
  return EXPENSE_SUBCATEGORIES[normalizeExpenseCategory(category)]
}

export function normalizeExpenseCategory(value: string | null | undefined): ExpenseCategory {
  if (!value) return 'Other'
  const match = EXPENSE_CATEGORIES.find(c => c.toLowerCase() === value.trim().toLowerCase())
  return match ?? 'Other'
}

export function normalizeExpenseSubcategory(
  category: string | null | undefined,
  subcategory: string | null | undefined
): string {
  const cat = normalizeExpenseCategory(category)
  const options = EXPENSE_SUBCATEGORIES[cat]
  if (!subcategory) return options[0]
  const match = options.find(s => s.toLowerCase() === subcategory.trim().toLowerCase())
  return match ?? options[0]
}

/** Best-effort subcategory from free text (voice / receipt). */
export function inferSubcategory(
  category: string,
  description: string | null | undefined
): string {
  const cat = normalizeExpenseCategory(category)
  const d = (description || '').toLowerCase()
  const options = EXPENSE_SUBCATEGORIES[cat]

  const rules: Partial<Record<ExpenseCategory, [RegExp, string][]>> = {
    Food: [
      [/hawker|koufu|canteen|food court/, 'Hawker'],
      [/bubble\s*tea|boba|chicha|liho|gong\s*cha/, 'Bubble Tea'],
      [/coffee|starbucks|cafe|kopi/, 'Coffee'],
      [/deliver|foodpanda|deliveroo|grabfood|grab\s*food/, 'Delivery'],
      [/grocer|fairprice|cold\s*storage|ntuc|sheng\s*siong/, 'Groceries'],
      [/restaurant|dining|mcdonald|burger|pizza/, 'Restaurant'],
    ],
    Transport: [
      [/mrt|bus|simplygo|ez-?link|train/, 'MRT/Bus'],
      [/grab|gojek|ryde/, 'Grab'],
      [/taxi|comfort|citycab/, 'Taxi'],
      [/petrol|shell|esso|caltex|fuel/, 'Petrol'],
      [/park(ing)?/, 'Parking'],
      [/flight|airasia|scoot|airline|airport/, 'Flight'],
    ],
    Shopping: [
      [/online|shopee|lazada|amazon|qoo10/, 'Online Shopping'],
      [/cloth|uniqlo|h&m|fashion|shirt/, 'Clothes'],
      [/electronic|phone|laptop|gadget|apple/, 'Electronics'],
      [/stationer|pen|notebook/, 'Stationery'],
      [/book/, 'Books'],
    ],
    Home: [
      [/rent|hostel|hall/, 'Rent'],
      [/wifi|internet|broadband/, 'Wifi'],
      [/utilit|electric|water|sp\s*group/, 'Utilities'],
      [/household|ikea|cleaning/, 'Household'],
    ],
    Health: [
      [/gym|fitness|activesg/, 'Gym'],
      [/mental|therap|counsel/, 'Mental Health'],
      [/doctor|clinic|hospital|gp/, 'Doctor'],
      [/pharma|guardian|watsons|medicine|pill/, 'Pharmacy'],
    ],
    Social: [
      [/date|dating/, 'Dates'],
      [/alcohol|beer|bar|club|wine/, 'Alcohol'],
      [/event|concert|party/, 'Events'],
      [/friend/, 'Friends'],
    ],
    Education: [
      [/tuition|tutor/, 'Tuition'],
      [/course|udemy|coursera/, 'Courses'],
      [/school\s*fee|semester|uni\s*fee/, 'School Fees'],
      [/book|textbook/, 'Books'],
    ],
    Family: [
      [/send\s*home|remit|wise|remitly/, 'Send Home'],
      [/gift|present/, 'Gifts'],
      [/family|support|parents/, 'Family Support'],
    ],
    Entertainment: [
      [/movie|cinema|cathay|gv\b/, 'Movies'],
      [/stream|netflix|spotify|disney|youtube/, 'Streaming'],
      [/game|steam|playstation|xbox/, 'Games'],
      [/sport|match|stadium/, 'Sports'],
    ],
    Other: [
      [/insur/, 'Insurance'],
      [/work|salary|freelance/, 'Work'],
    ],
  }

  for (const [re, label] of rules[cat] || []) {
    if (re.test(d) && options.includes(label)) return label
  }
  return options[0]
}
