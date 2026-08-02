type CountdownTone = 1 | 2 | 3 | 4 | 5 | 10

let audioContextPromise: Promise<AudioContext | null> | null = null

interface ToneOptions {
  attack?: number
  endFrequency?: number
  releaseTail?: number
  destination?: AudioNode
}

interface NoiseBurstOptions {
  attack?: number
  filterType?: BiquadFilterType
  filterFrequency?: number
  filterQ?: number
  playbackRate?: number
  releaseTail?: number
  destination?: AudioNode
}

async function getAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') {
    return null
  }

  if (!audioContextPromise) {
    audioContextPromise = (async () => {
      const AudioContextCtor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext

      if (!AudioContextCtor) {
        return null
      }

      const context = new AudioContextCtor()

      if (context.state === 'suspended') {
        await context.resume().catch(() => undefined)
      }

      return context
    })()
  }

  const context = await audioContextPromise

  if (context?.state === 'suspended') {
    await context.resume().catch(() => undefined)
  }

  return context
}

function scheduleTone(
  context: AudioContext,
  startAt: number,
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType,
  options: ToneOptions = {},
): void {
  const {
    attack = 0.02,
    endFrequency = Math.max(120, frequency * 1.08),
    releaseTail = 0.03,
    destination = context.destination,
  } = options
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)
  oscillator.frequency.exponentialRampToValueAtTime(
    endFrequency,
    startAt + duration,
  )

  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  oscillator.connect(gain)
  gain.connect(destination)

  oscillator.start(startAt)
  oscillator.stop(startAt + duration + releaseTail)
}

function scheduleNoiseBurst(
  context: AudioContext,
  startAt: number,
  duration: number,
  volume: number,
  options: NoiseBurstOptions = {},
): void {
  const {
    attack = 0.01,
    filterType = 'highpass',
    filterFrequency = 1600,
    filterQ = 0.707,
    playbackRate = 1,
    releaseTail = 0.02,
    destination = context.destination,
  } = options
  const buffer = context.createBuffer(
    1,
    Math.max(1, Math.round(context.sampleRate * duration)),
    context.sampleRate,
  )
  const channel = buffer.getChannelData(0)

  for (let index = 0; index < channel.length; index += 1) {
    const fade = 1 - index / channel.length
    channel[index] = (Math.random() * 2 - 1) * fade
  }

  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()

  source.buffer = buffer
  source.playbackRate.setValueAtTime(playbackRate, startAt)
  filter.type = filterType
  filter.frequency.setValueAtTime(filterFrequency, startAt)
  filter.Q.setValueAtTime(filterQ, startAt)

  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(destination)

  source.start(startAt)
  source.stop(startAt + duration + releaseTail)
}

const COUNTDOWN_CHORDS: Record<CountdownTone, number[]> = {
  1: [880, 1174.66],
  2: [783.99, 1046.5],
  3: [698.46, 932.33],
  4: [659.25, 880],
  5: [587.33, 783.99],
  10: [523.25, 698.46],
}

export async function playCountdownCue(tick: number): Promise<void> {
  const context = await getAudioContext()

  if (!context) {
    return
  }

  const chord = COUNTDOWN_CHORDS[tick as CountdownTone] ?? [659.25, 987.77]
  const startAt = context.currentTime + 0.01

  scheduleTone(context, startAt, chord[0], 0.16, 0.05, 'triangle')
  scheduleTone(context, startAt + 0.02, chord[1], 0.18, 0.035, 'sine')
}

export async function playShutterCue(): Promise<void> {
  const context = await getAudioContext()

  if (!context) {
    return
  }

  const startAt = context.currentTime + 0.008

  // Layer a short mechanical snap, mirror slap, and closing curtain click
  // so the cue reads more like a camera shutter than a UI beep.
  scheduleNoiseBurst(context, startAt, 0.02, 0.16, {
    attack: 0.001,
    filterType: 'bandpass',
    filterFrequency: 1900,
    filterQ: 1.1,
  })
  scheduleTone(context, startAt, 220, 0.028, 0.07, 'triangle', {
    attack: 0.001,
    endFrequency: 160,
  })
  scheduleTone(context, startAt + 0.004, 1240, 0.022, 0.022, 'square', {
    attack: 0.001,
    endFrequency: 760,
  })

  scheduleNoiseBurst(context, startAt + 0.024, 0.055, 0.07, {
    attack: 0.002,
    filterType: 'highpass',
    filterFrequency: 2600,
    filterQ: 0.8,
    playbackRate: 1.15,
  })
  scheduleTone(context, startAt + 0.028, 420, 0.05, 0.04, 'triangle', {
    attack: 0.0015,
    endFrequency: 260,
  })

  scheduleNoiseBurst(context, startAt + 0.072, 0.03, 0.035, {
    attack: 0.001,
    filterType: 'bandpass',
    filterFrequency: 1250,
    filterQ: 1.6,
  })
  scheduleTone(context, startAt + 0.078, 300, 0.03, 0.024, 'sawtooth', {
    attack: 0.001,
    endFrequency: 190,
  })
}
