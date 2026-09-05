"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getResultStorageKey } from '@/lib/auth';

type SpeechRecognitionType = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    maxAlternatives?: number;
    onstart?: (() => void) | null;
    onresult: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
};

type SectionKey = 'word_forward' | 'word_reverse' | 'number_forward' | 'number_reverse' | 'childhood' | 'adult' | 'recent' | 'adaptive';

const DEFAULT_WORD_BANK = [
    'River', 'Lamp', 'Garden', 'Mirror', 'Pencil', 'Tiger', 'Window', 'Orange', 'Bridge', 'Feather',
    'Mountain', 'Clock', 'Butterfly', 'Teacup', 'Library', 'Ocean', 'Temple', 'Camera', 'Parrot', 'Rainbow',
];

const DEFAULT_NUMBER_BANK = ['3', '7', '12', '19', '24', '31', '45', '58', '64', '72', '88', '91', '26', '39', '47', '53', '67', '75'];

const STEP_LAYOUT = [
    { key: 'word_forward', label: 'Word Recall Forward', type: 'recall' },
    { key: 'word_reverse', label: 'Word Recall Reverse', type: 'recall' },
    { key: 'number_forward', label: 'Number Recall Forward', type: 'recall' },
    { key: 'number_reverse', label: 'Number Recall Reverse', type: 'recall' },
    { key: 'childhood', label: 'Childhood Memory', type: 'memory' },
    { key: 'adult', label: 'Adult Memory', type: 'memory' },
    { key: 'recent', label: 'Recent Memory', type: 'memory' },
    { key: 'adaptive', label: 'Adaptive Follow-up', type: 'adaptive' },
] as const;

const DEFAULT_MEMORY_PROMPTS: Record<'childhood' | 'adult' | 'recent', string> = {
    childhood: 'Tell me about a childhood memory that still feels vivid to you.',
    adult: 'Tell me about a meaningful memory from your adult life.',
    recent: 'Tell me about a recent memory from the past few weeks that you can recall easily.',
};

const RECALL_SHOW_SECONDS = 10;
const RECALL_ANSWER_SECONDS = 30;
const MEMORY_WAIT_SECONDS = 15;
const MEMORY_ANSWER_SECONDS = 45;

type TestConfig = {
    word_bank?: string[];
    number_bank?: string[];
    memory_prompts?: Partial<Record<'childhood' | 'adult' | 'recent', string>>;
};

type SharedMemory = {
    id: string;
    category: string;
    text: string;
    createdAt: string;
};

const pickShuffle = <T,>(items: T[], count: number) => [...items].sort(() => Math.random() - 0.5).slice(0, count);
const normalizeTokens = (text: string) => text.toLowerCase().split(/[\s,.;:!?]+/).filter(Boolean);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

const normalizeAnswerText = (text: string) => {
    const cleaned = String(text || '').trim();
    if (!cleaned) return '';
    const lowered = cleaned.toLowerCase().replace(/\s+/g, ' ');
    if (/^(nil|null|none|n\/a|na|undefined|blank|empty)$/i.test(lowered)) return '';
    return cleaned;
};

const NUMBER_WORD_MAP: Record<string, string> = {
    zero: '0', oh: '0', o: '0',
    one: '1', won: '1',
    two: '2', to: '2', too: '2',
    three: '3', tree: '3',
    four: '4', for: '4', fore: '4',
    five: '5',
    six: '6', sex: '6',
    seven: '7',
    eight: '8', ate: '8',
    nine: '9',
    ten: '10',
    eleven: '11',
    twelve: '12',
    thirteen: '13',
    fourteen: '14',
    fifteen: '15',
    sixteen: '16',
    seventeen: '17',
    eighteen: '18',
    nineteen: '19',
    twenty: '20',
    thirty: '30',
    forty: '40',
    fifty: '50',
    sixty: '60',
    seventy: '70',
    eighty: '80',
    ninety: '90',
};

const NUMBER_PHRASE_MAP: Record<string, string> = {
    'twenty four': '24',
    'thirty one': '31',
    'forty five': '45',
    'fifty eight': '58',
    'sixty four': '64',
    'seventy two': '72',
    'eighty eight': '88',
    'ninety one': '91',
    'twenty six': '26',
    'thirty nine': '39',
    'forty seven': '47',
    'fifty three': '53',
    'sixty seven': '67',
    'seventy five': '75',
    'twenty one': '21',
    'twenty two': '22',
    'twenty three': '23',
    'twenty five': '25',
    'twenty seven': '27',
    'twenty eight': '28',
    'twenty nine': '29',
};

const levenshtein = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            );
        }
    }
    return dp[a.length][b.length];
};

const summarizeAnswer = (text: string) => {
    const cleaned = String(text || '').trim();
    if (!cleaned) return '';
    const firstSentence = cleaned.split(/[.!?]/)[0] || cleaned;
    const words = firstSentence.split(/\s+/).filter(Boolean).slice(0, 14);
    return words.join(' ').trim();
};

