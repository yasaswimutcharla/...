import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Lock, Check, Sparkles, ArrowRightLeft, MoveRight } from 'lucide-react';
import { SortCardObject } from '../../types';

interface SortingCardProps {
  card: SortCardObject;
  index: number;
  isSelected?: boolean;
  isPairHighlighted?: boolean;
  isDragCandidate?: boolean;
  isDropTarget?: boolean;
  isDragHovered?: boolean;
  onCardClick?: () => void;
  onDragSwap?: (fromIndex: number, toIndex: number) => void;
  onDragHoverIndex?: (targetIndex: number | null) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const SortingCard: React.FC<SortingCardProps> = ({
  card,
  index,
  isSelected = false,
  isPairHighlighted = false,
  isDragCandidate = false,
  isDropTarget = false,
  isDragHovered = false,
  onCardClick,
  onDragSwap,
  onDragHoverIndex,
  onDragStart,
  onDragEnd,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const hoveredTargetRef = useRef<number | null>(null);

  // Compute badge label
  let badgeLabel: string | null = null;
  if (card.isSorted) {
    badgeLabel = 'SORTED';
  } else if (isDragging) {
    badgeLabel = 'DRAGGING';
  } else if (isDragHovered) {
    badgeLabel = 'DROP SWAP';
  } else if (card.isMinimum) {
    badgeLabel = 'MINIMUM';
  } else if (card.isCurrent) {
    badgeLabel = 'CURRENT';
  } else if (card.isShifting) {
    badgeLabel = 'SHIFTING';
  } else if (isPairHighlighted) {
    badgeLabel = 'COMPARE';
  }

  // Dynamic styling based on physical card state
  let cardStyles = 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xs';
  if (card.isSorted) {
    cardStyles = 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-100 shadow-xs';
  } else if (isDragging) {
    cardStyles = 'bg-blue-50 dark:bg-blue-950/80 border-blue-600 text-blue-950 dark:text-blue-100 shadow-2xl ring-4 ring-blue-500/50 z-30';
  } else if (isDragHovered) {
    cardStyles = 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-500 text-indigo-950 dark:text-indigo-100 shadow-lg ring-3 ring-indigo-500/60 border-dashed scale-105';
  } else if (card.isMinimum) {
    cardStyles = 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500 text-amber-900 dark:text-amber-100 shadow-md ring-2 ring-amber-400/40';
  } else if (card.isCurrent) {
    cardStyles = 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 dark:border-indigo-400 text-indigo-900 dark:text-indigo-100 shadow-md ring-2 ring-indigo-500/40';
  } else if (isDragCandidate) {
    cardStyles = 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-900 dark:text-blue-100 shadow-lg ring-3 ring-blue-500/50';
  } else if (isPairHighlighted || isSelected) {
    cardStyles = 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-400 dark:border-blue-500 text-blue-950 dark:text-blue-100 shadow-md ring-2 ring-blue-400/50';
  } else if (isDropTarget) {
    cardStyles = 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-400 text-blue-900 dark:text-blue-100 border-dashed border-2';
  }

  const findTargetCardIndex = (clientX: number, clientY: number, dx: number): number | null => {
    const cardEls = document.querySelectorAll('[data-sort-card-index]');
    let closestIdx: number | null = null;
    let minDistance = Infinity;

    cardEls.forEach((el) => {
      const idxAttr = el.getAttribute('data-sort-card-index');
      if (idxAttr === null) return;
      const targetIdx = parseInt(idxAttr, 10);
      if (isNaN(targetIdx) || targetIdx === index) return;

      const rect = el.getBoundingClientRect();
      // Direct hit check
      if (
        clientX >= rect.left - 12 &&
        clientX <= rect.right + 12 &&
        clientY >= rect.top - 30 &&
        clientY <= rect.bottom + 30
      ) {
        const centerX = rect.left + rect.width / 2;
        const dist = Math.abs(clientX - centerX);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = targetIdx;
        }
      }
    });

    // If user dragged left-to-right or right-to-left enough (≥ 32px), default to neighbor in that direction
    if (closestIdx === null && Math.abs(dx) >= 32) {
      const neighborIdx = dx > 0 ? index + 1 : index - 1;
      const neighborEl = document.querySelector(`[data-sort-card-index="${neighborIdx}"]`);
      if (neighborEl) {
        closestIdx = neighborIdx;
      }
    }

    return closestIdx;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (card.isSorted || !onDragSwap) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
    hoveredTargetRef.current = null;
    setDragOffset({ x: 0, y: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || !onDragSwap) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (!dragStartRef.current.moved && Math.hypot(dx, dy) > 6) {
      dragStartRef.current.moved = true;
      setIsDragging(true);
      onDragStart?.();
    }

    if (dragStartRef.current.moved) {
      setDragOffset({ x: dx, y: dy * 0.35 });
      const targetIdx = findTargetCardIndex(e.clientX, e.clientY, dx);
      if (hoveredTargetRef.current !== targetIdx) {
        hoveredTargetRef.current = targetIdx;
        onDragHoverIndex?.(targetIdx);
      }
    }
  };

  const finishPointerDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore pointer capture release errors
    }

    const wasMoved = dragStartRef.current.moved;
    const dx = e.clientX - dragStartRef.current.x;
    const targetIdx = wasMoved
      ? hoveredTargetRef.current ?? findTargetCardIndex(e.clientX, e.clientY, dx)
      : null;

    dragStartRef.current = null;
    hoveredTargetRef.current = null;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    onDragHoverIndex?.(null);
    onDragEnd?.();

    if (wasMoved && targetIdx !== null && targetIdx !== index && onDragSwap) {
      onDragSwap(index, targetIdx);
    } else if (!wasMoved) {
      onCardClick?.();
    }
  };

