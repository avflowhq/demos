/**
 * Minimal typings for the AVFlow Job document.
 *
 * These cover only the fields the demos use. The authoritative schema lives at
 * https://avflow.dev/concepts/job/ — consult it before adding fields.
 */

export type MediaType = 'audio' | 'video' | 'data';

export type SelectFilter = {
  mediaTypes?: MediaType[];
  identities?: string[];
  excludeIdentities?: string[];
  trackSources?: string[];
  trackNames?: string[];
  trackSids?: string[];
};

/** An edge into a node or sink. A bare string means "everything this consumer accepts". */
export type InputRef = string | { name: string; select?: SelectFilter };

export type Component<TType extends string, TConfig> = {
  name: string;
  type: TType;
  config: TConfig;
};

export type Source =
  | Component<'livekit', { serverUrl: string; token: string; select?: SelectFilter }>
  | Component<
      'web_capture',
      {
        url: string;
        viewport?: { width: number; height: number; deviceScaleFactor?: number };
        fps?: number;
        captureAudio?: boolean;
        captureElement?: string;
        waitForSelector?: { selector: string; timeout?: number };
        waitForTimeout?: number;
        bestAttempt?: boolean;
      }
    >
  | Component<
      'video_generator',
      { width?: number; height?: number; fps?: number; backgroundColor?: string }
    >;

export type Canvas = {
  width: number;
  height: number;
  fps?: number;
  backgroundColor?: string;
  /** "pixel" (default) or "ratio" — ratio lets regions use 0..1 fractions. */
  coordinateSystem?: 'pixel' | 'ratio';
};

export type MatchSource = {
  sourceName?: string;
  identity?: string;
  trackSid?: string;
  trackSource?: string;
  trackName?: string;
  index?: number;
};

export type RegionStyle = {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
};

export type Placeholder = {
  image?: { url?: string; fit?: string; borderRadius?: number; width?: number; height?: number };
  text?: { content?: string; position?: string; fontSize?: number; fontFamily?: string; color?: string };
};

export type Region = {
  name: string;
  source?: MatchSource;
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  zIndex?: number;
  fit?: 'cover' | 'contain' | 'fill';
  placeholder?: Placeholder;
  style?: RegionStyle;
};

export type Layout = {
  mode: 'grid' | 'speaker' | 'custom';
  common?: { borderRadius?: number; nameLabel?: Record<string, unknown> };
  grid?: { maxColumns?: number; gap?: number; fit?: 'cover' | 'contain' | 'fill' };
  speaker?: {
    /** Ordered rules; first match wins. Listing 'active_speaker' requires an audio_mixer in the job. */
    mainPriority?: Array<'screen_share' | 'active_speaker' | MatchSource>;
    mainRatio?: number;
    maxThumbnails?: number;
    thumbnailPosition?: 'top' | 'bottom' | 'left' | 'right';
  };
  custom?: { regions: Region[] };
};

export type EncodingConfig = {
  videoCodec?: 'h264' | 'h265' | 'vp8' | 'vp9' | 'av1';
  audioCodec?: 'aac' | 'opus';
  audioProfile?: string;
  videoBitrateBps?: number;
  audioBitrateBps?: number;
  keyframeIntervalSec?: number;
  enableBFrames?: boolean;
};

export type S3StorageConfig = {
  bucket: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  pathPrefix?: string;
  forcePathStyle?: boolean;
};

export type Node =
  | Component<'video_mixer', { canvas: Canvas; layout: Layout }>
  | Component<'audio_mixer', { sampleRate?: number; channels?: number }>
  /**
   * Omit `provider`/`providerConfig` to use platform-managed credentials.
   * Supplying both switches the node to BYOK; supplying one is rejected.
   */
  | Component<
      'asr',
      { language?: string; provider?: string; providerConfig?: Record<string, unknown> }
    >
  /** `translate` is platform-managed only — passing provider settings is rejected. */
  | Component<'translate', { targetLanguage: string; echoTargetLanguage?: boolean }>
  | Component<
      'voice_agent',
      {
        language?: string;
        instructions?: string;
        greeting?: string;
        voice?: string;
        interrupt?: boolean;
        provider?: string;
        providerConfig?: Record<string, unknown>;
      }
    >;

export type NodeWithInputs = Node & { inputs: InputRef[] };

export type Sink =
  | (Component<
      'rtmp_push',
      { urls: string[]; encoding?: EncodingConfig }
    > & { inputs: InputRef[] })
  | (Component<
      'livekit',
      {
        serverUrl: string;
        token: string;
        videoTrackName?: string;
        audioTrackName?: string;
        encoding?: EncodingConfig;
      }
    > & { inputs: InputRef[] })
  | (Component<
      'segment',
      {
        storageType: 's3' | 'local' | 'gcp' | 'azure';
        storageConfig: S3StorageConfig | Record<string, unknown>;
        format?: 'hls';
        segmentDurationSec?: number;
        maxPlaylistEntries?: number;
        caption?: { showSpeaker?: boolean };
        encoding?: EncodingConfig;
      }
    > & { inputs: InputRef[] });

export type Policies = {
  /** Hard stop. Max 24h. */
  maxDurationSec?: number;
  /** Stop after this long with no media. Default 60s, max 300s. */
  idleTimeoutSec?: number;
};

export type Job = {
  name: string;
  metadata?: Record<string, string>;
  sources: Source[];
  nodes?: NodeWithInputs[];
  sinks: Sink[];
  policies?: Policies;
};

export type JobStatus =
  | 'pending'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | (string & {});

export type JobResponse = Job & {
  id?: string;
  status?: JobStatus;
  createdAt?: string;
  updatedAt?: string;
  error?: string;
  componentStatus?: Record<string, unknown>;
  usage?: Record<string, unknown>;
};
