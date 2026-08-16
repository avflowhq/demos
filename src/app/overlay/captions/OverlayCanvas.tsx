'use client';

import { Room, RoomEvent, type Participant, type RemoteParticipant } from 'livekit-client';
import { useEffect, useRef } from 'react';

import { TOPIC, decodeCaption, mergeCaption, type Caption } from '@/lib/captions';

const WIDTH = 1080;
const HEIGHT = 1920;
const ACCENT = '#38bdf8';
const BOT_PREFIX = 'avflow-';

type Speaker = { identity: string; name: string; speaking: boolean };

/**
 * The frame `web_capture` records.
 *
 * `captureElement` calls `el.captureStream()`, which only exists on canvas and
 * media elements — so the whole scene is drawn here rather than laid out in
 * HTML. The canvas keeps its natural 1080x1920 because the Job omits
 * `viewport`; an explicit height above 1080 would be clamped down.
 *
 * The draw loop runs unconditionally: `captureStream` only produces frames when
 * the canvas is painted, so a static scene would stall the stream.
 */
export function OverlayCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captionsRef = useRef<Caption[]>([]);
  const speakersRef = useRef<Speaker[]>([]);
  const roomNameRef = useRef('');
  const connectedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomName = params.get('room')?.trim();
    if (!roomName) return;
    roomNameRef.current = roomName;

    const room = new Room();
    let disposed = false;

    const syncSpeakers = () => {
      const humans = [...room.remoteParticipants.values()].filter(
        (p: RemoteParticipant) => !p.identity.startsWith(BOT_PREFIX),
      );
      speakersRef.current = humans.map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
        speaking: p.isSpeaking,
      }));
    };

    room
      .on(RoomEvent.DataReceived, (payload: Uint8Array, _participant, _kind, topic) => {
        if (topic !== TOPIC.asr) return;
        const caption = decodeCaption(payload);
        if (caption) captionsRef.current = mergeCaption(captionsRef.current, caption, 8);
      })
      .on(RoomEvent.ParticipantConnected, syncSpeakers)
      .on(RoomEvent.ParticipantDisconnected, syncSpeakers)
      .on(RoomEvent.ActiveSpeakersChanged, (speaking: Participant[]) => {
        const active = new Set(speaking.map((p) => p.identity));
        syncSpeakers();
        speakersRef.current = speakersRef.current.map((s) => ({
          ...s,
          speaking: active.has(s.identity),
        }));
      });

    void (async () => {
      try {
        const res = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: roomName,
            identity: `overlay-${Date.now().toString(36)}`,
            name: 'Caption overlay',
            canPublish: false,
          }),
        });
        const body = (await res.json()) as { token?: string; serverUrl?: string };
        if (disposed || !body.token || !body.serverUrl) return;

        // Data messages are independent of track subscriptions, so the overlay
        // stays cheap by never subscribing to audio.
        await room.connect(body.serverUrl, body.token, { autoSubscribe: false });
        if (disposed) return;

        syncSpeakers();
        connectedRef.current = true;
        canvasRef.current?.setAttribute('data-ready', 'true');
      } catch (err) {
        console.error('[overlay] could not join room', err);
      }
    })();

    return () => {
      disposed = true;
      connectedRef.current = false;
      void room.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let frame = 0;
    const render = () => {
      drawScene(ctx, {
        roomName: roomNameRef.current,
        captions: captionsRef.current,
        speakers: speakersRef.current,
        connected: connectedRef.current,
        tick: performance.now(),
      });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      id="stage"
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className="mx-auto block h-dvh w-auto max-w-full"
    />
  );
}

type Scene = {
  roomName: string;
  captions: Caption[];
  speakers: Speaker[];
  connected: boolean;
  tick: number;
};

function drawScene(ctx: CanvasRenderingContext2D, scene: Scene) {
  drawBackground(ctx, scene.tick);
  drawHeader(ctx, scene);
  drawSpeakers(ctx, scene.speakers, scene.tick);
  drawCaptions(ctx, scene.captions, scene.connected);
}

