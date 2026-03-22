import { APP_ICON_SRC } from '../lib/brand';

type AppLogoProps = {
  className?: string;
  imageClassName?: string;
};

export default function AppLogo({ className = '', imageClassName = '' }: AppLogoProps) {
  const wrapperClassName = ['flex items-center justify-center overflow-hidden', className]
    .filter(Boolean)
    .join(' ');
  const logoClassName = ['h-full w-full object-contain scale-[1.12]', imageClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClassName}>
      <img src={APP_ICON_SRC} alt="MINSA Prep Logo" className={logoClassName} />
    </div>
  );
}
