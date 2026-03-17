import os
import subprocess
import json
import re
from datetime import datetime, timedelta

# Configuration
VIDEO_DIR = "/Users/luizfernandotoledo/Desktop/clip metal"
AUDIO_FILE = "/Users/luizfernandotoledo/Desktop/clip metal/SURRENDER1.mp3"
OUTPUT_VIDEO = "/Users/luizfernandotoledo/Desktop/clip metal/SURRENDER_FINAL.mp4"
SUBTITLE_FILE = "/Users/luizfernandotoledo/Desktop/clip metal/subtitles.ass"

LYRICS_RAW = """
00:00:36,000 --> 00:00:40,000
No words

00:00:40,000 --> 00:00:44,000
False smiles

00:00:44,000 --> 00:00:48,000
Weird games

00:00:48,000 --> 00:00:52,000
Cold lies

00:00:52,000 --> 00:00:56,000
Surrender

00:00:56,000 --> 00:01:00,000
Deny

00:01:00,000 --> 00:01:04,000
Hidden envy

00:01:04,000 --> 00:01:06,000
Cruel patterns

00:01:06,000 --> 00:01:08,000
You became

00:01:08,000 --> 00:01:14,000
the storm you swore

00:01:14,000 --> 00:01:17,000
you'd never be.

00:01:17,000 --> 00:01:21,000
Your selfish twisted

00:01:21,000 --> 00:01:25,000
games now meets inside you

00:01:25,000 --> 00:01:30,000
Your cruel rising

00:01:30,000 --> 00:01:34,000
blame still meets inside you

00:01:34,000 --> 00:01:38,000
Your cold hollow

00:01:38,000 --> 00:01:41,000
shame always meets inside you

00:01:41,000 --> 00:01:46,000
Your dark spreading

00:01:46,000 --> 00:02:08,000
flame now meets inside you

00:02:08,000 --> 00:02:12,000
Broken echoes

00:02:12,000 --\> 00:02:16,000
Toxic circles

00:02:16,000 --\> 00:02:20,000
Silent poison

00:02:20,000 --\> 00:02:24,000
Fading morals

00:02:24,000 --\> 00:02:28,000
surrender

00:02:28,000 --\> 00:02:32,000
Deny

00:02:32,000 --\> 00:02:36,000
Harsh shadows

00:02:36,000 --\> 00:02:38,000
Endless chaos

00:02:38,000 --\> 00:02:46,000
You became the storm you swore

00:02:46,000 --\> 00:02:49,000
you'd never be.

00:02:49,000 --\> 00:02:53,000
Your selfish twisted

00:02:53,000 --\> 00:02:57,000
games now meets inside you

00:02:57,000 --\> 00:03:01,000
Your cruel rising

00:03:01,000 --\> 00:03:05,000
blame still meets inside you

00:03:05,000 --\> 00:03:09,000
Your cold hollow

00:03:09,000 --\> 00:03:13,000
shame always meets inside you

00:03:13,000 --\> 00:03:17,000
Your dark spreading

00:03:17,000 --\> 00:03:21,000
flame now meets inside you

00:03:21,000 --\> 00:03:24,000
Heyy,

00:03:24,000 --\> 00:03:28,000
you know the consequence

00:03:28,000 --\> 00:03:32,000
The violence of my mind

00:03:32,000 --\> 00:03:35,000
You know the time is now
"""

def get_duration(filename):
    result = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                             "format=duration", "-of",
                             "default=noprint_wrappers=1:nokey=1", filename],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT)
    return float(result.stdout)

def generate_ass_subtitles(lyrics_raw, output_path):
    # ASS Header
    # Base: White text, no box
    # Highlight: White text, black box
    ass_content = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Base,Arial,60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,5,10,10,100,1
