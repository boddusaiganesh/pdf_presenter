import { useState, useEffect, useRef } from 'react';
import { BookOpen, X } from 'lucide-react';
import { useStore } from '../store/useStore';

interface SpeakerNotePanelProps {
  onClose: () => void;
}

export default function SpeakerNotePanel({ onClose }: SpeakerNotePanelProps) {
  const { currentSession, currentSlideIndex, updateNote } = useStore();
  const slides = currentSession?.slides || [];
  const currentSlide = slides[currentSlideIndex];
  const [content, setContent] = useState(currentSlide?.note.content || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setContent(currentSlide?.note.content || '');
  }, [currentSlideIndex, currentSlide?.note.content]);

  // Debounce note saves — capture slideId at call time so fast navigation
  // never saves content to the wrong slide.
  const handleChange = (value: string) => {
    setContent(value);
    // Capture the ID now — not inside the timeout closure
    const slideId = currentSlide?.id;
    if (!slideId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNote(slideId, value);
    }, 300);
  };

  if (!currentSlide) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span className="text-white/70 text-sm font-medium">Speaker Notes</span>
          <span className="text-white/30 text-xs">· Slide {currentSlideIndex + 1}</span>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-white rounded transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 p-3">
        <textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Add speaker notes for this slide..."
          className="w-full h-full resize-none bg-transparent text-white/70 text-sm leading-relaxed placeholder-white/20 focus:outline-none"
          spellCheck
        />
      </div>
      <div className="px-4 py-2 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-white/20 text-xs">{content.length} chars</span>
        <span className="text-white/20 text-xs">Not visible to students</span>
      </div>
    </div>
  );
}
