import {
  ModelProviderError,
  QWEN_CONFIG,
  resolveQwenApiKey,
} from '../services/ModelProvider';

export interface QwenChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Direct Qwen/DashScope chat adapter.
 *
 * This is deliberately not an agent runtime: no tools, no filesystem access,
 * no shell. The API key is read from the process environment and never stored
 * in the vault or rendered into the conversation.
 */
export class QwenChatClient {
  private abortController: AbortController | null = null;
  private disposed = false;

  async complete(messages: QwenChatMessage[]): Promise<string> {
    if (this.disposed) {
      throw new ModelProviderError('disabled', '千问会话已释放');
    }
    const apiKey = resolveQwenApiKey();
    if (!apiKey) {
      throw new ModelProviderError(
        'not-authorized',
        '未检测到千问密钥。请设置 DASHSCOPE_API_KEY 或 QWEN_API_KEY 后重启 Obsidian。',
      );
    }

    const controller = new AbortController();
    this.abortController = controller;
    const url = `${QWEN_CONFIG.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: QWEN_CONFIG.model,
          messages,
          temperature: 0.4,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ModelProviderError('aborted', '已停止千问请求');
      }
      throw new ModelProviderError(
        'network',
        error instanceof Error ? error.message : '无法连接千问平台',
      );
    } finally {
      if (this.abortController === controller) this.abortController = null;
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const suffix = detail ? `：${detail.slice(0, 180)}` : '';
      throw new ModelProviderError(
        response.status === 401 || response.status === 403 ? 'not-authorized' : 'http',
        `千问请求失败（HTTP ${response.status}）${suffix}`,
      );
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          choices?: Array<{ message?: { content?: unknown } }>;
        }
      | null;
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ModelProviderError('invalid-response', '千问返回了空响应');
    }
    return content.trim();
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  dispose(): void {
    this.cancel();
    this.disposed = true;
  }
}
