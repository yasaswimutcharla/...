import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trophy,
  Check,
  Eye,
  Home,
  Clock,
} from 'lucide-react';
import { QuizQuestion, UserProgress } from '../../types';
import { QUIZ_QUESTIONS } from '../../data/quizData';
import { soundEffects } from '../../services/sound';
import { awardXP, applyPointsEvent, normalizePointsLedger } from '../../services/storage';

interface QuizViewProps {
  progress: UserProgress;
  onUpdateProgress: (updated: UserProgress | ((prev: UserProgress) => UserProgress)) => void;
  onNavigateHome?: () => void;
}

interface QuestionAnswerState {
  selectedOption: string | null;
  draggedOrder: string[];
  isSubmitted: boolean;
  isCorrect: boolean;
  isTimedOut?: boolean;
}

const QUESTION_TIME_LIMIT = 20;

export const QuizView: React.FC<QuizViewProps> = ({
  progress,
  onUpdateProgress,
  onNavigateHome,
}) => {
  const [currentIdx, setCurrentIdx] = useState<number>(() => {
    const records = progress.pointsLedger?.quizQuestionRecords || {};
    for (let i = 0; i < QUIZ_QUESTIONS.length; i++) {
      if (!records[i]) return i;
    }
    return 0;
  });

  // Restore locked question states from persistent storage so refreshing never grants extra points
  const [answers, setAnswers] = useState<Record<number, QuestionAnswerState>>(() => {
    const records = progress.pointsLedger?.quizQuestionRecords || {};
    const initial: Record<number, QuestionAnswerState> = {};
    Object.entries(records).forEach(([idxStr, rec]) => {
      const idx = Number(idxStr);
      if (rec) {
        initial[idx] = {
          selectedOption: rec.selectedOption ?? null,
          draggedOrder: rec.draggedOrder ?? [],
          isSubmitted: true,
          isCorrect: rec.status === 'correct',
          isTimedOut: rec.status === 'timeout',
        };
      }
    });
    return initial;
  });

  const [quizFinished, setQuizFinished] = useState<boolean>(() => {
    const records = progress.pointsLedger?.quizQuestionRecords || {};
    return Object.keys(records).length >= QUIZ_QUESTIONS.length;
  });
  const [quizStarted, setQuizStarted] = useState<boolean>(() => {
    const records = progress.pointsLedger?.quizQuestionRecords || {};
    return Object.keys(records).length > 0;
  });
  const [reviewQuestionIdx, setReviewQuestionIdx] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(QUESTION_TIME_LIMIT);

  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentQ: QuizQuestion = QUIZ_QUESTIONS[currentIdx];

  const persistedRecord = progress.pointsLedger?.quizQuestionRecords?.[currentIdx];
  const currentAnswerState: QuestionAnswerState = persistedRecord
    ? {
        selectedOption: persistedRecord.selectedOption ?? answers[currentIdx]?.selectedOption ?? null,
        draggedOrder: persistedRecord.draggedOrder ?? answers[currentIdx]?.draggedOrder ?? [],
        isSubmitted: true,
        isCorrect: persistedRecord.status === 'correct',
        isTimedOut: persistedRecord.status === 'timeout',
      }
    : answers[currentIdx] || {
        selectedOption: null,
        draggedOrder: [],
        isSubmitted: false,
        isCorrect: false,
        isTimedOut: false,
      };

  const isWaitingToStart = currentIdx === 0 && !quizStarted && !currentAnswerState.isSubmitted;

  const handleStartQuiz = () => {
    if (quizStarted) return;
    soundEffects.playClick();
    setQuizStarted(true);
    setRemainingSeconds(QUESTION_TIME_LIMIT);
  };

  // Initialize drag order or answer state if not yet set
  useEffect(() => {
    if (!answers[currentIdx] && !persistedRecord) {
      if (currentQ.type === 'drag-order' && Array.isArray(currentQ.options)) {
        const shuffled = [...currentQ.options].sort(() => Math.random() - 0.5);
        setAnswers((prev) => ({
          ...prev,
          [currentIdx]: {
            selectedOption: null,
            draggedOrder: shuffled,
            isSubmitted: false,
            isCorrect: false,
            isTimedOut: false,
          },
        }));
      } else {
        setAnswers((prev) => ({
          ...prev,
          [currentIdx]: {
            selectedOption: null,
            draggedOrder: [],
            isSubmitted: false,
            isCorrect: false,
            isTimedOut: false,
          },
        }));
      }
    }
  }, [currentIdx, currentQ, persistedRecord]);

  // Reset the timer to 20 seconds whenever a new unlocked question becomes active
  useEffect(() => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    if (!currentAnswerState.isSubmitted && !quizFinished) {
      setRemainingSeconds(QUESTION_TIME_LIMIT);
    }
  }, [currentIdx, currentAnswerState.isSubmitted, quizFinished]);

  const finishQuiz = useCallback(
    (latestAnswers?: Record<number, QuestionAnswerState>) => {
      const mergedAnswers = latestAnswers || answers;
      const records = progress.pointsLedger?.quizQuestionRecords || {};

      let totalCorrect = 0;
      for (let i = 0; i < QUIZ_QUESTIONS.length; i++) {
        const isCorr = records[i] ? records[i].status === 'correct' : mergedAnswers[i]?.isCorrect;
        if (isCorr) totalCorrect++;
      }

      const totalScorePercent = Math.round((totalCorrect / QUIZ_QUESTIONS.length) * 100);
      setQuizFinished(true);

      if (totalScorePercent >= 70) {
        soundEffects.playSuccess();
        try {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
          });
        } catch {
          // Ignore
        }
      }

      const allQuestionIndices = QUIZ_QUESTIONS.map((_, i) => i);
      onUpdateProgress((prev) => {
        const { updated } = awardXP(
          prev,
          150,
          'quiz_completed',
          'Quiz Completed',
          `Scored ${totalScorePercent}% on Assessment`
        );
        return {
          ...updated,
          quizCompleted: true,
          quizCompletedQuestions: allQuestionIndices,
          quizHighScore: Math.max(updated.quizHighScore || 0, totalScorePercent),
          quizTotalQuestionsAnswered: Math.max(
            updated.quizTotalQuestionsAnswered || 0,
            QUIZ_QUESTIONS.length
          ),
        };
      });
    },
    [answers, onUpdateProgress, progress.pointsLedger?.quizQuestionRecords]
  );

  // Handle timeout when 20-second timer reaches 0: lock question, award 0 points (no deduction), auto-move to next question
  const handleQuestionTimeout = useCallback(() => {
    if (currentAnswerState.isSubmitted || quizFinished || isWaitingToStart) return;

    const timedOutState: QuestionAnswerState = {
      selectedOption: currentAnswerState.selectedOption,
      draggedOrder: currentAnswerState.draggedOrder,
      isSubmitted: true,
      isCorrect: false,
      isTimedOut: true,
    };

    const nextAnswers = {
      ...answers,
      [currentIdx]: timedOutState,
    };
    setAnswers(nextAnswers);

    onUpdateProgress((prev) => {
      const updatedCompletedQuestions = Array.from(
        new Set([...(prev.quizCompletedQuestions || []), currentIdx])
      );
      return applyPointsEvent(
        {
          ...prev,
          quizCompletedQuestions: updatedCompletedQuestions,
          quizTotalQuestionsAnswered: updatedCompletedQuestions.length,
        },
        'quiz_timeout',
        0,
        `Question #${currentIdx + 1} Timed Out (20s expired — 0 pts)`,
        `quiz_q_${currentQ.id}_locked`,
        {
          quizQuestionIndex: currentIdx,
          quizRecord: {
            status: 'timeout',
            selectedOption: currentAnswerState.selectedOption,
            draggedOrder: currentAnswerState.draggedOrder,
          },
        }
      );
    });

    // Automatically move to the next question
    if (currentIdx + 1 < QUIZ_QUESTIONS.length) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      finishQuiz(nextAnswers);
    }
  }, [
    answers,
    currentAnswerState.draggedOrder,
    currentAnswerState.isSubmitted,
    currentAnswerState.selectedOption,
    currentIdx,
    currentQ.id,
    finishQuiz,
    isWaitingToStart,
    onUpdateProgress,
    quizFinished,
  ]);

  // Countdown tick every second while question is active and unlocked
  useEffect(() => {
    if (quizFinished || currentAnswerState.isSubmitted || isWaitingToStart) return;

    if (remainingSeconds <= 0) {
      handleQuestionTimeout();
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, quizFinished, currentAnswerState.isSubmitted, isWaitingToStart, handleQuestionTimeout]);

  const handleSelectOption = (opt: string) => {
    if (currentAnswerState.isSubmitted || isWaitingToStart) return;
    soundEffects.playClick();
    setAnswers((prev) => ({
      ...prev,
      [currentIdx]: {
        ...(prev[currentIdx] || {
          draggedOrder: [],
          isSubmitted: false,
          isCorrect: false,
        }),
        selectedOption: opt,
      },
    }));
  };

  const handleDragReorder = (sourceIdx: number, targetIdx: number) => {
    if (currentAnswerState.isSubmitted || isWaitingToStart) return;
    const currentList =
      currentAnswerState.draggedOrder.length > 0
        ? [...currentAnswerState.draggedOrder]
        : [...(currentQ.options || [])];
    const [moved] = currentList.splice(sourceIdx, 1);
    currentList.splice(targetIdx, 0, moved);

    setAnswers((prev) => ({
      ...prev,
      [currentIdx]: {
        ...(prev[currentIdx] || {
          selectedOption: null,
          isSubmitted: false,
          isCorrect: false,
        }),
        draggedOrder: currentList,
      },
    }));
  };

  const handleSubmitAnswer = () => {
    if (currentAnswerState.isSubmitted || isWaitingToStart) return;
    soundEffects.playClick();

    let isCorrect = false;
    if (currentQ.type === 'drag-order') {
      const correctArr = currentQ.correctAnswer as string[];
      const order = currentAnswerState.draggedOrder;
      isCorrect =
        order.length === correctArr.length &&
        order.every((val, idx) => val === correctArr[idx]);
    } else {
      isCorrect = currentAnswerState.selectedOption === currentQ.correctAnswer;
    }

    if (isCorrect) {
      soundEffects.playSuccess();
    } else {
      soundEffects.playError();
    }

    onUpdateProgress((prev) => {
      const updatedCompletedQuestions = Array.from(
        new Set([...(prev.quizCompletedQuestions || []), currentIdx])
      );
      return applyPointsEvent(
        {
          ...prev,
          quizCompletedQuestions: updatedCompletedQuestions,
          quizTotalQuestionsAnswered: updatedCompletedQuestions.length,
        },
        isCorrect ? 'quiz_correct' : 'quiz_wrong',
        isCorrect ? 4 : -1,
        isCorrect
          ? `Correct Answer on Quiz Question #${currentIdx + 1} (+4 pts)`
          : `Incorrect Answer on Quiz Question #${currentIdx + 1} (-1 pt)`,
        `quiz_q_${currentQ.id}_locked`,
        {
          quizQuestionIndex: currentIdx,
          quizRecord: {
            status: isCorrect ? 'correct' : 'wrong',
            selectedOption: currentAnswerState.selectedOption,
            draggedOrder: currentAnswerState.draggedOrder,
          },
        }
      );
    });

    setAnswers((prev) => ({
      ...prev,
      [currentIdx]: {
        ...(prev[currentIdx] || {
          selectedOption: null,
          draggedOrder: [],
        }),
        isSubmitted: true,
        isCorrect,
        isTimedOut: false,
      },
    }));
  };

  const handlePreviousQuestion = () => {
    if (currentIdx > 0) {
      soundEffects.playClick();
      setCurrentIdx((prev) => prev - 1);
    }
  };

  const handleNextQuestion = () => {
    soundEffects.playClick();

    if (currentIdx + 1 < QUIZ_QUESTIONS.length) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      finishQuiz();
    }
  };

  // Compute live score stats from persisted records + local state
  const ledger = normalizePointsLedger(progress.pointsLedger);
  const persistedRecords = ledger.quizQuestionRecords || {};
  let totalAnswered = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;
  for (let i = 0; i < QUIZ_QUESTIONS.length; i++) {
    const rec = persistedRecords[i];
    const localAns = answers[i];
    if (rec) {
      totalAnswered++;
      if (rec.status === 'correct') totalCorrect++;
      else if (rec.status === 'wrong') totalIncorrect++;
    } else if (localAns?.isSubmitted) {
      totalAnswered++;
      if (localAns.isCorrect) totalCorrect++;
      else if (!localAns.isTimedOut) totalIncorrect++;
    }
  }
  const finalScorePercent = Math.round(
    (totalCorrect / QUIZ_QUESTIONS.length) * 100
  );

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Quiz Assessment
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Validate your algorithmic Sorting reasoning and earn mastery points.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-2.5">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
              Correct Answer: +4 Points
            </span>
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-3 py-1 rounded-xl border border-rose-200 dark:border-rose-800">
              Wrong Answer: -1 Point
            </span>
          </div>
        </div>

        {/* Question Counter, 20s Timer & Controls */}
        {!quizFinished && (
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-bold text-xs transition-colors ${
                currentAnswerState.isSubmitted
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  : remainingSeconds <= 5
                  ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 animate-pulse'
                  : 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {currentAnswerState.isSubmitted
                  ? currentAnswerState.isTimedOut
                    ? 'Time Expired (0s)'
                    : 'Locked'
                  : isWaitingToStart
                  ? '20 seconds'
                  : `${remainingSeconds}s`}
              </span>
            </div>

            {isWaitingToStart && (
              <button
                onClick={handleStartQuiz}
                className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <span>Start Quiz</span>
              </button>
            )}

            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-mono">
              Question {currentIdx + 1} of {QUIZ_QUESTIONS.length}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar & Question Step Pill Navigation */}
      {!quizFinished && (
        <div className="space-y-2">
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-300"
              style={{
                width: `${((currentIdx + 1) / QUIZ_QUESTIONS.length) * 100}%`,
              }}
            />
          </div>

          {/* Quick Question Stepper Chips */}
          <div className="flex items-center justify-between gap-1 overflow-x-auto py-1 px-0.5">
            {QUIZ_QUESTIONS.map((q, idx) => {
              const ans = answers[idx];
              const isCurrent = idx === currentIdx;
              let chipBg =
                'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';

              if (isCurrent) {
                chipBg =
                  'bg-gradient-to-tr from-blue-600 to-purple-600 text-white border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-800 font-bold shadow-xs';
              } else if (ans?.isSubmitted) {
                if (ans.isCorrect) {
                  chipBg =
                    'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700';
                } else {
                  chipBg =
                    'bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-700';
                }
              }

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    if (isWaitingToStart && idx !== 0) return;
                    soundEffects.playClick();
                    setCurrentIdx(idx);
                  }}
                  disabled={isWaitingToStart && idx !== 0}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:pointer-events-none ${chipBg}`}
                  title={`Question ${idx + 1}: ${q.type}`}
                >
                  <span>Q{idx + 1}</span>
                  {ans?.isSubmitted && ans.isCorrect && (
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                  )}
                  {ans?.isSubmitted && !ans.isCorrect && (
                    <span className="text-[10px] text-rose-500 font-black leading-none">✕</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Quiz Question Card */}
      {!quizFinished ? (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
          {/* Question Category Badge & Text */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                {currentQ.type.replace('-', ' ')}
              </span>
              {currentAnswerState.isSubmitted && (
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    currentAnswerState.isCorrect
                      ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
                      : currentAnswerState.isTimedOut
                      ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                      : 'bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-700'
                  }`}
                >
                  {currentAnswerState.isCorrect
                    ? '✓ Correct (+4 pts)'
                    : currentAnswerState.isTimedOut
                    ? '⏱ Timed Out (0 pts)'
                    : '✕ Incorrect (-1 pt)'}
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-2.5 leading-relaxed whitespace-pre-line">
              {currentQ.question}
            </h2>
          </div>

          {/* Options (MCQ, True/False, Scenario, Predict Output) */}
          {currentQ.type !== 'drag-order' && currentQ.options && (
            <div className="space-y-3">
              {currentQ.options.map((opt) => {
                const isSelected = currentAnswerState.selectedOption === opt;
                const isCorrect = opt === currentQ.correctAnswer;

                let optClass =
                  'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200';

                if (currentAnswerState.isSubmitted) {
                  if (isCorrect) {
                    optClass =
                      'border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 font-bold ring-2 ring-emerald-200 dark:ring-emerald-900/50';
                  } else if (isSelected && !isCorrect) {
                    optClass =
                      'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/70 text-red-950 dark:text-red-100 ring-2 ring-red-200 dark:ring-red-900/50';
                  } else {
                    optClass =
                      'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 opacity-60 text-slate-400 dark:text-slate-500';
                  }
                } else if (isSelected) {
                  optClass =
                    'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-200 font-bold ring-2 ring-indigo-200 dark:ring-indigo-900/50';
                }

                return (
                  <button
                    key={opt}
                    onClick={() => handleSelectOption(opt)}
                    disabled={currentAnswerState.isSubmitted || isWaitingToStart}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-xs sm:text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${optClass}`}
                  >
                    <span>{opt}</span>
                    {currentAnswerState.isSubmitted && isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                    {currentAnswerState.isSubmitted && isSelected && !isCorrect && (
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Drag and Drop Chronological Order */}
          {currentQ.type === 'drag-order' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Drag cards to rearrange them into the correct chronological sequence:
              </p>

              <div className="space-y-2">
                {(currentAnswerState.draggedOrder.length > 0
                  ? currentAnswerState.draggedOrder
                  : currentQ.options || []
                ).map((item, idx) => (
                  <div
                    key={item}
                    draggable={!currentAnswerState.isSubmitted && !isWaitingToStart}
                    onDragStart={(e) => {
                      if (isWaitingToStart) return;
                      e.dataTransfer.setData('text/plain', String(idx));
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (isWaitingToStart) return;
                      const sourceIdx = Number(
                        e.dataTransfer.getData('text/plain')
                      );
                      handleDragReorder(sourceIdx, idx);
                    }}
                    className={`p-3.5 rounded-xl border-2 text-xs font-semibold flex items-center justify-between ${
                      currentAnswerState.isSubmitted
                        ? currentAnswerState.isCorrect
                        : isWaitingToStart
                        ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-grab active:cursor-grabbing'
                    }`}
                  >
                    <span>
                      {idx + 1}. {item}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {currentAnswerState.isSubmitted
                        ? 'Submitted'
                        : 'Drag to reorder'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Explanation Box after submission */}
          {currentAnswerState.isSubmitted && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs space-y-1.5 animate-fadeIn">
              <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                Detailed Explanation:
              </span>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {currentQ.explanation}
              </p>
            </div>
          )}

          {/* ─── ACTION FOOTER WITH PREVIOUS BUTTON & SUBMIT / NEXT BUTTONS ─── */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            {/* PREVIOUS BUTTON */}
            <button
              onClick={handlePreviousQuestion}
              disabled={currentIdx === 0}
              className="px-4 sm:px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {/* RIGHT SIDE: SUBMIT OR NEXT / FINISH BUTTON */}
            <div className="flex items-center gap-2">
              {!currentAnswerState.isSubmitted ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={
                    isWaitingToStart ||
                    (currentQ.type !== 'drag-order' &&
                      !currentAnswerState.selectedOption)
                  }
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-500/25 transition-all cursor-pointer active:scale-95"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span>
                    {currentIdx + 1 < QUIZ_QUESTIONS.length
                      ? 'Next Question'
                      : 'View Final Results'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ─── HIGHLIGHTED SCORE RESULTS DASHBOARD AFTER COMPLETION ─── */
        <div className="space-y-6 animate-fadeIn">
          
          {/* 1. HERO HIGHLIGHT SCORE CARD */}
          <div
            className={`rounded-3xl p-8 sm:p-10 border shadow-lg text-center relative overflow-hidden transition-all ${
              finalScorePercent >= 80
                ? 'bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/80 shadow-emerald-500/10'
                : finalScorePercent >= 60
                ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/80 shadow-indigo-500/10'
                : 'bg-amber-50/50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/80 shadow-amber-500/10'
            }`}
          >
            {/* Background Glow accent */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-32 bg-indigo-500/15 dark:bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />

            {/* Trophy & Badge Icon */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-md mb-4 text-white ${
                  finalScorePercent >= 80
                    ? 'bg-emerald-600 shadow-emerald-200 dark:shadow-emerald-950'
                    : finalScorePercent >= 60
                    ? 'bg-gradient-to-tr from-blue-600 to-purple-600 shadow-indigo-200 dark:shadow-indigo-950'
                    : 'bg-amber-500 shadow-amber-200 dark:shadow-amber-950'
                }`}
              >
                <Trophy className="w-10 h-10" />
              </div>

              {/* Status Pill Badge */}
              <div
                className={`px-4 py-1 rounded-full text-xs font-mono font-black uppercase tracking-wider mb-2 border ${
                  finalScorePercent >= 80
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                    : finalScorePercent >= 60
                    ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                }`}
              >
                {finalScorePercent >= 80
                  ? '★ OUTSTANDING MASTERY (GRADE A+) ★'
                  : finalScorePercent >= 60
                  ? '★ PROFICIENT (GRADE B) ★'
                  : 'PRACTICE RECOMMENDED (GRADE C)'}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                QUIZ ASSESSMENT COMPLETED
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-md">
                {finalScorePercent >= 80
                  ? 'Incredible performance! You demonstrated thorough command of sorting algorithms and algorithmic constraints.'
                  : finalScorePercent >= 60
                  ? 'Great job! You have a solid grasp of sorting fundamentals and lifecycle behavior.'
                  : 'Good effort! Review the detailed question explanations below to sharpen your algorithm mechanics.'}
              </p>

              {/* ─── VIBRANT HIGHLIGHTED SCORE BADGE ─── */}
              <div className="my-6 p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/90 border-2 border-indigo-400/50 dark:border-indigo-500/50 shadow-xl max-w-sm w-full mx-auto ring-4 ring-indigo-500/10 dark:ring-indigo-500/20">
                <span className="text-[11px] font-mono font-bold tracking-widest text-slate-400 dark:text-slate-400 uppercase block mb-1">
                  FINAL HIGHLIGHTED SCORE
                </span>
                
                {/* Big Bold Score Percentage */}
                <div className="flex items-baseline justify-center gap-1 font-mono font-black">
                  <span
                    className={`text-6xl sm:text-7xl font-black tracking-tight ${
                      finalScorePercent >= 80
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : finalScorePercent >= 60
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {finalScorePercent}%
                  </span>
                </div>

                {/* Question Score Ratio */}
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <span>{totalCorrect}</span>
                  <span className="text-slate-400">/</span>
                  <span>{QUIZ_QUESTIONS.length} Questions Correct</span>
                </div>
              </div>

              {/* ─── 3 HIGHLIGHT METRICS STATS ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-2xl mx-auto">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Correct</span>
                  <span className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                    <Check className="w-4 h-4 stroke-[3]" /> {totalCorrect}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Incorrect</span>
                  <span className="text-xl font-mono font-black text-rose-600 dark:text-rose-400">
                    {totalIncorrect}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Accuracy</span>
                  <span className="text-xl font-mono font-black text-slate-800 dark:text-slate-200">
                    {finalScorePercent}%
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 w-full max-w-lg mx-auto">
                {onNavigateHome && (
                  <button
                    onClick={() => {
                      soundEffects.playClick();
                      onNavigateHome();
                    }}
                    className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Home className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Back to Home</span>
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* 2. QUESTION-BY-QUESTION REVIEW BREAKDOWN */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Question Breakdown & Answers
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {totalCorrect} of {QUIZ_QUESTIONS.length} Correct
              </span>
            </div>

            <div className="space-y-3">
              {QUIZ_QUESTIONS.map((q, idx) => {
                const ans = answers[idx];
                const isCorrect = ans?.isCorrect;
                const isExpanded = reviewQuestionIdx === idx;

                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border transition-all ${
                      isCorrect
                        ? 'border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-rose-200/80 dark:border-rose-800/60 bg-rose-50/30 dark:bg-rose-950/20'
                    }`}
                  >
                    <div
                      onClick={() =>
                        setReviewQuestionIdx(isExpanded ? null : idx)
                      }
                      className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 text-white'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                            {q.question}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
                            {isCorrect ? '✓ Solved Correctly' : '✕ Missed Answer'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
                      >
                        {isExpanded ? 'Hide' : 'Explain'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 text-xs space-y-2 border-t border-slate-200/60 dark:border-slate-800">
                        <div className="pt-2 text-slate-600 dark:text-slate-300">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            Correct Answer:{' '}
                          </span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            {Array.isArray(q.correctAnswer)
                              ? q.correctAnswer.join(' ➔ ')
                              : q.correctAnswer}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed bg-white/70 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
                          💡 <strong className="text-slate-800 dark:text-slate-200">Explanation:</strong> {q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

