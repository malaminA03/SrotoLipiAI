import React, { useState, useEffect } from 'react';

interface TypingEffectProps {
  text: string;
  speed?: number;
}

const TypingEffect: React.FC<TypingEffectProps> = ({ text, speed = 10 }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return <p className="whitespace-pre-wrap">{displayedText}</p>;
};

export default TypingEffect;
