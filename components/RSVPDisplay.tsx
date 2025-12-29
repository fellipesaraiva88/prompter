
import React, { useMemo } from 'react';

interface RSVPDisplayProps {
  word: string;
  fontSize: number;
  showOrp: boolean;
}

const RSVPDisplay: React.FC<RSVPDisplayProps> = ({ word, fontSize, showOrp }) => {
  const renderedWord = useMemo(() => {
    if (!word) return null;
    if (!showOrp) return <span>{word}</span>;

    // ORP (Optimal Recognition Point) calculation
    // Usually the 2nd letter for short words, or slightly left of center for longer ones.
    let orpIndex = 0;
    if (word.length > 1) {
      orpIndex = Math.floor((word.length - 1) / 2);
      if (word.length > 5) orpIndex = 2;
      if (word.length > 9) orpIndex = 3;
    }

    const before = word.substring(0, orpIndex);
    const focus = word.substring(orpIndex, orpIndex + 1);
    const after = word.substring(orpIndex + 1);

    return (
      <div className="flex justify-center items-center tracking-tight">
        <span className="text-right flex-1">{before}</span>
        <span className="text-red-500 orp-marker w-auto px-[1px]">{focus}</span>
        <span className="text-left flex-1">{after}</span>
      </div>
    );
  }, [word, showOrp]);

  return (
    <div 
      className="flex flex-col items-center justify-center w-full h-full select-none"
      style={{ fontSize: `${fontSize}px` }}
    >
      <div className="relative w-full max-w-4xl text-center font-bold font-['Inter'] leading-none">
        {/* Alignment guides (subtle) */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 -translate-y-1/2 pointer-events-none"></div>
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/5 -translate-x-1/2 pointer-events-none"></div>
        
        {/* The Word */}
        <div className="relative z-10 whitespace-pre">
          {renderedWord || <span className="opacity-20">PRONTO</span>}
        </div>
      </div>
    </div>
  );
};

export default RSVPDisplay;