const STOP_WORDS = new Set([
    'about', 'there', 'their', 'where', 'which', 'while', 'would', 'could', 'should', 'because', 'before', 'after', 'during',
    'through', 'those', 'these', 'today', 'still', 'memory', 'thing', 'something', 'really', 'have', 'has', 'had', 'was',
    'were', 'been', 'being', 'this', 'that', 'then', 'with', 'from', 'into', 'your', 'you', 'mine', 'ours', 'very', 'just',
    'when', 'what', 'which', 'who', 'whom', 'does', 'did', 'done', 'make', 'made', 'came', 'come', 'went', 'want', 'like',
]);

const GENERIC_OVERLAP_WORDS = new Set(['have', 'time', 'life', 'place', 'person', 'people', 'event', 'story', 'memory']);

const sanitizeNarrativeText = (text: string) =>
    String(text || '')
        .replace(/\b(uh|um|hmm|ah|er|like|you know)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const extractKeyPhrases = (text: string) => {
    const tokens = normalizeTokens(text)
        .filter((token) => /^[a-z][a-z0-9'-]*$/.test(token))
        .filter((token) => token.length >= 5 && !STOP_WORDS.has(token))
        .slice(0, 18);
    return [...new Set(tokens)];
};

const buildAdaptivePrompt = (answers: Record<string, string>, priorMemories: string[] = []) => {
    const memories = [
        { label: 'childhood memory', text: normalizeAnswerText(answers.childhood) },
        { label: 'adult memory', text: normalizeAnswerText(answers.adult) },
        { label: 'recent memory', text: normalizeAnswerText(answers.recent) },
    ].filter((m) => m.text.length > 0);

    if (!memories.length) {
        return 'Which one personal memory feels the most vivid to you now, and what happened just before and after that moment?';
    }

    const focusMemory = memories
        .map((m) => ({ ...m, wc: normalizeTokens(m.text).length }))
        .sort((a, b) => b.wc - a.wc)[0];

    const focusSnippet = summarizeAnswer(focusMemory.text);
    const focusKeywords = extractKeyPhrases(focusMemory.text);
    const priorTokens = extractKeyPhrases(priorMemories.join(' '));
    const overlap = focusKeywords.find((k) => priorTokens.includes(k) && !GENERIC_OVERLAP_WORDS.has(k));

    if (overlap) {
        return `You described this ${focusMemory.label}: "${focusSnippet}". You also mentioned "${overlap}" in earlier sessions. Please describe one concrete moment connected to "${overlap}": who was present, where it happened, and what happened immediately before and after.`;
    }

    const focusCue = focusKeywords.find((k) => !GENERIC_OVERLAP_WORDS.has(k)) || 'that event';
    return `You described this ${focusMemory.label}: "${focusSnippet}". Please focus on ${focusCue} and narrate one exact sequence with timeline markers (first, next, then, finally), including a place and one person involved.`;
};

const scoreOrderedRecall = (expected: string[], answer: string, reverse = false) => {
    const target = reverse ? [...expected].reverse() : expected;
    const tokens = normalizeTokens(answer);
    const targetTokens = target.map((item) => item.toLowerCase());

    const exactHits = targetTokens.filter((item, index) => tokens[index] === item).length;
    const exactScore = targetTokens.length ? exactHits / targetTokens.length : 0;

    const unorderedHits = targetTokens.filter((item) => tokens.includes(item)).length;
    const unorderedScore = targetTokens.length ? unorderedHits / targetTokens.length : 0;

    let orderedSubsequenceHits = 0;
    let tokenIndex = 0;
    for (const expectedToken of targetTokens) {
        while (tokenIndex < tokens.length) {
            if (tokens[tokenIndex] === expectedToken) {
                orderedSubsequenceHits += 1;
                tokenIndex += 1;
                break;
            }
            tokenIndex += 1;
        }
    }
    const orderedSubsequenceScore = targetTokens.length ? orderedSubsequenceHits / targetTokens.length : 0;

    return clamp(exactScore * 0.55 + unorderedScore * 0.30 + orderedSubsequenceScore * 0.15);
};

const scoreRichText = (answer: string) => {
    const normalizedAnswer = normalizeAnswerText(answer);
    if (!normalizedAnswer) return 0;

    const tokens = normalizeTokens(normalizedAnswer);
    const unique = new Set(tokens).size;
    const richness = tokens.length ? unique / tokens.length : 0;
    const timelineHints = ['first', 'next', 'then', 'finally', 'after', 'before'].filter((word) => tokens.includes(word)).length;
    const continuityBoost = Math.min(timelineHints / 6, 0.12);
    const lengthFactor = clamp(tokens.length / 22);
    const softScore = 0.36 + 0.38 * lengthFactor + 0.18 * richness + continuityBoost;
    const floor = tokens.length >= 7 ? 0.62 : 0.52;
    return clamp(Math.max(softScore, floor));
};

const scoreAdaptiveText = (answer: string, refs: string[]) => {
    const base = scoreRichText(answer);
    if (!base) return 0;

    const tokens = normalizeTokens(answer);
    const overlap = refs.length ? tokens.filter((token) => refs.includes(token)).length / refs.length : 0;
    const boosted = clamp(base * 0.92 + overlap * 0.12);
    if (tokens.length >= 8) return Math.max(boosted, 0.64);
    return Math.max(boosted, 0.54);
};

const buildStepDetailMetrics = (key: SectionKey, value: string, score: number) => {
    const normalizedValue = normalizeAnswerText(value);
    if (!normalizedValue) {
        return {
            score: 0,
            correctness: 0,
            responseTime: 0,
            speechActivity: 0,
            pauseControl: 0,
            answerLength: 0,
            wordCount: 0,
        };
    }

    const answerLength = normalizedValue.length;
    const wordCount = normalizeTokens(normalizedValue).length;
    const performance = clamp(score);
    const verbosity = clamp(wordCount / 28);
    const phraseSmoothness = wordCount ? clamp(answerLength / Math.max(1, wordCount * 8)) : 0;
    const responseTime = (key === 'word_forward' || key === 'word_reverse' || key === 'number_forward' || key === 'number_reverse')
        ? clamp(performance * 0.9 + (answerLength > 0 ? 0.1 : 0))
        : clamp(performance * 0.75 + verbosity * 0.25);
    const speechActivity = clamp(performance * 0.8 + verbosity * 0.2);
    const pauseControl = clamp(performance * 0.82 + phraseSmoothness * 0.18);

    return {
        score: performance,
        correctness: performance,
        responseTime,
        speechActivity,
        pauseControl,
        answerLength,
        wordCount,
    };
};

export default function TestsPage() {
    const router = useRouter();
    const recognitionRef = useRef<SpeechRecognitionType | null>(null);
    const recognitionRestartTimerRef = useRef<number | null>(null);
    const transcriptHeartbeatRef = useRef<number>(Date.now());
    const assessmentFinalizedRef = useRef(false);
    const dictationBaseRef = useRef('');
    const dictationFinalRef = useRef('');
    const keepListeningRef = useRef(false);
    const manualStopRef = useRef(false);
    const [started, setStarted] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [phase, setPhase] = useState<'show' | 'wait' | 'answer'>('show');
    const [timeLeft, setTimeLeft] = useState(8);
    const [listening, setListening] = useState(false);
    const [voiceError, setVoiceError] = useState('');
    const [questionSpeechState, setQuestionSpeechState] = useState<'idle' | 'speaking' | 'unsupported'>('idle');
    const [questionSpeechMessage, setQuestionSpeechMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [testConfig, setTestConfig] = useState<TestConfig | null>(null);
    const [sharedMemories, setSharedMemories] = useState<SharedMemory[]>([]);
    const [priorMemorySnippets, setPriorMemorySnippets] = useState<string[]>([]);
    const [answers, setAnswers] = useState<Record<SectionKey, string>>({
        word_forward: '',
        word_reverse: '',
        number_forward: '',
        number_reverse: '',
        childhood: '',
        adult: '',
        recent: '',
        adaptive: '',
    });
    const [scores, setScores] = useState<Record<string, number>>({});
    const [details, setDetails] = useState<Record<string, any>>({});

    const wordPool = useMemo(() => {
        const serverWords = (testConfig?.word_bank || []).map((v) => String(v || '').trim()).filter(Boolean);
        return serverWords.length >= 3 ? serverWords : DEFAULT_WORD_BANK;
    }, [testConfig]);
    const numberPool = useMemo(() => {
        const serverNumbers = (testConfig?.number_bank || []).map((v) => String(v || '').trim()).filter(Boolean);
        return serverNumbers.length >= 3 ? serverNumbers : DEFAULT_NUMBER_BANK;
    }, [testConfig]);
    const memoryPrompts = useMemo(() => ({
        childhood: String(testConfig?.memory_prompts?.childhood || DEFAULT_MEMORY_PROMPTS.childhood),
        adult: String(testConfig?.memory_prompts?.adult || DEFAULT_MEMORY_PROMPTS.adult),
        recent: String(testConfig?.memory_prompts?.recent || DEFAULT_MEMORY_PROMPTS.recent),
    }), [testConfig]);

    const wordItems = useMemo(() => pickShuffle(wordPool, 3), [wordPool]);
    const numberItems = useMemo(() => pickShuffle(numberPool, 3), [numberPool]);
    const currentStep = STEP_LAYOUT[stepIndex];
    const adaptivePrompt = useMemo(() => buildAdaptivePrompt(answers, priorMemorySnippets), [answers, priorMemorySnippets]);
    const adaptiveRefs = useMemo(() => {
        const tokens = [answers.childhood, answers.adult, answers.recent, ...priorMemorySnippets]
            .map((answer) => normalizeAnswerText(answer))
            .flatMap((answer) => normalizeTokens(answer));
        return [...new Set(tokens.filter((token) => token.length > 3))].slice(0, 10);
    }, [answers.childhood, answers.adult, answers.recent, priorMemorySnippets]);

    const sharedMemoryPrompts = useMemo(() => {
        const latestBy = (matcher: (memory: SharedMemory) => boolean) => {
            const filtered = sharedMemories
                .filter((memory) => matcher(memory) && normalizeAnswerText(memory.text).length > 0)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            return filtered[0] || null;
        };

        const childhoodMemory = latestBy((memory) => /child/i.test(String(memory.category || '')));
        const recentMemory = latestBy((memory) => /recent/i.test(String(memory.category || '')));
        const adultMemory = latestBy((memory) => !/child|recent/i.test(String(memory.category || '')));

        const formatPrompt = (memory: SharedMemory | null, fallback: string) => {
            if (!memory) return fallback;
            const summary = summarizeAnswer(memory.text) || memory.text.slice(0, 120).trim();
            return `You earlier shared this ${String(memory.category || 'personal').toLowerCase()} memory: "${summary}". Please retell this event with details: where it happened, who was there, and what happened first, next, and finally.`;
        };

        return {
            childhood: formatPrompt(childhoodMemory, memoryPrompts.childhood),
            adult: formatPrompt(adultMemory, memoryPrompts.adult),
            recent: formatPrompt(recentMemory, memoryPrompts.recent),
        };
    }, [sharedMemories, memoryPrompts]);

    const stopVoiceInput = () => {
        manualStopRef.current = true;
        keepListeningRef.current = false;
        if (recognitionRestartTimerRef.current) {
            window.clearTimeout(recognitionRestartTimerRef.current);
            recognitionRestartTimerRef.current = null;
        }
        try {
            recognitionRef.current?.stop();
        } catch {
        }
        recognitionRef.current = null;
        setListening(false);
    };

    const restartVoiceRecognition = (recognition: SpeechRecognitionType) => {
        if (manualStopRef.current || !keepListeningRef.current) return;
        if (recognitionRestartTimerRef.current) {
            window.clearTimeout(recognitionRestartTimerRef.current);
        }

            recognitionRestartTimerRef.current = window.setTimeout(() => {
            if (manualStopRef.current || !keepListeningRef.current || recognitionRef.current !== recognition) return;
            try {
                recognition.start();
            } catch {
                keepListeningRef.current = false;
                setListening(false);
            }
        }, 120);
    };

    useEffect(() => {
        let mounted = true;
        Promise.all([
            apiFetch('/api/tests/config').catch(() => null),
            apiFetch('/api/user/reports').catch(() => []),
            apiFetch('/api/memories').catch(() => []),
        ]).then(([cfg, reports, memories]) => {
            if (!mounted) return;
            if (cfg && typeof cfg === 'object') {
                setTestConfig(cfg as TestConfig);
            }

            const snippets: string[] = [];
            for (const report of (Array.isArray(reports) ? reports : []).slice(0, 6)) {
                const inputs = (report?.user_inputs && typeof report.user_inputs === 'object') ? report.user_inputs : {};
                for (const key of ['childhood', 'adult', 'recent', 'adaptive']) {
                    const txt = String((inputs as any)[key] || '').trim();
                    if (txt) snippets.push(txt);
                }
            }

            const storedMemories: SharedMemory[] = (Array.isArray(memories) ? memories : [])
                .map((item: any) => ({
                    id: String(item?.id || ''),
                    category: String(item?.category || ''),
                    text: String(item?.text || ''),
                    createdAt: String(item?.created_at || item?.updated_at || ''),
                }))
                .filter((item: SharedMemory) => item.id && normalizeAnswerText(item.text).length > 0);

            setSharedMemories(storedMemories);
            const memorySnippets = storedMemories.map((item) => item.text);
            setPriorMemorySnippets([...snippets, ...memorySnippets].slice(0, 12));
        });

        return () => { mounted = false; };
    }, []);

    const getSpeechRecognition = (): (new () => SpeechRecognitionType) | null => {
        if (typeof window === 'undefined') return null;
        const w = window as any;
        return w.SpeechRecognition || w.webkitSpeechRecognition || null;
    };

    const normalizeTranscriptForStep = (rawText: string, key: SectionKey) => {
        const compactRawText = sanitizeNarrativeText(rawText).toLowerCase().replace(/-/g, ' ');
        const numberPhraseNormalized = Object.entries(NUMBER_PHRASE_MAP).reduce((acc, [phrase, value]) => {
            const pattern = new RegExp(`\\b${phrase}\\b`, 'g');
            return acc.replace(pattern, value);
        }, compactRawText);

        const rawTokens = normalizeTokens(numberPhraseNormalized);
        if (rawTokens.length === 0) return '';

        const filteredRecallTokens = rawTokens.filter((token) => ![
            'and', 'then', 'next', 'comma', 'forward', 'reverse', 'order', 'in', 'the', 'please', 'now', 'say', 'again', 'okay', 'ok',
        ].includes(token));

        if (key === 'number_forward' || key === 'number_reverse') {
            const mapped = filteredRecallTokens.map((token) => {
                if (NUMBER_WORD_MAP[token]) return NUMBER_WORD_MAP[token];
                const numeric = token.replace(/[^0-9]/g, '');
                return numeric || token;
            });
            return mapped.join(', ');
        }

        if (key === 'word_forward' || key === 'word_reverse') {
            const candidates = wordItems.map((w) => w.toLowerCase());
            const mapped = filteredRecallTokens.map((token) => {
                let best = token;
                let bestDist = 99;
                for (const candidate of candidates) {
                    const dist = levenshtein(token, candidate);
                    if (dist < bestDist) {
                        best = candidate;
                        bestDist = dist;
                    }
                }
                return bestDist <= 2 ? best : token;
            });
            return mapped.join(', ');
        }

        return sanitizeNarrativeText(rawText).trim();
    };

    const startVoiceInput = (key: SectionKey) => {
        setVoiceError('');
        const Ctor = getSpeechRecognition();
        if (!Ctor) {
            const msg = 'Voice input is not supported in this browser. Use Chrome or Edge.';
            setVoiceError(msg);
            window.alert(msg);
            return;
        }

        try {
            if (recognitionRef.current) {
                if (listening) {
                    stopVoiceInput();
                    return;
                }
                stopVoiceInput();
            }

            const recognition = new Ctor();
            const browserLang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';
            recognition.lang = browserLang;
            recognition.interimResults = true;
            recognition.continuous = true;
            recognition.maxAlternatives = 8;
            manualStopRef.current = false;
            keepListeningRef.current = true;

            dictationBaseRef.current = answers[key] ? `${answers[key].trim()} ` : '';
            dictationFinalRef.current = '';

            recognition.onstart = () => {
                setListening(true);
                setVoiceError('');
                transcriptHeartbeatRef.current = Date.now();
            };

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < (event.results || []).length; i++) {
                    const alternatives = Array.from((event.results[i] || []) as any[]);
                    const bestAlternative = alternatives.sort((a: any, b: any) => {
                        const confidenceDiff = Number(b?.confidence || 0) - Number(a?.confidence || 0);
                        if (confidenceDiff !== 0) return confidenceDiff;
                        return String(b?.transcript || '').length - String(a?.transcript || '').length;
                    })[0];
                    const transcript = String(bestAlternative?.transcript || '').trim();
                    if (event.results[i].isFinal) {
                        dictationFinalRef.current += `${dictationFinalRef.current ? ' ' : ''}${transcript}`;
                    } else {
                        interimTranscript += `${interimTranscript ? ' ' : ''}${transcript}`;
                    }
                }

                const combined = `${dictationBaseRef.current}${dictationFinalRef.current}${interimTranscript ? ` ${interimTranscript}` : ''}`.trim();
                setResponse(key, normalizeTranscriptForStep(combined, key));
                transcriptHeartbeatRef.current = Date.now();
            };

            recognition.onerror = (event: any) => {
                const errorCode = String(event?.error || '');
                if (errorCode === 'aborted' && keepListeningRef.current) {
                    restartVoiceRecognition(recognition);
                    return;
                }

                const msg = errorCode ? `Voice input error: ${errorCode}` : 'Voice input failed.';
                const recoverable = !['not-allowed', 'service-not-allowed', 'audio-capture'].includes(String(event?.error || ''));
                if (recoverable) {
                    setVoiceError(msg);
                    restartVoiceRecognition(recognition);
                    return;
                }
                setVoiceError(msg);
                keepListeningRef.current = false;
                setListening(false);
            };

            recognition.onend = () => {
                const finalCombined = `${dictationBaseRef.current}${dictationFinalRef.current}`.trim();
                if (finalCombined) {
                    setResponse(key, normalizeTranscriptForStep(finalCombined, key));
                }
                if (keepListeningRef.current && !manualStopRef.current) {
                    restartVoiceRecognition(recognition);
                    return;
                }
                setListening(false);
            };

            recognitionRef.current = recognition;
            setListening(true);
            recognition.start();
        } catch {
            const msg = 'Unable to start voice input. Please allow microphone permission and retry.';
            setVoiceError(msg);
            window.alert(msg);
            setListening(false);
        }
    };

    const speakQuestion = (text: string) => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
            setQuestionSpeechState('unsupported');
            setQuestionSpeechMessage('Text-to-speech is not supported in this browser.');
            return;
        }

        setQuestionSpeechState('speaking');
        setQuestionSpeechMessage('');
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.95;
        utterance.pitch = 1;
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find((voice) => /^en(-|_)?/i.test(voice.lang || '')) || voices[0] || null;
        utterance.onstart = () => {
            setQuestionSpeechState('speaking');
            setQuestionSpeechMessage('Reading the question aloud.');
        };
        utterance.onend = () => {
            setQuestionSpeechState('idle');
            setQuestionSpeechMessage('');
        };
        utterance.onerror = () => {
            setQuestionSpeechState('idle');
            setQuestionSpeechMessage('Text-to-speech could not start in this browser.');
        };
        window.speechSynthesis.speak(utterance);
    };

    const setResponse = (key: SectionKey, value: string) => {
        setAnswers((prev) => ({ ...prev, [key]: value }));
    };

    const getSpokenQuestionText = () => {
        if (currentStep.type === 'recall') {
            const shownItems = (stepIndex < 2 ? wordItems : numberItems).join(', ');
            const direction = currentStep.key.includes('reverse') ? 'in reverse order' : 'in forward order';
            if (phase === 'show') {
                return `This is ${direction}. Memorize these items: ${shownItems}.`;
            }
            return `Answer now ${direction}. The displayed items were: ${shownItems}.`;
        }

        if (currentStep.type === 'adaptive') {
            return adaptivePrompt;
        }

        return sharedMemoryPrompts[currentStep.key as 'childhood' | 'adult' | 'recent']
            || memoryPrompts[currentStep.key as 'childhood' | 'adult' | 'recent'];
    };

    const evaluateStep = (key: SectionKey, value: string) => {
        const normalizedValue = normalizeAnswerText(value);
        let score = 0;

        if (key === 'word_forward') score = scoreOrderedRecall(wordItems, normalizedValue, false);
        if (key === 'word_reverse') score = scoreOrderedRecall(wordItems, normalizedValue, true);
        if (key === 'number_forward') score = scoreOrderedRecall(numberItems, normalizedValue, false);
        if (key === 'number_reverse') score = scoreOrderedRecall(numberItems, normalizedValue, true);
        if (key === 'childhood' || key === 'adult' || key === 'recent') score = scoreRichText(normalizedValue);
        if (key === 'adaptive') score = scoreAdaptiveText(normalizedValue, adaptiveRefs);

        return {
            score,
            detail: buildStepDetailMetrics(key, normalizedValue, score),
        };
    };

    const scoreCurrentStep = () => {
        const key = currentStep.key;
        const value = answers[key];
        const evaluation = evaluateStep(key, value);
        const score = evaluation.score;

        setScores((prev) => ({ ...prev, [key]: score }));
        setDetails((prev) => ({
            ...prev,
            [key]: evaluation.detail,
        }));
        return score;
    };

    const finishAssessment = async () => {
        if (assessmentFinalizedRef.current || submitting) return;
        assessmentFinalizedRef.current = true;
        stopVoiceInput();
        setSubmitting(true);
        try {
            const finalScores = { ...scores };
            const finalDetails: Record<string, any> = { ...details };
            STEP_LAYOUT.forEach((step) => {
                const key = step.key as SectionKey;
                const value = answers[key] || '';
                const evaluation = evaluateStep(key, value);
                if (finalScores[key] === undefined) {
                    finalScores[key] = evaluation.score;
                }
                finalDetails[key] = buildStepDetailMetrics(key, value, Number(finalScores[key] || 0));
            });

            try {
                const memoryPayload = {
                    responses: {
                        childhood: normalizeAnswerText(answers.childhood),
                        adult: normalizeAnswerText(answers.adult),
                        recent: normalizeAnswerText(answers.recent),
                        adaptive: normalizeAnswerText(answers.adaptive),
                    },
                };
                const memoryModelRes = await apiFetch('/api/ml/memory-score', {
                    method: 'POST',
                    body: JSON.stringify(memoryPayload),
                });

                const modelScores = memoryModelRes?.scores || {};
                const blend = (heuristic: number, modelScore: number | undefined, text: string) => {
                    const normalized = normalizeAnswerText(text);
                    if (!normalized) return 0;
                    if (typeof modelScore !== 'number') return heuristic;
                    const weighted = clamp(heuristic * 0.95 + modelScore * 0.05);
                    const lenientFloor = normalized.split(/\s+/).filter(Boolean).length >= 7 ? 0.64 : 0.54;
                    return Math.max(weighted, clamp(heuristic * 0.9), lenientFloor);
                };

                finalScores.childhood = blend(finalScores.childhood ?? 0, modelScores.childhood, answers.childhood);
                finalScores.adult = blend(finalScores.adult ?? 0, modelScores.adult, answers.adult);
                finalScores.recent = blend(finalScores.recent ?? 0, modelScores.recent, answers.recent);
                finalScores.adaptive = blend(finalScores.adaptive ?? 0, modelScores.adaptive, answers.adaptive);

                (['childhood', 'adult', 'recent', 'adaptive'] as SectionKey[]).forEach((key) => {
                    finalDetails[key] = buildStepDetailMetrics(key, answers[key] || '', Number(finalScores[key] || 0));
                });
            } catch {
            }

            setScores(finalScores);
            setDetails(finalDetails);

            const orderedScores = STEP_LAYOUT.map((step) => finalScores[step.key] ?? 0);
            const provisionalOverallRisk = 1 - orderedScores.reduce((sum, value) => sum + value, 0) / orderedScores.length;

            let resultData = {
                scores: finalScores,
                details: finalDetails,
                overallRisk: provisionalOverallRisk,
                answers,
                date: new Date().toISOString(),
            };

            const submitRes = await apiFetch('/api/tests/submit', {
                method: 'POST',
                body: JSON.stringify({
                    sections: finalScores,
                    notes: JSON.stringify(answers),
                }),
            });

            const savedReport = submitRes?.report;
            if (savedReport && typeof savedReport === 'object') {
                resultData = {
                    ...resultData,
                    scores: savedReport.sections || resultData.scores,
                    overallRisk: Number(savedReport.risk_score ?? resultData.overallRisk),
                };
            }
            localStorage.setItem(getResultStorageKey(), JSON.stringify(resultData));
        } catch {
            const orderedScores = STEP_LAYOUT.map((step) => scores[step.key] ?? 0);
            const fallbackOverallRisk = 1 - orderedScores.reduce((sum, value) => sum + value, 0) / Math.max(1, orderedScores.length);
            localStorage.setItem(getResultStorageKey(), JSON.stringify({
                scores,
                details,
                overallRisk: fallbackOverallRisk,
                answers,
                date: new Date().toISOString(),
            }));
        } finally {
            setSubmitting(false);
            router.push('/results');
        }
    };

    const goToStep = (nextIndex: number) => {
        stopVoiceInput();
        setStepIndex(nextIndex);
        const nextStep = STEP_LAYOUT[nextIndex];
        if (!nextStep) return;
        if (nextStep.type === 'recall') {
            setPhase('show');
            setTimeLeft(RECALL_SHOW_SECONDS);
        } else {
            setPhase('wait');
            setTimeLeft(MEMORY_WAIT_SECONDS);
        }
    };

    const completeCurrentStep = () => {
        if (assessmentFinalizedRef.current || submitting) return;
        scoreCurrentStep();
        if (stepIndex < STEP_LAYOUT.length - 1) {
            goToStep(stepIndex + 1);
            return;
        }
        void finishAssessment();
    };

    const onTimeUp = () => {
        if (assessmentFinalizedRef.current || submitting) return;
        if (!started) return;
        if (currentStep.type === 'recall' && phase === 'show') {
            setPhase('answer');
            setTimeLeft(RECALL_ANSWER_SECONDS);
            return;
        }

        if (currentStep.type !== 'recall' && phase === 'wait') {
            setPhase('answer');
            setTimeLeft(MEMORY_ANSWER_SECONDS);
            return;
        }

        scoreCurrentStep();

        if (stepIndex < STEP_LAYOUT.length - 1) {
            goToStep(stepIndex + 1);
            return;
        }

        void finishAssessment();
    };

    useEffect(() => {
        if (!started) return;
        const timer = setInterval(() => setTimeLeft((value) => value - 1), 1000);
        return () => clearInterval(timer);
    }, [started, stepIndex, phase]);

    useEffect(() => {
        if (!started || timeLeft > 0) return;
        onTimeUp();
    }, [timeLeft, started, stepIndex, phase]);

    useEffect(() => {
        if (!listening || !keepListeningRef.current) return;
        const watchdog = window.setInterval(() => {
            const elapsed = Date.now() - transcriptHeartbeatRef.current;
            if (elapsed > 7000 && recognitionRef.current && keepListeningRef.current && !manualStopRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch {
                }
            }
        }, 1800);

        return () => window.clearInterval(watchdog);
    }, [listening]);

    useEffect(() => {
        return () => {
            stopVoiceInput();
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    if (!started) {
        return (
            <div className="full-bleed-section" style={{ width: '100%' }}>
                <div className="card page-hero interactive-card text-center animate-fadeInUp" style={{ padding: '40px 34px' }}>
                    <h1 className="font-heading" style={{ fontSize: '2rem', marginBottom: 10 }}>Assessment Overview</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.6 }}>
                        Compact flow: word recall forward and reverse, number recall forward and reverse, three life-memory questions, and one adaptive follow-up.
                    </p>
                    <div className="story-grid" style={{ marginBottom: 18 }}>
                        {STEP_LAYOUT.map((step) => (
                            <div key={step.key} className="card" style={{ padding: 14 }}>
                                <div className="badge badge-accent" style={{ marginBottom: 8 }}>{step.label}</div>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                                    {step.type === 'recall' && 'Short memorization task with a quick response.'}
                                    {step.type === 'memory' && 'Short story-based question about your life context.'}
                                    {step.type === 'adaptive' && 'Follow-up generated from the three previous memory answers.'}
                                </p>
                            </div>
                        ))}
                    </div>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={() => {
                            setStarted(true);
                            goToStep(0);
                        }}
                    >
                        Start Assessment
                    </button>
                </div>
            </div>
        );
    }

    const stepTitle = currentStep.type === 'adaptive'
        ? adaptivePrompt
        : currentStep.type === 'memory'
            ? (sharedMemoryPrompts[currentStep.key as 'childhood' | 'adult' | 'recent'] || memoryPrompts[currentStep.key as 'childhood' | 'adult' | 'recent'])
            : '';
    const isRecallShow = currentStep.type === 'recall' && phase === 'show';
    const isMemoryWait = currentStep.type !== 'recall' && phase === 'wait';
    const answerPhaseActive = phase === 'answer';
    const phaseLabel = isRecallShow ? 'Study phase' : isMemoryWait ? 'Reading phase' : 'Answer phase';
    const phaseHint = isRecallShow
        ? 'Look at the items carefully. The answering timer starts after the display time ends.'
        : isMemoryWait
            ? 'Read the prompt carefully. The answering timer starts after the wait period ends.'
            : 'Answer now. The timer is counting down.';

    return (
        <div className="full-bleed-section" style={{ width: '100%', padding: '20px' }}>
            <div className="card interactive-card animate-fadeInUp" style={{ padding: '32px 40px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Step {stepIndex + 1}/8 • {currentStep.label}
                    </div>
                    <div className="badge badge-amber" style={{ fontSize: '1.02rem', padding: '8px 14px' }}>⏱️ {phaseLabel}: {timeLeft}s</div>
                </div>

                <div className="card" style={{ marginBottom: 18, padding: '16px 18px', borderColor: 'rgba(0,127,138,0.2)', background: 'rgba(255,255,255,0.8)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                        <strong style={{ color: 'var(--accent)' }}>{phaseLabel}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{phaseHint}</span>
                    </div>
                    {(questionSpeechState !== 'idle' || questionSpeechMessage) && (
                        <div className="badge badge-accent" style={{ display: 'inline-flex', marginTop: 4 }}>
                            {questionSpeechState === 'speaking' ? '🔊 Reading question...' : 'ℹ️'} {questionSpeechMessage || 'Ready'}
                        </div>
                    )}
                </div>
                {isRecallShow && (
                    <>
                        <p style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: '1rem' }}>
                            Memorize these {stepIndex < 2 ? 'words' : 'numbers'}.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 24 }}>
                            {(stepIndex < 2 ? wordItems : numberItems).map((item) => (
                                <div key={item} className="test-word-flash" style={{ fontSize: '1.6rem', padding: '20px 28px', fontWeight: 600 }}>{item}</div>
                            ))}
                        </div>
                        <p style={{ marginTop: 20, color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.95rem' }}>The answer box appears after the display timer ends.</p>
                    </>
                )}

                {isMemoryWait && (
                    <div style={{ marginBottom: 8 }}>
                        <p style={{ marginBottom: 16, color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '1.05rem' }}>
                            {stepTitle}
                        </p>
                        <div className="card" style={{ padding: '18px 20px', background: 'rgba(0,127,138,0.05)', borderColor: 'rgba(0,127,138,0.18)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>Reading window</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{MEMORY_WAIT_SECONDS}s before the answer timer starts</div>
                                </div>
                                <div className="badge badge-amber" style={{ fontSize: '1rem' }}>⏳ {timeLeft}s</div>
                            </div>
                        </div>
                    </div>
                )}
                {answerPhaseActive && (
                    <>
                        <p style={{ marginBottom: 16, color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '1.05rem' }}>
                            {currentStep.type === 'recall' && 'Enter the items in the order requested.'}
                            {currentStep.type === 'memory' && stepTitle}
                            {currentStep.type === 'adaptive' && stepTitle}
                        </p>

                        {currentStep.type === 'recall' ? (
                            <>
                                <input
                                    className="form-control"
                                    value={answers[currentStep.key]}
                                    onChange={(e) => setResponse(currentStep.key, e.target.value)}
                                    placeholder={currentStep.key.includes('number') ? 'e.g., 3, 7, 12' : 'e.g., River, Lamp, Garden'}
                                    style={{ fontSize: '1rem', padding: '12px 14px', marginBottom: 12 }}
                                />
                            </>
                        ) : (
                            <>
                                <textarea
                                    className="form-control"
                                    rows={7}
                                    value={answers[currentStep.key]}
                                    onChange={(e) => setResponse(currentStep.key, e.target.value)}
                                    placeholder="Type your answer here..."
                                    style={{ fontSize: '1rem', padding: '12px 14px', marginBottom: 12 }}
                                />
                            </>
                        )}
                        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => speakQuestion(getSpokenQuestionText())}
                            >
                                🔊 Hear question
                            </button>
                            <button
                                type="button"
                                className={`btn ${listening ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                                onClick={() => startVoiceInput(currentStep.key)}
                            >
                                🎤 {listening ? 'Stop listening' : 'Voice input'}
                            </button>
                        </div>
                    </>
                )}

                {!answerPhaseActive && (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => speakQuestion(getSpokenQuestionText())}
                        >
                            🔊 Hear question
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled>
                            🎤 Voice input starts after the timer
                        </button>
                    </div>
                )}
                {voiceError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>⚠️ {voiceError}</div>}
                <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => router.push('/dashboard')}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                            if (assessmentFinalizedRef.current || submitting) return;
                            if (currentStep.type === 'recall' && phase === 'show') {
                                setPhase('answer');
                                setTimeLeft(RECALL_ANSWER_SECONDS);
                                return;
                            }
                            if (currentStep.type !== 'recall' && phase === 'wait') {
                                return;
                            }
                            completeCurrentStep();
                        }}
                        disabled={submitting || (currentStep.type !== 'recall' && phase === 'wait')}
                    >
                        {currentStep.type === 'recall' && phase === 'show'
                            ? 'I am ready'
                            : currentStep.type !== 'recall' && phase === 'wait'
                                ? 'Waiting...'
                                : stepIndex < STEP_LAYOUT.length - 1 ? 'Next' : submitting ? 'Submitting...' : 'Finish'}
                    </button>
                </div>
            </div>
        </div>
    );
}
