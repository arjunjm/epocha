import type { TimelineData } from './types.js';

export const STUB_TIMELINE: TimelineData = {
  topic: "History of Western Philosophy",
  period: "600 BCE to 400 CE",
  description: "Western philosophy began in ancient Greece with thinkers who sought rational explanations for the nature of reality, knowledge, and ethics. From the Pre-Socratics through Plato, Aristotle, and the Hellenistic schools, this millennium laid the intellectual foundations of Western civilization.",
  events: [
    {
      date: "624 BCE",
      sortYear: -624,
      title: "Thales of Miletus: First Philosopher",
      summary: "Thales proposed that water is the fundamental substance underlying all of reality, marking the first known attempt to explain the world through natural rather than mythological causes.",
      details: "Thales of Miletus is traditionally regarded as the first philosopher in the Western tradition. Rather than attributing natural phenomena to the actions of gods, he sought a single material principle — water — that could explain the diversity of the world.\n\nHis significance lies not in the answer but in the question: what is everything made of? This move from mythos to logos, from story to rational argument, initiated a tradition of inquiry that persists to this day.\n\nThales was also a mathematician and astronomer, reportedly predicting a solar eclipse in 585 BCE. He represents the fusion of practical wisdom and speculative thought that characterised early Greek philosophy.",
      significance: "Thales initiated the philosophical tradition of seeking natural, rational explanations for the world — the foundational move of both philosophy and science.",
      figures: ["Thales"],
      location: "Miletus, Ionia (modern Turkey)",
      tags: ["pre-socratic", "metaphysics", "cosmology"]
    },
    {
      date: "570 BCE",
      sortYear: -570,
      title: "Pythagoras and the Primacy of Number",
      summary: "Pythagoras founded a religious-philosophical community that held numbers to be the ultimate reality, influencing mathematics, music theory, and later idealist philosophy.",
      details: "Pythagoras of Samos founded a community at Croton in southern Italy that blended philosophical inquiry with religious practice. Central to his teaching was the idea that number is the fundamental principle of reality — that mathematical relationships underlie all things.\n\nThe Pythagoreans made genuine contributions to mathematics and discovered the relationship between musical harmony and numerical ratios. This insight — that abstract mathematical structures govern physical reality — proved enormously influential.\n\nPlato later absorbed Pythagorean ideas into his theory of Forms, and the tradition of mathematical idealism runs through Western thought to this day, echoing in modern physics and its use of mathematics to describe nature.",
      significance: "Pythagoras established the tradition that abstract mathematical structures underlie reality, a view that has profoundly shaped science and philosophy ever since.",
      figures: ["Pythagoras"],
      location: "Croton, southern Italy",
      tags: ["pre-socratic", "mathematics", "metaphysics"]
    },
    {
      date: "500 BCE",
      sortYear: -500,
      title: "Heraclitus: Everything Flows",
      summary: "Heraclitus argued that reality is characterised by constant flux and that an underlying rational principle (the Logos) governs all change.",
      details: "Heraclitus of Ephesus is famous for the doctrine that 'everything flows' — reality is not a static thing but a ceaseless process of change and opposition. His most famous image is the river: you cannot step into the same river twice, because both the water and you have changed.\n\nYet Heraclitus did not see chaos in this flux. An underlying rational principle he called the Logos (Word or Reason) governs all change. Opposites — hot and cold, night and day, war and peace — are unified by this principle. Strife and tension are not flaws in reality but its driving force.\n\nHis ideas influenced the Stoics, who adopted the concept of the Logos as the rational order of the cosmos, and were later echoed in Hegel's dialectic of opposites.",
      significance: "Heraclitus introduced the concept of the Logos and the idea that change and opposition are fundamental to reality, influencing Stoicism and later German idealism.",
      figures: ["Heraclitus"],
      location: "Ephesus, Ionia",
      tags: ["pre-socratic", "metaphysics", "logos"]
    },
    {
      date: "470 BCE",
      sortYear: -470,
      title: "Birth of Socrates",
      summary: "Socrates redirected philosophy from cosmology to ethics and human affairs, developing the dialectical method of inquiry through dialogue.",
      details: "Socrates represents a pivotal turn in ancient philosophy. Where his predecessors had focused on the nature of the cosmos, Socrates turned philosophy toward the human: How should we live? What is justice, courage, piety? What is knowledge itself?\n\nSocrates wrote nothing; we know him through the dialogues of his student Plato. His method — the elenchus, or refutation — involved drawing out his interlocutor's beliefs through questioning and then exposing their contradictions. The goal was not to win arguments but to achieve genuine self-knowledge.\n\nHis famous claim to know only that he knew nothing encapsulated his philosophical humility. He believed an unexamined life was not worth living, and he pursued examination so relentlessly that the city of Athens put him to death for it in 399 BCE.",
      significance: "Socrates reoriented philosophy toward ethics and human self-knowledge, and his martyrdom made him the defining symbol of the philosopher's commitment to truth over social conformity.",
      figures: ["Socrates"],
      location: "Athens, Greece",
      tags: ["ethics", "epistemology", "dialectic"]
    },
    {
      date: "428 BCE",
      sortYear: -428,
      title: "Birth of Plato",
      summary: "Plato founded the Academy and developed the Theory of Forms, arguing that true reality consists of eternal, immaterial archetypes of which the physical world is only a shadow.",
      details: "Plato is arguably the most influential philosopher in the Western tradition. A student of Socrates and teacher of Aristotle, he founded the Academy in Athens around 387 BCE — arguably the first institution of higher learning in the Western world.\n\nAt the heart of Plato's philosophy is the Theory of Forms. The world we perceive through our senses is constantly changing and imperfect. True reality consists of eternal, unchanging, perfect Forms — such as Beauty itself, Justice itself, the Good itself. Physical beautiful things are beautiful only insofar as they 'participate' in the Form of Beauty.\n\nHis allegory of the Cave, in the Republic, illustrates this vision: ordinary people are like prisoners in a cave who mistake shadows on the wall for reality. The philosopher is the one who escapes to see the sunlight — the Form of the Good — and then returns to guide others.\n\nPlato's influence on Christianity, medieval philosophy, and the entire subsequent Western tradition is incalculable.",
      significance: "Plato established idealism — the view that immaterial reality is more fundamental than physical reality — which shaped theology, science, and philosophy for two millennia.",
      figures: ["Plato", "Socrates"],
      location: "Athens, Greece",
      tags: ["metaphysics", "epistemology", "political-philosophy", "idealism"]
    },
    {
      date: "384 BCE",
      sortYear: -384,
      title: "Birth of Aristotle",
      summary: "Aristotle systematised nearly every field of knowledge and developed an empirical, form-in-matter metaphysics that countered Platonic idealism.",
      details: "Aristotle studied at Plato's Academy for twenty years before founding his own school, the Lyceum. Where Plato looked to abstract Forms beyond the physical world, Aristotle brought philosophy down to earth — forms exist within matter, not apart from it.\n\nAristotle created the first systematic treatment of logic, laying out the rules of valid inference in the Organon. His works covered biology, physics, metaphysics, ethics, politics, rhetoric, and poetics. He virtually invented the field of biology through careful empirical observation.\n\nHis ethics centred on eudaimonia — flourishing or happiness — achieved through the exercise of virtue. His Politics examined constitutions empirically, collecting and comparing 158 of them. His Nicomachean Ethics and Politics remained foundational texts through the medieval period and into modernity.\n\nRecovered and transmitted to medieval Europe via Arabic translations, Aristotle was known simply as 'The Philosopher.'",
      significance: "Aristotle created the first comprehensive scientific and philosophical system, establishing logic, empirical inquiry, and systematic ethics — pillars of Western intellectual life.",
      figures: ["Aristotle", "Plato", "Alexander the Great"],
      location: "Stagira and Athens, Greece",
      tags: ["metaphysics", "logic", "ethics", "science", "empiricism"]
    },
    {
      date: "341 BCE",
      sortYear: -341,
      title: "Epicurus and the Philosophy of Pleasure",
      summary: "Epicurus founded a school teaching that pleasure — especially tranquillity and freedom from pain — is the highest good, and that fear of death and the gods should be overcome through reason.",
      details: "Epicurus founded his school in Athens around 307 BCE, in a garden — hence his followers became known as the Garden school. Against the turbulence of the Hellenistic age, Epicurus offered a philosophy of withdrawal and tranquillity.\n\nHe argued that pleasure is the highest good, but he distinguished sharply between base pleasures and the deeper pleasure of ataraxia — tranquillity of mind, freedom from anxiety. Friendship, philosophical conversation, and simple living were the paths to this state.\n\nCrucially, Epicurus used Democritus's atomic theory to argue against two great sources of human fear: the fear of divine punishment (the gods have no interest in human affairs) and the fear of death (when death is, I am not; when I am, death is not). Philosophy, for Epicurus, was essentially therapeutic — a cure for the diseases of the soul.",
      significance: "Epicurus developed the first systematic materialist ethics and philosophy of death, offering a secular path to tranquillity that remains influential in modern secular humanism.",
      figures: ["Epicurus"],
      location: "Athens, Greece",
      tags: ["ethics", "materialism", "hellenistic"]
    },
    {
      date: "334 BCE",
      sortYear: -334,
      title: "Zeno of Citium Founds Stoicism",
      summary: "Zeno founded Stoicism in Athens, teaching that virtue is the only true good and that we should accept with equanimity whatever lies outside our control.",
      details: "Zeno of Citium began teaching on the Stoa Poikile (Painted Porch) in Athens around 301 BCE, giving Stoicism its name. The school became one of the most influential philosophical movements of the ancient world, lasting well into the Roman Empire.\n\nAt the core of Stoic ethics is a sharp distinction between what is 'up to us' — our judgements, desires, and responses — and what is not: health, wealth, reputation, even life itself. The Stoics argued that virtue — living in accordance with reason and nature — is the only true good, and that external things are 'indifferent.'\n\nThis produces a remarkable equanimity: since only virtue matters, nothing can truly harm the sage. The Stoics also developed a rich physics (the Logos pervades and orders the cosmos) and logic. Their influence is visible in Roman thinkers like Cicero, Seneca, Epictetus, and Marcus Aurelius.",
      significance: "Stoicism developed the most influential ancient ethics of self-mastery and equanimity, shaping Roman culture, early Christianity, and modern cognitive therapy.",
      figures: ["Zeno of Citium"],
      location: "Athens, Greece",
      tags: ["ethics", "stoicism", "hellenistic", "logos"]
    },
    {
      date: "270 BCE",
      sortYear: -270,
      title: "Pyrrhonism and Ancient Scepticism",
      summary: "Pyrrho of Elis developed radical scepticism — suspending judgement on all questions — as the path to tranquillity, founding a tradition that challenged every claim to knowledge.",
      details: "Pyrrho of Elis, who accompanied Alexander the Great to India, developed a radical form of scepticism: since we cannot know anything with certainty, we should suspend judgement (epoché) on all matters. This suspension, paradoxically, leads to tranquillity — ataraxia — because we are no longer disturbed by false beliefs.\n\nLater Academic Sceptics like Arcesilaus and Carneades attacked Stoic claims to certain knowledge, arguing that nothing can be known with certainty. Aenesidemus revived Pyrrhonism and compiled the famous Ten Modes — ten arguments for suspending judgement.\n\nAncient scepticism bequeathed to Western philosophy a permanent set of challenges: How do the senses mislead us? How do we escape circular reasoning? Descartes' method of doubt and Hume's scepticism are its direct descendants.",
      significance: "Ancient scepticism established the philosophical challenge of justifying knowledge claims, driving epistemology as a central concern of philosophy.",
      figures: ["Pyrrho", "Arcesilaus", "Aenesidemus"],
      location: "Greece",
      tags: ["epistemology", "scepticism", "hellenistic"]
    },
    {
      date: "106 BCE",
      sortYear: -106,
      title: "Cicero Transmits Greek Philosophy to Rome",
      summary: "Cicero adapted Greek philosophical traditions — especially Stoicism and Scepticism — into Latin, making them accessible to Roman culture and shaping Western political philosophy.",
      details: "Marcus Tullius Cicero was Rome's greatest orator and a philosopher of considerable originality. He saw himself as bringing Greek philosophy to the Latin world, and his translations created the Latin philosophical vocabulary that shaped the Western tradition (terms like 'quality,' 'individual,' 'moral,' 'vacuum' are his coinages).\n\nCicero's philosophical sympathies lay with the Academic Sceptics, but he drew heavily on Stoicism in his political and ethical works. His De Re Publica and De Legibus developed a theory of natural law — that there is a universal reason accessible to all humans which grounds justice — that proved enormously influential on Roman law, Christian political thought, and the natural law tradition.\n\nHis execution by Mark Antony's forces made him a martyr for republican values and free speech.",
      significance: "Cicero transmitted Greek philosophy to Rome, invented Latin philosophical vocabulary, and developed a natural law theory that shaped Western legal and political thought for two millennia.",
      figures: ["Cicero"],
      location: "Rome",
      tags: ["political-philosophy", "stoicism", "natural-law", "roman"]
    },
    {
      date: "4 BCE",
      sortYear: -4,
      title: "Philo of Alexandria: Philosophy Meets Scripture",
      summary: "Philo of Alexandria synthesised Platonic philosophy with Jewish scripture, pioneering the allegorical interpretation of sacred texts that shaped Christian and Jewish thought.",
      details: "Philo of Alexandria was a Jewish philosopher who attempted to show that the Hebrew scriptures, properly interpreted allegorically, conveyed the same truths as Platonic philosophy. Moses, he argued, was a philosopher who knew all that Plato knew.\n\nPhilo's most influential contribution was his development of the concept of the Logos as an intermediary between the transcendent God and the created world — a concept drawn from both Platonism and Stoicism, but reinterpreted in monotheistic terms.\n\nThis synthesis of Greek philosophy and monotheistic religion proved enormously productive. The Gospel of John opens with the declaration 'In the beginning was the Logos,' directly echoing Philo's framework. His method of allegorical interpretation became standard in both Jewish and Christian exegesis.",
      significance: "Philo pioneered the synthesis of Greek philosophy with monotheistic religion, developing the Logos concept that became central to Christian theology.",
      figures: ["Philo of Alexandria"],
      location: "Alexandria, Egypt",
      tags: ["platonism", "religion", "logos", "judaism"]
    },
    {
      date: "50 CE",
      sortYear: 50,
      title: "Epictetus and Roman Stoicism",
      summary: "Epictetus, a freed slave, became one of the most influential Stoic teachers, emphasising that freedom lies entirely in our inner response to external circumstances.",
      details: "Epictetus was born a slave in Phrygia and suffered physical disability, yet became one of the most powerful voices for human freedom in the ancient world. His teaching, recorded by his student Arrian in the Discourses and the Enchiridion, centres on one radical claim: true freedom is entirely internal.\n\nExternal things — health, wealth, social status, even one's own body — are not in our power. What is in our power is our judgement, our desires, our responses. The slave who understands this is freer than the emperor who does not.\n\nEpictetus's influence extended far beyond philosophy. His Enchiridion (Handbook) was used as a manual for practical living. Marcus Aurelius, the emperor-philosopher, was deeply influenced by him. In modern times, his ideas have been applied in Cognitive Behavioural Therapy.",
      significance: "Epictetus refined Stoic ethics into a practical philosophy of inner freedom that transcends social circumstances, influencing Christian spirituality and modern psychology.",
      figures: ["Epictetus", "Arrian"],
      location: "Nicopolis, Greece",
      tags: ["stoicism", "ethics", "freedom", "roman"]
    },
    {
      date: "121 CE",
      sortYear: 121,
      title: "Marcus Aurelius: The Philosopher-King",
      summary: "Marcus Aurelius, Roman Emperor, wrote the Meditations — a private Stoic journal that became one of the most widely read philosophical texts in history.",
      details: "Marcus Aurelius ruled the Roman Empire from 161 to 180 CE, facing constant warfare, plague, and political instability. In private, he kept a philosophical journal — written in Greek, never intended for publication — that we know as the Meditations.\n\nThe Meditations are a sustained exercise in Stoic self-discipline: reminders to himself to focus on what is in his control, to treat others with justice and patience, to contemplate death without fear, and to see his imperial power as an opportunity for service rather than self-aggrandisement.\n\nThey are also remarkably honest about failure — Marcus repeatedly chides himself for anger, vanity, and distraction. This combination of philosophical rigour and human fallibility has made the Meditations perennially appealing, from the Renaissance to modern self-help literature.",
      significance: "The Meditations gave the world its defining example of practical Stoic philosophy, demonstrating that philosophical principles can guide action even under extreme pressure.",
      figures: ["Marcus Aurelius", "Epictetus"],
      location: "Roman Empire",
      tags: ["stoicism", "ethics", "roman", "practical-philosophy"]
    },
    {
      date: "204 CE",
      sortYear: 204,
      title: "Plotinus and Neoplatonism",
      summary: "Plotinus developed Neoplatonism — a profound synthesis of Platonic philosophy — positing a hierarchy of being emanating from the One, which proved enormously influential on Christian mysticism.",
      details: "Plotinus is the founder of Neoplatonism, the last great creative system of ancient philosophy. Drawing on Plato, he constructed a metaphysical vision of extraordinary depth: reality emanates from the utterly transcendent One, through Intellect (Nous) and Soul, down to matter — like light radiating from the sun.\n\nThe human soul, trapped in matter, yearns to return to its source. Philosophy is the path of this return — a turning away from the sensory world toward pure intellect, and ultimately toward mystical union with the One, which Plotinus claimed to have experienced several times.\n\nNeoplatonism became the dominant philosophy of late antiquity and profoundly shaped Christian, Jewish, and Islamic theology. Augustine of Hippo was transformed by reading the Neoplatonists before his conversion to Christianity. The mystical traditions of all three Abrahamic religions bear the imprint of Plotinus.",
      significance: "Plotinus created Neoplatonism, the philosophical framework that mediated between ancient Greek philosophy and the emerging monotheistic religions, shaping mystical traditions across three faiths.",
      figures: ["Plotinus", "Porphyry"],
      location: "Rome",
      tags: ["platonism", "neoplatonism", "metaphysics", "mysticism"]
    },
    {
      date: "354 CE",
      sortYear: 354,
      title: "Augustine: Neoplatonism Meets Christianity",
      summary: "Augustine of Hippo synthesised Neoplatonic philosophy with Christian theology, producing a framework that dominated Western Christian thought for nearly a thousand years.",
      details: "Augustine of Hippo is the towering figure at the intersection of ancient philosophy and Christian theology. Before his conversion, he was transformed by reading the Neoplatonists — particularly Plotinus — and his subsequent theology is deeply shaped by Platonic and Neoplatonic thought.\n\nHis Confessions (c. 397 CE) gave the Western world its first great autobiography and a model for introspective self-examination. His City of God (413–426 CE), written after the sack of Rome by the Visigoths, offered a philosophy of history dividing humanity between those oriented toward God (the City of God) and those oriented toward earthly things (the City of Man).\n\nAugustine's doctrines of original sin, grace, predestination, and the nature of evil shaped Western Christianity — Catholic and Protestant alike. His synthesis of Platonism and Christianity defined philosophical theology until the recovery of Aristotle in the 12th century.",
      significance: "Augustine created the philosophical-theological synthesis that dominated Western Christian thought for nearly a millennium, shaping doctrines of sin, grace, and history.",
      figures: ["Augustine of Hippo"],
      location: "North Africa and Rome",
      tags: ["christianity", "neoplatonism", "theology", "late-antiquity"]
    }
  ]
};
