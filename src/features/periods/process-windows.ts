type ProcessWindowsResult = {
  opened: number;
  locked: number;
  emailErrors: Record<string, string>;
};

// Submission windows live on Schedule timestamps. There is no separate state to advance.
export async function processDueSubmissionWindows(_facilityId?: string): Promise<ProcessWindowsResult> {
  return { opened: 0, locked: 0, emailErrors: {} };
}

export async function syncSubmissionWindows(facilityId: string | null | undefined) {
  if (!facilityId) return;
  try {
    await processDueSubmissionWindows(facilityId);
  } catch (error) {
    console.error('syncSubmissionWindows', error);
  }
}
