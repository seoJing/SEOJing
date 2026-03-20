"use client";

import React, { useState } from "react";
import { cn } from "@app/utils";
import type { ArticleQuizItemProps, ArticleQuizProps } from "./article.types";

export function ArticleQuiz({
  children,
  className,
  ...props
}: ArticleQuizProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const items = React.Children.toArray(children).filter(React.isValidElement);
  const totalSteps = items.length;

  const handleResult = (isCorrect: boolean) => {
    if (isCorrect) setScore((prev) => prev + 1);
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  if (totalSteps === 0) return null;

  return (
    <div className={cn("my-8", className)} {...props}>
      <div className="flex items-center justify-between rounded-t-lg bg-gray-800 px-4 py-2 dark:bg-gray-900">
        <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">
          Quiz
        </span>
        {!isFinished && (
          <span className="text-xs font-mono text-gray-500">
            {currentStep + 1} / {totalSteps}
          </span>
        )}
      </div>

      {!isFinished && (
        <div className="h-0.5 w-full bg-gray-700">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
      )}

      <div className="rounded-b-lg bg-gray-900 p-5 sm:p-6 dark:bg-gray-950">
        {!isFinished ? (
          React.cloneElement(
            items[currentStep] as React.ReactElement,
            {
              stepIndex: currentStep,
              currentStep,
              onResult: handleResult,
              onNext: handleNext,
            } as any,
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-8 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="mb-2 text-xl font-bold text-gray-100">퀴즈 완료!</h3>
            <p className="text-gray-400 font-mono text-sm">
              {totalSteps}문제 중{" "}
              <span className="text-blue-400 font-bold text-base">{score}</span>
              문제 정답
            </p>
            <button
              onClick={() => {
                setCurrentStep(0);
                setScore(0);
                setIsFinished(false);
              }}
              className="mt-6 rounded-md bg-gray-700 px-5 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 transition-colors"
            >
              다시 도전하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ArticleQuizItem({
  mode,
  question,
  choices,
  answer,
  explanation,
  onResult,
  onNext,
  className,
  ...props
}: ArticleQuizItemProps) {
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSubmit = () => {
    if (!userAnswer && mode === "description") return;

    let correct = false;
    if (mode === "multiple") {
      correct = userAnswer === String(answer);
    } else {
      correct =
        userAnswer.replace(/\s+/g, "").toLowerCase() ===
        String(answer).replace(/\s+/g, "").toLowerCase();
    }

    setIsCorrect(correct);
    setIsSubmitted(true);
    if (onResult) onResult(correct);
  };

  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      <div className="flex items-center gap-2"></div>

      <h4 className="text-base font-medium leading-relaxed text-gray-100">
        <span className="text-blue-400 mr-2 font-mono">Q.</span>
        {question}
      </h4>

      <div className="mt-1">
        {mode === "multiple" && choices ? (
          <div className="flex flex-col gap-2">
            {choices.map((choice, idx) => {
              const isSelected = userAnswer === String(idx);
              const isThisAnswer = String(idx) === String(answer);

              let buttonClass =
                "border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800";

              if (isSubmitted) {
                if (isThisAnswer) {
                  buttonClass =
                    "border-blue-600/50 bg-blue-900/20 text-blue-300";
                } else if (isSelected && !isThisAnswer) {
                  buttonClass = "border-red-600/50 bg-red-900/20 text-red-300";
                } else {
                  buttonClass = "border-gray-800 bg-gray-900/50 text-gray-600";
                }
              } else if (isSelected) {
                buttonClass = "border-blue-500/50 bg-blue-900/20 text-blue-300";
              }

              return (
                <button
                  key={idx}
                  disabled={isSubmitted}
                  onClick={() => setUserAnswer(String(idx))}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded border text-sm transition-all duration-150",
                    buttonClass,
                  )}
                >
                  <span className="mr-3 inline-block w-4 font-mono text-xs opacity-50">
                    {idx + 1}.
                  </span>
                  {choice}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            type="text"
            disabled={isSubmitted}
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="정답을 입력해보세요..."
            className="w-full rounded border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 transition-colors focus:border-blue-500 focus:outline-none disabled:opacity-50 font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isSubmitted) handleSubmit();
            }}
          />
        )}
      </div>

      {!isSubmitted && (
        <div className="flex justify-end mt-1">
          <button
            onClick={handleSubmit}
            disabled={
              mode === "multiple" ? userAnswer === "" : !userAnswer.trim()
            }
            className="rounded bg-gray-700 px-5 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-30 transition-all"
          >
            정답 확인
          </button>
        </div>
      )}

      {isSubmitted && (
        <div className="mt-2 animate-in fade-in slide-in-from-top-2 flex flex-col gap-3">
          <div
            className={cn(
              "rounded border p-4 text-sm",
              isCorrect
                ? "border-blue-700/30 bg-blue-900/20"
                : "border-red-700/30 bg-red-900/20",
            )}
          >
            <p
              className={cn(
                "font-medium mb-1",
                isCorrect ? "text-blue-400" : "text-red-400",
              )}
            >
              {isCorrect ? "정답입니다." : "오답입니다."}
            </p>

            {!isCorrect && mode === "description" && (
              <p className="text-sm text-gray-400 mt-2">
                정답: <span className="font-mono text-blue-400">{answer}</span>
              </p>
            )}

            {explanation && (
              <div className="mt-3 pt-3 border-t border-gray-700/50 text-gray-400 text-sm leading-relaxed">
                <strong className="block mb-1 text-gray-300">해설</strong>
                {explanation}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={onNext}
              className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              다음 문제
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
