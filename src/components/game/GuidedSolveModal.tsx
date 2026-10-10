import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  RotateCcw,
  Check,
  ArrowRightLeft,
  MoveRight,
  Search,
  Bug,
  Swords,
  Lock,
} from 'lucide-react';
import { SortGameId, SortLevelConfig } from '../../types';
import { SORT_GAMES } from '../../data/sortGameData';
import { soundEffects } from '../../services/sound';

export interface InteractiveGuidedStep {
  stepNumber: number;
  phaseBadge: string;
  title: string;
  explanation: string;
  whyExplanation: string;
  actionSummary?: string;
  arrayState: number[];
  highlightIndices: number[];
  swappedIndices?: number[];
  sortedIndices: number[];
  minIndex?: number;
  keyIndex?: number;
  selectedAlgo?: string;
  selectedOptionId?: string;
  isComplete?: boolean;
}

interface GuidedSolveModalProps {
  gameId: SortGameId | string;
  levelNumber?: number;
  level?: SortLevelConfig;
  isOpen: boolean;
  onClose: () => void;
  onApplyStep?: (step: InteractiveGuidedStep, stepIndex: number, totalSteps: number) => void;
}

function generateBubbleSortSteps(initialArray: number[]): InteractiveGuidedStep[] {
  const steps: InteractiveGuidedStep[] = [];
  const arr = [...initialArray];
  const n = arr.length;
  const sortedIndices: number[] = [];

  // Initial state step: show initial problem and explain FIRST solving step
  steps.push({
    stepNumber: 1,
    phaseBadge: 'INITIAL STATE • PASS 1',
    title: `Initial Array: [${arr.join(', ')}] — First Step: Compare ${arr[0]} and ${arr[1]}`,
    explanation: `Compare ${arr[0]} (index 0) and ${arr[1]} (index 1).`,
    whyExplanation: `Bubble Sort starts at the beginning of the array and compares the first pair of adjacent elements (${arr[0]} and ${arr[1]}) to check if they are in ascending order.`,
    actionSummary: `Ready to compare index 0 [${arr[0]}] and index 1 [${arr[1]}]`,
    arrayState: [...arr],
    highlightIndices: [0, 1],
    sortedIndices: [],
  });

  for (let pass = 1; pass < n; pass++) {
    const limit = n - pass;
    for (let j = 0; j < limit; j++) {
      const leftVal = arr[j];
      const rightVal = arr[j + 1];

      // If this isn't the very first comparison (which was announced in step 1), add a Compare step
      if (!(pass === 1 && j === 0)) {
        steps.push({
          stepNumber: steps.length + 1,
          phaseBadge: `PASS ${pass} • COMPARE`,
          title: `Now compare ${leftVal} and ${rightVal}`,
          explanation: `Now compare ${leftVal} (index ${j}) and ${rightVal} (index ${j + 1}).`,
          whyExplanation: `We advance our comparison pointer one position to the right (indices ${j} and ${j + 1}) to check the next adjacent pair in Pass ${pass}.`,
          actionSummary: `Comparing [${leftVal}] and [${rightVal}]`,
          arrayState: [...arr],
          highlightIndices: [j, j + 1],
          sortedIndices: [...sortedIndices],
        });
      }

      // Perform decision & actual action
      if (leftVal > rightVal) {
        arr[j] = rightVal;
        arr[j + 1] = leftVal;
        steps.push({
          stepNumber: steps.length + 1,
          phaseBadge: `PASS ${pass} • SWAP PERFORMED`,
          title: `${leftVal} is greater than ${rightVal}, so swap them`,
          explanation: `${leftVal} is greater than ${rightVal}, so swap them. Array becomes [${arr.join(', ')}].`,
          whyExplanation: `In ascending order, the smaller value (${rightVal}) must come before the larger value (${leftVal}). Swapping moves ${leftVal} toward the right.`,
          actionSummary: `Swapped [${leftVal}] ⇄ [${rightVal}]`,
          arrayState: [...arr],
          highlightIndices: [j, j + 1],
          swappedIndices: [j, j + 1],
          sortedIndices: [...sortedIndices],
        });
      } else {
        steps.push({
          stepNumber: steps.length + 1,
          phaseBadge: `PASS ${pass} • KEEP ORDER`,
          title: `${leftVal} ≤ ${rightVal}, so keep their order`,
          explanation: `${leftVal} is less than or equal to ${rightVal}, so no swap is needed. Array remains [${arr.join(', ')}].`,
          whyExplanation: `Because ${leftVal} ≤ ${rightVal}, these two adjacent elements are already in ascending order.`,
          actionSummary: `Kept [${leftVal}] and [${rightVal}] in place`,
          arrayState: [...arr],
          highlightIndices: [j, j + 1],
          sortedIndices: [...sortedIndices],
        });
      }
    }

    // End of pass: lock the largest element of this pass
    sortedIndices.push(limit);
    const lockedVal = arr[limit];

    if (pass < n - 1) {
      steps.push({
        stepNumber: steps.length + 1,
        phaseBadge: `PASS ${pass} COMPLETE • LOCKED`,
        title: `Pass ${pass} Complete: ${lockedVal} locked at index ${limit}`,
        explanation: `Pass ${pass} is complete! The largest unsorted element (${lockedVal}) has bubbled to index ${limit} and is now locked.`,
        whyExplanation: `At the end of each pass, the largest remaining unsorted element reaches its final sorted position on the right.`,
        actionSummary: `Locked [${lockedVal}] at index ${limit}`,
        arrayState: [...arr],
        highlightIndices: [limit],
        sortedIndices: [...sortedIndices],
      });
    }
  }

  // Final solved state
  const allSorted = Array.from({ length: n }, (_, i) => i);
  steps.push({
    stepNumber: steps.length + 1,
    phaseBadge: 'SOLVED • COMPLETE',
    title: `Complete Solution Reached: [${arr.join(', ')}]`,
    explanation: `All passes are complete! The array is now completely sorted in ascending order: [${arr.join(', ')}].`,
    whyExplanation: `Every element has been compared and bubbled into its exact ascending position.`,
    actionSummary: `Final Sorted Array: [${arr.join(', ')}]`,
    arrayState: [...arr],
    highlightIndices: [],
    sortedIndices: allSorted,
    isComplete: true,
  });

  return steps;
}

