'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives?: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: {
    resultIndex: number
    results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } }
  }) => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

export type VoiceRecognitionError =
  | 'not-allowed'
  | 'no-speech'
  | 'network'
  | 'unsupported'
  | 'start-failed'
  | 'unknown'

/** Auto-stop after this much silence once the user has started speaking. */
const SILENCE_STOP_MS = 2000
/** RMS (0–1) above which we count audio as speech. */
const SPEECH_RMS_THRESHOLD = 0.02
/** Ignore leading silence — don't auto-stop until we've heard speech. */
const MIN_SPEECH_BEFORE_SILENCE_MS = 250
/** Safety cap so the mic never runs forever. */
const MAX_LISTEN_MS = 60_000

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null
}

/** Explicit mic permission probe (also used so first tap always prompts). */
export async function requestMicrophonePermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof navigator === 'undefined') return 'unsupported'
  if (!window.isSecureContext) return 'unsupported'
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return 'granted'
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied'
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'denied'
    return 'denied'
  }
}

export function isLikelyIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const isChromeOrCriOS = /CriOS|Chrome/.test(ua)
  const isFirefox = /FxiOS/.test(ua)
  return iOS && webkit && !isChromeOrCriOS && !isFirefox
}

/** Deep-link into Chrome on iOS/Android when possible. */
export function getOpenInChromeHref(): string {
  if (typeof window === 'undefined') return 'https://www.google.com/chrome/'
  const { host, pathname, search, hash, protocol } = window.location
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return `googlechromes://${host}${pathname}${search}${hash}`
  }
  if (/Android/i.test(navigator.userAgent)) {
    const url = encodeURIComponent(`${protocol}//${host}${pathname}${search}${hash}`)
    return `intent://${host}${pathname}${search}${hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${url};end`
  }
  return 'https://www.google.com/chrome/'
}

function mapSpeechError(code: string): VoiceRecognitionError {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'not-allowed'
  if (code === 'no-speech') return 'no-speech'
  if (code === 'network') return 'network'
  return 'unknown'
}

