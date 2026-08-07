export const hoaEmail = "pchoa66030@gmail.com";

export function gmailComposeUrl(subject?: string, body?: string) {
  const parameters = [
    "view=cm",
    "fs=1",
    `to=${encodeURIComponent(hoaEmail)}`,
  ];

  if (subject) parameters.push(`su=${encodeURIComponent(subject)}`);
  if (body) parameters.push(`body=${encodeURIComponent(body)}`);

  return `https://mail.google.com/mail/?${parameters.join("&")}`;
}

export function desktopEmailUrl(subject?: string, body?: string) {
  const parameters: string[] = [];

  if (subject) parameters.push(`subject=${encodeURIComponent(subject)}`);
  if (body) parameters.push(`body=${encodeURIComponent(body)}`);

  return `mailto:${hoaEmail}${parameters.length ? `?${parameters.join("&")}` : ""}`;
}
