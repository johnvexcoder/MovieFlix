"use client";

import { useId } from "react";

interface MovieFlixLogoProps {
  className?: string;
  size?: number;
}

/** Scalable ribbon mark; each instance owns its gradient IDs. */
export function MovieFlixLogo({ className = "h-8 w-8", size = 48 }: MovieFlixLogoProps) {
  const id = useId();
  return (
    <svg viewBox="0 0 240 240" width={size} height={size} fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      className={`movieflix-mark select-none ${className}`}>
      <defs>
        <linearGradient id={`${id}-ribbon`} x1="25" y1="70" x2="205" y2="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00eaff"/><stop offset=".28" stopColor="#0785ff"/>
          <stop offset=".51" stopColor="#9a22e8"/><stop offset=".7" stopColor="#ff249c"/>
          <stop offset=".86" stopColor="#ff8616"/><stop offset="1" stopColor="#fff36b"/>
        </linearGradient>
        <linearGradient id={`${id}-warm`} x1="90" y1="65" x2="165" y2="170" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff477"/><stop offset=".4" stopColor="#ff8a00"/><stop offset="1" stopColor="#ff199d"/>
        </linearGradient>
        <linearGradient id={`${id}-disc`} x1="100" y1="15" x2="155" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#02efff"/><stop offset=".5" stopColor="#096bd9"/><stop offset="1" stopColor="#5314a8"/>
        </linearGradient>
      </defs>
      <g className="movieflix-flames">
        <path d="M7 92 C43 99 61 57 101 41 C72 68 64 103 25 113 C39 104 44 98 47 91 C33 99 18 98 7 92Z" fill={`url(#${id}-warm)`}/>
        <path d="M4 121 C39 129 59 91 91 72 C71 96 59 127 22 139 C34 130 40 124 43 117 C29 125 15 125 4 121Z" fill={`url(#${id}-ribbon)`}/>
        <path d="M10 149 C37 155 55 127 76 111 C62 132 48 153 22 161 C30 155 35 151 38 146 C27 151 18 152 10 149Z" fill="#20caff"/>
      </g>
      <g className="movieflix-disc">
        <circle cx="139" cy="72" r="57" fill={`url(#${id}-disc)`} stroke="#daffff" strokeWidth="3"/>
        <path d="M104 49 l-6 11 M131 29 q8-2 15 0 M174 45 l6 12" stroke="#073071" strokeWidth="10" strokeLinecap="round"/>
        <path d="M104 46 l-6 11 M131 26 q8-2 15 0 M174 42 l6 12" stroke="#b8ffff" strokeWidth="5" strokeLinecap="round"/>
        <path d="M128 53 Q125 51 125 57 V91 Q125 97 131 93 L157 77 Q162 73 156 69Z" fill={`url(#${id}-warm)`} stroke="#352574" strokeWidth="3"/>
      </g>
      <path d="M23 222 L52 105 C59 76 81 62 96 91 L125 140 Q130 149 139 138 L180 83 C205 54 229 67 225 100 L209 184 Q204 221 174 222 L185 145 Q189 119 174 138 L140 175 Q122 194 108 171 L83 118 Q78 109 74 129 L59 191 Q52 222 23 222Z" fill={`url(#${id}-ribbon)`} stroke="#e3faff" strokeWidth="3"/>
      <path d="M83 104 Q90 91 100 112 L122 149 Q130 161 144 145 L183 100 Q207 74 219 87" stroke={`url(#${id}-warm)`} strokeWidth="15" strokeLinecap="round"/>
      <path d="M32 211 L62 108 Q69 86 81 86" stroke="#43eeff" strokeOpacity=".65" strokeWidth="5" strokeLinecap="round"/>
    </svg>
  );
}
