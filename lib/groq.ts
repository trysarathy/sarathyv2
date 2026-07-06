import Groq, { APIConnectionError } from 'groq-sdk'

let client: Groq | null = null

/** Groq client using Node's native fetch — avoids groq-sdk's bundled node-fetch. */
export function getGroqClient(): Groq {
  if (!client) {
    client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      fetch: globalThis.fetch.bind(globalThis),
      maxRetries: 0,
    })
  }
  return client
}

export function isTransientGroqNetworkError(error: unknown): boolean {
  if (error instanceof APIConnectionError) return true

  const parts: string[] = []
  const codes: string[] = []

  const collect = (err: unknown) => {
    if (!err || typeof err !== 'object') {
      parts.push(String(err))
      return
    }
    const e = err as Error & { code?: string; cause?: unknown }
    if (e.message) parts.push(e.message)
    if (e.code) codes.push(e.code)
    if (e.cause) collect(e.cause)
  }

  collect(error)

  const haystack = parts.join(' ').toLowerCase()
  return (
    codes.includes('ECONNRESET') ||
    codes.includes('ECONNABORTED') ||
    codes.includes('ERR_STREAM_PREMATURE_CLOSE') ||
    haystack.includes('econnreset') ||
    haystack.includes('premature close') ||
    haystack.includes('err_stream_premature_close')
  )
}

type ChatCompletionParams = Parameters<Groq['chat']['completions']['create']>[0]
type ChatCompletionResult = Awaited<ReturnType<Groq['chat']['completions']['create']>>

/** Sarathy chat completion with one automatic retry on transient network failures. */
export async function createChatCompletionWithRetry(
  params: ChatCompletionParams & { stream?: false | undefined }
): Promise<Extract<ChatCompletionResult, { choices: unknown }>> {
  const groq = getGroqClient()
  try {
    return (await groq.chat.completions.create(params)) as Extract<
      ChatCompletionResult,
      { choices: unknown }
    >
  } catch (error) {
    if (!isTransientGroqNetworkError(error)) throw error
    console.warn('Groq chat completion transient error, retrying once:', error)
    return (await groq.chat.completions.create(params)) as Extract<
      ChatCompletionResult,
      { choices: unknown }
    >
  }
}
