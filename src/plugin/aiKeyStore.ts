import type { App } from 'obsidian';

interface SecretStorage {
  getSecret(id: string): Promise<string | null>;
  setSecret(id: string, secret: string): Promise<void>;
  deleteSecret(id: string): Promise<void>;
}

function secretStorage(app: App): SecretStorage | undefined {
  return (
    app as unknown as {
      secretStorage?: SecretStorage;
    }
  ).secretStorage;
}

export async function readAiApiKey(app: App): Promise<string | undefined> {
  const storage = secretStorage(app);
  if (!storage) return undefined;
  try {
    const value = await storage.getSecret('interestseed-ai-key');
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export async function saveAiApiKey(app: App, value: string): Promise<boolean> {
  const storage = secretStorage(app);
  if (!storage) return false;
  const trimmed = value.trim();
  try {
    if (trimmed) await storage.setSecret('interestseed-ai-key', trimmed);
    else await storage.deleteSecret('interestseed-ai-key');
    return true;
  } catch {
    return false;
  }
}
