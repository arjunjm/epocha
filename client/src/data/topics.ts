export interface TopicEntry {
  label: string;
  topic: string;
  start: string;
  end: string;
}

export interface TopicCategory {
  label: string;
  icon: string;
  items: TopicEntry[];
}

export const TOPIC_TAXONOMY: TopicCategory[] = [
  {
    label: 'Ancient History',
    icon: '🏛️',
    items: [
      { label: 'Ancient Greece', topic: 'Ancient Greece', start: '800 BCE', end: '146 BCE' },
      { label: 'The Roman Empire', topic: 'The Roman Empire', start: '27 BCE', end: '476 CE' },
      { label: 'Ancient Egypt', topic: 'Ancient Egypt', start: '3100 BCE', end: '30 BCE' },
      { label: 'Mesopotamia', topic: 'Mesopotamia & Early Civilization', start: '3500 BCE', end: '500 BCE' },
      { label: 'The Persian Empire', topic: 'The Persian Empire', start: '550 BCE', end: '330 BCE' },
    ],
  },
  {
    label: 'Philosophy',
    icon: '🦉',
    items: [
      { label: 'Western Philosophy', topic: 'History of Western Philosophy', start: '600 BCE', end: '400 CE' },
      { label: 'Eastern Philosophy', topic: 'Eastern Philosophy', start: '800 BCE', end: '500 CE' },
      { label: 'The Enlightenment', topic: 'The Enlightenment', start: '1685', end: '1815' },
      { label: 'Existentialism', topic: 'Existentialism', start: '1800', end: '1970' },
      { label: 'Political Philosophy', topic: 'History of Political Philosophy', start: '400 BCE', end: '1900' },
    ],
  },
  {
    label: 'Science & Technology',
    icon: '🔬',
    items: [
      { label: 'History of Computing', topic: 'History of Computing', start: '1940', end: '1995' },
      { label: 'The Space Race', topic: 'The Space Race', start: '1950', end: '1975' },
      { label: 'Physics & Relativity', topic: 'History of Physics from Newton to Quantum Mechanics', start: '1687', end: '1950' },
      { label: 'Evolution & Biology', topic: 'History of Evolutionary Biology', start: '1750', end: '1950' },
      { label: 'Artificial Intelligence', topic: 'History of Artificial Intelligence', start: '1950', end: '2024' },
      { label: 'Medicine & Healthcare', topic: 'History of Medicine', start: '1800', end: '2000' },
    ],
  },
  {
    label: 'Revolutions & Politics',
    icon: '⚡',
    items: [
      { label: 'The French Revolution', topic: 'The French Revolution', start: '1789', end: '1799' },
      { label: 'American Revolution', topic: 'The American Revolution', start: '1765', end: '1783' },
      { label: 'Russian Revolution', topic: 'The Russian Revolution', start: '1905', end: '1924' },
      { label: 'The Cold War', topic: 'The Cold War', start: '1947', end: '1991' },
      { label: 'Civil Rights Movement', topic: 'The American Civil Rights Movement', start: '1954', end: '1968' },
      { label: 'Decolonization', topic: 'Decolonization of Africa and Asia', start: '1945', end: '1975' },
    ],
  },
  {
    label: 'Art & Culture',
    icon: '🎨',
    items: [
      { label: 'The Renaissance', topic: 'The Renaissance', start: '1300', end: '1600' },
      { label: 'Classical Music', topic: 'History of Classical Music', start: '1600', end: '1900' },
      { label: 'Modern Art', topic: 'History of Modern Art', start: '1860', end: '1970' },
      { label: 'Cinema History', topic: 'History of Cinema', start: '1895', end: '1970' },
      { label: 'Literature', topic: 'History of Western Literature', start: '800 BCE', end: '1900' },
    ],
  },
  {
    label: 'Religion & Spirituality',
    icon: '✨',
    items: [
      { label: 'Early Christianity', topic: 'The Rise of Early Christianity', start: '0', end: '400 CE' },
      { label: 'Islam', topic: 'The Rise and Spread of Islam', start: '570 CE', end: '1000 CE' },
      { label: 'The Reformation', topic: 'The Protestant Reformation', start: '1517', end: '1648' },
      { label: 'Buddhism', topic: 'The History of Buddhism', start: '500 BCE', end: '700 CE' },
    ],
  },
  {
    label: 'Economics & Trade',
    icon: '📈',
    items: [
      { label: 'Industrial Revolution', topic: 'The Industrial Revolution', start: '1760', end: '1840' },
      { label: 'The Great Depression', topic: 'The Great Depression', start: '1929', end: '1939' },
      { label: 'Globalization', topic: 'History of Globalization', start: '1950', end: '2000' },
      { label: 'Silk Road', topic: 'The Silk Road Trade Routes', start: '200 BCE', end: '1450 CE' },
    ],
  },
  {
    label: 'Wars & Conflicts',
    icon: '⚔️',
    items: [
      { label: 'World War I', topic: 'World War I', start: '1914', end: '1918' },
      { label: 'World War II', topic: 'World War II', start: '1939', end: '1945' },
      { label: 'The Crusades', topic: 'The Crusades', start: '1095', end: '1291' },
      { label: 'Napoleonic Wars', topic: 'The Napoleonic Wars', start: '1803', end: '1815' },
      { label: 'Vietnam War', topic: 'The Vietnam War', start: '1955', end: '1975' },
    ],
  },
];