function generateInsertionSortSteps(initialArray: number[]): InteractiveGuidedStep[] {
  const steps: InteractiveGuidedStep[] = [];
  const arr = [...initialArray];
  const n = arr.length;

  // Step 1: Initial state + explain first solving step
  steps.push({
    stepNumber: 1,
    phaseBadge: 'INITIAL STATE • KEY #1',
    title: `Initial Array: [${arr.join(', ')}] — Select Key ${arr[1]} at Index 1`,
    explanation: `Index 0 (${arr[0]}) is the initial sorted prefix. Select key element ${arr[1]} at index 1 and compare it with ${arr[0]}.`,
    whyExplanation: `Insertion Sort treats the first element [${arr[0]}] as a sorted prefix of length 1, then picks the next element (${arr[1]}) as the key to insert into the sorted prefix.`,
    actionSummary: `Selected key [${arr[1]}] to compare with [${arr[0]}]`,
    arrayState: [...arr],
    highlightIndices: [0, 1],
    keyIndex: 1,
    sortedIndices: [0],
  });

  for (let i = 1; i < n; i++) {
    const keyVal = arr[i];
    let keyPos = i;
    const currentSorted = Array.from({ length: i }, (_, idx) => idx);

    if (i > 1) {
      steps.push({
        stepNumber: steps.length + 1,
        phaseBadge: `KEY #${i} • SELECT & COMPARE`,
        title: `Select key ${keyVal} (index ${i}) and compare with ${arr[i - 1]}`,
        explanation: `Pick key element ${keyVal} at index ${i} and compare it with its predecessor ${arr[i - 1]} at index ${i - 1}.`,
        whyExplanation: `The prefix [${arr.slice(0, i).join(', ')}] is currently sorted. Now we scan backwards from index ${i - 1} to find where ${keyVal} belongs.`,
        actionSummary: `Comparing key [${keyVal}] with predecessor [${arr[i - 1]}]`,
        arrayState: [...arr],
        highlightIndices: [i - 1, i],
        keyIndex: i,
        sortedIndices: [...currentSorted],
      });
    }

    let j = i - 1;
    while (j >= 0) {
      const predVal = arr[j];

      if (j < i - 1) {
        steps.push({
          stepNumber: steps.length + 1,
          phaseBadge: `KEY #${i} • COMPARE NEXT`,
          title: `Now compare key ${keyVal} with predecessor ${predVal} (index ${j})`,
          explanation: `Compare key ${keyVal} with predecessor ${predVal} at index ${j}.`,
          whyExplanation: `We continue scanning left through the sorted prefix to check if ${predVal} is also greater than ${keyVal}.`,
          actionSummary: `Comparing key [${keyVal}] with [${predVal}]`,
          arrayState: [...arr],
          highlightIndices: [j, keyPos],
          keyIndex: keyPos,
          sortedIndices: Array.from({ length: i + 1 }, (_, idx) => idx).filter((idx) => idx !== keyPos),
        });
      }

      if (predVal > keyVal) {
        // Shift predVal right
        arr[j + 1] = arr[j];
        arr[j] = keyVal;
        keyPos = j;

        steps.push({
          stepNumber: steps.length + 1,
          phaseBadge: `KEY #${i} • SHIFT RIGHT`,
          title: `${predVal} > ${keyVal}, so shift ${predVal} to the right`,
          explanation: `${predVal} is greater than ${keyVal}, so shift ${predVal} one position to the right (to index ${j + 1}). Array is now [${arr.join(', ')}].`,
          whyExplanation: `Shifting larger sorted elements to the right opens up the slot to their left for the smaller key (${keyVal}).`,
          actionSummary: `Shifted [${predVal}] right → [${arr.join(', ')}]`,
          arrayState: [...arr],
          highlightIndices: [j, j + 1],
          swappedIndices: [j, j + 1],
          keyIndex: keyPos,
          sortedIndices: Array.from({ length: i + 1 }, (_, idx) => idx).filter((idx) => idx !== keyPos),
        });

        j--;
        if (j < 0) {
          const newSorted = Array.from({ length: i + 1 }, (_, idx) => idx);
          steps.push({
            stepNumber: steps.length + 1,
            phaseBadge: `KEY #${i} • INSERT AT START`,
            title: `Insert ${keyVal} at index 0`,
            explanation: `Reached the beginning of the array. Insert key ${keyVal} at index 0. Sorted prefix is now [${arr.slice(0, i + 1).join(', ')}].`,
            whyExplanation: `Because ${keyVal} is smaller than all previous elements in the prefix, it belongs at the very first index (0).`,
            actionSummary: `Inserted [${keyVal}] at index 0`,
            arrayState: [...arr],
            highlightIndices: [0],
            sortedIndices: newSorted,
          });
        }
      } else {
        const newSorted = Array.from({ length: i + 1 }, (_, idx) => idx);
        steps.push({
          stepNumber: steps.length + 1,
          phaseBadge: `KEY #${i} • INSERT IN PLACE`,
          title: `${predVal} ≤ ${keyVal}, so insert ${keyVal} at index ${keyPos}`,
          explanation: `${predVal} is less than or equal to ${keyVal}. No more shifts needed — insert ${keyVal} at index ${keyPos}. Sorted prefix is now [${arr.slice(0, i + 1).join(', ')}].`,
          whyExplanation: `All elements to the left are now ≤ ${keyVal} and all elements to the right in the prefix are > ${keyVal}, so index ${keyPos} is its exact sorted position.`,
          actionSummary: `Inserted [${keyVal}] at index ${keyPos}`,
          arrayState: [...arr],
          highlightIndices: [keyPos],
          sortedIndices: newSorted,
        });
        break;
      }
    }
  }

  const allSorted = Array.from({ length: n }, (_, i) => i);
  steps.push({
    stepNumber: steps.length + 1,
    phaseBadge: 'SOLVED • COMPLETE',
    title: `Complete Solution Reached: [${arr.join(', ')}]`,
    explanation: `All elements have been shifted and inserted! The final sorted array is [${arr.join(', ')}].`,
    whyExplanation: `The sorted prefix has grown to cover all ${n} elements of the array.`,
    actionSummary: `Final Sorted Array: [${arr.join(', ')}]`,
    arrayState: [...arr],
    highlightIndices: [],
    sortedIndices: allSorted,
    isComplete: true,
  });

  return steps;
}

