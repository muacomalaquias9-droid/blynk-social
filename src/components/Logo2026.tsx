import blynkLogo from '@/assets/blynk-logo-new.png';

interface Logo2026Props {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo2026 = ({ className = '', size = 'md' }: Logo2026Props) => {
  const sizeClasses = {
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-12',
    xl: 'h-16',
  };

  return (
    <img 
      src={blynkLogo} 
      alt="Blynk" 
      className={`${sizeClasses[size]} w-auto object-contain ${className}`}
    />
  );
};

export default Logo2026;
