function getInitialPasswordFromEmail(email: string): string {
  return email.trim().toLowerCase().split('@')[0];
}

export { getInitialPasswordFromEmail };