function generateSelectionSortSteps(initialArray: number[]): InteractiveGuidedStep[] {
  const steps: InteractiveGuidedStep[] = [];
  const arr = [...initialArray];
  const n = arr.length;
  const sortedIndices: number[] = [];

  // Step 1: Initial state + explain first solving step
  steps.push({
    stepNumber: 1,
    phaseBadge: 'INITIAL STATE • PASS 1',
    title: `Initial Array: [${arr.join(', ')}] — Start Minimum Scan at Index 0`,
    explanation: `Start Pass 1 with unsorted section [${arr.join(', ')}]. Set initial minimum candidate to ${arr[0]} (index 0) and scan remaining elements.`,
    whyExplanation: `Selection Sort searches the entire unsorted section to find the smallest value and place it at index 0.`,
    actionSummary: `Current minimum candidate: [${arr[0]}] at index 0`,
    arrayState: [...arr],
    highlightIndices: [0],
    minIndex: 0,
    sortedIndices: [],
  });

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;

    if (i > 0) {
      steps.push({
        stepNumber: steps.length + 1,
        phaseBadge: `PASS ${i + 1} • START SCAN`,
        title: `Pass ${i + 1}: Scan unsorted section [${arr.slice(i).join(', ')}]`,
        explanation: `Start at index ${i} (value ${arr[i]}) as the initial minimum candidate and compare with remaining unsorted elements.`,
        whyExplanation: `Indices 0..${i - 1} are already locked. We now look for the smallest value in indices ${i}..${n - 1}.`,
        actionSummary: `Scanning indices ${i}..${n - 1} (Initial min: ${arr[i]})`,
        arrayState: [...arr],
        highlightIndices: Array.from({ length: n - i }, (_, k) => i + k),
        minIndex: minIdx,
        sortedIndices: [...sortedIndices],
      });
    }

    // Show comparison scan and identify minimum
    const comparisonsDesc: string[] = [];
    for (let j = i + 1; j < n; j++) {
      if (arr[j] < arr[minIdx]) {
        comparisonsDesc.push(`${arr[j]} < ${arr[minIdx]} (new min: ${arr[j]})`);
        minIdx = j;
      } else {
        comparisonsDesc.push(`${arr[j]} ≥ ${arr[minIdx]}`);
      }
    }

    steps.push({
      stepNumber: steps.length + 1,
      phaseBadge: `PASS ${i + 1} • MINIMUM IDENTIFIED`,
      title: `Minimum identified: ${arr[minIdx]} at index ${minIdx}`,
      explanation: `After comparing unsorted elements (${comparisonsDesc.join(', ')}), ${arr[minIdx]} at index ${minIdx} is the true minimum.`,
      whyExplanation: `${arr[minIdx]} is strictly the smallest value among [${arr.slice(i).join(', ')}], so it must be placed at the first unsorted slot (index ${i}).`,
      actionSummary: `Identified minimum [${arr[minIdx]}] at index ${minIdx}`,
      arrayState: [...arr],
      highlightIndices: [i, minIdx],
      minIndex: minIdx,
      sortedIndices: [...sortedIndices],
    });

    // Perform swap into position i
    const minVal = arr[minIdx];
    const targetVal = arr[i];
    arr[i] = minVal;
    arr[minIdx] = targetVal;
    sortedIndices.push(i);

    steps.push({
      stepNumber: steps.length + 1,
      phaseBadge: `PASS ${i + 1} • SWAP & LOCK`,
      title:
        minIdx === i
          ? `${minVal} is already at index ${i} — lock it in place`
          : `Swap minimum ${minVal} (index ${minIdx}) with ${targetVal} (index ${i})`,
      explanation:
        minIdx === i
          ? `${minVal} is already at the front of the unsorted section (index ${i}), so lock it as sorted. Array: [${arr.join(', ')}].`
          : `Swap ${minVal} into index ${i} (replacing ${targetVal}) and lock index ${i} as sorted. Array becomes [${arr.join(', ')}].`,
      whyExplanation: `Placing ${minVal} at index ${i} expands our sorted prefix to [${arr.slice(0, i + 1).join(', ')}].`,
      actionSummary:
        minIdx === i ? `Locked [${minVal}] at index ${i}` : `Swapped [${minVal}] ⇄ [${targetVal}] (Locked index ${i})`,
      arrayState: [...arr],
      highlightIndices: [i, minIdx],
      swappedIndices: minIdx === i ? undefined : [i, minIdx],
      sortedIndices: [...sortedIndices],
    });
  }

  const allSorted = Array.from({ length: n }, (_, i) => i);
  steps.push({
    stepNumber: steps.length + 1,
    phaseBadge: 'SOLVED • COMPLETE',
    title: `Complete Solution Reached: [${arr.join(', ')}]`,
    explanation: `All minimums have been selected and placed! The final element (${arr[n - 1]}) locks automatically. Final sorted array: [${arr.join(', ')}].`,
    whyExplanation: `After ${n - 1} passes of Selection Sort, all ${n} elements are guaranteed to be in ascending order.`,
    actionSummary: `Final Sorted Array: [${arr.join(', ')}]`,
    arrayState: [...arr],
    highlightIndices: [],
    sortedIndices: allSorted,
    isComplete: true,
  });

  return steps;
}

