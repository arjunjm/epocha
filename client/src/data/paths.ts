export interface PathStep {
  label: string;
  topic: string;
  start: string;
  end: string;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  accentColor: string;
  steps: PathStep[];
}

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'ancient-world',
    title: 'The Ancient World',
    description: 'From the first civilisations of Mesopotamia through the rise and fall of Rome.',
    icon: '🏛️',
    color: 'from-amber-900/40 to-stone-900/40',
    accentColor: 'text-amber-400',
    steps: [
      { label: 'Mesopotamia', topic: 'Mesopotamia & Early Civilization', start: '3500 BCE', end: '500 BCE' },
      { label: 'Ancient Egypt', topic: 'Ancient Egypt', start: '3100 BCE', end: '30 BCE' },
      { label: 'Ancient Greece', topic: 'Ancient Greece', start: '800 BCE', end: '146 BCE' },
      { label: 'The Persian Empire', topic: 'The Persian Empire', start: '550 BCE', end: '330 BCE' },
      { label: 'The Roman Republic', topic: 'The Roman Republic', start: '509 BCE', end: '27 BCE' },
      { label: 'The Roman Empire', topic: 'The Roman Empire', start: '27 BCE', end: '476 CE' },
    ],
  },
  {
    id: 'science-progress',
    title: 'The Rise of Science',
    description: 'How humanity moved from superstition to scientific method — and changed everything.',
    icon: '🔬',
    color: 'from-cyan-900/40 to-blue-900/40',
    accentColor: 'text-cyan-400',
    steps: [
      { label: 'Western Philosophy', topic: 'History of Western Philosophy', start: '600 BCE', end: '400 CE' },
      { label: 'The Renaissance', topic: 'The Renaissance', start: '1300', end: '1600' },
      { label: 'Scientific Revolution', topic: 'The Scientific Revolution', start: '1543', end: '1687' },
      { label: 'Industrial Revolution', topic: 'The Industrial Revolution', start: '1760', end: '1840' },
      { label: 'History of Computing', topic: 'History of Computing', start: '1930', end: '2000' },
    ],
  },
  {
    id: 'empires',
    title: 'Age of Empires',
    description: 'The great empires that shaped cultures, borders, and the world we live in today.',
    icon: '👑',
    color: 'from-yellow-900/40 to-amber-900/40',
    accentColor: 'text-yellow-400',
    steps: [
      { label: 'The Mongol Empire', topic: 'The Mongol Empire', start: '1206', end: '1368' },
      { label: 'The Ottoman Empire', topic: 'The Ottoman Empire', start: '1299', end: '1922' },
      { label: 'The Mughal Empire', topic: 'The Mughal Empire', start: '1526', end: '1857' },
      { label: 'The British Empire', topic: 'The British Empire', start: '1600', end: '1997' },
    ],
  },
  {
    id: 'revolutions',
    title: 'Age of Revolutions',
    description: 'Political upheaval, social transformation, and the birth of the modern world.',
    icon: '⚡',
    color: 'from-red-900/40 to-rose-900/40',
    accentColor: 'text-red-400',
    steps: [
      { label: 'American Revolution', topic: 'The American Revolution', start: '1765', end: '1783' },
      { label: 'French Revolution', topic: 'The French Revolution', start: '1789', end: '1799' },
      { label: 'Napoleonic Wars', topic: 'The Napoleonic Wars', start: '1803', end: '1815' },
      { label: 'American Civil War', topic: 'The American Civil War', start: '1861', end: '1865' },
      { label: 'World War I', topic: 'World War I', start: '1914', end: '1918' },
      { label: 'World War II', topic: 'World War II', start: '1939', end: '1945' },
    ],
  },
  {
    id: 'exploration',
    title: 'Exploration & Discovery',
    description: 'Humanity's drive to venture into the unknown — from ocean voyages to outer space.',
    icon: '🧭',
    color: 'from-teal-900/40 to-cyan-900/40',
    accentColor: 'text-teal-400',
    steps: [
      { label: 'The Silk Road', topic: 'The Silk Road', start: '130 BCE', end: '1450 CE' },
      { label: 'Age of Exploration', topic: 'The Age of Exploration', start: '1400', end: '1600' },
      { label: 'The Space Race', topic: 'The Space Race', start: '1957', end: '1972' },
      { label: 'History of the Internet', topic: 'History of the Internet', start: '1969', end: '2010' },
    ],
  },
];
