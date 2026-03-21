export type PasswordChecks = {
  minLength: boolean;
  uppercase: boolean;
  number: boolean;
  lowercase: boolean;
  special: boolean;
  isSafe: boolean;
  score: number;
  label: string;
};

export function getPasswordChecks(password: string): PasswordChecks {
  const minLength = password.length >= 8;
  const uppercase = /[A-ZÁÉÍÓÚÑ]/.test(password);
  const number = /\d/.test(password);
  const lowercase = /[a-záéíóúñ]/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);

  const score =
    Number(minLength) +
    Number(uppercase) +
    Number(number) +
    Number(lowercase) +
    Number(special);

  let label = 'Muy débil';
  if (score >= 5) label = 'Fuerte';
  else if (score >= 4) label = 'Buena';
  else if (score >= 3) label = 'Aceptable';
  else if (score >= 2) label = 'Débil';

  return {
    minLength,
    uppercase,
    number,
    lowercase,
    special,
    isSafe: minLength && uppercase && number,
    score,
    label,
  };
}