// بنك أسئلة اختبار المستوى — ملف Server-only فقط.
// لا يُستورد هذا الملف من أي مكوّن "use client"؛ يُستخدم فقط داخل src/app/api/level-test/*
// حتى لا تصل حقول answer الصحيحة إلى حزمة المتصفح إطلاقًا.

export type TrackId = "general" | "schools" | "business";

export type QuestionId = number | string;

export type Question = {
  id: QuestionId;
  skill:
    | "Conversation"
    | "Grammar"
    | "Vocabulary"
    | "Use of English"
    | "Reading";
  difficulty: number;
  question: string;
  options: string[];
  answer: number;
};

export type AnswerRecord = {
  questionId: QuestionId;
  correct: boolean;
  difficulty: number;
  skill: Question["skill"];
};

export type Track = {
  id: TrackId;
  title: string;
  subtitle: string;
  description: string;
  questions: Question[];
};

export const MAX_QUESTIONS = 25;

export const levelNames: Record<number, string> = {
  1: "A1",
  2: "A2",
  3: "B1",
  4: "B2",
  5: "C1",
};

export const levelDescriptions: Record<string, string> = {
  A1: "مستوى مبتدئ. تستطيع فهم واستخدام عبارات أساسية في المواقف اليومية البسيطة.",
  A2: "مستوى أساسي. تستطيع التعامل مع المواقف اليومية والتواصل في موضوعات مألوفة.",
  B1: "مستوى متوسط. تستطيع التعامل مع معظم المواقف اليومية والتعبير عن أفكارك بشكل مفهوم.",
  B2: "مستوى فوق المتوسط. تستطيع التواصل بثقة وفهم نصوص ومواقف أكثر تعقيدًا.",
  C1: "مستوى متقدم. تستطيع استخدام الإنجليزية بمرونة وفهم اللغة في مواقف أكاديمية ومهنية متقدمة.",
};

