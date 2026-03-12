#!/usr/bin/env python3

import argparse
import json
import sys

from youtube_transcript_api import YouTubeTranscriptApi


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("video_id")
    args = parser.parse_args()

    try:
      transcript = YouTubeTranscriptApi.get_transcript(
          args.video_id,
          languages=["pt-BR", "pt", "en", "es"],
      )
      print(json.dumps(transcript, ensure_ascii=False))
    except Exception as exc:
      print(json.dumps({"error": str(exc)}, ensure_ascii=False))
      sys.exit(1)


if __name__ == "__main__":
    main()
