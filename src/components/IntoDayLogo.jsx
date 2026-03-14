import { useId } from 'react';

function IntoDayLogo({
  showWordmark = true,
  className = '',
  iconClassName = '',
  labelClassName = '',
}) {
  const gradientId = useId();
  const paint0 = `${gradientId}-paint0`;
  const paint1 = `${gradientId}-paint1`;
  const paint2 = `${gradientId}-paint2`;

  return (
    <div className={className}>
      <svg
        width="29"
        height="26"
        viewBox="0 0 29 26"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={iconClassName}
        aria-hidden="true"
      >
        <ellipse cx="14.5" cy="18.729" rx="14.5" ry="7.25" fill={`url(#${paint0})`} />
        <ellipse cx="18.7292" cy="13.2917" rx="9.0625" ry="4.83333" fill={`url(#${paint1})`} />
        <ellipse cx="15.1041" cy="5.73958" rx="10.2708" ry="5.73958" fill={`url(#${paint2})`} />
        <defs>
          <linearGradient id={paint0} x1="14.5" y1="11.479" x2="14.5" y2="30.8123" gradientUnits="userSpaceOnUse">
            <stop stopColor="#625F57" />
            <stop offset="1" stopColor="#C8C1B2" />
          </linearGradient>
          <linearGradient id={paint1} x1="18.7292" y1="8.45837" x2="18.7292" y2="26.2813" gradientUnits="userSpaceOnUse">
            <stop stopColor="#707070" />
            <stop offset="1" />
          </linearGradient>
          <linearGradient id={paint2} x1="15.1041" y1="0" x2="15.1041" y2="17.2187" gradientUnits="userSpaceOnUse">
            <stop offset="0.182692" stopColor="#E6D2A8" />
            <stop offset="1" stopColor="#80755D" />
          </linearGradient>
        </defs>
      </svg>

      {showWordmark ? <span className={labelClassName}>IntoDay</span> : null}
    </div>
  );
}

export default IntoDayLogo;
