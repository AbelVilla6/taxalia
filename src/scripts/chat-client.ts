export interface ChatConfig {
  apiBase: string;
  lang: 'en' | 'es';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  warning?: string;
}

export interface InitOptions {
  mount?: string;
  config?: string;
  timeoutMs?: number;
}

interface ServerSseEvent {
  delta?: string;
  done?: boolean;
  agents?: unknown[];
  warning?: string;
  error?: { code?: string; message?: string };
  requestId?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const CONFIG_WAIT_MS = 1_000;

function isChatConfig(value: unknown): value is ChatConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.apiBase === 'string' && (v.lang === 'en' || v.lang === 'es');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function waitForElement<T extends Element>(selector: string, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const found = document.querySelector<T>(selector);
    if (found) {
      resolve(found);
      return;
    }
    const start = Date.now();
    const observer = new MutationObserver(() => {
      const el = document.querySelector<T>(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      } else if (Date.now() - start >= timeoutMs) {
        observer.disconnect();
        resolve(null);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector<T>(selector));
    }, timeoutMs);
  });
}

function readConfig(scriptEl: HTMLScriptElement | null): ChatConfig | null {
  if (!scriptEl) return null;
  const raw = scriptEl.textContent?.trim();
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isChatConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

interface ActiveRequest {
  controller: AbortController;
  timeoutId: number;
}

export function init(options: InitOptions = {}): void {
  const mountSelector = options.mount ?? '#chat-widget';
  const configSelector = options.config ?? '#chat-config';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  void (async () => {
    const mount = await waitForElement<HTMLElement>(mountSelector, CONFIG_WAIT_MS);
    if (!mount) {
      console.error('[chat-client] mount element not found:', mountSelector);
      return;
    }

    const widget = mount.id === 'chat-widget' ? mount : mount.closest('#chat-widget') ?? mount;
    const configEl = await waitForElement<HTMLScriptElement>(configSelector, CONFIG_WAIT_MS);
    const config = readConfig(configEl);
    if (!config) {
      console.error('[chat-client] chat-config block missing or invalid:', configSelector);
      return;
    }

    const messagesEl = widget.querySelector<HTMLElement>('#chat-messages');
    const formEl = widget.querySelector<HTMLFormElement>('#chat-form');
    const inputEl = widget.querySelector<HTMLInputElement>('#chat-text');
    const sendEl = widget.querySelector<HTMLButtonElement>('#chat-send');
    const closeEl = widget.querySelector<HTMLButtonElement>('#chat-close');
    const typingEl = widget.querySelector<HTMLElement>('#chat-typing');
    const errorEl = widget.querySelector<HTMLElement>('#chat-error');

    if (!messagesEl || !formEl || !inputEl || !sendEl || !closeEl || !typingEl || !errorEl) {
      console.error('[chat-client] required widget sub-elements missing');
      return;
    }

    let active: ActiveRequest | null = null;
    const history: ChatMessage[] = [];
    const partialCopy = widget.dataset.chatPartial ?? 'Some answers may be incomplete.';

    const setBusy = (busy: boolean): void => {
      sendEl.disabled = busy || inputEl.value.trim().length === 0;
      inputEl.readOnly = busy;
    };

    const showTyping = (show: boolean): void => {
      typingEl.hidden = !show;
    };

    const showError = (message: string): void => {
      errorEl.textContent = message;
      errorEl.hidden = false;
    };

    const clearError = (): void => {
      errorEl.textContent = '';
      errorEl.hidden = true;
    };

    const appendMessage = (msg: ChatMessage): HTMLElement => {
      const el = document.createElement('div');
      el.className = `chat-msg chat-msg--${msg.role}`;
      const bubble = document.createElement('p');
      bubble.className = 'chat-msg-bubble';
      bubble.textContent = msg.content;
      el.appendChild(bubble);

      if (msg.warning) {
        const badge = document.createElement('p');
        badge.className = 'chat-msg-warning';
        badge.textContent = msg.warning;
        el.appendChild(badge);
      }

      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return el;
    };

    const updateSendState = (): void => {
      if (!active) {
        sendEl.disabled = inputEl.value.trim().length === 0;
      }
    };

    const cancelActive = (): void => {
      if (!active) return;
      window.clearTimeout(active.timeoutId);
      active.controller.abort();
      active = null;
    };

    const resetAssistant = (assistantEl: HTMLElement): void => {
      const bubble = assistantEl.querySelector<HTMLElement>('.chat-msg-bubble');
      if (bubble) bubble.textContent = '';
    };

    const parseSseChunk = (rawChunk: string): ServerSseEvent[] => {
      const events: ServerSseEvent[] = [];
      const lines = rawChunk.split('\n');
      let data = '';

      const pushData = (): void => {
        if (!data) return;
        try {
          const parsed: unknown = JSON.parse(data);
          if (parsed && typeof parsed === 'object') {
            events.push(parsed as ServerSseEvent);
          }
        } catch {
          // Ignore malformed payloads; backend may include non-JSON keep-alives.
        }
        data = '';
      };

      for (const line of lines) {
        const normalizedLine = line.replace(/\r$/, '');
        if (normalizedLine.startsWith('data:')) {
          data += normalizedLine.slice(5).trim();
        } else if (normalizedLine === '') {
          pushData();
        }
      }

      pushData();
      return events;
    };

    const send = async (text: string): Promise<void> => {
      if (active) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      clearError();
      const userMsg: ChatMessage = { role: 'user', content: trimmed };
      history.push(userMsg);
      appendMessage(userMsg);

      const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
      history.push(assistantMsg);
      const assistantEl = appendMessage(assistantMsg);
      const assistantBubble = assistantEl.querySelector<HTMLElement>('.chat-msg-bubble');
      if (!assistantBubble) return;

      const controller = new AbortController();
      const requestId = crypto.randomUUID();
      const startedAt = performance.now();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
        showError('Sorry, the request timed out. Please try again.');
        if (assistantBubble.textContent === '') {
          assistantEl.remove();
          history.pop();
        }
        showTyping(false);
        setBusy(false);
        inputEl.value = '';
        updateSendState();
        active = null;
      }, timeoutMs);
      active = { controller, timeoutId };

      setBusy(true);
      showTyping(true);

      try {
        const response = await fetch(`${config.apiBase.replace(/\/+$/, '')}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            'X-Request-Id': requestId,
          },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            lang: config.lang,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          showError('Sorry, something went wrong. Please try again.');
          assistantEl.remove();
          history.pop();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let gotAnyDelta = false;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            for (const event of parseSseChunk(part)) {
              if (typeof event.delta === 'string' && event.delta.length > 0) {
                assistantBubble.textContent += event.delta;
                messagesEl.scrollTop = messagesEl.scrollHeight;
                gotAnyDelta = true;
              }
              if (event.done) {
                if (typeof event.warning === 'string' && event.warning.length > 0) {
                  const badge = document.createElement('p');
                  badge.className = 'chat-msg-warning';
                  badge.textContent = event.warning;
                  assistantEl.appendChild(badge);
                  assistantMsg.warning = event.warning;
                }
                const latencyMs = Math.round(performance.now() - startedAt);
                console.info(
                  `[chat-client] requestId=${requestId} latencyMs=${latencyMs} outcome=done`,
                );
                return;
              }
              if (event.error && typeof event.error === 'object') {
                const code = event.error.code ?? 'STREAM_ERROR';
                showError(`Sorry, something went wrong. Please try again. (${code})`);
              }
            }
          }
        }

        if (!gotAnyDelta) {
          showError('Sorry, something went wrong. Please try again.');
          assistantEl.remove();
          history.pop();
        } else {
          // Stream ended without explicit done — log partial outcome, keep message.
          const latencyMs = Math.round(performance.now() - startedAt);
          console.info(
            `[chat-client] requestId=${requestId} latencyMs=${latencyMs} outcome=stream-end`,
          );
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') {
          return;
        }
        showError('Sorry, something went wrong. Please try again.');
        if (assistantBubble.textContent === '') {
          assistantEl.remove();
          history.pop();
        } else {
          const badge = document.createElement('p');
          badge.className = 'chat-msg-warning';
          badge.textContent = partialCopy;
          assistantEl.appendChild(badge);
        }
      } finally {
        window.clearTimeout(timeoutId);
        showTyping(false);
        setBusy(false);
        inputEl.value = '';
        updateSendState();
        active = null;
      }
    };

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = inputEl.value;
      if (!value.trim() || active) return;
      void send(value);
    });

    inputEl.addEventListener('input', updateSendState);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        formEl.requestSubmit();
      }
    });

    closeEl.addEventListener('click', () => {
      cancelActive();
      widget.remove();
    });

    void resetAssistant;
  })();
}
