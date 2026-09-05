export type Mp3Audit = {
  codec: 'MP3 MPEG-1 Layer III';
  sampleRate: number;
  channels: number;
  frameCount: number;
  durationMs: number;
  encodedFrameCount: number;
  encoderDelay: number;
  endPadding: number;
};

const SAMPLE_RATES = [44100, 48000, 32000] as const;

function readSynchsafe(buffer: Buffer, offset: number): number {
  const bytes = buffer.subarray(offset, offset + 4);
  if (bytes.length !== 4 || bytes.some((byte) => byte > 0x7f)) {
    throw new Error('ID3v2 大小字段不是合法的 synchsafe 整数');
  }
  return (bytes[0] << 21) | (bytes[1] << 14) | (bytes[2] << 7) | bytes[3];
}

function firstFrameOffset(buffer: Buffer): number {
  if (buffer.subarray(0, 3).toString('ascii') !== 'ID3') return 0;
  if (buffer.length < 10) throw new Error('ID3v2 头部不完整');
  const footerBytes = (buffer[5] & 0x10) === 0 ? 0 : 10;
  return 10 + readSynchsafe(buffer, 6) + footerBytes;
}

function readXingFrames(buffer: Buffer, offset: number): {
  encodedFrames: number;
  delay: number;
  padding: number;
} {
  const tag = buffer.subarray(offset, offset + 4).toString('ascii');
  if (tag !== 'Info' && tag !== 'Xing') {
    throw new Error('首帧缺少 Info/Xing 头，无法确定解码时长');
  }
  const flags = buffer.readUInt32BE(offset + 4);
  if ((flags & 0x01) === 0) throw new Error('Info/Xing 头没有 frame count');

  let cursor = offset + 8;
  const encodedFrames = buffer.readUInt32BE(cursor);
  cursor += 4;
  if ((flags & 0x02) !== 0) cursor += 4;
  if ((flags & 0x04) !== 0) cursor += 100;
  if ((flags & 0x08) !== 0) cursor += 4;

  // LAME/Lavc tag 的 3 字节字段给出 gapless 解码需裁掉的前后样本数。
  const gaplessOffset = cursor + 21;
  if (gaplessOffset + 3 > buffer.length) throw new Error('编码器 gapless 字段不完整');
  const delay = (buffer[gaplessOffset] << 4) | (buffer[gaplessOffset + 1] >> 4);
  const padding = ((buffer[gaplessOffset + 1] & 0x0f) << 8) | buffer[gaplessOffset + 2];
  return { encodedFrames, delay, padding };
}

export function auditMp3(buffer: Buffer): Mp3Audit {
  const frameOffset = firstFrameOffset(buffer);
  if (frameOffset + 4 > buffer.length) throw new Error('找不到完整 MP3 帧头');
  const header = buffer.readUInt32BE(frameOffset);
  if ((header >>> 21) !== 0x07ff) throw new Error('首个音频帧同步字无效');

  const version = (header >>> 19) & 0x03;
  const layer = (header >>> 17) & 0x03;
  const sampleRateIndex = (header >>> 10) & 0x03;
  if (version !== 0x03 || layer !== 0x01 || sampleRateIndex === 0x03) {
    throw new Error('只接受带 Info/Xing 的 MPEG-1 Layer III 母带');
  }

  const sampleRate = SAMPLE_RATES[sampleRateIndex];
  const channelMode = (header >>> 6) & 0x03;
  const channels = channelMode === 0x03 ? 1 : 2;
  const crcBytes = ((header >>> 16) & 0x01) === 0 ? 2 : 0;
  const sideInfoBytes = channels === 1 ? 17 : 32;
  const xingOffset = frameOffset + 4 + crcBytes + sideInfoBytes;
  const { encodedFrames, delay, padding } = readXingFrames(buffer, xingOffset);
  const frameCount = encodedFrames * 1152 - delay - padding;
  if (!Number.isSafeInteger(frameCount) || frameCount <= 0) {
    throw new Error('gapless 信息产生了无效解码样本数');
  }

  return {
    codec: 'MP3 MPEG-1 Layer III',
    sampleRate,
    channels,
    frameCount,
    durationMs: Number(((frameCount / sampleRate) * 1000).toFixed(6)),
    encodedFrameCount: encodedFrames,
    encoderDelay: delay,
    endPadding: padding,
  };
}