function drawBackground(ctx: CanvasRenderingContext2D, tick: number) {
  const base = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  base.addColorStop(0, '#0b1224');
  base.addColorStop(0.55, '#070c18');
  base.addColorStop(1, '#03060e');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A slow drift keeps the encoder from seeing a frozen frame.
  const drift = Math.sin(tick / 4000) * 60;
  const glow = ctx.createRadialGradient(
    WIDTH / 2 + drift,
    HEIGHT * 0.32,
    0,
    WIDTH / 2,
    HEIGHT * 0.32,
    WIDTH * 0.85,
  );
  glow.addColorStop(0, 'rgba(56, 189, 248, 0.20)');
  glow.addColorStop(0.5, 'rgba(99, 102, 241, 0.10)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawHeader(ctx: CanvasRenderingContext2D, scene: Scene) {
  ctx.save();
  ctx.font = '600 34px system-ui, -apple-system, "PingFang SC", sans-serif';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
  ctx.textBaseline = 'middle';
  ctx.fillText('AVFLOW · LIVE AUDIO', 72, 140);

  ctx.font = '700 58px system-ui, -apple-system, "PingFang SC", sans-serif';
  ctx.fillStyle = '#f1f5f9';
  ctx.fillText(scene.roomName || 'voice room', 72, 216);

  const pillX = WIDTH - 72 - 150;
  ctx.beginPath();
  roundRect(ctx, pillX, 112, 150, 56, 28);
  ctx.fillStyle = scene.connected ? 'rgba(16, 185, 129, 0.18)' : 'rgba(148, 163, 184, 0.12)';
  ctx.fill();
  ctx.font = '700 28px system-ui, sans-serif';
  ctx.fillStyle = scene.connected ? '#34d399' : '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText(scene.connected ? 'LIVE' : 'WAIT', pillX + 75, 141);
  ctx.restore();
}

function drawSpeakers(ctx: CanvasRenderingContext2D, speakers: Speaker[], tick: number) {
  const top = 380;
  const columns = 2;
  const cellW = (WIDTH - 144) / columns;
  const cellH = 300;

  if (speakers.length === 0) {
    ctx.save();
    ctx.font = '400 38px system-ui, -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for speakers to join…', WIDTH / 2, top + 120);
    ctx.restore();
    return;
  }

  speakers.slice(0, 6).forEach((speaker, i) => {
    const cx = 72 + (i % columns) * cellW + cellW / 2;
    const cy = top + Math.floor(i / columns) * cellH + 110;
    const radius = 92;

    if (speaker.speaking) {
      const pulse = 1 + Math.sin(tick / 200) * 0.05;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * pulse + 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 8;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = speaker.speaking ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 41, 59, 0.75)';
    ctx.fill();
    ctx.strokeStyle = speaker.speaking ? ACCENT : 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 66px system-ui, -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(initials(speaker.name), cx, cy + 4);

    ctx.font = '500 32px system-ui, -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(203, 213, 225, 0.9)';
    ctx.fillText(truncate(speaker.name, 16), cx, cy + radius + 46);
    ctx.restore();
  });
}

function drawCaptions(ctx: CanvasRenderingContext2D, captions: Caption[], connected: boolean) {
  const panelTop = 1290;
  const panelH = HEIGHT - panelTop - 96;

  ctx.beginPath();
  roundRect(ctx, 60, panelTop, WIDTH - 120, panelH, 40);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.save();
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
  ctx.fillText('LIVE CAPTIONS', 108, panelTop + 56);

  const recent = captions.slice(-3);
  if (recent.length === 0) {
    ctx.font = '400 38px system-ui, -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.fillText(
      connected ? 'Listening…' : 'Connecting to the room…',
      108,
      panelTop + 140,
    );
    ctx.restore();
    return;
  }

  let y = panelTop + 130;
  const maxWidth = WIDTH - 216;

  recent.forEach((caption, index) => {
    const isLatest = index === recent.length - 1;
    ctx.fillStyle = isLatest ? '#f1f5f9' : 'rgba(148, 163, 184, 0.55)';

    if (caption.speaker) {
      ctx.font = '700 30px system-ui, -apple-system, "PingFang SC", sans-serif';
      ctx.fillStyle = isLatest ? ACCENT : 'rgba(56, 189, 248, 0.45)';
      ctx.fillText(caption.speaker, 108, y);
      y += 42;
      ctx.fillStyle = isLatest ? '#f1f5f9' : 'rgba(148, 163, 184, 0.55)';
    }

    ctx.font = `${isLatest ? '600' : '400'} ${isLatest ? 46 : 38}px system-ui, -apple-system, "PingFang SC", sans-serif`;
    for (const line of wrapText(ctx, caption.text, maxWidth).slice(0, 3)) {
      ctx.fillText(line, 108, y);
      y += isLatest ? 58 : 48;
    }
    y += 18;
  });

  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';

  // Splitting on characters rather than words keeps CJK, which has no spaces,
  // from overflowing the panel.
  for (const char of text) {
    const candidate = current + char;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = char.trimStart();
    } else {
      current = candidate;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function initials(name: string): string {
  const parts = name.split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (/[\u4e00-\u9fa5]/.test(name)) return name.slice(0, 1);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
