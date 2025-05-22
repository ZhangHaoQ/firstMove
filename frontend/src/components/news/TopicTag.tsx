"use client";
import Image from 'next/image';

interface TopicTagProps {
  text: string;
  onClick?: () => void;
}

export default function TopicTag({ text, onClick }: TopicTagProps) {
  return (
    <span 
      onClick={onClick}
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors ${onClick ? 'cursor-pointer' : ''}`}
    >
      <Image src="/bq.svg" alt="" width={10} height={10} className="mr-0.5" />
      {text}
    </span>
  );
} 