function generateSortingBattleSteps(levelNum: number, initialArray: number[]): InteractiveGuidedStep[] {
  let chosenAlgo: string = 'insertion';
  let algoTitle = 'Insertion Sort';
  let strategyReason =
    'Insertion Sort adapts to existing order and shifts elements cleanly with low overhead.';

  if (levelNum === 2) {
    chosenAlgo = 'insertion';
    algoTitle = 'Insertion Sort';
    strategyReason =
      'The array [10, 20, 30, 25, 40, 50] is nearly sorted (only 25 is out of place). Insertion Sort runs in optimal O(n) time with just 1 shift!';
  } else if (levelNum === 3) {
    chosenAlgo = 'selection';
    algoTitle = 'Selection Sort';
    strategyReason =
      'Hardware constraint requires minimizing memory writes/swaps. Selection Sort performs at most n - 1 swaps total, protecting Flash memory!';
  } else if (levelNum === 1) {
    chosenAlgo = 'selection';
    algoTitle = 'Selection Sort';
    strategyReason =
      'On randomized array [35, 12, 48, 7, 21, 15], Selection Sort systematically picks each minimum in at most 5 swaps.';
  } else if (levelNum === 4) {
    chosenAlgo = 'bubble';
    algoTitle = 'Bubble Sort';
    strategyReason =
      'On reverse-sorted array [50, 40, 30, 20, 10], Bubble Sort systematically eliminates every adjacent inversion pass by pass.';
  } else {
    chosenAlgo = 'insertion';
    algoTitle = 'Insertion Sort';
    strategyReason =
      'Insertion Sort builds the sorted prefix step-by-step with clear backward comparisons and shifts.';
  }

  const baseSteps =
    chosenAlgo === 'selection'
      ? generateSelectionSortSteps(initialArray)
      : chosenAlgo === 'bubble'
      ? generateBubbleSortSteps(initialArray)
      : generateInsertionSortSteps(initialArray);

  const strategyStep: InteractiveGuidedStep = {
    stepNumber: 1,
    phaseBadge: 'BATTLE STRATEGY • STEP 1',
    title: `Step 1: Select Optimal Strategy — ${algoTitle}`,
    explanation: `Analyze the battlefield array [${initialArray.join(', ')}] and select ${algoTitle} to begin the battle.`,
    whyExplanation: strategyReason,
    actionSummary: `Selected Strategy: ${algoTitle.toUpperCase()}`,
    arrayState: [...initialArray],
    highlightIndices: [],
    sortedIndices: [],
    selectedAlgo: chosenAlgo,
  };

  const renumbered = baseSteps.map((s, idx) => ({
    ...s,
    stepNumber: idx + 2,
    selectedAlgo: chosenAlgo,
  }));

  return [strategyStep, ...renumbered];
}

