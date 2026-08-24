export type BinaryAnswer = 'yes' | 'no'

export type StationOneQuestionType = 'text' | 'yesno'

export type StationOneQuestion = {
  id: string
  prompt: string
  type: StationOneQuestionType
  /** Renders a number input with the existing 1–120 bounds — only the age
   * question needs this instead of a plain text field. */
  numeric?: boolean
}

export const STATION_ONE_INTAKE: StationOneQuestion[] = [
  { id: 'callName', prompt: 'What do you want us to call you?', type: 'text' },
  { id: 'age', prompt: 'What is your age?', type: 'text', numeric: true },
  { id: 'identity', prompt: 'What do you identify as?', type: 'text' },
  { id: 'orientation', prompt: 'What is your orientation?', type: 'text' },
  { id: 'doubtedOrientation', prompt: 'Have you ever doubted your orientation?', type: 'yesno' },
  { id: 'previousRelationships', prompt: 'Have you ever had previous relationships?', type: 'yesno' },
  { id: 'origin', prompt: 'Where are you from?', type: 'text' },
  { id: 'livesWhereBorn', prompt: 'Do you live where you were born?', type: 'yesno' },
  { id: 'washFrequency', prompt: 'How often do you wash yourself?', type: 'text' },
  { id: 'lastInsecure', prompt: 'When was the last time you felt insecure?', type: 'text' },
]

export type StationOnePhase =
  | 'intake'
  | 'analysis-intro'
  | 'scan-face'
  | 'scan-eyes'
  | 'scan-focus'
  | 'complete'
  | 'proceed'

export type StationOneState = {
  phase: StationOnePhase
  questionIndex: number
  answers: Record<string, string>
}

export type StationOneAction =
  | { type: 'SUBMIT_TEXT'; value: string }
  | { type: 'ANSWER'; value: BinaryAnswer }
  | { type: 'ADVANCE' }

const STATION_ONE_ADVANCE: Partial<Record<StationOnePhase, StationOnePhase>> = {
  'analysis-intro': 'scan-face',
  'scan-face': 'scan-eyes',
  'scan-eyes': 'scan-focus',
  'scan-focus': 'complete',
  complete: 'proceed',
}

export function createStationOneState(
  overrides: Partial<StationOneState> = {},
): StationOneState {
  return {
    phase: 'intake',
    questionIndex: 0,
    answers: {},
    ...overrides,
  }
}

function submitIntakeAnswer(state: StationOneState, value: string): StationOneState {
  const answers = { ...state.answers, [STATION_ONE_INTAKE[state.questionIndex].id]: value }
  const questionIndex = state.questionIndex + 1
  const phase = questionIndex >= STATION_ONE_INTAKE.length ? 'analysis-intro' : 'intake'
  return { ...state, answers, questionIndex, phase }
}

export function stationOneReducer(
  state: StationOneState,
  action: StationOneAction,
): StationOneState {
  const question = STATION_ONE_INTAKE[state.questionIndex]

  if (action.type === 'SUBMIT_TEXT' && state.phase === 'intake' && question?.type === 'text') {
    const value = action.value.trim()
    return value ? submitIntakeAnswer(state, value) : state
  }

  if (action.type === 'ANSWER' && state.phase === 'intake' && question?.type === 'yesno') {
    return submitIntakeAnswer(state, action.value)
  }

  if (action.type === 'ADVANCE') {
    const phase = STATION_ONE_ADVANCE[state.phase]
    return phase ? { ...state, phase } : state
  }

  return state
}

export type StationTwoQuestionType = 'yesno' | 'text' | 'scale'

export type StationTwoQuestionContext = {
  answers: Record<string, string>
  age: number | null
  previousRelationships: BinaryAnswer | null
}

export type StationTwoQuestion = {
  id: string
  prompt: string
  type: StationTwoQuestionType
  /** Some questions only make sense given an earlier answer, or should be
   * skipped for visitors who told Station I they're under 18 — evaluated
   * against the answers gathered so far plus the visitor's age. */
  visibleIf?: (ctx: StationTwoQuestionContext) => boolean
}

function isAdult(age: number | null): boolean {
  return age !== null && age >= 18
}

export const STATION_TWO_QUESTIONS: StationTwoQuestion[] = [
  { id: 'attractiveness', prompt: 'Is attractiveness important to you?', type: 'yesno' },
  { id: 'selfSmart', prompt: "Do you think you're a smart person?", type: 'yesno' },
  { id: 'partnerSmart', prompt: 'Should your partner be smart?', type: 'yesno' },
  {
    id: 'howSmart',
    prompt: 'How smart?',
    type: 'scale',
    visibleIf: (ctx) => ctx.answers.partnerSmart === 'yes',
  },
  { id: 'traditional', prompt: 'Do you want a traditional relationship?', type: 'yesno' },
  {
    id: 'pornography',
    prompt: 'Have you ever watched pornography?',
    type: 'yesno',
    visibleIf: (ctx) => isAdult(ctx.age),
  },
  {
    id: 'aiPornography',
    prompt: 'Have you knowingly watched AI pornography?',
    type: 'yesno',
    visibleIf: (ctx) => isAdult(ctx.age) && ctx.answers.pornography === 'yes',
  },
  {
    id: 'libido',
    prompt: 'Do you have a high libido?',
    type: 'yesno',
    visibleIf: (ctx) => isAdult(ctx.age),
  },
  {
    id: 'cheating',
    prompt: 'Have you ever thought about cheating?',
    type: 'yesno',
    visibleIf: (ctx) => isAdult(ctx.age) && ctx.previousRelationships === 'yes',
  },
  { id: 'higherPower', prompt: 'Do you believe in a higher power?', type: 'yesno' },
  {
    id: 'god',
    prompt: 'God?',
    type: 'yesno',
    visibleIf: (ctx) => ctx.answers.higherPower === 'yes',
  },
  {
    id: 'somethingElse',
    prompt: 'Something else?',
    type: 'text',
    visibleIf: (ctx) => ctx.answers.higherPower === 'yes' && ctx.answers.god === 'no',
  },
  { id: 'escapism', prompt: 'Do you practice escapism?', type: 'yesno' },
]