export const tracks: Track[] = [
  {
    id: "general",
    title: "General English",
    subtitle: "الإنجليزية العامة",
    description:
      "اختبار لتحديد مستواك في الإنجليزية المستخدمة في الحياة اليومية والدراسة والعمل.",
    questions: [
      {
        id: 1,
        skill: "Conversation",
        difficulty: 1,
        question: "Can I park here?",
        options: [
          "Sorry, I did that.",
          "It's the same place.",
          "Only for half an hour.",
        ],
        answer: 2,
      },
      {
        id: 2,
        skill: "Conversation",
        difficulty: 1,
        question: "What colour will you paint the children's bedroom?",
        options: [
          "I hope it was right.",
          "We can't decide.",
          "It wasn't very difficult.",
        ],
        answer: 1,
      },
      {
        id: 3,
        skill: "Conversation",
        difficulty: 1,
        question: "I can't understand this email.",
        options: [
          "Would you like some help?",
          "Don't you know?",
          "I suppose you can.",
        ],
        answer: 0,
      },
      {
        id: 4,
        skill: "Conversation",
        difficulty: 1,
        question: "I'd like two tickets for tomorrow night.",
        options: [
          "How much did you pay?",
          "Afternoon and evening.",
          "I'll just check for you.",
        ],
        answer: 2,
      },
      {
        id: 5,
        skill: "Conversation",
        difficulty: 1,
        question: "Shall we go to the gym now?",
        options: [
          "I'm too tired.",
          "It's very good.",
          "Not at all.",
        ],
        answer: 0,
      },
      {
        id: 6,
        skill: "Grammar",
        difficulty: 2,
        question:
          "His eyes were ...... bad that he couldn't read the number plate of the car in front.",
        options: ["such", "too", "so", "very"],
        answer: 2,
      },
      {
        id: 7,
        skill: "Vocabulary",
        difficulty: 2,
        question:
          "The company needs to decide ...... and for all what its position is on this point.",
        options: ["here", "once", "first", "finally"],
        answer: 1,
      },
      {
        id: 8,
        skill: "Vocabulary",
        difficulty: 2,
        question:
          "Don't put your cup on the ...... of the table – someone will knock it off.",
        options: ["outside", "edge", "boundary", "border"],
        answer: 1,
      },
      {
        id: 9,
        skill: "Vocabulary",
        difficulty: 2,
        question: "I'm sorry - I didn't ...... to disturb you.",
        options: ["hope", "think", "mean", "suppose"],
        answer: 2,
      },
      {
        id: 10,
        skill: "Grammar",
        difficulty: 2,
        question:
          "The singer ended the concert ...... her most popular song.",
        options: ["by", "with", "in", "as"],
        answer: 1,
      },
      {
        id: 11,
        skill: "Grammar",
        difficulty: 3,
        question:
          "Would you mind ...... these plates a wipe before putting them in the cupboard?",
        options: ["making", "doing", "getting", "giving"],
        answer: 3,
      },
      {
        id: 12,
        skill: "Grammar",
        difficulty: 3,
        question:
          "I was looking forward ...... at the new restaurant, but it was closed.",
        options: ["to eat", "to have eaten", "to eating", "eating"],
        answer: 2,
      },
      {
        id: 13,
        skill: "Grammar",
        difficulty: 3,
        question:
          "...... tired Melissa is when she gets home from work, she always makes time to say goodnight to the children.",
        options: ["Whatever", "No matter how", "However much", "Although"],
        answer: 1,
      },
      {
        id: 14,
        skill: "Grammar",
        difficulty: 3,
        question:
          "It was only ten days ago ...... she started her new job.",
        options: ["then", "since", "after", "that"],
        answer: 3,
      },
      {
        id: 15,
        skill: "Vocabulary",
        difficulty: 3,
        question:
          "The shop didn't have the shoes I wanted, but they've ...... a pair specially for me.",
        options: ["booked", "ordered", "commanded", "asked"],
        answer: 1,
      },
      {
        id: 16,
        skill: "Grammar",
        difficulty: 4,
        question:
          "Have you got time to discuss your work now or are you ...... to leave?",
        options: ["thinking", "round", "planned", "about"],
        answer: 3,
      },
      {
        id: 17,
        skill: "Vocabulary",
        difficulty: 4,
        question: "She came to live here ...... a month ago.",
        options: ["quite", "beyond", "already", "almost"],
        answer: 3,
      },
      {
        id: 18,
        skill: "Vocabulary",
        difficulty: 4,
        question:
          "Once the plane is in the air, you can ...... your seat belts if you wish.",
        options: ["undress", "unfasten", "unlock", "untie"],
        answer: 1,
      },
      {
        id: 19,
        skill: "Vocabulary",
        difficulty: 4,
        question:
          "I left my last job because I had no ...... to travel.",
        options: ["place", "position", "opportunity", "possibility"],
        answer: 2,
      },
      {
        id: 20,
        skill: "Vocabulary",
        difficulty: 4,
        question:
          "It wasn't a bad crash and ...... damage was done to my car.",
        options: ["little", "small", "light", "mere"],
        answer: 0,
      },
      {
        id: 21,
        skill: "Grammar",
        difficulty: 5,
        question:
          "I'd rather you ...... to her why we can't go.",
        options: [
          "would explain",
          "explained",
          "to explain",
          "will explain",
        ],
        answer: 1,
      },
      {
        id: 22,
        skill: "Vocabulary",
        difficulty: 5,
        question:
          "Before making a decision, the leader considered all ...... of the argument.",
        options: ["sides", "features", "perspectives", "shades"],
        answer: 0,
      },
      {
        id: 23,
        skill: "Vocabulary",
        difficulty: 5,
        question:
          "This new printer is recommended as being ...... reliable.",
        options: ["greatly", "highly", "strongly", "readily"],
        answer: 1,
      },
      {
        id: 24,
        skill: "Vocabulary",
        difficulty: 5,
        question:
          "When I realised I had dropped my gloves, I decided to ...... my steps.",
        options: ["retrace", "regress", "resume", "return"],
        answer: 0,
      },
      {
        id: 25,
        skill: "Vocabulary",
        difficulty: 5,
        question:
          "Anne's house is somewhere in the ...... of the railway station.",
        options: ["region", "quarter", "vicinity", "district"],
        answer: 2,
      },
    ],
  },

  {
    id: "schools",
    title: "For Schools",
    subtitle: "للطلاب والمدارس",
    description:
      "اختبار مناسب للطلاب ويركز على الإنجليزية المستخدمة في المواقف اليومية والتعليمية.",
    questions: [
      {
        id: 1,
        skill: "Conversation",
        difficulty: 1,
        question: "Could you tell me your surname?",
        options: [
          "Would you like me to spell it?",
          "Do you like my family name?",
          "How do I say that?",
        ],
        answer: 0,
      },
      {
        id: 2,
        skill: "Conversation",
        difficulty: 1,
        question: "This plant looks dead.",
        options: [
          "It's in the garden.",
          "It only needs some water.",
          "It's sleeping.",
        ],
        answer: 1,
      },
      {
        id: 3,
        skill: "Conversation",
        difficulty: 1,
        question: "I hope it doesn't rain.",
        options: ["Of course not.", "Will it be wet?", "So do I."],
        answer: 2,
      },
      {
        id: 4,
        skill: "Conversation",
        difficulty: 1,
        question: "Are you going to come inside soon?",
        options: ["For ever.", "Not long.", "In a minute."],
        answer: 2,
      },
      {
        id: 5,
        skill: "Conversation",
        difficulty: 1,
        question: "Who gave you this book, Lucy?",
        options: ["I bought it.", "For my birthday.", "My uncle was."],
        answer: 0,
      },
      {
        id: 6,
        skill: "Conversation",
        difficulty: 1,
        question: "Shall we go out for pizza tonight?",
        options: ["I know that.", "It's very good.", "I'm too tired."],
        answer: 2,
      },
      {
        id: 7,
        skill: "Conversation",
        difficulty: 1,
        question: "Do you mind if I come too?",
        options: ["That's fine!", "I'd like to.", "I don't know if I can."],
        answer: 0,
      },
      {
        id: 8,
        skill: "Conversation",
        difficulty: 1,
        question: "There's someone at the door.",
        options: [
          "Can I help you?",
          "Well, go and answer it then.",
          "He's busy at the moment.",
        ],
        answer: 1,
      },
      {
        id: 9,
        skill: "Conversation",
        difficulty: 2,
        question: "How much butter do I need for this cake?",
        options: ["I'd like one.", "I'll use some.", "I'm not sure."],
        answer: 2,
      },
      {
        id: 10,
        skill: "Grammar",
        difficulty: 2,
        question: "How long are you here for?",
        options: ["Since last week.", "Ten days ago.", "Till tomorrow."],
        answer: 2,
      },
      {
        id: 11,
        skill: "Conversation",
        difficulty: 2,
        question: "Have you guys had enough to eat?",
        options: [
          "That's all right.",
          "Is there any more rice?",
          "It's not the right time.",
        ],
        answer: 1,
      },
      {
        id: 12,
        skill: "Conversation",
        difficulty: 2,
        question: "That's my coat over there.",
        options: ["Will you take it off?", "No, you haven't.", "Here you are."],
        answer: 2,
      },
      {
        id: 13,
        skill: "Conversation",
        difficulty: 2,
        question: "Let's go by bus.",
        options: [
          "The train was expensive.",
          "We'll buy a ticket.",
          "It'll take too long.",
        ],
        answer: 0,
      },
      {
        id: 14,
        skill: "Conversation",
        difficulty: 2,
        question: "Do you know my brother Charlie?",
        options: [
          "Sorry, he's not here.",
          "I don't think I do.",
          "I know.",
        ],
        answer: 1,
      },
      {
        id: 15,
        skill: "Conversation",
        difficulty: 2,
        question: "Would you like some ice in your drink or not?",
        options: ["I hope so.", "Yes, I shall.", "I don't mind."],
        answer: 2,
      },
      {
        id: 16,
        skill: "Vocabulary",
        difficulty: 3,
        question:
          "I hope I haven't ...... you any trouble by changing the arrangements.",
        options: ["put", "caused", "made", "done"],
        answer: 1,
      },
      {
        id: 17,
        skill: "Vocabulary",
        difficulty: 3,
        question:
          "The floor is wet: don't run or you might ...... !",
        options: ["stoop", "spill", "slip", "spin"],
        answer: 2,
      },
      {
        id: 18,
        skill: "Vocabulary",
        difficulty: 3,
        question:
          "When you come to my house, ...... your camera with you.",
        options: ["take", "show", "fetch", "bring"],
        answer: 3,
      },
      {
        id: 19,
        skill: "Vocabulary",
        difficulty: 3,
        question:
          "Paul arrived at the shop ....... as the manager was closing for the day.",
        options: ["even", "just", "still", "right"],
        answer: 1,
      },
      {
        id: 20,
        skill: "Grammar",
        difficulty: 3,
        question:
          "I would ...... to stay at home and relax for a change.",
        options: ["rather", "better", "prefer", "enjoy"],
        answer: 0,
      },
      {
        id: 21,
        skill: "Vocabulary",
        difficulty: 4,
        question: "Is there ...... of food for everyone?",
        options: ["adequate", "enough", "sufficient", "plenty"],
        answer: 3,
      },
      {
        id: 22,
        skill: "Grammar",
        difficulty: 4,
        question:
          "Lily says she's happy at school but she's ...... complaining.",
        options: ["rarely", "sometimes", "always", "often"],
        answer: 2,
      },
      {
        id: 23,
        skill: "Vocabulary",
        difficulty: 4,
        question: "...... the step when you go in.",
        options: ["Consider", "Mind", "Attend", "Look"],
        answer: 1,
      },
      {
        id: 24,
        skill: "Vocabulary",
        difficulty: 5,
        question:
          "...... stay the night if it's too difficult to get home.",
        options: [
          "At all costs",
          "By all means",
          "In all",
          "On the whole",
        ],
        answer: 1,
      },
      {
        id: 25,
        skill: "Vocabulary",
        difficulty: 5,
        question:
          "No ...... Hannah is happy when you think how many prizes she has won recently.",
        options: ["surprise", "problem", "question", "wonder"],
        answer: 3,
      },
    ],
  },

  {
    id: "business",
    title: "Business English",
    subtitle: "الإنجليزية للأعمال",
    description:
      "اختبار يركز على اللغة الإنجليزية المستخدمة في بيئة العمل والتواصل المهني.",
    questions: [
  {
    id: "business-1",
    skill: "Reading",
    difficulty: 1,
    question:
      "Please remember that your manager must agree to any holiday dates before you complete a form. Why is the HR department sending this email?",
    options: [
      "To ask staff for some information",
      "To explain how something is done",
      "To tell managers about a problem",
    ],
    answer: 1,
  },

  {
    id: "business-2",
    skill: "Reading",
    difficulty: 1,
    question:
      "FINEFOODS requires an agent for nationwide distribution. Some experience in food retail is an advantage and a refrigerated van is provided. Finefoods requires an agent to:",
    options: [
      "Own a suitable vehicle for delivery.",
      "Be a specialist in food distribution.",
      "Deliver goods all over the country.",
    ],
    answer: 2,
  },

  {
    id: "business-3",
    skill: "Reading",
    difficulty: 1,
    question:
      "Staff wishing to enrol for the Accounts course should contact Jane Fellows, who needs to know numbers. Staff should tell Jane Fellows:",
    options: [
      "How many people have enrolled for the course.",
      "If they are interested in doing the course.",
      "Which of the courses they have decided to do.",
    ],
    answer: 1,
  },

  {
    id: "business-4",
    skill: "Reading",
    difficulty: 1,
    question:
      "Phone Neil Smith at our showroom for a free quotation, or to arrange a visit from our representative. Contact Neil Smith if you want to:",
    options: [
      "Obtain information about the company's prices.",
      "Arrange a visit to the showroom.",
      "Speak to a representative about special offers.",
    ],
    answer: 0,
  },

  {
    id: "business-5",
    skill: "Vocabulary",
    difficulty: 2,
    question:
      "Existing customers seem to be ______ you for the competition almost as fast as you can get new ones.",
    options: [
      "departing",
      "abandoning",
      "defecting",
      "withdrawing",
    ],
    answer: 2,
  },

  {
    id: "business-6",
    skill: "Vocabulary",
    difficulty: 2,
    question:
      "You can ______ your service for yourself, or watch your customers using it.",
    options: [
      "taste",
      "try",
      "experiment",
      "attempt",
    ],
    answer: 1,
  },

  {
    id: "business-7",
    skill: "Vocabulary",
    difficulty: 2,
    question:
      "The objective is to identify the ______ on which customers will form their judgement of your service.",
    options: [
      "topics",
      "subjects",
      "headings",
      "issues",
    ],
    answer: 3,
  },

  {
    id: "business-8",
    skill: "Vocabulary",
    difficulty: 2,
    question:
      "It would be foolish to think you could know all of those questions, let alone their answers, at the ______.",
    options: [
      "outset",
      "introduction",
      "origin",
      "foundation",
    ],
    answer: 0,
  },

  {
    id: "business-9",
    skill: "Vocabulary",
    difficulty: 2,
    question:
      "Your reputation is at ______ if you fail to deliver.",
    options: [
      "danger",
      "risk",
      "peril",
      "hazard",
    ],
    answer: 1,
  },

  {
    id: "business-10",
    skill: "Vocabulary",
    difficulty: 2,
    question:
      "Remember that customer satisfaction is a ______ target: today's satisfied customer may be tomorrow's bored one.",
    options: [
      "going",
      "passing",
      "moving",
      "travelling",
    ],
    answer: 2,
  },

  {
    id: "business-11",
    skill: "Vocabulary",
    difficulty: 2,
    question:
      "A service level that ______ the button today may be considered downright sloppy in six months' time.",
    options: [
      "touches",
      "hits",
      "knocks",
      "strikes",
    ],
    answer: 1,
  },

  {
    id: "business-12",
    skill: "Vocabulary",
    difficulty: 3,
    question:
      "The company's workforce ______ from six apprentices to highly qualified and experienced permanent employees.",
    options: [
      "ranges",
      "spreads",
      "distributes",
      "expands",
    ],
    answer: 0,
  },

  {
    id: "business-13",
    skill: "Vocabulary",
    difficulty: 3,
    question:
      "The company actively ______ employees to progress through the organisation.",
    options: [
      "encourages",
      "supports",
      "promotes",
      "rewards",
    ],
    answer: 0,
  },

  {
    id: "business-14",
    skill: "Vocabulary",
    difficulty: 3,
    question:
      "Each new project, whatever its size, is ______ with the same dedication.",
    options: [
      "advanced",
      "focused",
      "worked",
      "handled",
    ],
    answer: 3,
  },

  {
    id: "business-15",
    skill: "Vocabulary",
    difficulty: 3,
    question:
      "At present, the company is ______ in the refurbishment of a major concert hall in London.",
    options: [
      "concerned",
      "involved",
      "preoccupied",
      "committed",
    ],
    answer: 1,
  },

  {
    id: "business-16",
    skill: "Vocabulary",
    difficulty: 3,
    question:
      "The project is expected to be completed within ______ and on schedule.",
    options: [
      "cost",
      "budget",
      "estimate",
      "funding",
    ],
    answer: 1,
  },

  {
    id: "business-17",
    skill: "Vocabulary",
    difficulty: 3,
    question:
      "The company's varied project ______ includes numerous well-known corporate clients.",
    options: [
      "collection",
      "assortment",
      "portfolio",
      "accumulation",
    ],
    answer: 2,
  },

  {
    id: "business-18",
    skill: "Vocabulary",
    difficulty: 3,
    question:
      "The company also carried ______ restoration work at Windsor Castle.",
    options: [
      "off",
      "on",
      "over",
      "out",
    ],
    answer: 3,
  },

  {
    id: "business-19",
    skill: "Vocabulary",
    difficulty: 4,
    question:
      "Unlike some competitors, which are currently ______ at a loss, the company has reported its most successful year ever.",
    options: [
      "managing",
      "acting",
      "conducting",
      "running",
    ],
    answer: 3,
  },

  {
    id: "business-20",
    skill: "Vocabulary",
    difficulty: 4,
    question:
      "The company's commitment to developing its workforce is highlighted in its mission ______.",
    options: [
      "statement",
      "announcement",
      "promise",
      "undertaking",
    ],
    answer: 0,
  },

  {
    id: "business-21",
    skill: "Vocabulary",
    difficulty: 4,
    question:
      "One of the managing director's first actions was to ______ employees' training needs.",
    options: [
      "assess",
      "value",
      "reckon",
      "figure",
    ],
    answer: 0,
  },

  {
    id: "business-22",
    skill: "Vocabulary",
    difficulty: 4,
    question:
      "The training programme enables employees to work towards nationally ______ qualifications.",
    options: [
      "classified",
      "recognised",
      "identified",
      "regarded",
    ],
    answer: 1,
  },

  {
    id: "business-23",
    skill: "Vocabulary",
    difficulty: 4,
    question:
      "Employees should have ______ to training and good working conditions.",
    options: [
      "access",
      "entrance",
      "availability",
      "admission",
    ],
    answer: 0,
  },

  {
    id: "business-24",
    skill: "Vocabulary",
    difficulty: 4,
    question:
      "The management wants staff at all ______ of the company to be fully informed about its activities.",
    options: [
      "ranks",
      "statures",
      "levels",
      "positions",
    ],
    answer: 2,
  },

  {
    id: "business-25",
    skill: "Vocabulary",
    difficulty: 4,
    question:
      "The company has invested in training and new facilities, and its future is ______ good.",
    options: [
      "seeming",
      "showing",
      "looking",
      "appearing",
    ],
    answer: 2,
},
],
},
];


// نسخة عامة من السؤال بلا حقل "answer" — هذا فقط ما يصل إلى المتصفح
export type PublicQuestion = Omit<Question, "answer">;

export function toPublicQuestion(q: Question): PublicQuestion {
  const { answer, ...rest } = q;
  return rest;
}
