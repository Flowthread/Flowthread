import React from 'react';

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: 'full' | 'icon';
  className?: string;
}

export function Logo({ variant = 'full', className, ...props }: LogoProps) {
  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        {...props}
      >
        <rect width="100" height="100" rx="24" fill="#2D7AFF" />
        <path d="M32 30H68V38H42V48H62V56H42V70H32V30Z" fill="white" />
        <path d="M54 48H78V56H68V70H58V56H54V48Z" fill="white" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 450 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <rect x="20" y="20" width="80" height="80" rx="20" fill="#2D7AFF" />
      <path d="M38 42H62V48H46V56H58V62H46V78H38V42Z" fill="white" />
      <path d="M52 56H72V62H64V78H56V62H52V56Z" fill="white" />
      <text
        x="120"
        y="75"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="48"
        fontWeight="700"
        fill="currentColor"
      >
        FlowThread
      </text>
      <text
        x="120"
        y="100"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="16"
        fontWeight="400"
        fill="currentColor"
        opacity="0.6"
      >
        Where conversations become work
      </text>
    </svg>
  );
}
