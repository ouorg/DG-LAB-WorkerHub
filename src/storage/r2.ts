export const waveformKey = (userId: string, templateId: string) => `waveforms/${userId}/${templateId}.json`;
export const exportKey = (userId: string, filename: string) => `exports/${userId}/${filename}`;
export const auditArchiveKey = (date: Date, deviceId: string) => `audit/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}/${deviceId}.jsonl`;

export async function putWaveform(bucket: R2Bucket, userId: string, templateId: string, pulses: unknown): Promise<string> {
  const key = waveformKey(userId, templateId);
  await bucket.put(key, JSON.stringify(pulses), { httpMetadata: { contentType: "application/json" } });
  return key;
}