function generateFixAlgorithmSteps(levelNum: number, initialArray: number[]): InteractiveGuidedStep[] {
  if (levelNum === 1) {
    return [
      {
        stepNumber: 1,
        phaseBadge: 'INITIAL STATE • INSPECT TRACE',
        title: 'Step 1: Inspect Partially Executed Bubble Sort State [5, 3, 9, 7]',
        explanation:
          'Pass 1 started on [5, 9, 3, 7]: compared index 0 (5) & index 1 (9) → kept; compared index 1 (9) & index 2 (3) → swapped to [5, 3, 9, 7].',
        whyExplanation:
          'To know what operation executes next, we track the inner loop pointer j. It completed j=0 and j=1, so j now advances to 2.',
        actionSummary: 'Current array state: [5, 3, 9, 7] (pointer j advances to index 2)',
        arrayState: [5, 3, 9, 7],
        highlightIndices: [1, 2],
        sortedIndices: [],
      },
      {
        stepNumber: 2,
        phaseBadge: 'IDENTIFY NEXT STEP',
        title: 'Step 2: Compare Index 2 (9) and Index 3 (7)',
        explanation:
          'The pointer advances to indices 2 and 3, comparing 9 and 7. Options that lock 9 early or restart at index 0 violate Bubble Sort rules.',
        whyExplanation:
          'Bubble Sort must complete the full pass up to the unsorted boundary (index 3) before locking any element.',
        actionSummary: 'Comparing index 2 [9] and index 3 [7]',
        arrayState: [5, 3, 9, 7],
        highlightIndices: [2, 3],
        sortedIndices: [],
        selectedOptionId: 'opt-a',
      },
      {
        stepNumber: 3,
        phaseBadge: 'APPLY FIX • SWAP 9 AND 7',
        title: 'Step 3: 9 > 7, so Swap Them to Complete Pass 1',
        explanation:
          'Since 9 > 7, swap 9 and 7. The array becomes [5, 3, 7, 9] and 9 is now locked at index 3!',
        whyExplanation:
          'Swapping 9 and 7 bubbles the largest element (9) to the final index (3) at the end of Pass 1.',
        actionSummary: 'Swapped [9] ⇄ [7] → [5, 3, 7, 9]',
        arrayState: [5, 3, 7, 9],
        highlightIndices: [2, 3],
        swappedIndices: [2, 3],
        sortedIndices: [3],
        selectedOptionId: 'opt-a',
      },
      {
        stepNumber: 4,
        phaseBadge: 'COMPLETE REMAINING SORT • PASS 2',
        title: 'Step 4: Compare 5 and 3 (Indices 0 and 1) and Swap',
        explanation:
          'Pass 2 compares index 0 (5) and index 1 (3). Since 5 > 3, swap them to get [3, 5, 7, 9].',
        whyExplanation:
          'Continuing the algorithm finishes sorting the remaining unsorted elements so the entire problem reaches the final solved state.',
        actionSummary: 'Swapped [5] ⇄ [3] → Final Sorted Array [3, 5, 7, 9]',
        arrayState: [3, 5, 7, 9],
        highlightIndices: [],
        sortedIndices: [0, 1, 2, 3],
        selectedOptionId: 'opt-a',
        isComplete: true,
      },
    ];
  } else if (levelNum === 2) {
    return [
      {
        stepNumber: 1,
        phaseBadge: 'INITIAL STATE • DETECT BUG',
        title: 'Step 1: Inspect Buggy Minimum Selection on [8, 29, 14, 37, 10]',
        explanation:
          'Index 0 [8] is already sorted. In the unsorted section [29, 14, 37, 10], a buggy function stopped early and picked 14 (index 2) as the minimum.',
        whyExplanation:
          'Selection Sort must scan ALL elements in the unsorted section (indices 1 to 4) before selecting the minimum.',
        actionSummary: 'Bug detected: 14 was chosen prematurely before scanning index 4 (10)',
        arrayState: [8, 29, 14, 37, 10],
        highlightIndices: [2],
        sortedIndices: [0],
      },
      {
        stepNumber: 2,
        phaseBadge: 'IDENTIFY TRUE MINIMUM',
        title: 'Step 2: Scan Full Unsorted Section — True Minimum is 10 (Index 4)',
        explanation:
          'Compare all unsorted values: 29, 14, 37, and 10. Since 10 < 14, card 10 at index 4 is the true minimum.',
        whyExplanation:
          '10 is strictly the smallest number in [29, 14, 37, 10], so Option A is the correct algorithmic fix.',
        actionSummary: 'True Minimum Identified: [10] at index 4',
        arrayState: [8, 29, 14, 37, 10],
        highlightIndices: [1, 4],
        minIndex: 4,
        sortedIndices: [0],
        selectedOptionId: 'opt-a',
      },
      {
        stepNumber: 3,
        phaseBadge: 'APPLY FIX • SWAP 10 WITH 29',
        title: 'Step 3: Swap Minimum 10 (Index 4) with 29 (Index 1)',
        explanation:
          'Swap 10 with the first unsorted element 29 at index 1. The array updates to [8, 10, 14, 37, 29] with [8, 10] locked.',
        whyExplanation:
          'Selection Sort swaps the newly found minimum into the first unsorted slot (index 1) and locks it.',
        actionSummary: 'Swapped [10] ⇄ [29] → [8, 10, 14, 37, 29]',
        arrayState: [8, 10, 14, 37, 29],
        highlightIndices: [1, 4],
        swappedIndices: [1, 4],
        sortedIndices: [0, 1],
        selectedOptionId: 'opt-a',
      },
      {
        stepNumber: 4,
        phaseBadge: 'COMPLETE REMAINING SORT',
        title: 'Step 4: Place Remaining Minimums (14, then 29) to Finish Sort',
        explanation:
          'Pass 3 locks 14 at index 2, and Pass 4 swaps 29 (index 4) with 37 (index 3), reaching the completely sorted state [8, 10, 14, 29, 37].',
        whyExplanation:
          'With the bug fixed, Selection Sort cleanly finishes sorting the entire array into ascending order.',
        actionSummary: 'Final Sorted Array: [8, 10, 14, 29, 37]',
        arrayState: [8, 10, 14, 29, 37],
        highlightIndices: [],
        sortedIndices: [0, 1, 2, 3, 4],
        selectedOptionId: 'opt-a',
        isComplete: true,
      },
    ];
  } else {
    // Levels 3, 4, 5 use the Insertion Sort / invariant fix scenario in FixAlgorithmGame
    return [
      {
        stepNumber: 1,
        phaseBadge: 'INITIAL STATE • DETECT BUG',
        title: `Step 1: Inspect Buggy Insertion State [${initialArray.join(', ')}]`,
        explanation:
          'Sorted prefix is [8, 15, 27] and key is 12. The buggy code shifted 27 right, but stopped before comparing key 12 against 15!',
        whyExplanation:
          'Insertion Sort must continue shifting while (j >= 0 && arr[j] > key). Stopping after shifting only 27 would leave 15 before 12.',
        actionSummary: 'Bug detected: Loop stopped before comparing key [12] with [15]',
        arrayState: [8, 15, 27, 12],
        highlightIndices: [2, 3],
        keyIndex: 3,
        sortedIndices: [0, 1, 2],
      },
      {
        stepNumber: 2,
        phaseBadge: 'STEP 1 OF FIX • SHIFT 27 RIGHT',
        title: 'Step 2: Compare 27 with Key 12 → Shift 27 Right',
        explanation:
          'Compare predecessor 27 (index 2) with key 12. Since 27 > 12, shift 27 one position to the right (index 3).',
        whyExplanation:
          '27 is larger than 12, so it moves right to make room for 12.',
        actionSummary: 'Shifted [27] right → [8, 15, 12, 27]',
        arrayState: [8, 15, 12, 27],
        highlightIndices: [2, 3],
        swappedIndices: [2, 3],
        keyIndex: 2,
        sortedIndices: [0, 1, 3],
        selectedOptionId: 'opt-a',
      },
      {
        stepNumber: 3,
        phaseBadge: 'STEP 2 OF FIX • SHIFT 15 RIGHT',
        title: 'Step 3: Compare 15 with Key 12 → Shift 15 Right',
        explanation:
          'Now compare predecessor 15 (index 1) with key 12. Since 15 > 12, shift 15 one position to the right (index 2).',
        whyExplanation:
          'Fixing the while-loop condition ensures 15 is also compared and shifted right because 15 > 12.',
        actionSummary: 'Shifted [15] right → [8, 12, 15, 27]',
        arrayState: [8, 12, 15, 27],
        highlightIndices: [1, 2],
        swappedIndices: [1, 2],
        keyIndex: 1,
        sortedIndices: [0, 2, 3],
        selectedOptionId: 'opt-a',
      },
      {
        stepNumber: 4,
        phaseBadge: 'SOLVED • COMPLETE',
        title: 'Step 4: Compare 8 with 12 (8 ≤ 12) → Insert 12 at Index 1',
        explanation:
          'Compare 8 (index 0) with 12. Since 8 ≤ 12, insert 12 at index 1. The array is now completely sorted: [8, 12, 15, 27]!',
        whyExplanation:
          'All elements to the left of 12 are smaller and all elements to the right are larger. The bug is fixed and the problem is solved!',
        actionSummary: 'Final Sorted Array: [8, 12, 15, 27]',
        arrayState: [8, 12, 15, 27],
        highlightIndices: [],
        sortedIndices: [0, 1, 2, 3],
        selectedOptionId: 'opt-a',
        isComplete: true,
      },
    ];
  }
}

