// All topics from the sidebar taxonomy — pre-generated nightly
export interface TopicJob {
  topic: string;
  startYear: string;
  endYear: string;
}

export const ALL_TOPICS: TopicJob[] = [
  // Ancient History
  { topic: 'Ancient Greece', startYear: '800 BCE', endYear: '146 BCE' },
  { topic: 'The Roman Empire', startYear: '27 BCE', endYear: '476 CE' },
  { topic: 'Ancient Egypt', startYear: '3100 BCE', endYear: '30 BCE' },
  { topic: 'Mesopotamia & Early Civilization', startYear: '3500 BCE', endYear: '500 BCE' },
  { topic: 'The Persian Empire', startYear: '550 BCE', endYear: '330 BCE' },
  // Philosophy
  { topic: 'History of Western Philosophy', startYear: '600 BCE', endYear: '400 CE' },
  { topic: 'Eastern Philosophy', startYear: '800 BCE', endYear: '500 CE' },
  { topic: 'The Enlightenment', startYear: '1685', endYear: '1815' },
  { topic: 'Existentialism', startYear: '1800', endYear: '1970' },
  { topic: 'History of Political Philosophy', startYear: '400 BCE', endYear: '1900' },
  // Science & Technology
  { topic: 'History of Computing', startYear: '1940', endYear: '1995' },
  { topic: 'The Space Race', startYear: '1950', endYear: '1975' },
  { topic: 'History of Physics from Newton to Quantum Mechanics', startYear: '1687', endYear: '1950' },
  { topic: 'History of Evolutionary Biology', startYear: '1750', endYear: '1950' },
  { topic: 'History of Artificial Intelligence', startYear: '1950', endYear: '2024' },
  { topic: 'History of Medicine', startYear: '1800', endYear: '2000' },
  // Revolutions & Politics
  { topic: 'The French Revolution', startYear: '1789', endYear: '1799' },
  { topic: 'The American Revolution', startYear: '1765', endYear: '1783' },
  { topic: 'The Russian Revolution', startYear: '1905', endYear: '1924' },
  { topic: 'The Cold War', startYear: '1947', endYear: '1991' },
  { topic: 'The American Civil Rights Movement', startYear: '1954', endYear: '1968' },
  { topic: 'Decolonization of Africa and Asia', startYear: '1945', endYear: '1975' },
  // Art & Culture
  { topic: 'The Renaissance', startYear: '1300', endYear: '1600' },
  { topic: 'History of Classical Music', startYear: '1600', endYear: '1900' },
  { topic: 'History of Modern Art', startYear: '1860', endYear: '1970' },
  { topic: 'History of Cinema', startYear: '1895', endYear: '1970' },
  { topic: 'History of Western Literature', startYear: '800 BCE', endYear: '1900' },
  // Religion
  { topic: 'The Rise of Early Christianity', startYear: '0', endYear: '400 CE' },
  { topic: 'The Rise and Spread of Islam', startYear: '570 CE', endYear: '1000 CE' },
  { topic: 'The Protestant Reformation', startYear: '1517', endYear: '1648' },
  { topic: 'The History of Buddhism', startYear: '500 BCE', endYear: '700 CE' },
  // Economics & Trade
  { topic: 'The Industrial Revolution', startYear: '1760', endYear: '1840' },
  { topic: 'The Great Depression', startYear: '1929', endYear: '1939' },
  { topic: 'History of Globalization', startYear: '1950', endYear: '2000' },
  { topic: 'The Silk Road Trade Routes', startYear: '200 BCE', endYear: '1450 CE' },
  // Wars & Conflicts
  { topic: 'World War I', startYear: '1914', endYear: '1918' },
  { topic: 'World War II', startYear: '1939', endYear: '1945' },
  { topic: 'The Crusades', startYear: '1095', endYear: '1291' },
  { topic: 'The Napoleonic Wars', startYear: '1803', endYear: '1815' },
  { topic: 'The Vietnam War', startYear: '1955', endYear: '1975' },
];