  return (
    <motion.div
      layout={!isDragging}
      layoutId={card.id}
      animate={{
        x: isDragging ? dragOffset.x : 0,
        y: isDragging ? dragOffset.y - 6 : 0,
        scale: isDragging ? 1.08 : isDragHovered ? 1.04 : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 26,
        mass: 0.75,
      }}
      whileHover={!card.isSorted && !isDragging ? { y: -4, scale: 1.02 } : {}}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      onPointerCancel={finishPointerDrag}
      onClick={() => {
        if (!onDragSwap) {
          onCardClick?.();
        }
      }}
      data-sort-card-index={index}
      style={{ touchAction: onDragSwap && !card.isSorted ? 'none' : 'auto' }}
      className={`relative select-none flex flex-col items-center justify-between p-3 sm:p-4 w-18 sm:w-22 h-26 sm:h-32 rounded-2xl border-2 transition-colors ${
        card.isSorted ? 'cursor-default' : onDragSwap ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } shrink-0 ${cardStyles}`}
      id={`card-${card.id}`}
    >
      {/* Top Bar: Index & Status Tag */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono pointer-events-none">
        <span className="text-slate-400 dark:text-slate-500 font-bold">
          #{index}
        </span>
        {card.isSorted ? (
          <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
        ) : isDragCandidate || isDragging ? (
          <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        ) : (
          <span className="text-[9px] font-mono text-slate-400">id:{card.id.split('-')[1]}</span>
        )}
      </div>

      {/* Center: Large Card Value */}
      <div className="flex flex-col items-center justify-center my-auto pointer-events-none">
        <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight leading-none">
          {card.value}
        </span>
      </div>

      {/* Bottom: State Label Badge */}
      <div className="w-full flex justify-center pointer-events-none">
        {badgeLabel ? (
          <span
            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md leading-none ${
              card.isSorted
                ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300'
                : isDragging || isDragCandidate
                ? 'bg-blue-600 text-white'
                : isDragHovered
                ? 'bg-indigo-600 text-white'
                : card.isMinimum
                ? 'bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200'
                : card.isCurrent
                ? 'bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200'
                : 'bg-blue-100 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300'
            }`}
          >
            {badgeLabel}
          </span>
        ) : (
          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold">
            Unsorted
          </span>
        )}
      </div>

      {/* Visual lock watermark for sorted items */}
      {card.isSorted && (
        <div className="absolute top-1.5 right-1.5 opacity-20 pointer-events-none">
          <Lock className="w-4 h-4 text-emerald-600" />
        </div>
      )}
    </motion.div>
  );
};