export const GuidedSolveModal: React.FC<GuidedSolveModalProps> = ({
  gameId,
  levelNumber = 1,
  level,
  isOpen,
  onClose,
  onApplyStep,
}) => {
  const normalizedGameId: SortGameId =
    gameId === 'fix-the-sort' || gameId === 'fix-the-algorithm'
      ? 'fix-algorithm'
      : (gameId as SortGameId);

  const resolvedLevel: SortLevelConfig = useMemo(() => {
    if (level) return level;
    const gameMeta = SORT_GAMES.find((g) => g.id === normalizedGameId) || SORT_GAMES[0];
    return (
      gameMeta.levels.find((l) => l.levelNumber === levelNumber) || gameMeta.levels[0]
    );
  }, [level, normalizedGameId, levelNumber]);

  const steps: InteractiveGuidedStep[] = useMemo(() => {
    const initialArr = resolvedLevel.initialArray;
    switch (normalizedGameId) {
      case 'bubble-sort':
        return generateBubbleSortSteps(initialArr);
      case 'insertion-sort':
        return generateInsertionSortSteps(initialArr);
      case 'selection-sort':
        return generateSelectionSortSteps(initialArr);
      case 'sorting-battle':
        return generateSortingBattleSteps(resolvedLevel.levelNumber, initialArr);
      case 'fix-algorithm':
        return generateFixAlgorithmSteps(resolvedLevel.levelNumber, initialArr);
      default:
        return generateBubbleSortSteps(initialArr);
    }
  }, [normalizedGameId, resolvedLevel]);

  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);

  // Reset step index when modal opens or level changes
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIdx(0);
      if (steps.length > 0 && onApplyStep) {
        onApplyStep(steps[0], 0, steps.length);
      }
    }
  }, [isOpen, resolvedLevel.levelNumber, normalizedGameId]);

  if (!isOpen) return null;

  const currentStep = steps[currentStepIdx] || steps[0];
  const totalSteps = steps.length;
  const isFirstStep = currentStepIdx === 0;
  const isLastStep = currentStepIdx === totalSteps - 1;
  const progressPercent = Math.round(((currentStepIdx + 1) / totalSteps) * 100);

  const handleNextStep = () => {
    if (currentStepIdx < totalSteps - 1) {
      soundEffects.playClick();
      const nextIdx = currentStepIdx + 1;
      setCurrentStepIdx(nextIdx);
      if (onApplyStep) {
        onApplyStep(steps[nextIdx], nextIdx, totalSteps);
      }
      if (steps[nextIdx].isComplete) {
        soundEffects.playSuccess();
      }
    } else {
      soundEffects.playCorrect();
      onClose();
    }
  };

  const handlePrevStep = () => {
    if (currentStepIdx > 0) {
      soundEffects.playClick();
      const prevIdx = currentStepIdx - 1;
      setCurrentStepIdx(prevIdx);
      if (onApplyStep) {
        onApplyStep(steps[prevIdx], prevIdx, totalSteps);
      }
    }
  };

  const handleRestartWalkthrough = () => {
    soundEffects.playClick();
    setCurrentStepIdx(0);
    if (onApplyStep && steps[0]) {
      onApplyStep(steps[0], 0, totalSteps);
    }
  };

  const getGameHeaderTitle = () => {
    switch (normalizedGameId) {
      case 'bubble-sort':
        return `Bubble Sort • Level ${resolvedLevel.levelNumber} Guided Solve`;
      case 'insertion-sort':
        return `Insertion Sort • Level ${resolvedLevel.levelNumber} Guided Solve`;
      case 'selection-sort':
        return `Selection Sort • Level ${resolvedLevel.levelNumber} Guided Solve`;
      case 'sorting-battle':
        return `Sorting Battle • Level ${resolvedLevel.levelNumber} Guided Solve`;
      case 'fix-algorithm':
        return `Fix the Algorithm • Level ${resolvedLevel.levelNumber} Guided Solve`;
      default:
        return `Level ${resolvedLevel.levelNumber} — Guided Solve`;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header Banner */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50/70 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Lightbulb className="w-5 h-5 stroke-[2.4]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase">
                    INTERACTIVE STEP-BY-STEP SOLVER
                  </span>
                  <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300">
                    Step {currentStep.stepNumber} of {totalSteps}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  {getGameHeaderTitle()}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRestartWalkthrough}
                title="Restart Guided Solve from Step 1"
                className="p-2 rounded-xl text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close Guided Solve"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-600 to-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>

          {/* Body Content */}
          <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-5">
            {/* Step Status & Phase Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`text-[10px] font-mono font-extrabold uppercase px-2.5 py-1 rounded-lg tracking-wider ${
                  currentStep.isComplete
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : currentStep.swappedIndices
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                }`}
              >
                {currentStep.phaseBadge}
              </span>

              {currentStep.actionSummary && (
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                  {currentStep.actionSummary}
                </span>
              )}
            </div>

            {/* Live Problem Array State Visualization */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>Live Game Problem State</span>
                <span>
                  {currentStep.isComplete
                    ? '✓ All Elements Sorted'
                    : `${currentStep.sortedIndices.length} / ${currentStep.arrayState.length} Locked`}
                </span>
              </div>

              <div className="flex items-center justify-center gap-2 sm:gap-3 py-3 overflow-x-auto">
                {currentStep.arrayState.map((val, idx) => {
                  const isSorted = currentStep.sortedIndices.includes(idx);
                  const isHighlighted = currentStep.highlightIndices.includes(idx);
                  const isSwapped = currentStep.swappedIndices?.includes(idx);
                  const isMin = currentStep.minIndex === idx;
                  const isKey = currentStep.keyIndex === idx;

                  let cardStyle =
                    'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100';
                  let badgeText = 'UNSORTED';
                  let badgeStyle = 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';

                  if (isSorted) {
                    cardStyle =
                      'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-100 shadow-xs';
                    badgeText = 'SORTED';
                    badgeStyle =
                      'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300';
                  }
                  if (isSwapped) {
                    cardStyle =
                      'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-100 ring-2 ring-amber-400/50 shadow-md';
                    badgeText = 'SWAPPED';
                    badgeStyle = 'bg-amber-500 text-white';
                  } else if (isMin) {
                    cardStyle =
                      'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-900 dark:text-amber-100 ring-2 ring-amber-400/40 shadow-md';
                    badgeText = 'MINIMUM';
                    badgeStyle =
                      'bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200';
                  } else if (isKey) {
                    cardStyle =
                      'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-400/40 shadow-md';
                    badgeText = 'KEY';
                    badgeStyle =
                      'bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200';
                  } else if (isHighlighted) {
                    cardStyle =
                      'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-900 dark:text-blue-100 ring-2 ring-blue-400/50 shadow-md';
                    badgeText = 'COMPARE';
                    badgeStyle = 'bg-blue-600 text-white';
                  }

                  return (
                    <motion.div
                      key={`guided-card-${idx}-${val}`}
                      layout
                      initial={{ scale: 0.95, opacity: 0.8 }}
                      animate={{ scale: isHighlighted || isSwapped ? 1.05 : 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                      className={`relative flex flex-col items-center justify-between p-2.5 sm:p-3 w-16 sm:w-20 h-24 sm:h-28 rounded-2xl border-2 shrink-0 transition-colors ${cardStyle}`}
                    >
                      <div className="w-full flex items-center justify-between text-[10px] font-mono">
                        <span className="opacity-60 font-bold">#{idx}</span>
                        {isSorted && <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />}
                      </div>

                      <div className="text-xl sm:text-2xl font-black font-mono tracking-tight">
                        {val}
                      </div>

                      <span
                        className={`text-[8px] sm:text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md leading-none ${badgeStyle}`}
                      >
                        {badgeText}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Step Action & Why Explanation Box */}
            <div
              className={`p-5 rounded-2xl border space-y-2.5 transition-colors ${
                currentStep.isComplete
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60'
                  : 'bg-blue-50/60 dark:bg-blue-950/25 border-blue-100 dark:border-blue-900/50'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`shrink-0 w-6 h-6 rounded-full text-white text-xs font-extrabold flex items-center justify-center mt-0.5 ${
                    currentStep.isComplete ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}
                >
                  {currentStep.isComplete ? '✓' : currentStep.stepNumber}
                </span>
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {currentStep.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                    {currentStep.explanation}
                  </p>
                </div>
              </div>

              <div className="pl-8 pt-1 border-t border-slate-200/60 dark:border-slate-800/80 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800 dark:text-slate-200 font-bold">Why this step: </strong>
                  {currentStep.whyExplanation}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Navigation Controls */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between gap-3">
            <button
              onClick={handlePrevStep}
              disabled={isFirstStep}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isFirstStep
                  ? 'text-slate-300 dark:text-slate-700 bg-slate-100 dark:bg-slate-800/40 cursor-not-allowed'
                  : 'text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>

            <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 hidden sm:block">
              {currentStep.isComplete
                ? 'Problem Completely Solved!'
                : `Click "Next Step" to execute step ${currentStep.stepNumber + 1}`}
            </div>

            <button
              onClick={handleNextStep}
              className={`px-6 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                isLastStep
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
              }`}
            >
              <span>{isLastStep ? 'Finish Guided Solve' : 'Next Step'}</span>
              {isLastStep ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