export type ThisOrThatPair = { id: string; left: string; right: string }

export const STATION_TWO_LIGHTNING: ThisOrThatPair[] = [
  { id: 'beautyMoney', left: 'Beauty', right: 'Money' },
  { id: 'insideOutside', left: 'Inside', right: 'Outside' },
  { id: 'processResult', left: 'Process', right: 'Result' },
  { id: 'calmExcitement', left: 'Calm', right: 'Excitement' },
  { id: 'sexLove', left: 'Sex', right: 'Love' },
  { id: 'rebellionSimplicity', left: 'Rebellion', right: 'Simplicity' },
  { id: 'natureComfort', left: 'Nature', right: 'Comfort' },
]

export type StationTwoPhase =
  | 'percentile'
  | 'companion-intro'
  | 'debra-brief'
  | 'question'
  | 'height'
  | 'lightning-intro'
  | 'lightning'
  | 'complete'

export type StationTwoState = {
  phase: StationTwoPhase
  questionIndex: number
  answers: Record<string, string>
  height: number
  lightningIndex: number
  lightningAnswers: Record<string, string>
  age: number | null
  previousRelationships: BinaryAnswer | null
}

export type StationTwoAction =
  | { type: 'ADVANCE' }
  | { type: 'ANSWER'; value: BinaryAnswer }
  | { type: 'SUBMIT_TEXT'; value: string }
  | { type: 'SET_SCALE'; value: number }
  | { type: 'SET_HEIGHT'; value: number }

export function createStationTwoState(
  overrides: Partial<StationTwoState> = {},
): StationTwoState {
  return {
    phase: 'percentile',
    questionIndex: 0,
    answers: {},
    height: 0.5,
    lightningIndex: 0,
    lightningAnswers: {},
    age: null,
    previousRelationships: null,
    ...overrides,
  }
}

function questionContext(state: StationTwoState): StationTwoQuestionContext {
  return {
    answers: state.answers,
    age: state.age,
    previousRelationships: state.previousRelationships,
  }
}

function nextVisibleQuestionIndex(start: number, ctx: StationTwoQuestionContext): number {
  let index = start
  while (index < STATION_TWO_QUESTIONS.length) {
    const question = STATION_TWO_QUESTIONS[index]
    if (!question.visibleIf || question.visibleIf(ctx)) return index
    index += 1
  }
  return index
}

function advanceQuestion(state: StationTwoState, id: string, value: string): StationTwoState {
  const answers = { ...state.answers, [id]: value }
  const ctx = { answers, age: state.age, previousRelationships: state.previousRelationships }
  const questionIndex = nextVisibleQuestionIndex(state.questionIndex + 1, ctx)
  const phase = questionIndex >= STATION_TWO_QUESTIONS.length ? 'height' : 'question'
  return { ...state, answers, questionIndex, phase }
}

export function stationTwoReducer(
  state: StationTwoState,
  action: StationTwoAction,
): StationTwoState {
  const currentQuestion = STATION_TWO_QUESTIONS[state.questionIndex]

  if (action.type === 'ADVANCE') {
    if (state.phase === 'percentile') return { ...state, phase: 'companion-intro' }
    if (state.phase === 'companion-intro') return { ...state, phase: 'debra-brief' }
    if (state.phase === 'debra-brief') {
      const questionIndex = nextVisibleQuestionIndex(0, questionContext(state))
      return questionIndex >= STATION_TWO_QUESTIONS.length
        ? { ...state, phase: 'height' }
        : { ...state, phase: 'question', questionIndex }
    }
    if (state.phase === 'question' && currentQuestion?.type === 'scale') {
      const value = state.answers[currentQuestion.id] ?? '0.5'
      return advanceQuestion(state, currentQuestion.id, value)
    }
    if (state.phase === 'height') return { ...state, phase: 'lightning-intro' }
    if (state.phase === 'lightning-intro') return { ...state, phase: 'lightning' }
    return state
  }

  if (action.type === 'ANSWER' && state.phase === 'question' && currentQuestion?.type === 'yesno') {
    return advanceQuestion(state, currentQuestion.id, action.value)
  }

  if (action.type === 'ANSWER' && state.phase === 'lightning') {
    const pair = STATION_TWO_LIGHTNING[state.lightningIndex]
    if (!pair) return state
    const chosen = action.value === 'yes' ? pair.left : pair.right
    const lightningAnswers = { ...state.lightningAnswers, [pair.id]: chosen }
    const lightningIndex = state.lightningIndex + 1
    const phase = lightningIndex >= STATION_TWO_LIGHTNING.length ? 'complete' : 'lightning'
    return { ...state, lightningAnswers, lightningIndex, phase }
  }

  if (action.type === 'SUBMIT_TEXT' && state.phase === 'question' && currentQuestion?.type === 'text') {
    const value = action.value.trim()
    return value ? advanceQuestion(state, currentQuestion.id, value) : state
  }

  if (action.type === 'SET_SCALE' && state.phase === 'question' && currentQuestion?.type === 'scale') {
    const value = String(Math.min(1, Math.max(0, action.value)))
    return { ...state, answers: { ...state.answers, [currentQuestion.id]: value } }
  }

  if (action.type === 'SET_HEIGHT' && state.phase === 'height') {
    return { ...state, height: Math.min(1, Math.max(0, action.value)) }
  }

  return state
}