function computeRms(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buffer)
  let sum = 0
  for (let i = 0; i < buffer.length; i++) {
    const v = (buffer[i] - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / buffer.length)
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<VoiceRecognitionError | null>(null)
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>(
    'unknown'
  )

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const finalTranscriptRef = useRef('')
  const interimTranscriptRef = useRef('')
  /** User/session wants mic open — restart Chrome when it ends mid-utterance. */
  const wantListeningRef = useRef(false)
  const intentionalStopRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const silenceRafRef = useRef<number | null>(null)
  const lastSpeechAtRef = useRef(0)
  const speechStartedAtRef = useRef(0)
  const listenStartedAtRef = useRef(0)
  const supported = isSpeechRecognitionSupported()

  const foldInterimIntoFinal = useCallback(() => {
    if (interimTranscriptRef.current) {
      finalTranscriptRef.current = `${finalTranscriptRef.current}${interimTranscriptRef.current}`
      interimTranscriptRef.current = ''
      setTranscript(finalTranscriptRef.current)
      setInterimTranscript('')
    }
  }, [])

  const stopSilenceMonitor = useCallback(() => {
    if (silenceRafRef.current != null) {
      cancelAnimationFrame(silenceRafRef.current)
      silenceRafRef.current = null
    }
    analyserRef.current = null
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const finishListening = useCallback(() => {
    intentionalStopRef.current = true
    wantListeningRef.current = false
    foldInterimIntoFinal()
    stopSilenceMonitor()
    recognitionRef.current?.stop()
    // onend will clear isListening; force UI if stop is sync-noop
    setIsListening(false)
  }, [foldInterimIntoFinal, stopSilenceMonitor])

  const abortListening = useCallback(() => {
    intentionalStopRef.current = true
    wantListeningRef.current = false
    stopSilenceMonitor()
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setIsListening(false)
    interimTranscriptRef.current = ''
    setInterimTranscript('')
  }, [stopSilenceMonitor])

  const stopListening = useCallback(() => {
    finishListening()
  }, [finishListening])

  const startSilenceMonitor = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return

    const buffer = new Uint8Array(new ArrayBuffer(analyser.fftSize))
    lastSpeechAtRef.current = 0
    speechStartedAtRef.current = 0

    const tick = () => {
      if (!wantListeningRef.current || !analyserRef.current) return

      const now = Date.now()
      if (now - listenStartedAtRef.current > MAX_LISTEN_MS) {
        finishListening()
        return
      }

      const rms = computeRms(analyser, buffer)
      if (rms >= SPEECH_RMS_THRESHOLD) {
        if (!speechStartedAtRef.current) speechStartedAtRef.current = now
        lastSpeechAtRef.current = now
      } else if (
        speechStartedAtRef.current &&
        now - speechStartedAtRef.current >= MIN_SPEECH_BEFORE_SILENCE_MS &&
        lastSpeechAtRef.current &&
        now - lastSpeechAtRef.current >= SILENCE_STOP_MS
      ) {
        finishListening()
        return
      }

      // Fallback: speech API went quiet (no interim/final) after we had text
      const hasText =
        Boolean(finalTranscriptRef.current.trim()) || Boolean(interimTranscriptRef.current.trim())
      if (
        hasText &&
        lastSpeechAtRef.current &&
        now - lastSpeechAtRef.current >= SILENCE_STOP_MS
      ) {
        // Only use transcript-quiet fallback if analyser also sees silence
        if (rms < SPEECH_RMS_THRESHOLD) {
          finishListening()
          return
        }
      }

      silenceRafRef.current = requestAnimationFrame(tick)
    }

    silenceRafRef.current = requestAnimationFrame(tick)
  }, [finishListening])

  const attachRecognitionHandlers = useCallback(
    (recognition: SpeechRecognitionInstance) => {
      recognition.onstart = () => {
        if (wantListeningRef.current) setIsListening(true)
      }

      recognition.onresult = (event) => {
        let interim = ''
        let finalText = finalTranscriptRef.current

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          const chunk = result[0]?.transcript ?? ''
          if (result.isFinal) {
            finalText += chunk
          } else {
            interim += chunk
          }
        }

        finalTranscriptRef.current = finalText
        interimTranscriptRef.current = interim
        setTranscript(finalText)
        setInterimTranscript(interim)

        // Treat recognition activity as speech for silence timer
        if (finalText.trim() || interim.trim()) {
          const now = Date.now()
          if (!speechStartedAtRef.current) speechStartedAtRef.current = now
          lastSpeechAtRef.current = now
        }
      }

      recognition.onerror = (event) => {
        if (event.error === 'aborted') return
        if (event.error === 'no-speech') {
          // Keep listening until silence detector / user stops
          return
        }
        wantListeningRef.current = false
        stopSilenceMonitor()
        setError(mapSpeechError(event.error))
        setIsListening(false)
      }

      recognition.onend = () => {
        // Ignore stale sessions (aborted / replaced)
        if (recognitionRef.current !== recognition) return
        // Chrome often ends mid-phrase even with continuous=true — restart until silence/user stop
        if (wantListeningRef.current && !intentionalStopRef.current) {
          try {
            recognition.start()
            return
          } catch {
            // Already started or unavailable — fall through
          }
        }
        setIsListening(false)
        interimTranscriptRef.current = ''
        setInterimTranscript('')
      }
    },
    [stopSilenceMonitor]
  )

  const startListening = useCallback(async (): Promise<boolean> => {
    setError(null)

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError('unsupported')
      return false
    }

    abortListening()
    intentionalStopRef.current = false

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : ''
      setPermissionState(
        name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'denied' : 'denied'
      )
      setError(
        name === 'NotAllowedError' || name === 'PermissionDeniedError' ? 'not-allowed' : 'not-allowed'
      )
      setIsListening(false)
      return false
    }

    setPermissionState('granted')
    streamRef.current = stream

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        const ctx = new AudioCtx()
        await ctx.resume().catch(() => {})
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.5
        source.connect(analyser)
        audioCtxRef.current = ctx
        analyserRef.current = analyser
      }
    } catch {
      // Silence monitor optional — recognition still works; user can tap to stop
    }

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-SG'
    if (typeof recognition.maxAlternatives === 'number') {
      recognition.maxAlternatives = 1
    }

    finalTranscriptRef.current = ''
    interimTranscriptRef.current = ''
    setTranscript('')
    setInterimTranscript('')

    wantListeningRef.current = true
    listenStartedAtRef.current = Date.now()
    attachRecognitionHandlers(recognition)
    recognitionRef.current = recognition

    try {
      recognition.start()
      startSilenceMonitor()
      setIsListening(true)
      return true
    } catch {
      wantListeningRef.current = false
      stopSilenceMonitor()
      setError('start-failed')
      setIsListening(false)
      return false
    }
  }, [abortListening, attachRecognitionHandlers, startSilenceMonitor, stopSilenceMonitor])

  useEffect(() => {
    return () => {
      intentionalStopRef.current = true
      wantListeningRef.current = false
      stopSilenceMonitor()
      recognitionRef.current?.abort()
    }
  }, [stopSilenceMonitor])

  const getFullTranscript = useCallback(() => {
    const combined = `${finalTranscriptRef.current}${interimTranscriptRef.current}`.trim()
    return combined || transcript.trim()
  }, [transcript])

  return {
    supported,
    isListening,
    transcript,
    interimTranscript,
    error,
    permissionState,
    clearError: () => setError(null),
    startListening,
    stopListening,
    abortListening,
    getFullTranscript,
  }
}