Style: Highlight,Arial,60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,3,0,0,5,10,10,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    # Standardize lyrics input
    lyrics_raw = lyrics_raw.replace('\\>', '>')
    
    # Regex for timecodes
    pattern = re.compile(r'(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})\n(.*?)(?=\n\n|\n\d|$)', re.DOTALL)
    matches = pattern.findall(lyrics_raw)

    for start_raw, end_raw, text in matches:
        def to_ass_time(ts):
            h, m, s_ms = ts.split(':')
            s, ms = s_ms.split(',')
            return f"{int(h)}:{m}:{s}.{ms[:2]}"

        start_ass = to_ass_time(start_raw)
        end_ass = to_ass_time(end_raw)
        
        text = text.strip().replace('\n', ' ')
        words = text.split()
        if not words: continue

        # Layer 0: Static phrase in Background (semi-transparent white)
        ass_content += f"Dialogue: 0,{start_ass},{end_ass},Base,,0,0,0,,{{\\alpha&H80&}}{' '.join(words)}\n"

        # Layer 1: Words one by one with black box
        start_dt = datetime.strptime(start_raw, "%H:%M:%S,%f")
        end_dt = datetime.strptime(end_raw, "%H:%M:%S,%f")
        total_duration_ms = (end_dt - start_dt).total_seconds() * 1000
        word_duration_ms = total_duration_ms / len(words)

        for i in range(len(words)):
            w_start_dt = start_dt + timedelta(milliseconds=i * word_duration_ms)
            w_end_dt = w_start_dt + timedelta(milliseconds=word_duration_ms)
            
            # Format as H:MM:SS.CC (CC = centiseconds)
            w_start_ass = f"{w_start_dt.hour}:{w_start_dt.minute:02}:{w_start_dt.second:02}.{w_start_dt.microsecond // 10000:02d}"
            w_end_ass = f"{w_end_dt.hour}:{w_end_dt.minute:02}:{w_end_dt.second:02}.{w_end_dt.microsecond // 10000:02d}"
            
            # Construct line where all words are transparent except the current one
            line_parts = []
            for j in range(len(words)):
                if i == j:
                    line_parts.append(f"{{\\alpha&H00&}}{words[j]}")
                else:
                    line_parts.append(f"{{\\alpha&HFF&}}{words[j]}")
            
            highlight_text = " ".join(line_parts)
            ass_content += f"Dialogue: 1,{w_start_ass},{w_end_ass},Highlight,,0,0,0,,{highlight_text}\n"

    with open(output_path, "w") as f:
        f.write(ass_content)

def main():
    print("--- Starting Music Video Creation ---")
    
    # 1. Get audio duration
    audio_dur = get_duration(AUDIO_FILE)
    print(f"Audio duration: {audio_dur}s")

    # 2. List and get video durations
    videos = [os.path.join(VIDEO_DIR, f) for f in os.listdir(VIDEO_DIR) 
              if f.upper().endswith(".MP4") and os.path.join(VIDEO_DIR, f) != OUTPUT_VIDEO]
    videos.sort() # Ensure consistent order
    
    if not videos:
        print("No video files found!")
        return

    video_info = []
    total_video_dur = 0
    for v in videos:
        dur = get_duration(v)
        video_info.append((v, dur))
        total_video_dur += dur
    
    print(f"Total unique video duration: {total_video_dur}s")

    # 3. Create concatenation list
    # Use ffmpeg concat demuxer format
    concat_file = "/tmp/concat_list.txt"
    current_dur = 0
    with open(concat_file, "w") as f:
        while current_dur < audio_dur:
            for v, dur in video_info:
                f.write(f"file '{v}'\n")
                current_dur += dur
                if current_dur >= audio_dur:
                    break
    
    print(f"Final video duration will be approx {current_dur}s")

    # 4. Generate subtitles
    print("Generating subtitles...")
    generate_ass_subtitles(LYRICS_RAW, SUBTITLE_FILE)

    # 5. Run FFmpeg
    # - We use -t audio_dur to cut the video exactly at the audio end
    # - We scale to 1920x1080 and ensure 30fps for consistency
    # - Subtitles are burned in using 'ass' filter
    
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0", "-i", concat_file,
        "-i", AUDIO_FILE,
        "-vf", f"scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p,ass='{SUBTITLE_FILE}'",
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-c:a", "aac", "-b:a", "192k",
        "-map", "0:v:0", "-map", "1:a:0",
        "-t", str(audio_dur),
        OUTPUT_VIDEO
    ]
    
    print("Running FFmpeg... this may take a few minutes.")
    subprocess.run(cmd, check=True)
    print(f"Done! Final video saved to: {OUTPUT_VIDEO}")

if __name__ == "__main__":
    main()
